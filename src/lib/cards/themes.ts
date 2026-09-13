export interface Theme {
  id: string;
  name: string;
  /** CSS background of the card. */
  bg: string;
  /** Background for inner tiles / pills. */
  surface: string;
  fg: string;
  muted: string;
  accent: string;
  /** Top colour of the area-chart gradient (with alpha). */
  accentSoft: string;
  up: { bg: string; fg: string };
  down: { bg: string; fg: string };
  dark: boolean;
  blobs?: [string, string];
}

export const THEMES: Theme[] = [
  {
    id: "peach",
    name: "Peach",
    bg: "linear-gradient(135deg, #FFF3E8 0%, #FFD8C4 100%)",
    surface: "rgba(255,255,255,0.55)",
    fg: "#3B241A",
    muted: "#A97C69",
    accent: "#FF7A4D",
    accentSoft: "rgba(255,122,77,0.32)",
    up: { bg: "rgba(255,255,255,0.7)", fg: "#C2410C" },
    down: { bg: "rgba(255,255,255,0.7)", fg: "#9F1239" },
    dark: false,
    blobs: ["rgba(255,255,255,0.55)", "rgba(255,150,110,0.28)"],
  },
  {
    id: "mint",
    name: "Mint",
    bg: "linear-gradient(135deg, #EDFDF4 0%, #C6F1DA 100%)",
    surface: "rgba(255,255,255,0.55)",
    fg: "#0F3B2A",
    muted: "#5E9078",
    accent: "#12B76A",
    accentSoft: "rgba(18,183,106,0.3)",
    up: { bg: "rgba(255,255,255,0.7)", fg: "#027A48" },
    down: { bg: "rgba(255,255,255,0.7)", fg: "#B42318" },
    dark: false,
    blobs: ["rgba(255,255,255,0.6)", "rgba(18,183,106,0.16)"],
  },
  {
    id: "sky",
    name: "Sky",
    bg: "linear-gradient(135deg, #EEF6FF 0%, #CBE2FF 100%)",
    surface: "rgba(255,255,255,0.55)",
    fg: "#112B57",
    muted: "#5F7FAE",
    accent: "#3B82F6",
    accentSoft: "rgba(59,130,246,0.3)",
    up: { bg: "rgba(255,255,255,0.7)", fg: "#1D4ED8" },
    down: { bg: "rgba(255,255,255,0.7)", fg: "#B42318" },
    dark: false,
    blobs: ["rgba(255,255,255,0.6)", "rgba(59,130,246,0.16)"],
  },
  {
    id: "lavender",
    name: "Lavender",
    bg: "linear-gradient(135deg, #F6F1FF 0%, #DCD0FF 100%)",
    surface: "rgba(255,255,255,0.55)",
    fg: "#2A1B5C",
    muted: "#7F6BAE",
    accent: "#7C5CFF",
    accentSoft: "rgba(124,92,255,0.3)",
    up: { bg: "rgba(255,255,255,0.7)", fg: "#5B3DE6" },
    down: { bg: "rgba(255,255,255,0.7)", fg: "#B42318" },
    dark: false,
    blobs: ["rgba(255,255,255,0.6)", "rgba(124,92,255,0.16)"],
  },
  {
    id: "lemon",
    name: "Lemon",
    bg: "linear-gradient(135deg, #FFFBE5 0%, #FFEFA3 100%)",
    surface: "rgba(255,255,255,0.55)",
    fg: "#463500",
    muted: "#9B8536",
    accent: "#F2B400",
    accentSoft: "rgba(242,180,0,0.32)",
    up: { bg: "rgba(255,255,255,0.7)", fg: "#8A6100" },
    down: { bg: "rgba(255,255,255,0.7)", fg: "#B42318" },
    dark: false,
    blobs: ["rgba(255,255,255,0.6)", "rgba(242,180,0,0.16)"],
  },
  {
    id: "bubblegum",
    name: "Bubblegum",
    bg: "linear-gradient(135deg, #FFEAF4 0%, #FFC4DF 100%)",
    surface: "rgba(255,255,255,0.55)",
    fg: "#561B3C",
    muted: "#B2678C",
    accent: "#F0489E",
    accentSoft: "rgba(240,72,158,0.3)",
    up: { bg: "rgba(255,255,255,0.7)", fg: "#BE185D" },
    down: { bg: "rgba(255,255,255,0.7)", fg: "#9F1239" },
    dark: false,
    blobs: ["rgba(255,255,255,0.6)", "rgba(240,72,158,0.16)"],
  },
  {
    id: "sunset",
    name: "Sunset",
    bg: "linear-gradient(135deg, #FFE7CF 0%, #FFC4D6 55%, #E5D3FF 100%)",
    surface: "rgba(255,255,255,0.5)",
    fg: "#3A2140",
    muted: "#9A6E8E",
    accent: "#E8548F",
    accentSoft: "rgba(232,84,143,0.3)",
    up: { bg: "rgba(255,255,255,0.7)", fg: "#BE185D" },
    down: { bg: "rgba(255,255,255,0.7)", fg: "#9F1239" },
    dark: false,
    blobs: ["rgba(255,255,255,0.55)", "rgba(255,180,120,0.3)"],
  },
  {
    id: "paper",
    name: "Paper",
    bg: "#FFFDF8",
    surface: "rgba(0,0,0,0.045)",
    fg: "#161616",
    muted: "#7A7671",
    accent: "#161616",
    accentSoft: "rgba(22,22,22,0.16)",
    up: { bg: "#E9F8EE", fg: "#1B7A3E" },
    down: { bg: "#FDECEC", fg: "#B42318" },
    dark: false,
  },
  {
    id: "midnight",
    name: "Midnight",
    bg: "linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)",
    surface: "rgba(255,255,255,0.08)",
    fg: "#F8FAFC",
    muted: "#94A3B8",
    accent: "#A5B4FC",
    accentSoft: "rgba(165,180,252,0.35)",
    up: { bg: "rgba(74,222,128,0.16)", fg: "#86EFAC" },
    down: { bg: "rgba(248,113,113,0.16)", fg: "#FCA5A5" },
    dark: true,
    blobs: ["rgba(165,180,252,0.18)", "rgba(236,72,153,0.16)"],
  },
  {
    id: "forest",
    name: "Forest",
    bg: "linear-gradient(135deg, #0B2E20 0%, #14503B 100%)",
    surface: "rgba(255,255,255,0.08)",
    fg: "#ECFDF5",
    muted: "#8FBFA8",
    accent: "#34D399",
    accentSoft: "rgba(52,211,153,0.35)",
    up: { bg: "rgba(52,211,153,0.18)", fg: "#A7F3D0" },
    down: { bg: "rgba(248,113,113,0.16)", fg: "#FCA5A5" },
    dark: true,
    blobs: ["rgba(52,211,153,0.16)", "rgba(250,204,21,0.12)"],
  },
];

export const THEME_MAP: Record<string, Theme> = Object.fromEntries(THEMES.map((t) => [t.id, t]));

export function getTheme(id: string): Theme {
  return THEME_MAP[id] ?? THEMES[0];
}
