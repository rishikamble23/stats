"use client";
import { toCanvas } from "html-to-image";

const isSafari = () => typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

export type CardExportFormat = "png" | "jpeg" | "webp";
export type CardExportScale = 1 | 2 | 3;

interface CardExportOptions {
  width: number;
  height: number;
  format?: CardExportFormat;
  pixelRatio?: CardExportScale;
}

/** Renders a card DOM node in the chosen format, defaulting to PNG at 2×. */
export async function renderCard(node: HTMLElement, opts: CardExportOptions): Promise<Blob> {
  const format = opts.format ?? "png";
  const mimeType = `image/${format}`;
  const options = {
    width: opts.width,
    height: opts.height,
    pixelRatio: opts.pixelRatio ?? 2,
    cacheBust: true,
    style: { transform: "none", margin: "0" },
  };
  if (document.fonts?.ready) await document.fonts.ready;
  // Safari occasionally drops fonts/images on the first pass; a warm-up render fixes it.
  if (isSafari()) await toCanvas(node, options);
  const canvas = await toCanvas(node, options);
  if (format === "jpeg") {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not render the image.");
    // Fill behind the card rather than replacing its theme background.
    context.save();
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Could not render the image."));
      else if (blob.type !== mimeType) reject(new Error(`This browser does not support ${format.toUpperCase()} export.`));
      else resolve(blob);
    }, mimeType, 0.9);
  });
}

/** PNG-only entry point for dashboard downloads and clipboard images. */
export function renderCardPng(node: HTMLElement, opts: Omit<CardExportOptions, "format">): Promise<Blob> {
  return renderCard(node, { ...opts, format: "png" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
  try {
    if (!("clipboard" in navigator) || typeof ClipboardItem === "undefined") return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
