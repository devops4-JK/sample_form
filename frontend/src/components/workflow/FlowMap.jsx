import { useMemo } from "react";
import { INPUT_TYPES } from "../../constants/formElements";
import { OTHERWISE_COLOR, edgesOf, routeColor, unreachable } from "./graph";

/**
 * The flow map: the form as a vertical rail of page cards, top to bottom,
 * ending in a Finish node. The plain "next page" steps run down the rail's
 * spine on the left; every logic jump is drawn as a coloured lane on the
 * right, from the page it leaves to the page it lands on.
 *
 * The selected page's lanes are drawn strong and the rest fade back, so a
 * busy form still reads one page at a time.
 */

const CARD_H = 66;
const GAP = 34;
const TOP = 46;
const LEFT = 14;
const CARD_W = 232;
const LANE_GAP = 15;
const END_H = 44;

const yOf = (i) => TOP + i * (CARD_H + GAP);

export default function FlowMap({ pages, workflow, selectedId, onSelect }) {
  const edges = useMemo(() => edgesOf(pages, workflow), [pages, workflow]);
  const lost = useMemo(() => unreachable(pages, edges), [pages, edges]);

  const n = pages.length;
  const endY = yOf(n);
  const right = LEFT + CARD_W;
  const selected = pages.findIndex((p) => p.id === selectedId);

  /* Jumps leave from and arrive at points spread along a card's right edge,
     and each takes the lowest lane it does not share with an overlapping one. */
  const jumps = useMemo(() => {
    const list = edges
      .filter((e) => e.kind !== "next")
      .map((e) => ({ ...e, toIdx: e.to === "end" ? n : e.to }));
    const outCount = {};
    const inCount = {};
    list.forEach((e) => {
      outCount[e.from] = (outCount[e.from] || 0) + 1;
      inCount[e.toIdx] = (inCount[e.toIdx] || 0) + 1;
    });
    const outSeen = {};
    const inSeen = {};
    list.forEach((e) => {
      const o = (outSeen[e.from] = (outSeen[e.from] || 0) + 1) - 1;
      const k = (inSeen[e.toIdx] = (inSeen[e.toIdx] || 0) + 1) - 1;
      const spread = (idx, count, h) => h / 2 + (idx - (count - 1) / 2) * Math.min(9, (h - 16) / Math.max(count, 1));
      e.y1 = yOf(e.from) + spread(o, outCount[e.from], CARD_H);
      e.y2 = (e.to === "end" ? endY : yOf(e.toIdx)) + spread(k, inCount[e.toIdx], e.to === "end" ? END_H : CARD_H);
    });

    const lanes = [];
    [...list]
      .sort((a, b) => a.y2 - a.y1 - (b.y2 - b.y1))
      .forEach((e) => {
        let lane = 0;
        while ((lanes[lane] || []).some((o) => !(e.y2 + 6 < o.y1 || e.y1 - 6 > o.y2))) lane += 1;
        (lanes[lane] = lanes[lane] || []).push(e);
        e.lane = lane;
      });
    return list;
  }, [edges, n, endY]);

  const laneCount = jumps.reduce((m, e) => Math.max(m, e.lane + 1), 0);
  const width = right + 22 + laneCount * LANE_GAP + 10;
  const height = endY + END_H + 16;

  const colorOf = (e) => (e.kind === "otherwise" ? OTHERWISE_COLOR : routeColor(e.ruleIndex));

  const pathOf = (e) => {
    const x = right + 20 + e.lane * LANE_GAP;
    const r = Math.min(8, (e.y2 - e.y1) / 2);
    return `M ${right} ${e.y1} H ${x - r} Q ${x} ${e.y1} ${x} ${e.y1 + r} V ${e.y2 - r} Q ${x} ${e.y2} ${x - r} ${e.y2} H ${right + 5}`;
  };

  const spineX = LEFT + 26;
  const fallsThrough = (i) => edges.some((e) => e.from === i && e.kind === "next");

  return (
    <div className="wf-map" role="group" aria-label="Flow map">
      <div className="wf-map-canvas" style={{ width, height }}>
        <svg className="wf-map-svg" width={width} height={height} aria-hidden="true">
          <defs>
            {[...new Set(jumps.map(colorOf))].map((c) => (
              <marker
                key={c}
                id={`wf-arrow-${c.slice(1)}`}
                viewBox="0 0 8 8"
                refX="6"
                refY="4"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L8 4 L0 8 z" fill={c} />
              </marker>
            ))}
          </defs>

          {/* the spine: start → each page → finish */}
          <line className="wf-spine" x1={spineX} y1={30} x2={spineX} y2={TOP} />
          {pages.map((p, i) => (
            <line
              key={p.id}
              className={fallsThrough(i) ? "wf-spine" : "wf-spine is-unused"}
              x1={spineX}
              y1={yOf(i) + CARD_H}
              x2={spineX}
              y2={i + 1 < n ? yOf(i + 1) : endY}
            />
          ))}

          {jumps.map((e, k) => {
            const strong = e.from === selected;
            const c = colorOf(e);
            return (
              <path
                key={k}
                d={pathOf(e)}
                className={strong ? "wf-jump is-strong" : "wf-jump"}
                stroke={c}
                strokeDasharray={e.kind === "otherwise" ? "5 4" : undefined}
                markerEnd={`url(#wf-arrow-${c.slice(1)})`}
              />
            );
          })}
        </svg>

        <span className="wf-start" style={{ left: LEFT, top: 6 }}>
          Start
        </span>

        {pages.map((p, i) => {
          const cfg = workflow?.pages?.[p.id];
          const routes = cfg?.rules?.length || 0;
          const questions = (p.fields || []).filter((f) => INPUT_TYPES.has(f.type)).length;
          const on = p.id === selectedId;
          return (
            <button
              key={p.id}
              type="button"
              className={`wf-node${on ? " is-on" : ""}${lost.has(i) ? " is-lost" : ""}`}
              style={{ left: LEFT, top: yOf(i), width: CARD_W, height: CARD_H }}
              onClick={() => onSelect(p.id)}
              aria-pressed={on}
            >
              <span className="wf-node-num">{i + 1}</span>
              <span className="wf-node-body">
                <span className="wf-node-name">{p.name || `Page ${i + 1}`}</span>
                <span className="wf-node-meta">
                  {questions} question{questions === 1 ? "" : "s"}
                  {lost.has(i) && <em className="wf-node-lost"> · never reached</em>}
                </span>
              </span>
              {routes > 0 && (
                <span className="wf-node-dots" title={`${routes} route${routes === 1 ? "" : "s"}`}>
                  {cfg.rules.slice(0, 4).map((r, ri) => (
                    <i key={r.id || ri} style={{ background: routeColor(ri) }} />
                  ))}
                  {routes > 4 && <b>+{routes - 4}</b>}
                </span>
              )}
            </button>
          );
        })}

        <span className="wf-end" style={{ left: LEFT, top: endY, width: CARD_W, height: END_H }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
          </svg>
          Finish &amp; submit
        </span>
      </div>
    </div>
  );
}



















