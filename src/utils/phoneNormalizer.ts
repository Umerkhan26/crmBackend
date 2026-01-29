/**
 * Normalizes phone numbers for duplicate checking
 * Removes spaces, dashes, parentheses, plus signs, and other non-digit characters
 * Keeps only digits for comparison
 */
export const normalizePhone = (phone: string | number | null | undefined): string => {
  if (!phone) return "";
  
  // Convert to string
  let phoneStr = String(phone).trim();
  
  if (!phoneStr) return "";
  
  // Remove all non-digit characters (spaces, dashes, parentheses, plus signs, etc.)
  phoneStr = phoneStr.replace(/\D/g, "");
  
  return phoneStr;
};

/**
 * Checks if two phone numbers are the same after normalization
 */
export const arePhonesEqual = (phone1: string | number | null | undefined, phone2: string | number | null | undefined): boolean => {
  const normalized1 = normalizePhone(phone1);
  const normalized2 = normalizePhone(phone2);
  
  if (!normalized1 || !normalized2) return false;
  
  return normalized1 === normalized2;
};
