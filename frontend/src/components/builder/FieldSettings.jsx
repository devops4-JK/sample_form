import { Form } from "react-bootstrap";
import { BY_TYPE } from "../../constants/formElements";
import { ElementTile } from "./AddContentModal";
import { ImagePicker } from "../design/controls";
import MediaSettings from "./MediaSettings";
import { ProductListEditor, ProductSetsEditor } from "./ProductEditor";
import SettingsSection, { SectionGroup } from "./SettingsSection";

/* Small inline icons for the panel. */
const I = {
  copy: "M8 8h11v11H8z M5 16H4V4h12v1",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
};
function Glyph({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** A labelled input. Every setting in the panel goes through this. */
function Field({ label, hint, children }) {
  return (
    <label className="fb-field">
      <span className="fb-label">{label}</span>
      {children}
      {hint && <span className="fb-hint">{hint}</span>}
    </label>
  );
}

/* Each settings group opens and closes; see SettingsSection.jsx. */
const Section = SettingsSection;

/** One editable row in a list (options, matrix rows, matrix columns). */
function ListEditor({ items, noun, onEdit, onAdd, onRemove, extra }) {
  return (
    <div className="fb-list">
      {items.map((item, i) => (
        <div key={i} className="fb-list-row">
          <span className="fb-list-n">{i + 1}</span>
          <div className="fb-list-inputs">
            <input
              className="fb-input"
              value={item}
              onChange={(e) => onEdit(i, e.target.value)}
              aria-label={`${noun} ${i + 1}`}
            />
            {extra?.(i)}
          </div>
          <button
            type="button"
            className="fb-icon fb-icon-danger"
            onClick={() => onRemove(i)}
            disabled={items.length <= 1}
            aria-label={`Remove ${noun.toLowerCase()} ${i + 1}`}
            title={items.length <= 1 ? `Keep at least one ${noun.toLowerCase()}` : `Remove ${noun.toLowerCase()}`}
          >
            <Glyph d={I.x} size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="fb-add-row" onClick={onAdd}>
        <Glyph d={I.plus} size={14} />
        Add {noun.toLowerCase()}
      </button>
    </div>
  );
}

/**
 * The right-hand panel. It reads `caps` from the element catalog and shows
 * only the controls that element supports, so adding a new element type
 * needs no changes here.
 *
 * `confirm` comes from useConfirm(); every removal goes through it.
 */
export default function FieldSettings({ field, position, onChange, onDelete, onDuplicate, confirm }) {
  const spec = BY_TYPE[field.type];
  const caps = spec.caps;
  const set = (patch) => onChange({ ...field, ...patch });
  const isScreen = field.type === "welcome_screen" || field.type === "end_screen";

  const editList = (key) => (i, v) => {
    const list = [...field[key]];
    list[i] = v;
    set({ [key]: list });
  };

  const removeFromList = (key, noun) => async (i) => {
    const value = field[key][i];
    const ok = await confirm({
      title: `Remove this ${noun}?`,
      body: `“${value || `${noun} ${i + 1}`}” will be removed from this question. Answers already collected are kept.`,
      action: `Remove ${noun}`,
    });
    if (!ok) return;
    const patch = { [key]: field[key].filter((_, n) => n !== i) };
    if (key === "options" && field.images) patch.images = field.images.filter((_, n) => n !== i);
    set(patch);
  };

  const setImage = (i, v) => {
    const images = [...(field.images || [])];
    images[i] = v;
    set({ images });
  };

  const setPart = (i, patch) =>
    set({ parts: field.parts.map((p, n) => (n === i ? { ...p, ...patch } : p)) });

  const hasRules = caps.required || caps.multiple;
  const hasSettings =
    caps.range || caps.scaleLabels || caps.steps || caps.maxLength || caps.dateFormat ||
    caps.payment || caps.file || caps.duration;
  const hasExtras = caps.button || caps.url;

  return (
    <aside className="fb-panel fb-panel-right" aria-label="Question settings">
      <header className="fb-panel-head">
        <ElementTile element={spec} size={15} />
        <div className="fb-panel-titles">
          <span className="fb-panel-title">{spec.name}</span>
          {position && <span className="fb-panel-sub">{position}</span>}
        </div>
        <button type="button" className="fb-icon" onClick={onDuplicate} aria-label="Duplicate" title="Duplicate">
          <Glyph d={I.copy} />
        </button>
        <button type="button" className="fb-icon fb-icon-danger" onClick={onDelete} aria-label="Delete" title="Delete">
          <Glyph d={I.trash} />
        </button>
      </header>

      <div className="fb-panel-body">
        {/* One section open at a time; a new question starts on Content. */}
        <SectionGroup key={field.id} initial="Content">
        <Section title="Content">
          <Field label={isScreen ? "Heading" : "Question"}>
            <textarea
              className="fb-input fb-textarea"
              rows={2}
              value={field.label}
              onChange={(e) => set({ label: e.target.value })}
            />
          </Field>

          {caps.placeholder && (
            <Field label="Placeholder" hint="The grey hint shown inside the empty box.">
              <input
                className="fb-input"
                value={field.placeholder ?? ""}
                onChange={(e) => set({ placeholder: e.target.value })}
              />
            </Field>
          )}

          {caps.help && (
            <Field label="Description">
              <textarea
                className="fb-input fb-textarea"
                rows={2}
                value={field.help ?? ""}
                onChange={(e) => set({ help: e.target.value })}
                placeholder="Optional"
              />
            </Field>
          )}
        </Section>

        {hasRules && (
          <Section title="Rules">
            {caps.required && (
              <Form.Check
                type="switch"
                id={`req_${field.id}`}
                className="fb-switch"
                label="Required"
                checked={Boolean(field.required)}
                onChange={(e) => set({ required: e.target.checked })}
              />
            )}
            {caps.multiple && (
              <Form.Check
                type="switch"
                id={`multi_${field.id}`}
                className="fb-switch"
                label="Allow more than one answer"
                checked={Boolean(field.multiple)}
                onChange={(e) => set({ multiple: e.target.checked })}
              />
            )}
          </Section>
        )}

        {caps.products && (
          <Section title="Products">
            <p className="fb-hint fb-hint-top">
              People pick one. Each product has a picture, a name and a description.
            </p>
            <ProductListEditor
              products={field.products}
              onChange={(products) => set({ products })}
              confirm={confirm}
            />
          </Section>
        )}

        {caps.productSets && (
          <Section title="Product options">
            <p className="fb-hint fb-hint-top">
              People pick one product from every option, so three options means three products.
            </p>
            <ProductSetsEditor
              groups={field.groups}
              onChange={(groups) => set({ groups })}
              confirm={confirm}
            />
          </Section>
        )}

        {caps.options && (
          <Section title="Options">
            <ListEditor
              items={field.options}
              noun="Option"
              onEdit={editList("options")}
              onAdd={() => set({ options: [...field.options, `Option ${field.options.length + 1}`] })}
              onRemove={removeFromList("options", "option")}
              extra={
                caps.images
                  ? (i) => (
                      <ImagePicker
                        value={field.images?.[i] ?? ""}
                        onChange={(src) => setImage(i, src)}
                        label={`Picture for option ${i + 1}`}
                        cta="Add a picture"
                        hint="Drop a file here"
                      />
                    )
                  : undefined
              }
            />
          </Section>
        )}

        {caps.matrix && (
          <>
            <Section title="Rows">
              <ListEditor
                items={field.rows}
                noun="Row"
                onEdit={editList("rows")}
                onAdd={() => set({ rows: [...field.rows, `Row ${field.rows.length + 1}`] })}
                onRemove={removeFromList("rows", "row")}
              />
            </Section>
            <Section title="Columns">
              <ListEditor
                items={field.columns}
                noun="Column"
                onEdit={editList("columns")}
                onAdd={() => set({ columns: [...field.columns, `Column ${field.columns.length + 1}`] })}
                onRemove={removeFromList("columns", "column")}
              />
            </Section>
          </>
        )}

        {caps.parts && (
          <Section title="Sub-fields">
            <p className="fb-hint fb-hint-top">Each one has its own label and placeholder.</p>
            {(field.parts || []).map((part, i) => (
              <div key={part.key} className={part.show ? "fb-part" : "fb-part is-off"}>
                <div className="fb-part-head">
                  <span className="fb-part-name">{part.label || part.key}</span>
                  <Form.Check
                    type="switch"
                    id={`${field.id}_${part.key}_show`}
                    className="fb-switch fb-switch-sm"
                    label={part.show ? "Shown" : "Hidden"}
                    checked={Boolean(part.show)}
                    onChange={(e) => setPart(i, { show: e.target.checked })}
                  />
                </div>
                <Field label="Label">
                  <input className="fb-input fb-input-sm" value={part.label}
                    onChange={(e) => setPart(i, { label: e.target.value })} />
                </Field>
                <Field label="Placeholder">
                  <input className="fb-input fb-input-sm" value={part.placeholder}
                    onChange={(e) => setPart(i, { placeholder: e.target.value })} />
                </Field>
              </div>
            ))}
          </Section>
        )}

        {hasSettings && (
          <Section title="Settings">
            {caps.range && (
              <div className="fb-pair">
                <Field label="Minimum">
                  <input type="number" className="fb-input" value={field.min ?? 0}
                    onChange={(e) => set({ min: Number(e.target.value) })} />
                </Field>
                <Field label="Maximum">
                  <input type="number" className="fb-input" value={field.max ?? 10}
                    onChange={(e) => set({ max: Number(e.target.value) })} />
                </Field>
              </div>
            )}

            {caps.scaleLabels && (
              <div className="fb-pair">
                <Field label="Low end label">
                  <input className="fb-input" value={field.lowLabel ?? ""}
                    onChange={(e) => set({ lowLabel: e.target.value })} />
                </Field>
                <Field label="High end label">
                  <input className="fb-input" value={field.highLabel ?? ""}
                    onChange={(e) => set({ highLabel: e.target.value })} />
                </Field>
              </div>
            )}

            {caps.steps && (
              <div className="fb-pair">
                <Field label="Steps">
                  <input type="number" min={2} max={10} className="fb-input" value={field.steps ?? 5}
                    onChange={(e) => set({ steps: Number(e.target.value) })} />
                </Field>
                {caps.shape && (
                  <Field label="Shape">
                    <select className="fb-input" value={field.shape ?? "star"}
                      onChange={(e) => set({ shape: e.target.value })}>
                      <option value="star">Star</option>
                      <option value="heart">Heart</option>
                      <option value="thumb">Thumb</option>
                    </select>
                  </Field>
                )}
              </div>
            )}

            {caps.maxLength && (
              <Field label="Character limit">
                <input type="number" min={1} className="fb-input" value={field.maxLength ?? 100}
                  onChange={(e) => set({ maxLength: Number(e.target.value) })} />
              </Field>
            )}

            {caps.dateFormat && (
              <Field label="Date format">
                <select className="fb-input" value={field.format ?? "DD/MM/YYYY"}
                  onChange={(e) => set({ format: e.target.value })}>
                  <option>DD/MM/YYYY</option>
                  <option>MM/DD/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </Field>
            )}

            {caps.payment && (
              <div className="fb-pair">
                <Field label="Currency">
                  <select className="fb-input" value={field.currency ?? "INR"}
                    onChange={(e) => set({ currency: e.target.value })}>
                    <option>INR</option>
                    <option>USD</option>
                    <option>EUR</option>
                  </select>
                </Field>
                <Field label="Amount">
                  <input type="number" min={0} className="fb-input" value={field.amount ?? 0}
                    onChange={(e) => set({ amount: Number(e.target.value) })} />
                </Field>
              </div>
            )}

            {caps.file && (
              <div className="fb-pair">
                <Field label="Accepted types">
                  <input className="fb-input" value={field.accept ?? ""} placeholder=".pdf,.png"
                    onChange={(e) => set({ accept: e.target.value })} />
                </Field>
                <Field label="Max size (MB)">
                  <input type="number" min={1} className="fb-input" value={field.maxSizeMb ?? 10}
                    onChange={(e) => set({ maxSizeMb: Number(e.target.value) })} />
                </Field>
              </div>
            )}

            {caps.duration && (
              <Field label="Slot length (minutes)">
                <input type="number" min={5} step={5} className="fb-input" value={field.durationMins ?? 30}
                  onChange={(e) => set({ durationMins: Number(e.target.value) })} />
              </Field>
            )}
          </Section>
        )}

        {hasExtras && (
          <Section title={caps.url ? "Redirect" : "Button"}>
            {caps.button && (
              <Field label="Button text" hint="Leave empty to hide the button.">
                <input className="fb-input" value={field.buttonText ?? ""}
                  onChange={(e) => set({ buttonText: e.target.value })} />
              </Field>
            )}
            {caps.url && (
              <Field label="Send people to">
                <input className="fb-input" value={field.url ?? ""} placeholder="https://…"
                  onChange={(e) => set({ url: e.target.value })} />
              </Field>
            )}
          </Section>
        )}

        {/* The screen's background and where it sits. The same controls a
            page has, so they behave the same way. */}
        {caps.image && <MediaSettings owner={field} onChange={set} kind="screen" />}
        </SectionGroup>
      </div>
    </aside>
  );
}