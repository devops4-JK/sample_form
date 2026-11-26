import { ConditionRow, Glyph, ICONS as I, MatchSwitch, blankCondition, newId, useRefs } from "./Conditions";
import { OTHERWISE_COLOR, pageLabel, routeColor, ruleIsComplete } from "./graph";

/**
 * The routes leaving one page.
 *
 * Each route reads as a sentence — "When [question] [is] [answer] … go to
 * [page]" — on a card with a coloured rail that matches its lane on the
 * flow map. Routes are tried top to bottom and the first that matches
 * wins, so they can be moved up and down. Below them sits the "otherwise"
 * card: where everyone else goes.
 */

const LIMIT_RULES = 20;
const LIMIT_CONDITIONS = 10;

/** The "go to" picker: later pages, or the end of the form. */
function TargetSelect({ pages, pageIndex, value, onChange, withNext, label }) {
  const later = pages.map((p, i) => ({ p, i })).filter(({ i }) => i > pageIndex);
  const valid = value === "end" || later.some(({ p }) => p.id === value) || (withNext && (!value || value === "next"));
  return (
    <select
      className={`wf-input wf-target${valid ? "" : " is-empty"}`}
      value={valid ? value || (withNext ? "next" : "") : ""}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
    >
      {withNext ? (
        <option value="next">
          {pageIndex + 1 < pages.length ? `The next page (${pageLabel(pages, pageIndex + 1)})` : "Finish & submit"}
        </option>
      ) : (
        <option value="">Choose where to go…</option>
      )}
      {later.map(({ p, i }) => (
        <option key={p.id} value={p.id}>
          {pageLabel(pages, i)}
        </option>
      ))}
      <option value="end">Finish &amp; submit</option>
    </select>
  );
}

export default function RuleEditor({ pages, pageIndex, cfg, onChange, workflow }) {
  const page = pages[pageIndex];
  const rules = cfg?.rules || [];
  const otherwise = cfg?.otherwise || "next";

  /* What a route on this page may test: questions on this page and earlier
     ones, values from the link, and variables. */
  const refs = useRefs(pages, workflow, pageIndex);
  const ownFirst =
    refs.find((r) => r.pageIndex === pageIndex) || refs.filter((r) => r.pageIndex !== undefined).pop() || refs[0];

  const save = (patch) => onChange({ rules, otherwise, ...patch });
  const setRule = (ri, rule) => save({ rules: rules.map((r, i) => (i === ri ? rule : r)) });
  const move = (ri, by) => {
    const list = [...rules];
    const [r] = list.splice(ri, 1);
    list.splice(ri + by, 0, r);
    save({ rules: list });
  };

  const blank = () => blankCondition(ownFirst);

  const addRule = () =>
    save({
      rules: [...rules, { id: newId("r"), match: "all", conditions: [blank()], goTo: "" }],
    });

  const isLast = pageIndex === pages.length - 1;

  return (
    <div className="wf-editor">
      <div className="wf-editor-head">
        <span className="wf-editor-kicker">Routes leaving</span>
        <h3 className="wf-editor-title">{pageLabel(pages, pageIndex)}</h3>
        <p className="wf-editor-sub">
          Checked top to bottom when someone presses Next. The first route that matches decides where they go.
        </p>
      </div>

      {!refs.some((r) => r.pageIndex !== undefined) && (
        <div className="wf-note">
          <Glyph d={I.warn} />
          <span>
            There are no questions on this page or before it yet, so there is nothing to branch on. Add a question in
            Content, or set where this page goes below.
          </span>
        </div>
      )}

      {rules.map((rule, ri) => {
        const color = routeColor(ri);
        const complete = ruleIsComplete(rule, pages, pageIndex, workflow);
        const conds = rule.conditions || [];
        return (
          <section key={rule.id || ri} className="wf-route" style={{ "--wf-c": color }}>
            <header className="wf-route-head">
              <span className="wf-route-tag">Route {ri + 1}</span>
              {conds.length > 1 && (
                <MatchSwitch match={rule.match} onChange={(match) => setRule(ri, { ...rule, match })} />
              )}
              <span className="wf-route-tools">
                <button type="button" className="wf-icon" onClick={() => move(ri, -1)} disabled={ri === 0} aria-label="Move route up" title="Move up">
                  <Glyph d={I.up} />
                </button>
                <button type="button" className="wf-icon" onClick={() => move(ri, 1)} disabled={ri === rules.length - 1} aria-label="Move route down" title="Move down">
                  <Glyph d={I.down} />
                </button>
                <button
                  type="button"
                  className="wf-icon wf-icon-danger"
                  onClick={() => save({ rules: rules.filter((_, i) => i !== ri) })}
                  aria-label="Delete route"
                  title="Delete route"
                >
                  <Glyph d={I.trash} />
                </button>
              </span>
            </header>

            <div className="wf-route-body">
              {conds.map((c, ci) => (
                <ConditionRow
                  key={ci}
                  cond={c}
                  refs={refs}
                  joiner={ci === 0 ? "When" : rule.match === "any" ? "or" : "and"}
                  canRemove={conds.length > 1}
                  onChange={(next) => setRule(ri, { ...rule, conditions: conds.map((x, i) => (i === ci ? next : x)) })}
                  onRemove={() => setRule(ri, { ...rule, conditions: conds.filter((_, i) => i !== ci) })}
                />
              ))}

              {conds.length < LIMIT_CONDITIONS && (
                <button
                  type="button"
                  className="wf-link"
                  onClick={() => setRule(ri, { ...rule, conditions: [...conds, blank()] })}
                >
                  <Glyph d={I.plus} size={13} /> Add condition
                </button>
              )}

              <div className="wf-goto">
                <span className="wf-goto-label">
                  <Glyph d={I.arrow} size={14} /> Go to
                </span>
                <TargetSelect
                  pages={pages}
                  pageIndex={pageIndex}
                  value={rule.goTo}
                  onChange={(goTo) => setRule(ri, { ...rule, goTo })}
                  label={`Route ${ri + 1} destination`}
                />
              </div>

              {!complete && (
                <p className="wf-warn">
                  <Glyph d={I.warn} size={13} />
                  Not active yet — {conds.some((c) => refs.some((r) => r.ref === c.fieldId)) ? "choose where it goes." : "choose a question to check."}
                </p>
              )}
            </div>
          </section>
        );
      })}

      {rules.length < LIMIT_RULES && (
        <button type="button" className="wf-add" onClick={addRule} disabled={!ownFirst || isLast}>
          <Glyph d={I.plus} size={14} />
          {rules.length ? "Add another route" : "Add a route"}
        </button>
      )}
      {isLast && !rules.length && (
        <p className="wf-hint">This is the last page — everyone who reaches it finishes the form here.</p>
      )}

      {!isLast && (
        <section className="wf-route wf-route-else" style={{ "--wf-c": OTHERWISE_COLOR }}>
          <header className="wf-route-head">
            <span className="wf-route-tag">{rules.length ? "Everyone else" : "After this page"}</span>
          </header>
          <div className="wf-route-body">
            <div className="wf-goto">
              <span className="wf-goto-label">
                <Glyph d={I.arrow} size={14} /> Go to
              </span>
              <TargetSelect
                pages={pages}
                pageIndex={pageIndex}
                value={otherwise}
                withNext
                onChange={(v) => save({ otherwise: v })}
                label="Where everyone else goes"
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}