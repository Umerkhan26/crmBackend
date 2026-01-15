import FormData from "form-data";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export interface TranscribeResult {
  text: string;
  raw?: any;
}

export interface TranscribeParams {
  audioBuffer: Buffer;
  filename: string;
  mimeType?: string;
  language?: string;
}

/**
 * Transcribe audio using self-hosted Whisper (Python)
 * Requires: pip install openai-whisper
 * Model options: tiny, base, small, medium, large
 */
export const transcribeWithSelfHostedWhisper = async (
  params: TranscribeParams
): Promise<TranscribeResult> => {
  const model = process.env.WHISPER_MODEL || "base";
  const whisperCommand = process.env.WHISPER_COMMAND || "whisper";
  const tempDir = os.tmpdir();
  const inputFile = path.join(tempDir, `audio_${Date.now()}_${params.filename}`);
  const outputFile = path.join(tempDir, `transcript_${Date.now()}.txt`);

  try {
    // Write audio buffer to temporary file
    await fs.promises.writeFile(inputFile, params.audioBuffer);

    // Build whisper command
    const languageFlag = params.language ? `--language ${params.language}` : "";
    const command = `${whisperCommand} "${inputFile}" --model ${model} --output_format txt --output_dir "${tempDir}" ${languageFlag}`;

    // Execute whisper
    const { stdout, stderr } = await execAsync(command);

    // Find the output file (whisper creates file with same name but .txt extension)
    const baseName = path.basename(inputFile, path.extname(inputFile));
    const whisperOutputFile = path.join(tempDir, `${baseName}.txt`);

    let transcript = "";
    if (fs.existsSync(whisperOutputFile)) {
      transcript = await fs.promises.readFile(whisperOutputFile, "utf-8");
      transcript = transcript.trim();
    } else {
      // Fallback: try to parse stdout
      transcript = stdout.trim() || stderr.trim() || "";
    }

    if (!transcript) {
      throw new Error("Whisper did not produce any transcript");
    }

    return {
      text: transcript,
      raw: { stdout, stderr, model },
    };
  } catch (error: any) {
    throw new Error(
      `Self-hosted Whisper transcription failed: ${error.message || error}`
    );
  } finally {
    // Cleanup temporary files
    try {
      if (fs.existsSync(inputFile)) await fs.promises.unlink(inputFile);
      if (fs.existsSync(outputFile)) await fs.promises.unlink(outputFile);
      // Clean up whisper output files
      const baseName = path.basename(inputFile, path.extname(inputFile));
      const whisperFiles = [
        path.join(tempDir, `${baseName}.txt`),
        path.join(tempDir, `${baseName}.vtt`),
        path.join(tempDir, `${baseName}.srt`),
        path.join(tempDir, `${baseName}.json`),
      ];
      for (const file of whisperFiles) {
        if (fs.existsSync(file)) await fs.promises.unlink(file);
      }
    } catch (cleanupError) {
      console.warn("Failed to cleanup temporary files:", cleanupError);
    }
  }
};

/**
 * Transcribe audio using OpenAI Whisper API (cloud-based)
 */
export const transcribeWithOpenAIWhisper = async (
  params: TranscribeParams
): Promise<TranscribeResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const form = new FormData();
  form.append("model", "whisper-1");
  if (params.language) form.append("language", params.language);
  form.append("response_format", "json");

  form.append("file", params.audioBuffer, {
    filename: params.filename,
    contentType: params.mimeType || "audio/webm",
  });

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form as any,
  });

  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      `OpenAI transcription failed (HTTP ${resp.status})`;
    throw new Error(msg);
  }

  return {
    text: data?.text || "",
    raw: data,
  } satisfies TranscribeResult;
};

/**
 * Main transcription function - uses self-hosted Whisper by default,
 * falls back to OpenAI API if USE_OPENAI_WHISPER=true
 */
export const transcribeAudio = async (
  params: TranscribeParams
): Promise<TranscribeResult> => {
  const useOpenAI = process.env.USE_OPENAI_WHISPER === "true";

  if (useOpenAI) {
    return await transcribeWithOpenAIWhisper(params);
  } else {
    return await transcribeWithSelfHostedWhisper(params);
  }
};

