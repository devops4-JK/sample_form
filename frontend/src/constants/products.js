/**
 * Product questions: the shared rules.
 *
 * Two element types use these:
 *
 *   product_choice  one question, a row of products, pick one
 *   product_sets    several sets of products (Option 1, Option 2, …),
 *                   pick one from every set
 *
 * A product is { id, name, description, image, sizeKind, sizes }.
 * When a product comes in sizes (apparel, trousers), its sizes appear only
 * after it has been picked, and a size must then be chosen too.
 *
 * Answers are plain objects of text, so the Excel export, the Google
 * Sheet and every saved response read them without anything new:
 *
 *   product_choice  { product: "Hoodie", size: "M" }
 *   product_sets    { g1: "Hoodie", "g1:size": "M", g2: "Mug", … }
 *
 * The server repeats these checks in backend/controllers/sanitise.js.
 */

export const SIZE_PRESETS = {
  none: { label: "No sizes", sizes: [] },
  apparel: { label: "Apparel (S – 3XL)", sizes: ["S", "M", "L", "XL", "2XL", "3XL"] },
  pants: {
    label: "Pants (28 – 46)",
    sizes: ["28", "30", "32", "34", "36", "38", "40", "42", "44", "46"],
  },
  custom: { label: "Custom sizes", sizes: [] },
};

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const makeProduct = (n = 1) => ({
  id: uid("pr"),
  name: `Product ${n}`,
  description: "",
  image: "",
  sizeKind: "none",
  sizes: [],
});

export const makeGroup = (n = 1) => ({
  id: uid("g"),
  title: `Option ${n}`,
  products: [makeProduct(1), makeProduct(2), makeProduct(3)],
});

/** The sizes a product is offered in. Empty when it has none. */
export function sizesOf(product) {
  if (!product || !product.sizeKind || product.sizeKind === "none") return [];
  if (product.sizeKind === "custom") {
    return (product.sizes || []).map((s) => String(s).trim()).filter(Boolean);
  }
  return SIZE_PRESETS[product.sizeKind]?.sizes || [];
}

export const isProductType = (type) => type === "product_choice" || type === "product_sets";

/** Product questions start required: a gift form needs the choice. */
const findProduct = (products, name) => (products || []).find((p) => p.name === name) || null;

/**
 * Why a product answer is not complete yet, or null when it is.
 *
 * A size is always needed once a product that comes in sizes is picked,
 * required question or not. Picking the product itself is needed only when
 * the question is required.
 */
export function productProblem(field, value) {
  const label = field.label || "This question";

  if (field.type === "product_choice") {
    const chosen = findProduct(field.products, value?.product);
    if (!chosen) return field.required ? `${label}: choose a product.` : null;
    if (sizesOf(chosen).length && !value?.size) return `${label}: choose a size for ${chosen.name}.`;
    return null;
  }

  if (field.type === "product_sets") {
    for (const group of field.groups || []) {
      const chosen = findProduct(group.products, value?.[group.id]);
      if (!chosen) {
        if (field.required) return `${label}: choose one product in ${group.title || "every option"}.`;
        continue;
      }
      if (sizesOf(chosen).length && !value?.[`${group.id}:size`]) {
        return `${label}: choose a size for ${chosen.name}.`;
      }
    }
    return null;
  }

  return null;
}



