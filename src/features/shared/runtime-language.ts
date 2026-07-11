export function normalizeRuntimeLanguage(text: string | null | undefined): string {
  if (!text) {
    return "";
  }

  return text
    .replace(/AISW_HOME/g, "AI Switch data folder")
    .replace(/outside AISW/g, "outside AI Switch")
    .replace(/Outside AISW/g, "Outside AI Switch")
    .replace(/AISW cannot/g, "AI Switch cannot")
    .replace(/AISW Desktop/g, "AI Switch")
    .replace(/\bAISW\b/g, "AI Switch")
    .replace(/saved imported context/g, "saved shared group")
    .replace(/Saved imported context/g, "Saved shared group")
    .replace(/imported context/g, "shared group")
    .replace(/Imported context/g, "Shared group")
    .replace(/CLI context/g, "shared group")
    .replace(/cli context/g, "shared group");
}
