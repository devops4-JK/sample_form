import { Form } from "react-bootstrap";
import PhoneNumberInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import "react-phone-number-input/style.css";
import { ElementIcon } from "./AddContentModal";
import { sizesOf } from "../../constants/products";

/**
 * A working preview of one element. The inputs are live, so the centre of
 * the builder behaves the way the published form will.
 *
 * value / onChange come from the builder's answers map, keyed by field id.
 * `device` is "desktop" or "mobile"; kept so callers can say which they
 * are drawing for.
 */
export default function FieldPreview({ field, value, onChange, device = "desktop" }) {
  const set = (v) => onChange?.(v);

  switch (field.type) {
    /* ---------------- screens and dividers ---------------- */

    case "welcome_screen":
    case "end_screen":
      return <Screen field={field} />;

    case "statement":
      return (
        <div className="pv-statement">
          <h2 className="pv-title">{field.label}</h2>
          {field.help && <p className="pv-help">{field.help}</p>}
          {field.buttonText && (
            <button type="button" className="pv-cta">
              {field.buttonText}
            </button>
          )}
        </div>
      );

    case "question_group":
      return (
        <div className="pv-group">
          <span className="pv-group-tag">Section</span>
          <h2 className="pv-title">{field.label}</h2>
          {field.help && <p className="pv-help">{field.help}</p>}
        </div>
      );

    case "redirect_url":
      return (
        <div className="pv-statement">
          <h2 className="pv-title">{field.label}</h2>
          {field.help && <p className="pv-help">{field.help}</p>}
          <code className="pv-url">{field.url || "https://"}</code>
        </div>
      );

    /* ---------------- everything that collects an answer ---------------- */

    default:
      return (
        <div className="pv-field">
          <label className="pv-title" htmlFor={field.id}>
            {field.label}
            {field.required && <span className="pv-req">*</span>}
          </label>
          {field.help && <p className="pv-help">{field.help}</p>}
          <Body field={field} value={value} set={set} />
        </div>
      );
  }
}

/**
 * A welcome or end screen: a heading, a line of text and a button.
 *
 * Its picture is not drawn here. A screen's picture is the background of
 * the page it sits on, placed by PageMedia / PageBackdrop like any other
 * page background.
 */
