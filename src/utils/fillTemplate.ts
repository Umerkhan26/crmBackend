export function fillTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/{{(.*?)}}/g, (_, key) => {
    const trimmedKey = String(key).trim();
    const val = data[trimmedKey];
    return val != null ? String(val) : "";
  });
}
