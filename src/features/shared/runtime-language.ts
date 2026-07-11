export function normalizeRuntimeLanguage(text: string | null | undefined): string {
  if (!text) {
    return "";
  }

  return text
    .replace(/saved imported context/g, "saved shared group")
    .replace(/Saved imported context/g, "Saved shared group")
    .replace(/imported context/g, "shared group")
    .replace(/Imported context/g, "Shared group")
    .replace(/CLI context/g, "shared group")
    .replace(/cli context/g, "shared group");
}
