export function normalizeRuntimeLanguage(text: string | null | undefined): string {
  if (!text) {
    return "";
  }

  return text
    .replace(/switching engine/g, "desktop engine")
    .replace(/Switching engine/g, "Desktop engine")
    .replace(/included engine/g, "included desktop engine")
    .replace(/Included engine/g, "Included desktop engine")
    .replace(/current engine/g, "current desktop engine")
    .replace(/Current engine/g, "Current desktop engine")
    .replace(/compatible engine/g, "compatible desktop engine")
    .replace(/Compatible engine/g, "Compatible desktop engine")
    .replace(/engine choice/g, "desktop engine choice")
    .replace(/Engine version details are unavailable/g, "Desktop engine version details are unavailable")
    .replace(/Engine capability details are unavailable/g, "Desktop engine capability details are unavailable")
    .replace(/AISW_HOME/g, "Data folder")
    .replace(/aisw desktop/g, "AI Switch")
    .replace(/Aisw Desktop/g, "AI Switch")
    .replace(/AISW desktop/g, "AI Switch")
    .replace(/outside aisw/g, "outside AI Switch")
    .replace(/Outside aisw/g, "Outside AI Switch")
    .replace(/outside AISW/g, "outside AI Switch")
    .replace(/Outside AISW/g, "Outside AI Switch")
    .replace(/aisw cannot/g, "AI Switch cannot")
    .replace(/Aisw cannot/g, "AI Switch cannot")
    .replace(/AISW cannot/g, "AI Switch cannot")
    .replace(/\baisw\b/g, "AI Switch")
    .replace(/\bAisw\b/g, "AI Switch")
    .replace(/AISW Desktop/g, "AI Switch")
    .replace(/\bAISW\b/g, "AI Switch")
    .replace(/saved imported context/g, "saved set")
    .replace(/Saved imported context/g, "Saved set")
    .replace(/imported context/g, "set")
    .replace(/Imported context/g, "Set")
    .replace(/CLI context/g, "set")
    .replace(/cli context/g, "set");
}
