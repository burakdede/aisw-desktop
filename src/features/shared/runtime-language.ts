export function normalizeRuntimeLanguage(text: string | null | undefined): string {
  if (!text) {
    return "";
  }

  return text
    .replace(/switching engine/g, "runtime")
    .replace(/Switching engine/g, "Runtime")
    .replace(/included engine/g, "included runtime")
    .replace(/Included engine/g, "Included runtime")
    .replace(/current engine/g, "current runtime")
    .replace(/Current engine/g, "Current runtime")
    .replace(/compatible engine/g, "compatible runtime")
    .replace(/Compatible engine/g, "Compatible runtime")
    .replace(/engine choice/g, "runtime choice")
    .replace(/Engine version details are unavailable/g, "Runtime version details are unavailable")
    .replace(/Engine capability details are unavailable/g, "Runtime capability details are unavailable")
    .replace(/AISW_HOME/g, "Data folder")
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
