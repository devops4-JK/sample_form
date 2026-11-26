/* ============================================================
   The shape of a theme, the ten sample templates, and the
   helpers that turn a theme into CSS custom properties.

   This file is design-only: nothing here talks to the API.
   ============================================================ */

/* ---------------- fonts ---------------- */

/**
 * Every Google font is on offer: the Design section's Family control is
 * the `react-fontpicker-ts` package, which carries the whole catalogue and
 * loads whichever face is chosen. A theme stores the family's real name
 * ("Poppins", "Playfair Display").
 *
 * Themes saved before that stored a short id instead. LEGACY_FONTS turns
 * those ids back into names, so nothing already designed changes face.
 */
const LEGACY_FONTS = {
  inter: "Inter",
  roboto: "Roboto",
  opensans: "Open Sans",
  lato: "Lato",
  montserrat: "Montserrat",
  poppins: "Poppins",
  nunito: "Nunito",
  playfair: "Playfair Display",
  merriweather: "Merriweather",
  robotomono: "Roboto Mono",
};

export const DEFAULT_FONT = "Inter";

/**
 * The family's name, safe to put in a stylesheet or a font URL. Anything
 * that is not a letter, a digit or a space is dropped, so a saved theme can
 * never smuggle CSS in through its font.
 */
export function fontName(family) {
  const raw = String(family ?? "").trim();
  const name = (LEGACY_FONTS[raw] || raw).replace(/[^A-Za-z0-9 ]/g, "").trim().slice(0, 60);
  return name || DEFAULT_FONT;
}

