/**
 * Logo helpers. Uploaded logos are stored on the card as small data URLs so
 * exports never depend on a third-party host allowing cross-origin fetches.
 */

const LOGO_PX = 160; // shown at 40px, exported at 2×
const MAX_PNG_CHARS = 200_000;

/** Reads an image file and returns it as a square, cover-cropped data URL. */
export async function fileToLogoDataUrl(file: File, size = LOGO_PX): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That file isn't an image we can read."));
      i.src = objectUrl;
    });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("That image has no size.");
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas isn't available here.");
    const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    const png = canvas.toDataURL("image/png");
    return png.length > MAX_PNG_CHARS ? canvas.toDataURL("image/jpeg", 0.85) : png;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** A tiny inline SVG logo (a letter on a rounded tile) for demo cards. */
export function letterLogo(letter: string, background: string, color = "#ffffff"): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="20" fill="${background}"/>` +
    `<text x="32" y="44" text-anchor="middle" font-family="ui-rounded, system-ui, sans-serif" font-size="34" font-weight="800" fill="${color}">${letter}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
