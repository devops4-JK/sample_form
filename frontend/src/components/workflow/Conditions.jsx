import { useMemo } from "react";
import { BY_TYPE } from "../../constants/formElements";
import { NO_VALUE, OPS_BY_KIND, OP_LABELS, SCORE, choiceOptions, kindOf } from "./engine";
import { pageLabel } from "./graph";

/**
 * Conditions, shared by every part of the Workflow tab: logic routes,
 * calculations, tags and endings. A condition can look at
 *
 *   a question's answer       (on this page or before it, for routes)
 *   a value from the link     ("hidden:<key>")
 *   a variable or the score   ("var:<name>")
 */

export const Glyph = ({ d, size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const ICONS = {
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  arrow: "M5 12h14M13 6l6 6-6 6",
  warn: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0",
};

export const newId = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Everything a condition may point at, grouped for the picker. `upTo` is
 * the last page whose questions are allowed; -1 means every page.
 */
export function useRefs(pages, workflow, upTo) {
  return useMemo(() => {
    const out = [];
    pages.slice(0, upTo < 0 ? pages.length : upTo + 1).forEach((p, i) =>
      (p.fields || []).forEach((f) => {
        const kind = kindOf(f);
        if (!kind) return;
        out.push({
          ref: f.id,
          group: pageLabel(pages, i),
          label: f.label || BY_TYPE[f.type]?.label || "Untitled question",
          kind,
          options: kind === "choice" ? choiceOptions(f) : [],
          pageIndex: i,
        });
      })
    );
    (workflow?.hidden || []).forEach((h) =>
      out.push({ ref: `hidden:${h.key}`, group: "From the link", label: h.key, kind: "text", options: [] })
    );
    out.push({ ref: `var:${SCORE}`, group: "Variables", label: "score", kind: "number", options: [] });
    (workflow?.variables || []).forEach((v) =>
      out.push({ ref: `var:${v.name}`, group: "Variables", label: v.name, kind: v.type === "text" ? "text" : "number", options: [] })
    );
    return out;
  }, [pages, workflow, upTo]);
}

export const blankCondition = (ref) => ({
  fieldId: ref ? ref.ref : "",
  op: ref ? OPS_BY_KIND[ref.kind][0] : "is",
  value: "",
});

/** One "thing · comparison · value" line. */
export function ConditionRow({ cond, refs, onChange, onRemove, canRemove, joiner }) {
  const ref = refs.find((r) => r.ref === cond.fieldId) || null;
  const ops = ref ? OPS_BY_KIND[ref.kind] : [];

  const groups = refs.reduce((acc, r) => {
    (acc[r.group] = acc[r.group] || []).push(r);
    return acc;
  }, {});

  return (
    <div className="wf-cond">
      <span className="wf-cond-joiner">{joiner}</span>
      <div className="wf-cond-fields">
        <select
          className={`wf-input wf-cond-q${!ref ? " is-empty" : ""}`}
          value={ref ? cond.fieldId : ""}
          onChange={(e) => onChange(blankCondition(refs.find((r) => r.ref === e.target.value)))}
          aria-label="What to check"
        >
          <option value="">Choose what to check…</option>
          {Object.entries(groups).map(([label, list]) => (
            <optgroup key={label} label={label}>
              {list.map((r) => (
                <option key={r.ref} value={r.ref}>
                  {r.group === "From the link" ? `🔗 ${r.label}` : r.group === "Variables" ? `# ${r.label}` : r.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <select
          className="wf-input wf-cond-op"
          value={ops.includes(cond.op) ? cond.op : ops[0] || ""}
          onChange={(e) =>
            onChange({ ...cond, op: e.target.value, value: NO_VALUE.has(e.target.value) ? "" : cond.value })
          }
          disabled={!ref}
          aria-label="Comparison"
        >
          {ops.map((op) => (
            <option key={op} value={op}>
              {OP_LABELS[op]}
            </option>
          ))}
        </select>

        {ref && !NO_VALUE.has(cond.op) &&
          (ref.options.length ? (
            <select
              className={`wf-input wf-cond-val${cond.value === "" ? " is-empty" : ""}`}
              value={cond.value}
              onChange={(e) => onChange({ ...cond, value: e.target.value })}
              aria-label="Value"
            >
              <option value="">Choose an answer…</option>
              {ref.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="wf-input wf-cond-val"
              type={ref.kind === "number" ? "number" : "text"}
              value={cond.value}
              maxLength={200}
              placeholder={ref.kind === "number" ? "0" : "Type a value"}
              onChange={(e) => onChange({ ...cond, value: e.target.value })}
              aria-label="Value"
            />
          ))}
      </div>
      <button
        type="button"
        className="wf-icon"
        onClick={onRemove}
        disabled={!canRemove}
        title={canRemove ? "Remove this condition" : "At least one condition is needed"}
        aria-label="Remove condition"
      >
        <Glyph d={ICONS.x} size={14} />
      </button>
    </div>
  );
}

/** All / Any switch, shown once there is more than one condition. */
export function MatchSwitch({ match, onChange }) {
  return (
    <div className="wf-seg" role="group" aria-label="How conditions combine">
      {["all", "any"].map((m) => (
        <button
          key={m}
          type="button"
          className={(match === "any" ? "any" : "all") === m ? "is-on" : ""}
          onClick={() => onChange(m)}
        >
          {m === "all" ? "All match" : "Any match"}
        </button>
      ))}
    </div>
  );
}

/**
 * The conditions of a calculation, tag or ending. None at all means
 * "always", which is said in words so it is never a surprise.
 */
export function ConditionList({ item, refs, onChange, alwaysLabel = "Always" }) {
  const conds = item.conditions || [];
  const set = (patch) => onChange({ ...item, ...patch });
  return (
    <div className="wf-clist">
      {conds.length === 0 ? (
        <div className="wf-cond">
          <span className="wf-cond-joiner">When</span>
          <span className="wf-always">{alwaysLabel}</span>
        </div>
      ) : (
        conds.map((c, ci) => (
          <ConditionRow
            key={ci}
            cond={c}
            refs={refs}
            joiner={ci === 0 ? "When" : item.match === "any" ? "or" : "and"}
            canRemove
            onChange={(next) => set({ conditions: conds.map((x, i) => (i === ci ? next : x)) })}
            onRemove={() => set({ conditions: conds.filter((_, i) => i !== ci) })}
          />
        ))
      )}
      <div className="wf-clist-foot">
        {conds.length < 10 && (
          <button type="button" className="wf-link" onClick={() => set({ conditions: [...conds, blankCondition(refs[0])] })}>
            <Glyph d={ICONS.plus} size={13} /> {conds.length ? "Add condition" : "Only when…"}
          </button>
        )}
        {conds.length > 1 && <MatchSwitch match={item.match} onChange={(match) => set({ match })} />}
      </div>
    </div>
  );
}








 