import { ConditionList, Glyph, ICONS, newId, useRefs } from "./Conditions";
import { routeColor } from "./graph";

/**
 * Endings and tags. Both are decided once the form is finished, from
 * everything answered, the link values and the variables.
 *
 *   Endings  the thank-you screen. The first whose conditions match is
 *            shown; one with no conditions catches everyone else. It can
 *            send people on to another web address.
 *   Tags     labels on the response for the team — in the export, the
 *            Google Sheet, the webhook and the email. Never shown to the
 *            respondent.
 */

function names(workflow) {
  return ["score", ...(workflow.variables || []).map((v) => v.name), ...(workflow.hidden || []).map((h) => h.key)];
}

function Recall({ workflow }) {
  return (
    <p className="wf-recall">
      Fill in with:{" "}
      {names(workflow).map((n) => (
        <code key={n}>{`{{${n}}}`}</code>
      ))}
    </p>
  );
}

function move(list, i, by) {
  const out = [...list];
  const [x] = out.splice(i, 1);
  out.splice(i + by, 0, x);
  return out;
}

function Endings({ pages, workflow, setWorkflow }) {
  const refs = useRefs(pages, workflow, -1);
  const list = workflow.outcomes || [];
  const set = (outcomes) => setWorkflow((w) => ({ ...w, outcomes }));
  const fallback = list.findIndex((o) => !(o.conditions || []).length);

  return (
    <section className="wf-card">
      <header className="wf-card-head">
        <span className="wf-card-icon" aria-hidden="true">⚑</span>
        <div>
          <h3>Endings</h3>
          <p>
            Show a different thank-you screen depending on how someone answered. Checked top to bottom; the first that
            matches is shown.
          </p>
        </div>
      </header>

      {list.length === 0 && (
        <p className="wf-muted">No endings yet — everyone sees the standard “Thank you” screen.</p>
      )}

      {list.map((o, i) => {
        const set1 = (next) => set(list.map((x, k) => (k === i ? next : x)));
        const unreachable = fallback !== -1 && i > fallback;
        return (
          <div key={o.id || i} className="wf-route" style={{ "--wf-c": routeColor(i) }}>
            <header className="wf-route-head">
              <span className="wf-route-tag">Ending {i + 1}</span>
              {unreachable && <span className="wf-chip is-warn">Never shown — an ending above catches everyone</span>}
              <span className="wf-route-tools">
                <button type="button" className="wf-icon" onClick={() => set(move(list, i, -1))} disabled={i === 0} aria-label="Move up">
                  <Glyph d={ICONS.up} />
                </button>
                <button type="button" className="wf-icon" onClick={() => set(move(list, i, 1))} disabled={i === list.length - 1} aria-label="Move down">
                  <Glyph d={ICONS.down} />
                </button>
                <button type="button" className="wf-icon wf-icon-danger" onClick={() => set(list.filter((_, k) => k !== i))} aria-label="Delete ending">
                  <Glyph d={ICONS.trash} />
                </button>
              </span>
            </header>
            <div className="wf-route-body">
              <ConditionList item={o} refs={refs} onChange={set1} alwaysLabel="Everyone else (no conditions)" />
              <div className="wf-ending">
                <label>
                  <span>Title</span>
                  <input
                    className="wf-input"
                    value={o.title}
                    maxLength={120}
                    placeholder="Well done, {{name}}!"
                    onChange={(e) => set1({ ...o, title: e.target.value })}
                  />
                </label>
                <label>
                  <span>Message</span>
                  <textarea
                    className="wf-input wf-textarea"
                    value={o.message}
                    maxLength={1000}
                    rows={3}
                    placeholder="You scored {{score}} out of 30."
                    onChange={(e) => set1({ ...o, message: e.target.value })}
                  />
                </label>
                <label>
                  <span>Then send them to (optional)</span>
                  <input
                    className="wf-input"
                    value={o.redirect}
                    maxLength={500}
                    placeholder="https://yourcompany.com/thanks?score={{score}}"
                    onChange={(e) => set1({ ...o, redirect: e.target.value })}
                  />
                </label>
                {o.redirect && !/^https?:\/\//i.test(o.redirect) && (
                  <p className="wf-warn">
                    <Glyph d={ICONS.warn} size={13} /> Must start with https:// — it will be ignored otherwise.
                  </p>
                )}
                <Recall workflow={workflow} />
              </div>
            </div>
          </div>
        );
      })}

      {list.length < 20 && (
        <button
          type="button"
          className="wf-add"
          onClick={() =>
            set([...list, { id: newId("o"), title: "", message: "", redirect: "", match: "all", conditions: list.length ? [] : [] }])
          }
        >
          <Glyph d={ICONS.plus} size={14} /> Add an ending
        </button>
      )}
    </section>
  );
}

function Tags({ pages, workflow, setWorkflow }) {
  const refs = useRefs(pages, workflow, -1);
  const list = workflow.tags || [];
  const set = (tags) => setWorkflow((w) => ({ ...w, tags }));

  return (
    <section className="wf-card">
      <header className="wf-card-head">
        <span className="wf-card-icon" aria-hidden="true">🏷</span>
        <div>
          <h3>Tags</h3>
          <p>
            Label responses for your team — “VIP”, “Needs follow-up”, “Size XL”. Shown in the export, the Google Sheet,
            the webhook and the email. Respondents never see them.
          </p>
        </div>
      </header>

      {list.map((t, i) => (
        <div key={t.id || i} className="wf-tag">
          <div className="wf-tag-head">
            <span className="wf-tag-pill" aria-hidden="true">🏷</span>
            <input
              className="wf-input wf-tag-name"
              value={t.name}
              maxLength={40}
              placeholder="Tag name"
              onChange={(e) => set(list.map((x, k) => (k === i ? { ...t, name: e.target.value } : x)))}
              aria-label="Tag name"
            />
            <button type="button" className="wf-icon wf-icon-danger" onClick={() => set(list.filter((_, k) => k !== i))} aria-label="Delete tag">
              <Glyph d={ICONS.trash} />
            </button>
          </div>
          <ConditionList
            item={t}
            refs={refs}
            onChange={(next) => set(list.map((x, k) => (k === i ? next : x)))}
            alwaysLabel="Every response"
          />
        </div>
      ))}

      {list.length < 50 && (
        <button
          type="button"
          className="wf-add"
          onClick={() => set([...list, { id: newId("t"), name: "", match: "all", conditions: [{ fieldId: "", op: "is", value: "" }] }])}
        >
          <Glyph d={ICONS.plus} size={14} /> Add a tag
        </button>
      )}
    </section>
  );
}

export default function Outcomes(props) {
  return (
    <div className="wf-col">
      <Endings {...props} />
      <Tags {...props} />
    </div>
  );
}




 