/**
 * The single source of truth for the builder.
 *
 * Every element declares:
 *   group     which section of the "Add content" picker it sits in
 *   icon      key into ICON_PATHS below
 *   defaults  the field object created when you add one
 *   caps      which controls the settings panel shows for it
 *
 * Adding a new element type means adding one entry here, one case in
 * FieldPreview.jsx, and nothing else.
 */

import { makeGroup, makeProduct } from "./products";

/** The order here is the order of the picker's rail and of its sections. */
export const GROUPS = [
  { id: "text", label: "Text" },
  { id: "contact", label: "Contact info" },
  { id: "other", label: "Other" },
  { id: "products", label: "Products" },
  { id: "choice", label: "Choice" },
  { id: "rating", label: "Rating & ranking" },
];

/** Tints for the icon tiles, one per group. */
export const GROUP_TONE = {
  products: "tone-green",
  contact: "tone-pink",
  choice: "tone-violet",
  rating: "tone-teal",
  text: "tone-blue",
  other: "tone-amber",
};

export const ELEMENTS = [
  /* ---------------- products ---------------- */
  {
    type: "product_choice",
    name: "Product Choice",
    group: "products",
    icon: "bag",
    defaults: {
      label: "Choose your gift",
      help: "",
      required: true,
      products: [makeProduct(1), makeProduct(2), makeProduct(3)],
    },
    caps: { required: true, help: true, products: true },
  },
  {
    type: "product_sets",
    name: "Product Sets",
    group: "products",
    icon: "bags",
    defaults: {
      label: "Choose one product from each option",
      help: "",
      required: true,
      groups: [makeGroup(1), makeGroup(2), makeGroup(3)],
    },
    caps: { required: true, help: true, productSets: true },
  },

  /* ---------------- contact info ---------------- */
  {
    type: "contact_info",
    name: "Contact Info",
    group: "contact",
    icon: "contact",
    defaults: {
      label: "How can we reach you?",
      help: "",
      required: true,
      parts: [
        { key: "firstName", label: "First name", placeholder: "Jagadeesh", show: true },
        { key: "lastName", label: "Last name", placeholder: "Kumar", show: true },
        { key: "email", label: "Email", placeholder: "name@company.com", show: true },
        { key: "phone", label: "Phone", placeholder: "+91 98765 43210", show: true },
      ],
    },
    caps: { required: true, help: true, parts: true },
  },
  {
    type: "email",
    name: "Email",
    group: "contact",
    icon: "mail",
    defaults: {
      label: "Enter your email",
      placeholder: "Enter your email",
      help: "",
      required: true,
    },
    caps: { required: true, help: true, placeholder: true },
  },
  {
    type: "phone",
    name: "Phone Number",
    group: "contact",
    icon: "phone",
    defaults: {
      label: "Enter your phone number",
      placeholder: "+91 98765 43210",
      help: "",
      required: true,
    },
    caps: { required: true, help: true, placeholder: true },
  },
  {
    type: "address",
    name: "Address",
    group: "contact",
    icon: "pin",
    defaults: {
      label: "Where should we deliver?",
      help: "",
      required: true,
      parts: [
        { key: "line1", label: "Address line 1", placeholder: "221B Baker Street", show: true },
        { key: "line2", label: "Address line 2", placeholder: "Apartment 4", show: true },
        { key: "city", label: "City/Town", placeholder: "Bengaluru", show: true },
        { key: "state", label: "State/Region/Province", placeholder: "Karnataka", show: true },
        { key: "zip", label: "Zip/Post code", placeholder: "560001", show: true },
        { key: "country", label: "Country", placeholder: "India", show: true },
      ],
    },
    caps: { required: true, help: true, parts: true },
  },
  {
    type: "website",
    name: "Website",
    group: "contact",
    icon: "link",
    defaults: {
      label: "Your website",
      placeholder: "https://example.com",
      help: "",
      required: false,
    },
    caps: { required: true, help: true, placeholder: true },
  },

  /* ---------------- choice ---------------- */
  {
    type: "multiple_choice",
    name: "Multiple Choice",
    group: "choice",
    icon: "list",
    defaults: {
      label: "Pick an option",
      help: "",
      required: true,
      options: ["Option 1", "Option 2", "Option 3"],
      multiple: false,
    },
    caps: { required: true, help: true, options: true, multiple: true },
  },
  {
    type: "dropdown",
    name: "Dropdown",
    group: "choice",
    icon: "chevron",
    defaults: {
      label: "Choose one",
      placeholder: "Select an option",
      help: "",
      required: true,
      options: ["Option 1", "Option 2", "Option 3"],
    },
    caps: { required: true, help: true, placeholder: true, options: true },
  },
  {
    type: "picture_choice",
    name: "Picture Choice",
    group: "choice",
    icon: "image",
    defaults: {
      label: "Which one do you like?",
      help: "",
      required: true,
      options: ["Option 1", "Option 2"],
      images: ["", ""],
    },
    caps: { required: true, help: true, options: true, images: true },
  },
  {
    type: "yes_no",
    name: "Yes/No",
    group: "choice",
    icon: "toggle",
    defaults: { label: "Do you agree?", help: "", required: true },
    caps: { required: true, help: true },
  },
  {
    type: "legal",
    name: "Legal",
    group: "choice",
    icon: "scale",
    defaults: {
      label: "Do you accept the terms?",
      help: "Read the terms before continuing.",
      required: true,
    },
    caps: { required: true, help: true },
  },
  {
    type: "checkbox",
    name: "Checkbox",
    group: "choice",
    icon: "check",
    defaults: {
      label: "Select everything that applies",
      help: "",
      required: false,
      options: ["Option 1", "Option 2", "Option 3"],
    },
    caps: { required: true, help: true, options: true },
  },

  /* ---------------- rating & ranking ---------------- */
  {
    type: "nps",
    name: "Net Promoter Score",
    group: "rating",
    icon: "gauge",
    defaults: {
      label: "How likely are you to recommend us?",
      help: "",
      required: true,
      lowLabel: "Not likely",
      highLabel: "Very likely",
    },
    caps: { required: true, help: true, scaleLabels: true },
  },
  {
    type: "opinion_scale",
    name: "Opinion Scale",
    group: "rating",
    icon: "bars",
    defaults: {
      label: "How would you rate this?",
      help: "",
      required: true,
      min: 1,
      max: 5,
      lowLabel: "Poor",
      highLabel: "Excellent",
    },
    caps: { required: true, help: true, range: true, scaleLabels: true },
  },
  {
    type: "rating",
    name: "Rating",
    group: "rating",
    icon: "star",
    defaults: {
      label: "Rate your experience",
      help: "",
      required: true,
      steps: 5,
      shape: "star",
    },
    caps: { required: true, help: true, steps: true, shape: true },
  },
  {
    type: "ranking",
    name: "Ranking",
    group: "rating",
    icon: "rank",
    defaults: {
      label: "Put these in order of preference",
      help: "Drag to reorder.",
      required: true,
      options: ["Option 1", "Option 2", "Option 3"],
    },
    caps: { required: true, help: true, options: true },
  },
  {
    type: "matrix",
    name: "Matrix",
    group: "rating",
    icon: "grid",
    defaults: {
      label: "Rate each item",
      help: "",
      required: true,
      rows: ["Row 1", "Row 2"],
      columns: ["Poor", "Fine", "Great"],
    },
    caps: { required: true, help: true, matrix: true },
  },

  /* ---------------- text ---------------- */
  {
    type: "long_text",
    name: "Long Text",
    group: "text",
    icon: "text",
    defaults: {
      label: "Tell us more",
      placeholder: "Type your answer here",
      help: "",
      required: false,
      maxLength: 500,
    },
    caps: { required: true, help: true, placeholder: true, maxLength: true },
  },
  {
    type: "short_text",
    name: "Short Text",
    group: "text",
    icon: "text",
    defaults: {
      label: "Your answer",
      placeholder: "Type your answer here",
      help: "",
      required: true,
      maxLength: 80,
    },
    caps: { required: true, help: true, placeholder: true, maxLength: true },
  },

  /* ---------------- other ---------------- */
  {
    type: "number",
    name: "Number",
    group: "other",
    icon: "hash",
    defaults: {
      label: "How many?",
      placeholder: "0",
      help: "",
      required: true,
      min: 0,
      max: 100,
    },
    caps: { required: true, help: true, placeholder: true, range: true },
  },
  {
    type: "date",
    name: "Date",
    group: "other",
    icon: "calendar",
    defaults: {
      label: "Pick a date",
      help: "",
      required: true,
      format: "DD/MM/YYYY",
    },
    caps: { required: true, help: true, dateFormat: true },
  },
  {
    type: "signature",
    name: "Signature",
    group: "other",
    icon: "pen",
    defaults: {
      label: "Sign here",
      help: "Use your mouse or finger.",
      required: true,
    },
    caps: { required: true, help: true },
  },
  {
    type: "payment",
    name: "Payment",
    group: "other",
    icon: "card",
    defaults: {
      label: "Complete your payment",
      help: "",
      required: true,
      currency: "INR",
      amount: 500,
    },
    caps: { required: true, help: true, payment: true },
  },
  {
    type: "file_upload",
    name: "File Upload",
    group: "other",
    icon: "upload",
    defaults: {
      label: "Upload a file",
      help: "",
      required: false,
      accept: ".pdf,.png,.jpg",
      maxSizeMb: 10,
    },
    caps: { required: true, help: true, file: true },
  },
  {
    type: "scheduler",
    name: "Scheduler",
    group: "other",
    icon: "clock",
    defaults: {
      label: "Book a slot",
      help: "",
      required: true,
      durationMins: 30,
    },
    caps: { required: true, help: true, duration: true },
  },
  {
    type: "statement",
    name: "Statement",
    group: "other",
    icon: "quote",
    defaults: {
      label: "A quick note before you continue",
      help: "Add the detail you want people to read here.",
      buttonText: "Continue",
    },
    caps: { help: true, button: true },
  },
  {
    type: "question_group",
    name: "Question Group",
    group: "other",
    icon: "group",
    defaults: {
      label: "Section title",
      help: "Everything after this belongs to the section.",
    },
    caps: { help: true },
  },
  {
    type: "welcome_screen",
    name: "Welcome Screen",
    group: "other",
    icon: "screen",
    defaults: {
      label: "Something good is on its way to you",
      help: "Share a few quick details so we can send it to the right place. It takes less than a minute.",
      buttonText: "Start",
      image: "",
    },
    caps: { help: true, button: true, image: true },
  },
  {
    type: "end_screen",
    name: "End Screen",
    group: "other",
    icon: "screenEnd",
    defaults: {
      label: "All done — thank you!",
      help: "Your answers are safely with us. We will be in touch soon with what happens next.",
      buttonText: "",
      image: "",
    },
    caps: { help: true, button: true, image: true },
  },
  {
    type: "redirect_url",
    name: "Redirect to URL",
    group: "other",
    icon: "arrow",
    defaults: {
      label: "Redirect",
      help: "People land here once they finish.",
      url: "https://",
    },
    caps: { help: true, url: true },
  },
];

