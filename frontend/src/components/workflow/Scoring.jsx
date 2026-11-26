import { useMemo, useState } from "react";
import { BY_TYPE } from "../../constants/formElements";
import { CALC_OPS, NAME_RE, SCORE, choiceOptions, kindOf } from "./engine";
import { ConditionList, Glyph, ICONS, newId, useRefs } from "./Conditions";
import { pageLabel } from "./graph";

/**
 * Variables and scoring.
 *
 *   Variables        the built-in score, plus numbers or text of your own
 *   Points           points per answer, added to the score
 *   Calculations     "after page 2, when …, add 5 to bonus"
 *
 * Points and calculations run when someone presses Next on a page, before
 * that page's logic routes are checked, so a route can jump on the score.
 */

function Variables({ workflow, setWorkflow }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("number");
  const [problem, setProblem] = useState("");
  const vars = workflow.variables || [];
  const taken = new Set([SCORE, ...vars.map((v) => v.name), ...(workflow.hidden || []).map((h) => h.key)]);

  const update = (i, patch) =>
    setWorkflow((w) => ({ ...w, variables: (w.variables || []).map((v, k) => (k === i ? { ...v, ...patch } : v)) }));

  const add = () => {
    const n = name.trim().toLowerCase();
    if (!NAME_RE.test(n)) return setProblem("Start with a letter; use only a–z, 0–9 and _.");
    if (taken.has(n)) return setProblem(`“${n}” is already in use.`);
    if (vars.length >= 20) return setProblem("Up to 20 variables.");
    setWorkflow((w) => ({ ...w, variables: [...(w.variables || []), { name: n, type, initial: type === "text" ? "" : 0 }] }));
    setName("");
    setProblem("");
    return undefined;
  };

  return (
    <section className="wf-card">
      <header className="wf-card-head">
        <span className="wf-card-icon" aria-hidden="true">#</span>
        <div>
          <h3>Variables</h3>
          <p>Values that change as people answer. Show one in a question or ending with {"{{name}}"}.</p>
        </div>
      </header>

      <div className="wf-table">
        <div className="wf-tr wf-th">
          <span>Name</span>
          <span>Type</span>
          <span>Starts at</span>
          <span />
        </div>
        <div className="wf-tr">
          <span>
            <code>score</code> <em className="wf-badge">built in</em>
          </span>
          <span>Number</span>
          <span>0</span>
          <span />
        </div>
        {vars.map((v, i) => (
          <div className="wf-tr" key={v.name}>
            <span>
              <code>{v.name}</code>
            </span>
            <span>{v.type === "text" ? "Text" : "Number"}</span>
            <span>
              <input
                className="wf-input wf-input-sm"
                type={v.type === "text" ? "text" : "number"}
                value={v.initial}
                maxLength={200}
                onChange={(e) => update(i, { initial: v.type === "text" ? e.target.value : e.target.value === "" ? 0 : Number(e.target.value) })}
                aria-label={`${v.name} starts at`}
              />
            </span>
            <span>
              <button
                type="button"
                className="wf-icon wf-icon-danger"
                onClick={() => setWorkflow((w) => ({ ...w, variables: (w.variables || []).filter((x) => x.name !== v.name) }))}
                aria-label={`Delete ${v.name}`}
                title="Delete"
              >
                <Glyph d={ICONS.trash} />
              </button>
            </span>
          </div>
        ))}
      </div>

      <form
        className="wf-inline-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className="wf-input"
          value={name}
          maxLength={32}
          placeholder="New variable, e.g. bonus, level"
          onChange={(e) => {
            setName(e.target.value);
            setProblem("");
          }}
          aria-label="New variable name"
        />
        <select className="wf-input wf-input-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
          <option value="number">Number</option>
          <option value="text">Text</option>
        </select>
        <button type="submit" className="fb-btn fb-btn-sm" disabled={!name.trim()}>
          <Glyph d={ICONS.plus} size={13} /> Add
        </button>
      </form>
      {problem && <p className="wf-warn">{problem}</p>}
    </section>
  );
}

