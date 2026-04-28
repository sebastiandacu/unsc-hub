/**
 * Single source of truth for the unit's identity.
 * Rebranding the site = edit this file + swap a few SVGs in /public.
 */
export const unit = {
  name: "United Nations Space Command",
  shortCode: "UNSC",
  parentAgency: "Unified Earth Government",
  tagline: "Forged in fire. Bound by oath. Holding the line.",
  classification: "TOP SECRET // UNSC EYES ONLY",

  logo: {
    seal: "/brand/seal.png", // big circular emblem
    mark: "/brand/seal.png", // small icon for the sidebar
  },

  /**
   * Brand colors. These map to CSS variables in app/globals.css.
   * Change them here, restart the dev server, and the whole site reskins.
   */
  colors: {
    base:    "#050810", // page background — deep space navy
    panel:   "#0b1220", // card / panel background
    border:  "#1a2a4a", // panel border
    accent:  "#4dd0ff", // electric cobalt cyan
    accent2: "#1f7aa3", // deep cobalt
    danger:  "#ff3b3b",
    success: "#4ade80",
    text:    "#dde7f5",
    muted:   "#5b6b85",
  },

  /** Default Wall categories created by the seed script. Editable in admin later. */
  defaultWallCategories: [
    { slug: "actionable-intel", name: "Actionable Intel",        color: "#ff3b3b", description: "Tiempo crítico — inteligencia operativa accionable." },
    { slug: "in-character",     name: "In-Character",            color: "#ffb547", description: "Conversación estrictamente en personaje." },
    { slug: "off-role",         name: "Off-Role",                color: "#4dd0ff", description: "Charla fuera de operación." },
    { slug: "lore",             name: "Archivo & Lore",          color: "#4ade80", description: "Worldbuilding, referencias, archivos desclasificados." },
  ],
} as const;

export type Unit = typeof unit;
