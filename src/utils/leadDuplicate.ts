import { Op } from "sequelize";
import Lead from "../models/lead.model";
import IncomingLead from "../models/incomingLead.model";
import { extractEmailFromLeadData } from "./extractLeadContact";
import {
  extractPhoneRawFromLeadData,
  normalizeLeadDataInput,
} from "./normalizeLeadData";
import { normalizePhone } from "./phoneNormalizer";

export type DuplicateMatchField = "phone" | "email" | "image";
export type DuplicateState = "all" | "duplicate";

/** Campaign field aliases for Main Image (Open Leads / Fiverr Lead Reference). */
export const LEAD_DATA_IMAGE_KEYS: string[] = [
  "Main Image",
  "main_image",
  "mainImage",
  "MainImage",
  "MAIN_IMAGE",
  "image",
  "Image",
  "IMAGE",
  "photo",
  "Photo",
  "picture",
  "Picture",
];

const STRIP_BIDI = /[\u200e\u200f\u202a-\u202e]/g;

function normalizeKey(key: string): string {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function pickRawString(
  data: Record<string, unknown>,
  keys: string[],
): string {
  for (const key of keys) {
    const v = data[key];
    if (v == null) continue;
    const s = String(v).replace(STRIP_BIDI, "").trim();
    if (s.length > 0 && s.toUpperCase() !== "N/A") return s;
  }
  return "";
}

/** First non-empty main-image-like URL/path from leadData / payload. */
export function extractMainImageFromLeadData(leadData: unknown): string {
  const data = normalizeLeadDataInput(leadData);
  const fromKnown = pickRawString(data, LEAD_DATA_IMAGE_KEYS);
  if (fromKnown) return fromKnown;

  for (const key of Object.keys(data)) {
    const nk = normalizeKey(key);
    if (nk === "mainimage" || nk === "image" || nk.endsWith("mainimage")) {
      const v = data[key];
      if (v == null) continue;
      const s = String(v).replace(STRIP_BIDI, "").trim();
      if (s.length > 0 && s.toUpperCase() !== "N/A") return s;
    }
  }
  return "";
}

export function normalizeEmailForDuplicate(email: string | null | undefined): string {
  if (!email) return "";
  return String(email).trim().toLowerCase();
}

export function normalizeImageForDuplicate(image: string | null | undefined): string {
  if (!image) return "";
  return String(image).replace(STRIP_BIDI, "").trim().toLowerCase();
}

export type LeadDuplicateIdentity = {
  phone: string;
  email: string;
  mainImage: string;
};

export function extractLeadDuplicateIdentity(
  leadData: unknown,
): LeadDuplicateIdentity {
  const phone = normalizePhone(extractPhoneRawFromLeadData(leadData));
  const email = normalizeEmailForDuplicate(extractEmailFromLeadData(leadData));
  const mainImage = normalizeImageForDuplicate(
    extractMainImageFromLeadData(leadData),
  );
  return { phone, email, mainImage };
}

export type DuplicateLeadLike = {
  id: number | string;
  campaignName?: string | null;
  leadData?: unknown;
  payload?: unknown;
};

export type DuplicateAnnotation = {
  isDuplicate: boolean;
  duplicateCount: number;
  duplicateMatchOn: DuplicateMatchField[];
};

type CampaignIndex = {
  phoneToIds: Map<string, Set<string>>;
  emailToIds: Map<string, Set<string>>;
  imageToIds: Map<string, Set<string>>;
  idToIdentity: Map<string, LeadDuplicateIdentity>;
};

function rowDataBlob(row: DuplicateLeadLike): unknown {
  return row.leadData != null ? row.leadData : row.payload;
}

function campaignKey(name: string | null | undefined): string {
  return String(name || "").trim().toLowerCase() || "__none__";
}

function toIdKey(id: number | string): string {
  return String(id);
}

function addToIndex(
  map: Map<string, Set<string>>,
  value: string,
  idKey: string,
) {
  if (!value) return;
  let set = map.get(value);
  if (!set) {
    set = new Set();
    map.set(value, set);
  }
  set.add(idKey);
}

/** Build per-campaign indexes from identity rows (same campaign only). */
export function buildCampaignDuplicateIndexes(
  rows: DuplicateLeadLike[],
): Map<string, CampaignIndex> {
  const byCampaign = new Map<string, CampaignIndex>();

  for (const row of rows) {
    const ck = campaignKey(row.campaignName);
    let index = byCampaign.get(ck);
    if (!index) {
      index = {
        phoneToIds: new Map(),
        emailToIds: new Map(),
        imageToIds: new Map(),
        idToIdentity: new Map(),
      };
      byCampaign.set(ck, index);
    }

    const idKey = toIdKey(row.id);
    const identity = extractLeadDuplicateIdentity(rowDataBlob(row));
    index.idToIdentity.set(idKey, identity);
    addToIndex(index.phoneToIds, identity.phone, idKey);
    addToIndex(index.emailToIds, identity.email, idKey);
    addToIndex(index.imageToIds, identity.mainImage, idKey);
  }

  return byCampaign;
}

function annotationForId(
  index: CampaignIndex | undefined,
  idKey: string,
): DuplicateAnnotation {
  if (!index) {
    return { isDuplicate: false, duplicateCount: 0, duplicateMatchOn: [] };
  }
  const identity = index.idToIdentity.get(idKey);
  if (!identity) {
    return { isDuplicate: false, duplicateCount: 0, duplicateMatchOn: [] };
  }

  const related = new Set<string>();
  const matchOn: DuplicateMatchField[] = [];

  const pushMatches = (
    value: string,
    map: Map<string, Set<string>>,
    field: DuplicateMatchField,
  ) => {
    if (!value) return;
    const set = map.get(value);
    if (!set || set.size < 2) return;
    matchOn.push(field);
    for (const id of set) related.add(id);
  };

  pushMatches(identity.phone, index.phoneToIds, "phone");
  pushMatches(identity.email, index.emailToIds, "email");
  pushMatches(identity.mainImage, index.imageToIds, "image");

  const isDuplicate = matchOn.length > 0;
  return {
    isDuplicate,
    duplicateCount: isDuplicate ? Math.max(0, related.size - 1) : 0,
    duplicateMatchOn: matchOn,
  };
}

/** Annotate list rows with isDuplicate / duplicateCount / duplicateMatchOn. */
export function annotateLeadsWithDuplicates<T extends DuplicateLeadLike>(
  rows: T[],
  indexes: Map<string, CampaignIndex>,
): Array<T & DuplicateAnnotation> {
  return rows.map((row) => {
    const ck = campaignKey(row.campaignName);
    const ann = annotationForId(indexes.get(ck), toIdKey(row.id));
    return { ...row, ...ann };
  });
}

/** Numeric lead ids that are duplicates within their campaign. */
export function collectDuplicateNumericIds(
  indexes: Map<string, CampaignIndex>,
): number[] {
  const ids: number[] = [];
  for (const index of indexes.values()) {
    for (const idKey of index.idToIdentity.keys()) {
      const ann = annotationForId(index, idKey);
      if (!ann.isDuplicate) continue;
      const n = Number(idKey);
      if (Number.isFinite(n) && !String(idKey).startsWith("incoming-")) {
        ids.push(n);
      }
    }
  }
  return ids;
}

/** Incoming staging numeric ids that are duplicates within their campaign. */
export function collectDuplicateIncomingIds(
  indexes: Map<string, CampaignIndex>,
): number[] {
  const ids: number[] = [];
  for (const index of indexes.values()) {
    for (const idKey of index.idToIdentity.keys()) {
      const ann = annotationForId(index, idKey);
      if (!ann.isDuplicate) continue;
      const n = Number(idKey);
      if (Number.isFinite(n)) ids.push(n);
    }
  }
  return ids;
}

export function parseDuplicateState(raw: unknown): DuplicateState {
  const v = String(raw || "all").toLowerCase();
  return v === "duplicate" ? "duplicate" : "all";
}

/**
 * Load lead identity rows for duplicate detection (scoped).
 * Keep attributes minimal for memory.
 */
export async function loadLeadIdentityRows(where: Record<string, unknown>) {
  return Lead.findAll({
    attributes: ["id", "campaignName", "leadData"],
    where,
    raw: true,
  }) as Promise<
    Array<{ id: number; campaignName: string | null; leadData: unknown }>
  >;
}

export async function loadIncomingIdentityRows(where: Record<string, unknown>) {
  return IncomingLead.findAll({
    attributes: ["id", "campaignName", "payload"],
    where,
    raw: true,
  }) as Promise<
    Array<{ id: number; campaignName: string | null; payload: unknown }>
  >;
}

/**
 * Build Sequelize id filter for duplicateState=duplicate.
 * Returns null when duplicateState is all (no filter).
 * Returns empty Op.in when no duplicates found (forces empty result).
 */
export async function buildDuplicateIdWhereFilter(options: {
  duplicateState: DuplicateState;
  campaign?: string;
  baseWhere?: Record<string, unknown>;
}): Promise<Record<string, unknown> | null> {
  if (options.duplicateState !== "duplicate") return null;

  const where: Record<string, unknown> = { ...(options.baseWhere || {}) };
  if (options.campaign?.trim()) {
    where.campaignName = options.campaign.trim();
  }

  const identityRows = await loadLeadIdentityRows(where);
  const indexes = buildCampaignDuplicateIndexes(identityRows);
  const dupIds = collectDuplicateNumericIds(indexes);

  return {
    id: { [Op.in]: dupIds.length > 0 ? dupIds : [-1] },
  };
}

/** Enrich already-fetched lead rows (page) using campaign-scoped identity scan. */
export async function enrichLeadRowsWithDuplicates<T extends DuplicateLeadLike>(
  rows: T[],
  options?: { campaign?: string; baseWhere?: Record<string, unknown> },
): Promise<Array<T & DuplicateAnnotation>> {
  if (!rows.length) return rows.map((r) => ({
    ...r,
    isDuplicate: false,
    duplicateCount: 0,
    duplicateMatchOn: [] as DuplicateMatchField[],
  }));

  const campaigns = new Set<string>();
  if (options?.campaign?.trim()) {
    campaigns.add(options.campaign.trim());
  } else {
    for (const row of rows) {
      const name = String(row.campaignName || "").trim();
      if (name) campaigns.add(name);
    }
  }

  const where: Record<string, unknown> = { ...(options?.baseWhere || {}) };
  if (campaigns.size === 1) {
    where.campaignName = [...campaigns][0];
  } else if (campaigns.size > 1) {
    where.campaignName = { [Op.in]: [...campaigns] };
  }

  const identityRows = await loadLeadIdentityRows(where);
  const indexes = buildCampaignDuplicateIndexes(identityRows);
  return annotateLeadsWithDuplicates(rows, indexes);
}

/** Incoming staging: annotate + optional duplicate-only id set for filtering. */
export async function enrichIncomingRowsWithDuplicates<
  T extends DuplicateLeadLike,
>(
  rows: T[],
  options?: { campaignName?: string; baseWhere?: Record<string, unknown> },
): Promise<Array<T & DuplicateAnnotation>> {
  if (!rows.length) {
    return rows.map((r) => ({
      ...r,
      isDuplicate: false,
      duplicateCount: 0,
      duplicateMatchOn: [] as DuplicateMatchField[],
    }));
  }

  const where: Record<string, unknown> = { ...(options?.baseWhere || {}) };
  if (options?.campaignName?.trim()) {
    where.campaignName = options.campaignName.trim();
  } else {
    const campaigns = [
      ...new Set(
        rows
          .map((r) => String(r.campaignName || "").trim())
          .filter(Boolean),
      ),
    ];
    if (campaigns.length === 1) where.campaignName = campaigns[0];
    else if (campaigns.length > 1) where.campaignName = { [Op.in]: campaigns };
  }

  const identityRows = await loadIncomingIdentityRows(where);
  const indexes = buildCampaignDuplicateIndexes(
    identityRows.map((r) => ({
      id: r.id,
      campaignName: r.campaignName,
      payload: r.payload,
    })),
  );
  return annotateLeadsWithDuplicates(rows, indexes);
}

export async function getIncomingDuplicateIdSet(options: {
  campaignName?: string;
  baseWhere?: Record<string, unknown>;
}): Promise<Set<number>> {
  const where: Record<string, unknown> = { ...(options.baseWhere || {}) };
  if (options.campaignName?.trim()) {
    where.campaignName = options.campaignName.trim();
  }
  const identityRows = await loadIncomingIdentityRows(where);
  const indexes = buildCampaignDuplicateIndexes(
    identityRows.map((r) => ({
      id: r.id,
      campaignName: r.campaignName,
      payload: r.payload,
    })),
  );
  return new Set(collectDuplicateIncomingIds(indexes));
}