function Points({ pages, workflow, setWorkflow }) {
  const scored = useMemo(() => {
    const out = [];
    pages.forEach((p, i) =>
      (p.fields || []).forEach((f) => {
        const kind = kindOf(f);
        if (kind === "choice" || kind === "number") out.push({ f, kind, page: pageLabel(pages, i) });
      })
    );
    return out;
  }, [pages]);

  const [open, setOpen] = useState(() => new Set());
  const scoring = workflow.scoring || {};

  const setRule = (fieldId, rule) =>
    setWorkflow((w) => {
      const next = { ...(w.scoring || {}) };
      const empty = !rule.addAnswer && !Object.values(rule.points || {}).some((p) => Number(p));
      if (empty) delete next[fieldId];
      else next[fieldId] = rule;
      return { ...w, scoring: next };
    });

  const total = (fieldId) => {
    const r = scoring[fieldId];
    if (!r) return null;
    const pts = Object.values(r.points || {}).filter((p) => Number(p)).length;
    return [pts ? `${pts} answer${pts === 1 ? "" : "s"} scored` : "", r.addAnswer ? "adds the answer" : ""].filter(Boolean).join(" · ");
  };

  return (
    <section className="wf-card">
      <header className="wf-card-head">
        <span className="wf-card-icon" aria-hidden="true">★</span>
        <div>
          <h3>Points per answer</h3>
          <p>Give answers points — for a quiz, an assessment or a lead score. They add up into {"{{score}}"}.</p>
        </div>
      </header>

      {scored.length === 0 && <p className="wf-muted">Add a choice, rating or number question in Content to score it.</p>}

      <div className="wf-accordion">
        {scored.map(({ f, kind, page }) => {
          const rule = scoring[f.id] || { points: {}, addAnswer: false };
          const isOpen = open.has(f.id);
          const summary = total(f.id);
          return (
            <div key={f.id} className={isOpen ? "wf-acc is-open" : "wf-acc"}>
              <button
                type="button"
                className="wf-acc-head"
                onClick={() =>
                  setOpen((s) => {
                    const n = new Set(s);
                    if (n.has(f.id)) n.delete(f.id);
                    else n.add(f.id);
                    return n;
                  })
                }
                aria-expanded={isOpen}
              >
                <span className="wf-acc-title">
                  {f.label || BY_TYPE[f.type]?.label}
                  <small>{page}</small>
                </span>
                {summary && <span className="wf-chip is-on">{summary}</span>}
                <Glyph d={isOpen ? ICONS.up : ICONS.down} />
              </button>
              {isOpen && (
                <div className="wf-acc-body">
                  {kind === "choice" &&
                    choiceOptions(f).map((o) => (
                      <label key={o} className="wf-point">
                        <span>{o}</span>
                        <input
                          className="wf-input wf-input-sm"
                          type="number"
                          value={rule.points?.[o] ?? ""}
                          placeholder="0"
                          onChange={(e) =>
                            setRule(f.id, { ...rule, points: { ...(rule.points || {}), [o]: e.target.value === "" ? 0 : Number(e.target.value) } })
                          }
                          aria-label={`Points for ${o}`}
                        />
                        <em>points</em>
                      </label>
                    ))}
                  {kind === "choice" && f.type === "checkbox" && (
                    <p className="wf-muted">Several can be ticked; their points add up.</p>
                  )}
                  {kind === "number" && (
                    <label className="wf-toggle-row">
                      <input
                        type="checkbox"
                        checked={Boolean(rule.addAnswer)}
                        onChange={(e) => setRule(f.id, { ...rule, addAnswer: e.target.checked })}
                      />
                      Add the number given (e.g. a rating of 4 adds 4 points)
                    </label>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CalcCard({ calc, index, count, pages, workflow, onChange, onMove, onRemove }) {
  const pageIndex = Math.max(0, pages.findIndex((p) => p.id === calc.pageId));
  const refs = useRefs(pages, workflow, pageIndex);
  const vars = [{ name: SCORE, type: "number" }, ...(workflow.variables || [])];
  const target = vars.find((v) => v.name === calc.variable);
  const isText = target && target.type === "text";

  return (
    <div className="wf-route" style={{ "--wf-c": "#7c3aed" }}>
      <header className="wf-route-head">
        <span className="wf-route-tag">Calculation {index + 1}</span>
        <span className="wf-route-sub">
          after
          <select
            className="wf-input wf-input-auto"
            value={calc.pageId}
            onChange={(e) => onChange({ ...calc, pageId: e.target.value, conditions: [] })}
            aria-label="After which page"
          >
            {pages.map((p, i) => (
              <option key={p.id} value={p.id}>
                {pageLabel(pages, i)}
              </option>
            ))}
          </select>
        </span>
        <span className="wf-route-tools">
          <button type="button" className="wf-icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up">
            <Glyph d={ICONS.up} />
          </button>
          <button type="button" className="wf-icon" onClick={() => onMove(1)} disabled={index === count - 1} aria-label="Move down">
            <Glyph d={ICONS.down} />
          </button>
          <button type="button" className="wf-icon wf-icon-danger" onClick={onRemove} aria-label="Delete calculation">
            <Glyph d={ICONS.trash} />
          </button>
        </span>
      </header>
      <div className="wf-route-body">
        <ConditionList item={calc} refs={refs} onChange={onChange} alwaysLabel="Always, whenever this page is passed" />
        <div className="wf-goto wf-calc">
          <span className="wf-goto-label">Then</span>
          <select
            className="wf-input wf-input-auto"
            value={isText ? "set" : calc.op}
            onChange={(e) => onChange({ ...calc, op: e.target.value })}
            aria-label="Operation"
          >
            {Object.entries(CALC_OPS)
              .filter(([op]) => !isText || op === "set")
              .map(([op, label]) => (
                <option key={op} value={op}>
                  {label}
                </option>
              ))}
          </select>
          {!isText && (
            <input
              className="wf-input wf-input-sm"
              type="number"
              value={calc.value}
              onChange={(e) => onChange({ ...calc, value: e.target.value })}
              aria-label="Amount"
            />
          )}
          <span className="wf-calc-word">{calc.op === "add" ? "to" : calc.op === "subtract" ? "from" : ""}</span>
          <select
            className={`wf-input wf-input-auto${target ? "" : " is-empty"}`}
            value={target ? calc.variable : ""}
            onChange={(e) => {
              const v = vars.find((x) => x.name === e.target.value);
              onChange({ ...calc, variable: e.target.value, op: v && v.type === "text" ? "set" : calc.op === "set" ? "add" : calc.op });
            }}
            aria-label="Variable"
          >
            <option value="">Choose a variable…</option>
            {vars.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
          {isText && (
            <>
              <span className="wf-calc-word">to</span>
              <input
                className="wf-input"
                value={calc.value}
                maxLength={200}
                placeholder="Text"
                onChange={(e) => onChange({ ...calc, value: e.target.value })}
                aria-label="Text value"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Calculations({ pages, workflow, setWorkflow }) {
  const calcs = workflow.calcs || [];
  const set = (list) => setWorkflow((w) => ({ ...w, calcs: list }));

  return (
    <section className="wf-card">
      <header className="wf-card-head">
        <span className="wf-card-icon" aria-hidden="true">ƒ</span>
        <div>
          <h3>Calculations</h3>
          <p>Change a variable when someone passes a page. They run in this order, after that page's points.</p>
        </div>
      </header>

      {calcs.map((c, i) => (
        <CalcCard
          key={c.id || i}
          calc={c}
          index={i}
          count={calcs.length}
          pages={pages}
          workflow={workflow}
          onChange={(next) => set(calcs.map((x, k) => (k === i ? next : x)))}
          onRemove={() => set(calcs.filter((_, k) => k !== i))}
          onMove={(by) => {
            const list = [...calcs];
            const [x] = list.splice(i, 1);
            list.splice(i + by, 0, x);
            set(list);
          }}
        />
      ))}

      {calcs.length < 100 && (
        <button
          type="button"
          className="wf-add"
          disabled={!pages.length}
          onClick={() =>
            set([...calcs, { id: newId("c"), pageId: pages[0]?.id, match: "all", conditions: [], variable: SCORE, op: "add", value: "1" }])
          }
        >
          <Glyph d={ICONS.plus} size={14} /> Add a calculation
        </button>
      )}
    </section>
  );
}

export default function Scoring(props) {
  return (
    <div className="wf-col">
      <Variables {...props} />
      <Points {...props} />
      <Calculations {...props} />
    </div>
  );
}