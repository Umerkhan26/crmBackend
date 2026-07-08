Add-Type -AssemblyName System.Drawing

function Upscale-Png {
    param(
        [string]$SrcPath,
        [string]$DstPath,
        [int]$Size
    )
    $tempPath = "$DstPath.tmp.png"
    $src = [System.Drawing.Image]::FromFile($SrcPath)
    $dst = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($dst)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.DrawImage($src, 0, 0, $Size, $Size)
    $dst.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $src.Dispose()
    $dst.Dispose()
    $g.Dispose()
    Move-Item -Force $tempPath $DstPath
    Write-Output "Upscaled $DstPath to ${Size}x${Size}"
}

$root = Split-Path $PSScriptRoot -Parent
$favicons = Join-Path $root "public\Favicons"
Upscale-Png (Join-Path $favicons "dnova.png") (Join-Path $favicons "dnova.png") 128
Upscale-Png (Join-Path $favicons "Looksforleeds.png") (Join-Path $favicons "Looksforleeds.png") 128