function Screen({ field }) {
  return (
    <div className="pv-screen">
      <div className="pv-screen-text">
        <h2 className="pv-screen-title">{field.label}</h2>
        {field.help && <p className="pv-screen-sub">{field.help}</p>}
        {field.buttonText && (
          <button type="button" className="pv-cta">
            {field.buttonText}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Answers saved before the country picker changed look like
 * "+91 98765 43210". The picker wants the same number with nothing but the
 * plus and digits, so this strips the rest. Anything that does not start
 * with a plus is not a number it can place in a country, and is dropped.
 */
function toE164(value) {
  const text = String(value ?? "").trim();
  if (!text.startsWith("+")) return undefined;
  const digits = text.slice(1).replace(/\D/g, "");
  return digits ? `+${digits}` : undefined;
}

/**
 * A phone number with a country picker, from the `react-phone-number-input`
 * package: every country, its flag and dialling code, and the number
 * formatted as it is typed.
 *
 * The answer stays one plain string ("+919876543210"), so the Excel export
 * and every saved response read it exactly as before. The flags are bundled
 * with the app rather than fetched from another website.
 */
function PhoneInput({ id, field, value, set, className = "pv-input" }) {
  return (
    <PhoneNumberInput
      className="pv-phone"
      flags={flags}
      international
      countryCallingCodeEditable={false}
      defaultCountry={field.country || "IN"}
      value={toE164(value)}
      onChange={(next) => set(next || "")}
      placeholder={field.placeholder}
      numberInputProps={{ id, className }}
      countrySelectProps={{ "aria-label": "Country" }}
    />
  );
}

/* ---------------------------- products ---------------------------- */

/** The tick shown on a picked card and on a finished set. */
function Tick({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/**
 * Every product of a question on one line. Cards share the width equally;
 * when there are more than fit, the row scrolls sideways and snaps to a card.
 */
function ProductGrid({ products, chosen, onPick, name }) {
  const list = products || [];
  return (
    <div
      className="pv-prods"
      role="radiogroup"
      aria-label={name}
      style={{ "--pv-count": Math.max(list.length, 1) }}
    >
      {list.map((p, i) => {
        const on = chosen === p.name;
        return (
          <button
            key={p.id || i}
            type="button"
            role="radio"
            aria-checked={on}
            className={on ? "pv-prod is-on" : "pv-prod"}
            onClick={() => onPick(p)}
            title={p.name}
          >
            <span className="pv-prod-pic">
              {p.image ? (
                <img src={p.image} alt="" loading="lazy" />
              ) : (
                <span className="pv-prod-blank">
                  <ElementIcon name="image" size={24} />
                </span>
              )}
              <span className="pv-prod-key">{String.fromCharCode(65 + (i % 26))}</span>
              <span className="pv-prod-check" aria-hidden="true">
                <Tick />
              </span>
            </span>
            <span className="pv-prod-body">
              <span className="pv-prod-name">{p.name}</span>
              {p.description && <span className="pv-prod-desc">{p.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The sizes of the picked product. Shown only once a product is picked. */
function SizePicker({ product, value, onPick }) {
  const sizes = sizesOf(product);
  if (!sizes.length) return null;

  return (
    <div className="pv-sizes">
      <span className="pv-sizes-label">Choose a size for {product.name}</span>
      <div className="pv-sizes-row" role="radiogroup" aria-label={`Size for ${product.name}`}>
        {sizes.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            className={value === s ? "pv-size is-on" : "pv-size"}
            onClick={() => onPick(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductChoice({ field, value, set }) {
  const v = value || {};
  const chosen = (field.products || []).find((p) => p.name === v.product) || null;

  return (
    <div className="pv-prod-q">
      <ProductGrid
        products={field.products}
        chosen={v.product}
        name={field.label}
        // Picking another product clears the size picked for the last one.
        onPick={(p) => set(p.name === v.product ? v : { product: p.name, size: "" })}
      />
      {chosen && (
        <SizePicker product={chosen} value={v.size} onPick={(size) => set({ ...v, size })} />
      )}
    </div>
  );
}

function ProductSets({ field, value, set }) {
  const v = value || {};

  return (
    <div className="pv-prod-sets">
      {(field.groups || []).map((g, i) => {
        const chosen = (g.products || []).find((p) => p.name === v[g.id]) || null;
        const done = !!chosen && (!sizesOf(chosen).length || !!v[`${g.id}:size`]);
        return (
          <section key={g.id} className={done ? "pv-prod-set is-done" : "pv-prod-set"}>
            <header className="pv-prod-set-head">
              <span className="pv-prod-set-n">{done ? <Tick size={13} /> : i + 1}</span>
              <h3 className="pv-prod-set-title">{g.title}</h3>
              <span className="pv-prod-set-hint">
                {chosen
                  ? `Selected: ${chosen.name}${v[`${g.id}:size`] ? ` · ${v[`${g.id}:size`]}` : ""}`
                  : "Choose one"}
              </span>
            </header>
            <ProductGrid
              products={g.products}
              chosen={v[g.id]}
              name={g.title}
              onPick={(p) =>
                p.name === v[g.id] ? null : set({ ...v, [g.id]: p.name, [`${g.id}:size`]: "" })
              }
            />
            {chosen && (
              <SizePicker
                product={chosen}
                value={v[`${g.id}:size`]}
                onPick={(size) => set({ ...v, [`${g.id}:size`]: size })}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

function Body({ field, value, set }) {
  switch (field.type) {
    case "product_choice":
      return <ProductChoice field={field} value={value} set={set} />;

    case "product_sets":
      return <ProductSets field={field} value={value} set={set} />;

    case "phone":
      return <PhoneInput id={field.id} field={field} value={value} set={set} />;

    case "email":
    case "website":
    case "short_text":
      return (
        <Form.Control
          id={field.id}
          type={field.type === "email" ? "email" : "text"}
          className="pv-input"
          maxLength={field.maxLength || undefined}
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => set(e.target.value)}
        />
      );

    case "long_text":
      return (
        <Form.Control
          id={field.id}
          as="textarea"
          rows={4}
          className="pv-input"
          maxLength={field.maxLength || undefined}
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => set(e.target.value)}
        />
      );

    case "number":
      return (
        <Form.Control
          id={field.id}
          type="number"
          className="pv-input"
          min={field.min}
          max={field.max}
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => set(e.target.value)}
        />
      );

    case "date":
      return (
        <Form.Control
          id={field.id}
          type="date"
          className="pv-input"
          value={value ?? ""}
          onChange={(e) => set(e.target.value)}
        />
      );

    /* Both render from field.parts, so every sub-label and placeholder is
       editable in the settings panel. */
    case "contact_info":
    case "address": {
      const v = value || {};
      const upd = (k, val) => set({ ...v, [k]: val });
      const parts = (field.parts || []).filter((p) => p.show);
      return (
        <div className="pv-parts">
          {parts.map((p) => (
            <div key={p.key} className="pv-part">
              <label className="pv-part-label" htmlFor={`${field.id}_${p.key}`}>
                {p.label}
              </label>
              {p.key === "phone" ? (
                <PhoneInput
                  id={`${field.id}_${p.key}`}
                  field={{ ...field, placeholder: p.placeholder }}
                  value={v[p.key] ?? ""}
                  set={(val) => upd(p.key, val)}
                  className="pv-line"
                />
              ) : (
                <input
                  id={`${field.id}_${p.key}`}
                  className="pv-line"
                  type={p.key === "email" ? "email" : "text"}
                  placeholder={p.placeholder}
                  value={v[p.key] ?? ""}
                  onChange={(e) => upd(p.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      );
    }

    case "multiple_choice": {
      const selected = field.multiple ? value || [] : value;
      const toggle = (opt) => {
        if (!field.multiple) return set(opt);
        const list = Array.isArray(selected) ? selected : [];
        set(list.includes(opt) ? list.filter((o) => o !== opt) : [...list, opt]);
      };
      const isOn = (opt) =>
        field.multiple ? (selected || []).includes(opt) : selected === opt;
      return (
        <div className="pv-options">
          {field.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={isOn(opt) ? "pv-opt pv-opt-on" : "pv-opt"}
              onClick={() => toggle(opt)}
            >
              <span className="pv-key">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          ))}
        </div>
      );
    }

    case "checkbox": {
      const list = Array.isArray(value) ? value : [];
      return (
        <div className="pv-stack">
          {field.options.map((opt, i) => (
            <Form.Check
              key={i}
              type="checkbox"
              id={`${field.id}_${i}`}
              label={opt}
              checked={list.includes(opt)}
              onChange={() =>
                set(list.includes(opt) ? list.filter((o) => o !== opt) : [...list, opt])
              }
            />
          ))}
        </div>
      );
    }

    case "dropdown":
      return (
        <Form.Select
          id={field.id}
          className="pv-input"
          value={value ?? ""}
          onChange={(e) => set(e.target.value)}
        >
          <option value="">{field.placeholder || "Select an option"}</option>
          {field.options.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </Form.Select>
      );

    case "picture_choice":
      return (
        <div className="pv-pics">
          {field.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              className={value === opt ? "pv-pic pv-pic-on" : "pv-pic"}
              onClick={() => set(opt)}
            >
              {field.images?.[i] ? (
                <img src={field.images[i]} alt="" />
              ) : (
                <span className="pv-pic-blank">
                  <ElementIcon name="image" size={22} />
                </span>
              )}
              <span className="pv-pic-label">{opt}</span>
            </button>
          ))}
        </div>
      );

    case "yes_no":
      return (
        <div className="pv-options pv-options-row">
          {["Yes", "No"].map((opt) => (
            <button
              key={opt}
              type="button"
              className={value === opt ? "pv-opt pv-opt-on" : "pv-opt"}
              onClick={() => set(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      );

    case "legal":
      return (
        <div className="pv-options pv-options-row">
          {["I accept", "I decline"].map((opt) => (
            <button
              key={opt}
              type="button"
              className={value === opt ? "pv-opt pv-opt-on" : "pv-opt"}
              onClick={() => set(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      );

    case "nps":
    case "opinion_scale": {
      const min = field.type === "nps" ? 0 : Number(field.min ?? 1);
      const max = field.type === "nps" ? 10 : Number(field.max ?? 5);
      const scale = [];
      for (let n = min; n <= max; n += 1) scale.push(n);
      return (
        <div>
          <div className="pv-scale">
            {scale.map((n) => (
              <button
                key={n}
                type="button"
                className={value === n ? "pv-scale-btn pv-scale-on" : "pv-scale-btn"}
                onClick={() => set(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="pv-scale-ends">
            <span>{field.lowLabel}</span>
            <span>{field.highLabel}</span>
          </div>
        </div>
      );
    }

    case "rating": {
      const steps = Number(field.steps ?? 5);
      const glyph = { star: "★", heart: "♥", thumb: "👍" }[field.shape] || "★";
      return (
        <div className="pv-rating">
          {Array.from({ length: steps }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={Number(value) >= n ? "pv-star pv-star-on" : "pv-star"}
              onClick={() => set(n)}
              aria-label={`${n} of ${steps}`}
            >
              {glyph}
            </button>
          ))}
        </div>
      );
    }

    case "ranking": {
      const order = Array.isArray(value) && value.length ? value : field.options;
      const move = (i, dir) => {
        const next = [...order];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        set(next);
      };
      return (
        <ol className="pv-rank">
          {order.map((opt, i) => (
            <li key={opt}>
              <span className="pv-rank-n">{i + 1}</span>
              <span className="pv-rank-label">{opt}</span>
              <span className="pv-rank-moves">
                <button type="button" onClick={() => move(i, -1)} aria-label="Move up">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} aria-label="Move down">
                  ↓
                </button>
              </span>
            </li>
          ))}
        </ol>
      );
    }

    case "matrix": {
      const v = value || {};
      return (
        <div className="pv-matrix-wrap">
          <table className="pv-matrix">
            <thead>
              <tr>
                <th />
                {field.columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {field.rows.map((r) => (
                <tr key={r}>
                  <th scope="row">{r}</th>
                  {field.columns.map((c) => (
                    <td key={c}>
                      <input
                        type="radio"
                        name={`${field.id}_${r}`}
                        checked={v[r] === c}
                        onChange={() => set({ ...v, [r]: c })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "signature":
      return (
        <div className="pv-sign">
          <span>Sign here</span>
        </div>
      );

    case "payment":
      return (
        <div className="pv-pay">
          <span className="pv-pay-amount">
            {field.currency === "INR" ? "₹" : field.currency === "USD" ? "$" : "€"}
            {Number(field.amount || 0).toLocaleString("en-IN")}
          </span>
          <Form.Control className="pv-input" placeholder="Card number" disabled />
          <div className="pv-grid">
            <Form.Control className="pv-input" placeholder="MM / YY" disabled />
            <Form.Control className="pv-input" placeholder="CVC" disabled />
          </div>
        </div>
      );

    case "file_upload":
      return (
        <label className="pv-upload">
          <ElementIcon name="upload" size={20} />
          <span>Choose a file</span>
          <small>
            {field.accept} · up to {field.maxSizeMb} MB
          </small>
          <input type="file" accept={field.accept} hidden />
        </label>
      );

    case "scheduler":
      return (
        <div className="pv-slots">
          {["09:00", "11:30", "14:00", "16:30"].map((slot) => (
            <button
              key={slot}
              type="button"
              className={value === slot ? "pv-opt pv-opt-on" : "pv-opt"}
              onClick={() => set(slot)}
            >
              {slot}
              <small>{field.durationMins} min</small>
            </button>
          ))}
        </div>
      );

    default:
      return null;
  }
}