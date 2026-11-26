import { ImagePicker } from "../design/controls";
import { SIZE_PRESETS, makeGroup, makeProduct, sizesOf } from "../../constants/products";

/**
 * The settings-panel editors for the two product questions.
 *
 *   ProductListEditor  the products of one question (or of one set): a
 *                      picture, a name, a description, and sizes if it is
 *                      apparel
 *   ProductSetsEditor  several sets, each with a title and its own products
 *
 * Every removal goes through `confirm`, like the rest of the panel.
 */

const letter = (i) => String.fromCharCode(65 + (i % 26));

const X = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

const PLUS = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/** One product: picture, name, description, sizes. */
function ProductRow({ product, index, onChange, onRemove, canRemove }) {
  const set = (patch) => onChange({ ...product, ...patch });

  return (
    <div className="fb-prod">
      <div className="fb-prod-head">
        <span className="fb-list-n">{letter(index)}</span>
        <span className="fb-prod-title">{product.name || `Product ${letter(index)}`}</span>
        <button
          type="button"
          className="fb-icon fb-icon-danger"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove product ${letter(index)}`}
          title={canRemove ? "Remove this product" : "Keep at least one product"}
        >
          {X}
        </button>
      </div>

      <ImagePicker
        value={product.image || ""}
        onChange={(image) => set({ image })}
        label={`Picture for product ${letter(index)}`}
        cta="Add the product picture"
        hint="Drop a file here, or choose one"
      />

      <label className="fb-field">
        <span className="fb-label">Name</span>
        <input
          className="fb-input"
          value={product.name}
          maxLength={120}
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>

      <label className="fb-field">
        <span className="fb-label">Description</span>
        <textarea
          className="fb-input fb-textarea"
          rows={2}
          value={product.description || ""}
          maxLength={500}
          placeholder="Shown under the picture"
          onChange={(e) => set({ description: e.target.value })}
        />
      </label>

      <label className="fb-field">
        <span className="fb-label">Sizes</span>
        <select
          className="fb-input"
          value={product.sizeKind || "none"}
          onChange={(e) => {
            const sizeKind = e.target.value;
            set({ sizeKind, sizes: sizeKind === "custom" ? sizesOf(product) : [] });
          }}
        >
          {Object.entries(SIZE_PRESETS).map(([id, preset]) => (
            <option key={id} value={id}>
              {preset.label}
            </option>
          ))}
        </select>
        <span className="fb-hint">
          {product.sizeKind && product.sizeKind !== "none"
            ? "The sizes appear only after this product is picked, and one must be chosen."
            : "Choose a size range for apparel, so people pick a size with the product."}
        </span>
      </label>

      {product.sizeKind === "custom" && (
        <label className="fb-field">
          <span className="fb-label">Custom sizes</span>
          <input
            className="fb-input"
            value={(product.sizes || []).join(", ")}
            placeholder="XS, S, M, L"
            onChange={(e) =>
              set({ sizes: e.target.value.split(",").map((s) => s.trim()).slice(0, 30) })
            }
            onBlur={(e) =>
              set({ sizes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30) })
            }
          />
          <span className="fb-hint">Separate sizes with commas.</span>
        </label>
      )}

      {sizesOf(product).length > 0 && product.sizeKind !== "custom" && (
        <p className="fb-prod-sizes">{sizesOf(product).join(" · ")}</p>
      )}
    </div>
  );
}

/** The products of one question, or of one set. */
export function ProductListEditor({ products, onChange, confirm, where = "this question" }) {
  const list = products || [];

  const remove = async (i) => {
    const target = list[i];
    const ok = await confirm({
      title: "Remove this product?",
      body: `“${target.name || `Product ${letter(i)}`}” is removed from ${where}. Answers already collected are kept.`,
      action: "Remove product",
    });
    if (ok) onChange(list.filter((_, n) => n !== i));
  };

  return (
    <div className="fb-prods">
      {list.map((p, i) => (
        <ProductRow
          key={p.id}
          product={p}
          index={i}
          canRemove={list.length > 1}
          onChange={(next) => onChange(list.map((x, n) => (n === i ? next : x)))}
          onRemove={() => remove(i)}
        />
      ))}
      <button
        type="button"
        className="fb-add-row"
        onClick={() => onChange([...list, makeProduct(list.length + 1)])}
        disabled={list.length >= 26}
      >
        {PLUS}
        Add product
      </button>
    </div>
  );
}

/** Several sets, each with its own title and products. One pick per set. */
export function ProductSetsEditor({ groups, onChange, confirm }) {
  const list = groups || [];

  const setGroup = (i, patch) => onChange(list.map((g, n) => (n === i ? { ...g, ...patch } : g)));

  const remove = async (i) => {
    const target = list[i];
    const ok = await confirm({
      title: `Remove ${target.title || "this option"}?`,
      body: "The option and all its products are removed from this question. Answers already collected are kept.",
      action: "Remove option",
    });
    if (ok) onChange(list.filter((_, n) => n !== i));
  };

  return (
    <div className="fb-sets">
      {list.map((g, i) => (
        <section key={g.id} className="fb-set">
          <div className="fb-set-head">
            <span className="fb-list-n">{i + 1}</span>
            <input
              className="fb-input fb-set-title"
              value={g.title}
              maxLength={80}
              onChange={(e) => setGroup(i, { title: e.target.value })}
              aria-label={`Name of option ${i + 1}`}
            />
            <button
              type="button"
              className="fb-icon fb-icon-danger"
              onClick={() => remove(i)}
              disabled={list.length <= 1}
              aria-label={`Remove option ${i + 1}`}
              title={list.length <= 1 ? "Keep at least one option" : "Remove this option"}
            >
              {X}
            </button>
          </div>
          <p className="fb-hint fb-hint-top">People pick one product from this option.</p>
          <ProductListEditor
            products={g.products}
            onChange={(products) => setGroup(i, { products })}
            confirm={confirm}
            where={g.title || `option ${i + 1}`}
          />
        </section>
      ))}

      <button
        type="button"
        className="fb-add-row"
        onClick={() => onChange([...list, makeGroup(list.length + 1)])}
        disabled={list.length >= 20}
      >
        {PLUS}
        Add option
      </button>
    </div>
  );
}




