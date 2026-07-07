export const CATEGORY_MAP: Record<string, string[]> = {
  "Assignment & Change of Control": [
    "Assignment (General)",
    "Assignment on Change of Control",
    "Assignment Termination Rights"
  ],
  "Compensation & Payment": [
    "Total Contract Value",
    "Annual Contract Value",
    "Payment Terms",
    "Can charge late payment fees?",
    "Late Payment Fee Percent",
    "Price Cap Increase percentage"
  ],
  "Confidentiality": [
    "Duration of Confidentiality"
  ],
  "Governing Law, Jurisdiction & Dispute Resolution": [
    "Governing Law",
    "Jurisdiction and Venue"
  ],
  "Limitation of Liability": [
    "Limitation of Liability Cap Amount",
    "Limitation of Liability Cap Multiplier",
    "Limitation of Liability Cap Duration"
  ],
  "Objective Information": [
    "Agreement Type",
    "Party Name",
    "Party Role (buyer/seller/etc.)",
    "Title",
    "Execution Date",
    "Languages",
    "NDA Type",
    "Line of Business"
  ],
  "Renewals": [
    "Auto Renewal (Y/N)",
    "Option to renew",
    "Renewal Term",
    "Renewal Notice Period",
    "Non-Renewal – Notice Period"
  ],
  "Term": [
    "Effective Date",
    "Expiration Date",
    "Term – Evergreen",
    "Term – Renewal Option",
    "Term Length (initial/overall term)"
  ],
  "Termination": [
    "Termination for Cause – Notice Period",
    "Termination for Convenience – Notice Period"
  ],
  "Payment Obligations": [
    "Payment Terms – Deposit or Initial Payment Amount",
    "Payment Terms – Deposit or Initial Payment Amount – Calculated",
    "Payment Terms – Deposit or Initial Payment – Date Due",
    "Payment Terms – Deposit or Initial Payment – Period Due",
    "Payment Terms – Late Payment Penalties",
    "Payment Terms – Late Payment Interest",
    "Payment Terms – One Time Payment Amount",
    "Payment Terms – One Time Payment – Date Due",
    "Payment Terms – One Time Payment – Period Due",
    "Party – Promissor"
  ]
};

export const OTHER_CATEGORY = "Other";

export function getCategoryForField(fieldName: string): string {
  const normalized = fieldName.trim().toLowerCase();
  for (const [category, fields] of Object.entries(CATEGORY_MAP)) {
    if (fields.some(f => f.trim().toLowerCase() === normalized)) {
      return category;
    }
  }
  return OTHER_CATEGORY;
}
