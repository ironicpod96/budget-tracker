export function parseCurrencyInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole = "", decimal = ""] = cleaned.split(".");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "") || "0";

  return decimal.length > 0
    ? `${normalizedWhole}.${decimal.slice(0, 2)}`
    : normalizedWhole;
}

export function formatCurrencyInput(value: string): string {
  if (!value) return "";

  const [whole = "", decimal] = value.split(".");
  const formattedWhole = Number(whole || 0).toLocaleString("en-MY");

  return decimal !== undefined ? `${formattedWhole}.${decimal}` : formattedWhole;
}
