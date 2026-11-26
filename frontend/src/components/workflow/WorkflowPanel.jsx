import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import FlowMap from "./FlowMap";
import RuleEditor from "./RuleEditor";
import HiddenFields from "./HiddenFields";
import Scoring from "./Scoring";
import Outcomes from "./Outcomes";
import { edgesOf, ruleIsComplete, unreachable } from "./graph";
import "./workflow.css";

/**
 * The Workflow tab, in four sections:
 *
 *   Logic              jumps between pages, on a flow map
 *   Hidden fields      values read from the form's link
 *   Variables & score  points per answer, variables, calculations
 *   Tags & endings     labels for the team, thank-you screens by result
 *
 * They are one workflow, held by the form editor (useWorkflow)
 * so Preview walks the same rules, and saved as they are changed.
 */

const SECTIONS = [
  { id: "logic", label: "Logic", icon: "M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9" },
  { id: "hidden", label: "Hidden fields", icon: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" },
  { id: "scoring", label: "Variables & score", icon: "M9 4 7 20M17 4l-2 16M4 9h16M4 15h16" },
  { id: "endings", label: "Tags & endings", icon: "M5 21V4M5 4h11l-2 4 2 4H5" },
];

function SectionIcon({ d }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function WorkflowPanel({ form, pages, workflow, setWorkflow, ready, saveState, error, onPreview, onOpenContent, confirm }) {
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.some((s) => s.id === params.get("wf")) ? params.get("wf") : "logic";
  const setSection = (id) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (id === "logic") n.delete("wf");
        else n.set("wf", id);
        return n;
      },
      { replace: true }
    );

  const [selectedId, setSelectedId] = useState(pages[0]?.id || null);

  // Keep a real page selected when pages are added, removed or reordered.
  useEffect(() => {
    if (!pages.some((p) => p.id === selectedId)) setSelectedId(pages[0]?.id || null);
  }, [pages, selectedId]);

  const pageIndex = pages.findIndex((p) => p.id === selectedId);

  const stats = useMemo(() => {
    let routes = 0;
    let idle = 0;
    pages.forEach((p, i) =>
      (workflow.pages?.[p.id]?.rules || []).forEach((r) => {
        routes += 1;
        if (!ruleIsComplete(r, pages, i, workflow)) idle += 1;
      })
    );
    return { routes, idle, lost: unreachable(pages, edgesOf(pages, workflow)).size };
  }, [pages, workflow]);

  const counts = {
    logic: stats.routes,
    hidden: (workflow.hidden || []).length,
    scoring: Object.keys(workflow.scoring || {}).length + (workflow.calcs || []).length + (workflow.variables || []).length,
    endings: (workflow.outcomes || []).length + (workflow.tags || []).length,
  };

  const setPageCfg = (pageId, cfg) =>
    setWorkflow((w) => ({ ...w, pages: { ...(w.pages || {}), [pageId]: cfg } }));

  const clearLogic = async () => {
    const ok = await confirm({
      title: "Clear all logic?",
      body: "Every route on every page is removed and the form goes back to running page by page. Hidden fields, scoring, tags and endings stay.",
      action: "Clear logic",
    });
    if (ok) setWorkflow((w) => ({ ...w, pages: {} }));
  };

  if (!ready) {
    return (
      <div className="wf-state">
        <Spinner animation="border" size="sm" />
      </div>
    );
  }

  const sectionProps = { form, pages, workflow, setWorkflow };

  return (
    <div className="wf">
      <div className="wf-top">
        <div className="wf-top-row">
          <div>
            <h2 className="wf-title">Workflow</h2>
            <p className="wf-sub">What happens as people answer — and after they finish.</p>
          </div>
          <div className="wf-top-right">
            {section === "logic" && (
              <span className="wf-chips">
                <span className="wf-chip">
                  <b>{stats.routes}</b> route{stats.routes === 1 ? "" : "s"}
                </span>
                {stats.idle > 0 && (
                  <span className="wf-chip is-warn">
                    <b>{stats.idle}</b> unfinished
                  </span>
                )}
                {stats.lost > 0 && (
                  <span className="wf-chip is-warn" title="No answer can ever lead to these pages">
                    <b>{stats.lost}</b> page{stats.lost === 1 ? "" : "s"} never reached
                  </span>
                )}
              </span>
            )}
            {section !== "automations" && (
              <span className={`wf-save is-${saveState}`} aria-live="polite">
                {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved"}
              </span>
            )}
            {section === "logic" && stats.routes > 0 && (
              <button type="button" className="fb-btn fb-btn-sm" onClick={clearLogic}>
                Clear logic
              </button>
            )}
            <button type="button" className="fb-btn fb-btn-sm fb-btn-primary" onClick={onPreview}>
              Try it in Preview
            </button>
          </div>
        </div>

        <nav className="wf-sections" aria-label="Workflow sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === section ? "wf-section is-on" : "wf-section"}
              onClick={() => setSection(s.id)}
              aria-current={s.id === section ? "page" : undefined}
            >
              <SectionIcon d={s.icon} />
              {s.label}
              {counts[s.id] > 0 && <span className="wf-section-count">{counts[s.id]}</span>}
            </button>
          ))}
        </nav>
      </div>

      {error && <div className="wf-error" role="alert">{error}</div>}

      {section === "logic" &&
        (pages.length < 2 ? (
          <div className="wf-empty">
            <div className="wf-empty-art" aria-hidden="true">
              <i /> <i /> <i />
            </div>
            <h3>Branching needs at least two pages</h3>
            <p>
              Logic decides which page comes next. Split your questions across pages in Content, then come back here to
              connect them.
            </p>
            <button type="button" className="fb-btn fb-btn-primary" onClick={onOpenContent}>
              Go to Content
            </button>
          </div>
        ) : (
          <div className="wf-body">
            <aside className="wf-side">
              <div className="wf-side-head">
                <span>Flow map</span>
                <span className="wf-legend">
                  <i className="wf-legend-solid" /> next page
                  <i className="wf-legend-jump" /> jump
                  <i className="wf-legend-else" /> everyone else
                </span>
              </div>
              <FlowMap pages={pages} workflow={workflow} selectedId={selectedId} onSelect={setSelectedId} />
            </aside>

            <main className="wf-main">
              {pageIndex >= 0 && (
                <RuleEditor
                  key={selectedId}
                  pages={pages}
                  pageIndex={pageIndex}
                  workflow={workflow}
                  cfg={workflow.pages?.[selectedId]}
                  onChange={(cfg) => setPageCfg(selectedId, cfg)}
                />
              )}
            </main>
          </div>
        ))}

      {section !== "logic" && (
        <div className="wf-pane">
          {section === "hidden" && <HiddenFields {...sectionProps} />}
          {section === "scoring" && <Scoring {...sectionProps} />}
          {section === "endings" && <Outcomes {...sectionProps} />}
        </div>
      )}
    </div>
  );
}