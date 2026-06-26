import {
  customerBrandedEmailTemplate,
} from "./customerBrandedEmailTemplate";
import {
  type CustomerEmailBrandTheme,
  buildCustomerEmailBrandTheme,
  getCustomerEmailBrandThemeFromBrand,
} from "../utils/customerEmailBrandTheme";
import Brand from "../models/brand.model";

const escapeHtml = (raw: string) =>
  raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatMoney = (amount: number): string => {
  const n = Number.isFinite(amount) ? amount : 0;
  return `$${n.toFixed(2)}`;
};

const formatInvoiceDate = (value?: Date | string | null): string => {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const invoiceStatusLabel = (status?: string | null): string => {
  const s = String(status || "pending").toLowerCase();
  if (s === "converted") return "Paid";
  if (s === "cancelled") return "Cancelled";
  return "Pending";
};

export type CustomerInvoiceEmailProduct = {
  productType?: string | null;
  price?: number | null;
  notes?: string | null;
};

export const customerInvoiceBoxHtml = (params: {
  theme: CustomerEmailBrandTheme;
  invoiceNumber: string;
  invoiceDate?: Date | string | null;
  saleId: number;
  status?: string | null;
  products: CustomerInvoiceEmailProduct[];
  totalAmount: number;
}): string => {
  const { theme } = params;
  const rows = params.products.length
    ? params.products
    : [{ productType: "Order", price: params.totalAmount, notes: null }];

  const lineRows = rows
    .map((item, index) => {
      const label = String(item.productType || "Item").trim() || "Item";
      const notes = String(item.notes || "").trim();
      const price = parseFloat(String(item.price ?? 0)) || 0;
      const border =
        index === 0 ? "" : "border-top:1px solid #f1f3f5;";
      return `
        <tr>
          <td style="padding:12px 0;font-size:14px;color:${theme.textColor};${border}">
            <strong>${escapeHtml(label)}</strong>
            ${notes ? `<br/><span style="font-size:12px;color:${theme.mutedColor};">${escapeHtml(notes)}</span>` : ""}
          </td>
          <td align="right" style="padding:12px 0;font-size:14px;font-weight:600;color:${theme.textColor};${border}">${formatMoney(price)}</td>
        </tr>`;
    })
    .join("");

  return `
    <p style="margin:0 0 16px 0;">Thank you for your order with <strong style="color:${theme.primaryColor};">${escapeHtml(theme.brandLabel)}</strong>. Your invoice summary is below.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;background:#ffffff;border:1px solid #e9ecef;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:14px 18px;background:${theme.primaryColor};color:#ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:13px;font-weight:600;">Invoice ${escapeHtml(params.invoiceNumber)}</td>
              <td align="right" style="font-size:12px;opacity:0.95;">Order #${params.saleId}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:0 0 10px;font-size:12px;color:${theme.mutedColor};width:33%;">Date</td>
              <td style="padding:0 0 10px;font-size:13px;font-weight:600;color:${theme.textColor};">${formatInvoiceDate(params.invoiceDate)}</td>
            </tr>
            <tr>
              <td style="padding:0 0 10px;font-size:12px;color:${theme.mutedColor};border-top:1px solid #f1f3f5;">Status</td>
              <td style="padding:10px 0 0;font-size:13px;font-weight:600;color:${theme.primaryColor};border-top:1px solid #f1f3f5;">${escapeHtml(invoiceStatusLabel(params.status))}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 18px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:10px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${theme.mutedColor};border-bottom:2px solid ${theme.primaryColor};">Description</td>
              <td align="right" style="padding:10px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${theme.mutedColor};border-bottom:2px solid ${theme.primaryColor};">Amount</td>
            </tr>
            ${lineRows}
            <tr>
              <td style="padding:14px 0 0;font-size:15px;font-weight:700;color:${theme.textColor};border-top:2px solid #e9ecef;">Total</td>
              <td align="right" style="padding:14px 0 0;font-size:18px;font-weight:700;color:${theme.primaryColor};border-top:2px solid #e9ecef;">${formatMoney(params.totalAmount)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:14px;color:${theme.mutedColor};">Sign in to your portal anytime to view, download, and track all your invoices.</p>
  `;
};

export const customerInvoiceEmailTemplate = (data: {
  firstname: string;
  lastname: string;
  theme?: CustomerEmailBrandTheme;
  brand?: Brand | null;
  portalUrl?: string;
  invoiceNumber: string;
  invoiceDate?: Date | string | null;
  saleId: number;
  status?: string | null;
  products: CustomerInvoiceEmailProduct[];
  totalAmount: number;
}): { subject: string; html: string } => {
  const theme =
    data.theme ||
    getCustomerEmailBrandThemeFromBrand(data.brand) ||
    buildCustomerEmailBrandTheme("gwb");

  const portalUrl = data.portalUrl || theme.portalUrl;
  const portalBase = portalUrl.startsWith("http") ? portalUrl : `https://${portalUrl}`;
  const invoicesUrl = `${portalBase.replace(/\/$/, "")}/invoices`;

  const fullName = [data.firstname, data.lastname]
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .join(" ");

  const subject = `Invoice ${data.invoiceNumber} from ${theme.brandLabel}`;

  const html = customerBrandedEmailTemplate({
    theme,
    title: "Your invoice",
    preheader: `${data.invoiceNumber} — total ${formatMoney(data.totalAmount)}`,
    greeting: fullName ? `Hello ${fullName},` : "Hello,",
    contentHtml: customerInvoiceBoxHtml({
      theme,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: data.invoiceDate,
      saleId: data.saleId,
      status: data.status,
      products: data.products,
      totalAmount: data.totalAmount,
    }),
    cta: {
      label: "View invoices in portal",
      url: invoicesUrl,
    },
  });

  return { subject, html };
};