export const BY_TYPE = Object.fromEntries(ELEMENTS.map((e) => [e.type, e]));

/** Types that collect an answer, as opposed to screens and section markers. */
export const INPUT_TYPES = new Set(
  ELEMENTS.filter((e) => e.caps.required).map((e) => e.type)
);

/** Creates an empty page. A page holds any number of fields. */
export function makePage(name = "Page") {
  return {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    image: "",
    imageCaption: "",
    fields: [],
  };
}

/** Creates a field ready to drop into a page. */
export function makeField(type) {
  const spec = BY_TYPE[type];
  const field = {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    ...structuredClone(spec.defaults),
  };
  // Every new product question gets products and sets of its own, never
  // ones shared with the last question of the same kind.
  if (type === "product_choice") field.products = [makeProduct(1), makeProduct(2), makeProduct(3)];
  if (type === "product_sets") field.groups = [makeGroup(1), makeGroup(2), makeGroup(3)];
  return field;
}

/* ------------------------------------------------------------------
   Icons. Paths only, so one component renders all of them.
   ------------------------------------------------------------------ */

export const ICON_PATHS = {
  contact: ["M3 5h18v14H3z", "M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4", "M6 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4", "M15 9h4M15 13h4"],
  mail: ["M3 6h18v12H3z", "m3 7 9 6 9-6"],
  phone: ["M7 3h3l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 5 5a2 2 0 0 1 2-2"],
  pin: ["M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11", "M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"],
  link: ["M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1", "M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"],
  list: ["M9 6h11M9 12h11M9 18h11", "M4 5.5h1.5v1.5H4zM4 11.5h1.5V13H4zM4 17.5h1.5V19H4z"],
  chevron: ["M4 6h16v12H4z", "m9 11 3 3 3-3"],
  image: ["M3 5h18v14H3z", "m5 17 5-5 3 3 3-2 5 4", "M9 9.5a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4"],
  toggle: ["M8 7h8a5 5 0 0 1 0 10H8A5 5 0 0 1 8 7", "M16 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"],
  scale: ["M12 4v16M6 8h12", "m6 8-3 6h6zM18 8l-3 6h6z"],
  check: ["M4 5h16v14H4z", "m8 12 3 3 5-6"],
  gauge: ["M4 18a8 8 0 1 1 16 0", "m12 14 4-4"],
  bars: ["M5 20V12M10 20V6M15 20V9M20 20v-6"],
  star: ["m12 4 2.4 5 5.6.7-4 3.9 1 5.4-5-2.7-5 2.7 1-5.4-4-3.9 5.6-.7z"],
  rank: ["M9 7h11M9 12h11M9 17h11", "M4 6.5 5.2 6v3M4 17h2.2l-2.2 2H6"],
  grid: ["M4 5h16v14H4z", "M4 10h16M4 15h16M10 5v14M15 5v14"],
  text: ["M4 7h16M4 12h16M4 17h10"],
  hash: ["M9 4 7 20M17 4l-2 16M4 9h16M4 15h16"],
  calendar: ["M4 6h16v14H4z", "M8 3v5M16 3v5M4 11h16"],
  pen: ["M4 20h16", "M6 16 16 6l3 3L9 19H6z"],
  card: ["M3 6h18v12H3z", "M3 10h18", "M7 15h4"],
  upload: ["M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3", "M12 4v11", "m8 8 4-4 4 4"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18", "M12 7v5l3 2"],
  quote: ["M8 7c-2 0-3 1.5-3 3.5S6.2 14 8 14c0 2-1 3-3 3", "M18 7c-2 0-3 1.5-3 3.5S16.2 14 18 14c0 2-1 3-3 3"],
  group: ["M4 5h16v14H4z", "M8 9h9M8 13h9M8 17h5"],
  screen: ["M3 5h18v14H3z", "M9 5v14"],
  screenEnd: ["M3 5h18v14H3z", "M15 5v14"],
  bag: ["M5 8h14l-1 12H6z", "M9 8V6a3 3 0 0 1 6 0v2"],
  bags: ["M3 9h11l-1 11H4z", "M6 9V7.5a2.5 2.5 0 0 1 5 0V9", "M15 6h6l-.8 9H16"],
  arrow: ["M4 6h8a8 8 0 0 1 0 16H8", "m16 2 4 4-4 4"],
};