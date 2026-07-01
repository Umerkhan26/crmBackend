/** Merge optional CSS with inner HTML (injected inside branded template body only). */
export const mergeCustomerEmailInnerContent = (
  html: string,
  css?: string | null
): string => {
  const inner = String(html || "").trim();
  const styles = String(css || "").trim();
  if (!inner && !styles) return "";
  if (!styles) return inner;
  return `<style type="text/css">\n${styles}\n</style>\n${inner}`;
};
