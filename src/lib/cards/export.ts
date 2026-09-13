"use client";
import { toBlob } from "html-to-image";

const isSafari = () => typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

/** Renders a card DOM node to a PNG blob at 2× (e.g. 540 → 1080 px). */
export async function renderCardPng(node: HTMLElement, opts: { width: number; height: number; pixelRatio?: number }): Promise<Blob> {
  const options = {
    width: opts.width,
    height: opts.height,
    pixelRatio: opts.pixelRatio ?? 2,
    cacheBust: true,
    style: { transform: "none", margin: "0" },
  };
  if (document.fonts?.ready) await document.fonts.ready;
  // Safari occasionally drops fonts/images on the first pass; a warm-up render fixes it.
  if (isSafari()) await toBlob(node, options);
  const blob = await toBlob(node, options);
  if (!blob) throw new Error("Could not render the image.");
  return blob;
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