/** The face first, then real fallbacks for the moment before it loads. */
export const fontStack = (family) =>
  `"${fontName(family)}", -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

/* Text is set in points on the page, not in t-shirt sizes: pick the pixel
   size the questions are set in and everything else follows from it. */
export const BASE_PX = 16;
export const MIN_PX = 12;
export const MAX_PX = 30;

/* Themes saved before the slider existed carry an id instead. */
const LEGACY_SIZES = { sm: 13, md: 16, lg: 21 };

const pxOf = (font) => {
  const px = Number(font.sizePx);
  if (Number.isFinite(px) && px > 0) return Math.min(MAX_PX, Math.max(MIN_PX, px));
  return LEGACY_SIZES[font.size] || BASE_PX;
};

export const ALIGNMENTS = [
  { id: "left", label: "Left" },
  { id: "center", label: "Centre" },
  { id: "right", label: "Right" },
];

/* ---------------- logo ---------------- */

export const LOGO_SIZES = [
  { id: "sm", label: "Small", px: 30 },
  { id: "md", label: "Medium", px: 46 },
  { id: "lg", label: "Large", px: 66 },
];

const logoPx = (id) => (LOGO_SIZES.find((s) => s.id === id) || LOGO_SIZES[1]).px;

/* The logo and the form's name travel together in one strip. It can sit
   under the questions or over them; under is the quieter default. */
export const HEADER_PLACES = [
  { id: "bottom", label: "Bottom" },
  { id: "top", label: "Top" },
];

/* ---------------- the loading screen ---------------- */

/**
 * What plays while the form is getting ready.
 *
 * The first seven move the logo itself. The rest are the spinners from the
 * `react-spinners` package, drawn under the logo in the theme's button
 * colour; LoadingScreen.jsx maps each id to its component.
 */
export const LOADING_ANIMATIONS = [
  { id: "pulse", label: "Logo · Pulse", note: "The logo breathes in and out" },
  { id: "float", label: "Logo · Float", note: "The logo drifts up and down" },
  { id: "ring", label: "Logo · Ring", note: "A circle sweeps around the logo" },
  { id: "bars", label: "Logo · Bars", note: "Three bars rise under the logo" },
  { id: "shimmer", label: "Logo · Shimmer", note: "A light sweeps across the logo" },
  { id: "flip", label: "Logo · Flip", note: "The logo turns on its axis" },
  { id: "zoom", label: "Logo · Zoom", note: "The logo grows in from nothing" },

  { id: "sp-bar", label: "Bar", note: "A line that fills and empties" },
  { id: "sp-beat", label: "Beat", note: "Three dots beating in turn" },
  { id: "sp-bounce", label: "Bounce", note: "Two circles trading places" },
  { id: "sp-circle", label: "Circle", note: "Rings turning inside each other" },
  { id: "sp-climbing-box", label: "Climbing box", note: "A box climbing a stair" },
  { id: "sp-clip", label: "Clip", note: "A plain turning ring" },
  { id: "sp-clock", label: "Clock", note: "Clock hands going round" },
  { id: "sp-dot", label: "Dot", note: "Two dots orbiting" },
  { id: "sp-fade", label: "Fade", note: "Spokes fading in turn" },
  { id: "sp-grid", label: "Grid", note: "Nine dots pulsing" },
  { id: "sp-hash", label: "Hash", note: "Two bars crossing" },
  { id: "sp-moon", label: "Moon", note: "A dot circling a ring" },
  { id: "sp-pacman", label: "Pacman", note: "The arcade classic" },
  { id: "sp-propagate", label: "Propagate", note: "Dots spreading outwards" },
  { id: "sp-puff", label: "Puff", note: "Rings puffing outwards" },
  { id: "sp-pulse", label: "Pulse dots", note: "Three dots pulsing" },
  { id: "sp-ring", label: "Ring", note: "Two rings tumbling" },
  { id: "sp-rise", label: "Rise", note: "Dots rising and falling" },
  { id: "sp-rotate", label: "Rotate", note: "Three dots turning" },
  { id: "sp-scale", label: "Scale", note: "Bars stretching in a wave" },
  { id: "sp-skew", label: "Skew", note: "A triangle folding over" },
  { id: "sp-square", label: "Square", note: "A square flipping over" },
  { id: "sp-sync", label: "Sync", note: "Three dots bouncing in step" },
];

/** True for the ids that draw a `react-spinners` spinner. */
export const isSpinner = (id) => String(id || "").startsWith("sp-");

export const MIN_WAIT = 1;
export const MAX_WAIT = 8;

/* ---------------- buttons, borders, motion ---------------- */

export const BUTTON_STYLES = [
  { id: "solid", label: "Solid", note: "Filled with the button colour" },
  { id: "outline", label: "Outline", note: "Border only, transparent inside" },
  { id: "soft", label: "Soft", note: "A tint of the button colour" },
];

export const BUTTON_WIDTHS = [
  { id: "auto", label: "Fit text" },
  { id: "wide", label: "Wide" },
  { id: "full", label: "Full width" },
];

export const FIELD_STYLES = [
  { id: "outline", label: "Outlined", note: "A border around every answer" },
  { id: "filled", label: "Filled", note: "A soft block behind the answer" },
  { id: "underline", label: "Underline", note: "A single rule under the answer" },
];

export const BORDER_STYLES = [
  { id: "solid", label: "Solid" },
  { id: "dashed", label: "Dashed" },
  { id: "none", label: "None" },
];

export const SHADOWS = [
  { id: "none", label: "None", css: "none" },
  { id: "soft", label: "Soft", css: "0 2px 10px rgba(15, 18, 25, 0.06)" },
  { id: "lifted", label: "Lifted", css: "0 12px 30px rgba(15, 18, 25, 0.12)" },
  { id: "deep", label: "Deep", css: "0 24px 60px rgba(15, 18, 25, 0.22)" },
];

export const shadowCss = (id) => (SHADOWS.find((s) => s.id === id) || SHADOWS[0]).css;

/**
 * How each question arrives. The keyframes come from the `animate.css`
 * package: every id below except "none" is the name of one of its
 * entrance animations, so adding another is one more line here.
 *
 * Themes saved before the package was added carry one of the ten old ids;
 * LEGACY_ANIMATIONS points each of those at its nearest match.
 */
export const ANIMATIONS = [
  { id: "none", label: "None", note: "Questions appear at once" },

  { id: "fadeIn", label: "Fade in", note: "Eases in on the spot" },
  { id: "fadeInUp", label: "Fade in up", note: "Lifts up as it fades in" },
  { id: "fadeInDown", label: "Fade in down", note: "Falls in from above" },
  { id: "fadeInLeft", label: "Fade in left", note: "Enters from the left" },
  { id: "fadeInRight", label: "Fade in right", note: "Enters from the right" },
  { id: "fadeInUpBig", label: "Fade in up, far", note: "A long lift from below" },
  { id: "fadeInDownBig", label: "Fade in down, far", note: "A long fall from above" },
  { id: "fadeInLeftBig", label: "Fade in left, far", note: "All the way from the left edge" },
  { id: "fadeInRightBig", label: "Fade in right, far", note: "All the way from the right edge" },
  { id: "fadeInTopLeft", label: "Fade in top left", note: "From the top-left corner" },
  { id: "fadeInTopRight", label: "Fade in top right", note: "From the top-right corner" },
  { id: "fadeInBottomLeft", label: "Fade in bottom left", note: "From the bottom-left corner" },
  { id: "fadeInBottomRight", label: "Fade in bottom right", note: "From the bottom-right corner" },

  { id: "slideInUp", label: "Slide up", note: "Slides up into place" },
  { id: "slideInDown", label: "Slide down", note: "Slides down into place" },
  { id: "slideInLeft", label: "Slide from left", note: "Slides in from the left" },
  { id: "slideInRight", label: "Slide from right", note: "Slides in from the right" },

  { id: "zoomIn", label: "Zoom in", note: "Grows into place" },
  { id: "zoomInUp", label: "Zoom in up", note: "Grows as it rises" },
  { id: "zoomInDown", label: "Zoom in down", note: "Grows as it falls" },
  { id: "zoomInLeft", label: "Zoom in left", note: "Grows in from the left" },
  { id: "zoomInRight", label: "Zoom in right", note: "Grows in from the right" },

  { id: "bounceIn", label: "Bounce in", note: "Pops in with a bounce" },
  { id: "bounceInUp", label: "Bounce in up", note: "Bounces up into place" },
  { id: "bounceInDown", label: "Bounce in down", note: "Bounces down into place" },
  { id: "bounceInLeft", label: "Bounce in left", note: "Bounces in from the left" },
  { id: "bounceInRight", label: "Bounce in right", note: "Bounces in from the right" },

  { id: "backInUp", label: "Back in up", note: "Starts small, swings up" },
  { id: "backInDown", label: "Back in down", note: "Starts small, swings down" },
  { id: "backInLeft", label: "Back in left", note: "Starts small, swings in from the left" },
  { id: "backInRight", label: "Back in right", note: "Starts small, swings in from the right" },

  { id: "flipInX", label: "Flip", note: "Turns in on its own axis" },
  { id: "flipInY", label: "Flip sideways", note: "Turns in like a door" },

  { id: "rotateIn", label: "Rotate in", note: "Spins into place" },
  { id: "rotateInDownLeft", label: "Rotate in down left", note: "Swings down from the left" },
  { id: "rotateInDownRight", label: "Rotate in down right", note: "Swings down from the right" },
  { id: "rotateInUpLeft", label: "Rotate in up left", note: "Swings up from the left" },
  { id: "rotateInUpRight", label: "Rotate in up right", note: "Swings up from the right" },

  { id: "lightSpeedInLeft", label: "Light speed left", note: "Streaks in from the left" },
  { id: "lightSpeedInRight", label: "Light speed right", note: "Streaks in from the right" },
  { id: "rollIn", label: "Roll in", note: "Rolls in from the left" },
  { id: "jackInTheBox", label: "Jack in the box", note: "Springs up and wobbles" },
];

const LEGACY_ANIMATIONS = {
  fade: "fadeIn",
  rise: "fadeInUp",
  drop: "fadeInDown",
  "slide-left": "fadeInLeft",
  "slide-right": "fadeInRight",
  "zoom-in": "zoomIn",
  "zoom-out": "zoomInDown",
  flip: "flipInX",
  blur: "fadeIn",
};

/** The saved choice as an id from the list above, whatever era it is from. */
export function animationId(id) {
  const next = LEGACY_ANIMATIONS[id] || id;
  return ANIMATIONS.some((a) => a.id === next) ? next : "none";
}

/* Slow is a beat you can watch; fast is almost instant. */
export const SPEEDS = [
  { id: "slow", label: "Slow", ms: 1200 },
  { id: "normal", label: "Normal", ms: 520 },
  { id: "fast", label: "Fast", ms: 180 },
];

export const speedMs = (id) => (SPEEDS.find((s) => s.id === id) || SPEEDS[1]).ms;

export const HOVERS = [
  { id: "none", label: "None" },
  { id: "lift", label: "Lift" },
  { id: "grow", label: "Grow" },
  { id: "glow", label: "Glow" },
];

/* ---------------- background image, and where it sits ---------------- */

/**
 * Where the picture sits next to the questions. The same six choices on a
 * wide screen; a phone gets the four that make sense in one column.
 */
export const DESKTOP_LAYOUTS = [
  { id: "full", label: "Behind", note: "Fills the screen behind the questions" },
  { id: "left-half", label: "Left half", note: "Half image, half form" },
  { id: "right-half", label: "Right half", note: "Half form, half image" },
  { id: "left-tile", label: "Left tile", note: "A narrow band down the left" },
  { id: "right-tile", label: "Right tile", note: "A narrow band down the right" },
  { id: "banner", label: "Top banner", note: "Across the top of the form" },
];

export const MOBILE_LAYOUTS = [
  { id: "banner", label: "Top banner", note: "Edge to edge across the top" },
  { id: "bottom", label: "Bottom banner", note: "Edge to edge across the bottom" },
  { id: "full", label: "Behind", note: "Fills the screen behind the questions" },
  { id: "none", label: "Hidden", note: "No picture on a phone" },
];

/**
 * Where a welcome or end screen's own picture sits against its words. A
 * smaller set than a page's, drawn with the same little maps.
 */
export const SCREEN_LAYOUTS = [
  { id: "banner", label: "Above", note: "Picture above the heading" },
  { id: "bottom", label: "Below", note: "Picture under the button" },
  { id: "left-half", label: "Left", note: "Picture on the left, words on the right" },
  { id: "right-half", label: "Right", note: "Words on the left, picture on the right" },
];

export const SCREEN_LAYOUTS_MOBILE = [
  { id: "banner", label: "Above", note: "Picture above the heading" },
  { id: "bottom", label: "Below", note: "Picture under the button" },
  { id: "none", label: "Hidden", note: "No picture on a phone" },
];

/** Whether the whole picture shows, or it is cropped to fill its space. */
export const IMAGE_FITS = [
  { id: "contain", label: "Whole picture" },
  { id: "cover", label: "Fill the space" },
];

export const layoutLabel = (id, mobile = false) =>
  ((mobile ? MOBILE_LAYOUTS : DESKTOP_LAYOUTS).find((l) => l.id === id) || { label: "Behind" }).label;

/** A data URL or a link is a video when it says so. */
export const isVideo = (src = "") =>
  /^data:video\//i.test(src) || /\.(mp4|webm|ogg|ogv|mov)(\?|#|$)/i.test(src);

/* ---------------- the theme itself ---------------- */

/** Every theme carries this shape; templates only override what differs. */
export const BASE_THEME = {
  logo: { src: "", size: "md", show: true },
  font: {
    family: DEFAULT_FONT,
    sizePx: BASE_PX,
    titleColour: "#0f172a",
    questionColour: "#0f172a",
    helpColour: "#475569",
    answerColour: "#0f172a",
    size: "md",
    alignWelcome: "center",
    alignQuestions: "left",
  },
  buttons: {
    fill: "#2563eb",
    text: "#ffffff",
    // What it turns into under the pointer. Empty means "darken the fill
    // a little", which is what a button did before these existed.
    hoverFill: "",
    hoverText: "",
    radius: 10,
    style: "solid",
    width: "auto",
  },
  // The line across the top of the form: hide either half of it.
  header: { showName: true, showCount: true, place: "bottom" },
  background: {
    colour: "#ffffff",
    image: "",
    desktop: "right-half",
    mobile: "banner",
    focalX: 50,
    focalY: 50,
    brightness: 100,
    blur: 0,
    overlay: 0,
  },
  card: {
    fieldStyle: "outline",
    // The answer fields have a colour of their own, so changing the button
    // never repaints what people type into.
    inputColour: "#2563eb",
    borderStyle: "solid",
    borderWidth: 1,
    borderColour: "#e2e8f0",
    radius: 12,
    shadow: "soft",
  },
  motion: { animation: "fadeInUp", speed: "normal", hover: "lift" },
  // Shown for a few seconds before the first question.
  loading: {
    enabled: false,
    seconds: 4,
    animation: "pulse",
    background: "",
    text: "Getting your form ready…",
    showText: true,
  },
};

const merge = (patch = {}) => ({
  ...BASE_THEME,
  ...patch,
  logo: { ...BASE_THEME.logo, ...(patch.logo || {}) },
  header: { ...BASE_THEME.header, ...(patch.header || {}) },
  font: { ...BASE_THEME.font, ...(patch.font || {}) },
  buttons: { ...BASE_THEME.buttons, ...(patch.buttons || {}) },
  background: { ...BASE_THEME.background, ...(patch.background || {}) },
  card: { ...BASE_THEME.card, ...(patch.card || {}) },
  motion: { ...BASE_THEME.motion, ...(patch.motion || {}) },
  loading: { ...BASE_THEME.loading, ...(patch.loading || {}) },
});

let seq = 0;
export const themeId = () => `th_${Date.now().toString(36)}_${(seq += 1).toString(36)}`;

const template = (name, tagline, patch) => ({
  id: themeId(),
  name,
  tagline,
  template: true,
  ...merge(patch),
});

/* ---------------- the ten sample templates ---------------- */

export const TEMPLATES = [
  template("Clean slate", "Plain white, blue accent", {}),

  template("Midnight", "Dark, high contrast", {
    font: {
      family: "montserrat",
      titleColour: "#f8fafc",
      questionColour: "#f1f5f9",
      helpColour: "#94a3b8",
      answerColour: "#e2e8f0",
    },
    buttons: { fill: "#818cf8", text: "#0b1020", radius: 12, style: "solid" },
    background: { colour: "#0b1020", desktop: "full", mobile: "full", overlay: 45 },
    card: { inputColour: "#818cf8", fieldStyle: "filled", borderColour: "#1e293b", radius: 14, shadow: "deep" },
    motion: { animation: "fade", speed: "normal", hover: "glow" },
  }),

  template("Paper", "Warm, editorial serif", {
    font: {
      family: "playfair",
      titleColour: "#1c1917",
      questionColour: "#1c1917",
      helpColour: "#57534e",
      answerColour: "#1c1917",
      size: "lg",
    },
    buttons: { fill: "#1c1917", text: "#fafaf9", radius: 2, style: "solid" },
    background: { colour: "#faf7f2", desktop: "banner", mobile: "banner" },
    card: { inputColour: "#1c1917", fieldStyle: "underline", borderColour: "#e7e1d8", radius: 4, shadow: "none" },
    motion: { animation: "fade", speed: "slow", hover: "none" },
  }),

  template("Sandstone", "Earthy and calm", {
    font: {
      family: "nunito",
      titleColour: "#44403c",
      questionColour: "#44403c",
      helpColour: "#78716c",
      answerColour: "#44403c",
    },
    buttons: { fill: "#c2703d", text: "#ffffff", radius: 28, style: "solid" },
    background: { colour: "#f5efe6" },
    card: { inputColour: "#c2703d", fieldStyle: "filled", borderColour: "#e5dccd", radius: 18, shadow: "soft" },
    motion: { animation: "rise", speed: "normal", hover: "lift" },
  }),

  template("Ocean", "Cool blues, roomy", {
    font: {
      family: "lato",
      titleColour: "#0c4a6e",
      questionColour: "#0c4a6e",
      helpColour: "#0369a1",
      answerColour: "#0c4a6e",
    },
    buttons: { fill: "#0284c7", text: "#ffffff", radius: 10, style: "solid", width: "wide" },
    background: { colour: "#f0f9ff", desktop: "left-half", mobile: "banner" },
    card: { inputColour: "#0284c7", fieldStyle: "outline", borderColour: "#bae6fd", radius: 12, shadow: "soft" },
    motion: { animation: "slide-left", speed: "normal", hover: "lift" },
  }),

  template("Forest", "Deep green, grounded", {
    font: {
      family: "merriweather",
      titleColour: "#052e16",
      questionColour: "#14532d",
      helpColour: "#3f6212",
      answerColour: "#14532d",
    },
    buttons: { fill: "#15803d", text: "#ffffff", radius: 6, style: "solid" },
    background: { colour: "#f2f7f0" },
    card: { inputColour: "#15803d", fieldStyle: "outline", borderColour: "#cfe3cb", radius: 8, shadow: "soft" },
    motion: { animation: "drop", speed: "normal", hover: "grow" },
  }),

  template("Berry", "Bold, playful contrast", {
    font: {
      family: "poppins",
      titleColour: "#4a044e",
      questionColour: "#701a75",
      helpColour: "#a21caf",
      answerColour: "#4a044e",
      size: "lg",
    },
    buttons: { fill: "#c026d3", text: "#ffffff", radius: 28, style: "solid", width: "wide" },
    background: { colour: "#fdf4ff", desktop: "right-tile", mobile: "banner" },
    card: { inputColour: "#c026d3", fieldStyle: "filled", borderColour: "#f5d0fe", radius: 20, shadow: "lifted" },
    motion: { animation: "zoom-in", speed: "fast", hover: "grow" },
  }),

  template("Mono", "Monospaced and precise", {
    font: {
      family: "robotomono",
      titleColour: "#111827",
      questionColour: "#111827",
      helpColour: "#4b5563",
      answerColour: "#111827",
      size: "sm",
    },
    buttons: { fill: "#111827", text: "#ffffff", radius: 0, style: "outline" },
    background: { colour: "#ffffff" },
    card: { inputColour: "#111827", fieldStyle: "outline", borderStyle: "dashed", borderColour: "#9ca3af", radius: 0, shadow: "none" },
    motion: { animation: "none", speed: "fast", hover: "none" },
  }),

  template("Sunrise", "Warm gradient energy", {
    font: {
      family: "opensans",
      titleColour: "#7c2d12",
      questionColour: "#9a3412",
      helpColour: "#b45309",
      answerColour: "#7c2d12",
    },
    buttons: { fill: "#ea580c", text: "#ffffff", radius: 14, style: "soft", width: "wide" },
    background: { colour: "#fff7ed", desktop: "right-half", mobile: "banner" },
    card: { inputColour: "#ea580c", fieldStyle: "filled", borderColour: "#fed7aa", radius: 16, shadow: "lifted" },
    motion: { animation: "blur", speed: "fast", hover: "lift" },
  }),

  template("Slate", "Quiet corporate grey", {
    font: {
      family: "roboto",
      titleColour: "#0f172a",
      questionColour: "#1e293b",
      helpColour: "#64748b",
      answerColour: "#0f172a",
    },
    buttons: { fill: "#334155", text: "#ffffff", radius: 8, style: "solid" },
    background: { colour: "#f8fafc" },
    card: { inputColour: "#334155", fieldStyle: "outline", borderColour: "#e2e8f0", radius: 10, shadow: "none" },
    motion: { animation: "fade", speed: "normal", hover: "none" },
  }),
];

/* ---------------- helpers ---------------- */

/** A fresh, unsaved theme built from a template (or from the base). */
export function newTheme(name, from) {
  const src = from ? merge(from) : merge();
  return { ...src, id: themeId(), name, template: false };
}

/** "Ocean" → "Ocean copy", "Ocean copy" → "Ocean copy 2". */
export function copyName(name, existing) {
  return uniqueName(`${name} copy`, existing);
}

/** "Untitled theme" → "Untitled theme 2" once the first one exists. */
export function uniqueName(name, existing) {
  const taken = new Set(existing.map((t) => t.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  let n = 2;
  while (taken.has(`${name} ${n}`.toLowerCase())) n += 1;
  return `${name} ${n}`;
}

const rgba = (hex, alpha) => {
  const clean = String(hex || "").replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = parseInt(full || "000000", 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Everything the preview needs, as CSS custom properties. Keeping the
 * translation in one place means the card preview and the big canvas can
 * never drift apart.
 */
export function themeVars(theme) {
  const t = merge(theme);
  const px = pxOf(t.font);
  const solid = t.buttons.style === "solid";
  const soft = t.buttons.style === "soft";
  const hoverFill = t.buttons.hoverFill || "";
  const hoverText = t.buttons.hoverText || "";

  return {
    "--t-font": fontStack(t.font.family),
    "--t-size": `${px}px`,
    /* Kept so every rule written against the old scale still works. */
    "--t-scale": px / BASE_PX,
    "--t-title": t.font.titleColour,
    "--t-question": t.font.questionColour,
    "--t-help": t.font.helpColour,
    "--t-answer": t.font.answerColour,
    "--t-align-welcome": t.font.alignWelcome,
    "--t-align-question": t.font.alignQuestions,

    "--t-bg": t.background.colour,
    "--t-media-focal": `${t.background.focalX}% ${t.background.focalY}%`,
    "--t-media-filter": `brightness(${t.background.brightness}%) blur(${t.background.blur}px)`,
    "--t-media-overlay": `rgba(0, 0, 0, ${t.background.overlay / 100})`,

    "--t-btn-bg": solid ? t.buttons.fill : soft ? rgba(t.buttons.fill, 0.14) : "transparent",
    "--t-btn-text": solid ? t.buttons.text : t.buttons.fill,
    "--t-btn-border": t.buttons.fill,
    "--t-btn-radius": `${t.buttons.radius}px`,
    "--t-btn-glow": rgba(t.buttons.fill, 0.38),
    "--t-btn-hover-bg": hoverFill
      ? solid
        ? hoverFill
        : soft
        ? rgba(hoverFill, 0.18)
        : rgba(hoverFill, 0.1)
      : solid
      ? rgba(t.buttons.fill, 0.86)
      : rgba(t.buttons.fill, 0.1),
    "--t-btn-hover-text": hoverText || (solid ? t.buttons.text : hoverFill || t.buttons.fill),
    "--t-btn-hover-border": hoverFill || t.buttons.fill,
    "--t-accent": t.buttons.fill,
    "--t-accent-soft": rgba(t.buttons.fill, 0.12),

    "--t-input": t.card.inputColour,
    "--t-input-soft": rgba(t.card.inputColour, 0.12),
    "--t-field-bg":
      t.card.fieldStyle === "filled" ? rgba(t.card.inputColour, 0.07) : "transparent",
    "--t-border-style": t.card.borderStyle,
    "--t-border-width": `${t.card.borderStyle === "none" ? 0 : t.card.borderWidth}px`,
    "--t-border-colour": t.card.borderColour,
    "--t-radius": `${t.card.radius}px`,
    "--t-shadow": shadowCss(t.card.shadow),

    "--t-logo": `${logoPx(t.logo.size)}px`,

    /* An animate.css keyframe name, or "none". */
    "--t-anim": animationId(t.motion.animation),
    "--t-motion": `${speedMs(t.motion.speed)}ms`,
    /* Each question waits a little longer than the one before it, in
       proportion to the speed, so Slow really does feel slow. */
    "--t-stagger": `${Math.round(speedMs(t.motion.speed) * 0.22)}ms`,

    "--t-load-bg": t.loading.background || t.background.colour,
  };
}

export { merge as fillTheme, pxOf as fontSizePx };