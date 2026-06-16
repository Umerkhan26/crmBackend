export type PortalServiceFormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "select"
  | "date";

export interface PortalServiceFormField {
  name: string;
  label: string;
  type: PortalServiceFormFieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  sortOrder?: number;
}

export const normalizeFormFields = (
  raw: unknown
): PortalServiceFormField[] => {
  if (!Array.isArray(raw)) return [];

  const fields: PortalServiceFormField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name || "").trim();
    const label = String(row.label || "").trim();
    const type = String(row.type || "text") as PortalServiceFormFieldType;
    if (!name || !label) continue;

    const allowed: PortalServiceFormFieldType[] = [
      "text",
      "textarea",
      "email",
      "phone",
      "number",
      "select",
      "date",
    ];
    if (!allowed.includes(type)) continue;

    fields.push({
      name,
      label,
      type,
      required: Boolean(row.required),
      placeholder: row.placeholder ? String(row.placeholder) : undefined,
      options: Array.isArray(row.options)
        ? row.options.map((o) => String(o)).filter(Boolean)
        : undefined,
      sortOrder:
        row.sortOrder != null && Number.isFinite(Number(row.sortOrder))
          ? Number(row.sortOrder)
          : fields.length + 1,
    });
  }

  return fields.sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
};

export const slugifyServiceName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
