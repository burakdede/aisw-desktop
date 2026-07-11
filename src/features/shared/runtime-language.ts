export function normalizeRuntimeLanguage(text: string | null | undefined): string {
  if (!text) {
    return "";
  }

  return text
    .replace(/AISW_HOME/g, "Desktop storage")
    .replace(/outside AISW/g, "outside AI Switch")
    .replace(/Outside AISW/g, "Outside AI Switch")
    .replace(/AISW cannot/g, "AI Switch cannot")
    .replace(/AISW Desktop/g, "AI Switch")
    .replace(/\bAISW\b/g, "AI Switch")
    .replace(/saved imported context/g, "saved imported set")
    .replace(/Saved imported context/g, "Saved imported set")
    .replace(/imported context/g, "imported set")
    .replace(/Imported context/g, "Imported set")
    .replace(/CLI context/g, "imported set")
    .replace(/cli context/g, "imported set");
}
