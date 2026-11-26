import { refOf } from "./engine";

/** Route colours. A page's first route is always the first colour, and so on,
    so the editor's cards and the map's arrows can be matched by eye. */
export const ROUTE_COLORS = ["#2a6f97", "#c2410c", "#4a7c59", "#7c3aed", "#0e7c7b", "#be185d"];
export const OTHERWISE_COLOR = "#8a8a8a";
export const routeColor = (i) => ROUTE_COLORS[i % ROUTE_COLORS.length];

/** A later page's index, "end", or null when the target is unset or invalid. */
function target(pages, from, to) {
  if (to === "end") return "end";
  if (!to || to === "next") return null;
  const i = pages.findIndex((p) => p.id === to);
  return i > from ? i : null;
}

/** Can this rule ever fire? It needs a destination and a usable condition. */
export function ruleIsComplete(rule, pages, pageIndex, workflow) {
  const fields = {};
  pages.slice(0, pageIndex + 1).forEach((p) => (p.fields || []).forEach((f) => (fields[f.id] = f)));
  const hasCondition = (rule.conditions || []).some((c) => refOf(c.fieldId, workflow, fields));
  return hasCondition && target(pages, pageIndex, rule.goTo) !== null;
}

/**
 * Every arrow on the map.
 *   kind "rule"       a route's jump, coloured by its position on the page
 *   kind "otherwise"  where the page goes when no route matches, if changed
 *   kind "next"       the plain fall-through to the following page / the end
 */
export function edgesOf(pages, workflow) {
  const edges = [];
  pages.forEach((page, i) => {
    const cfg = (workflow && workflow.pages && workflow.pages[page.id]) || null;
    (cfg?.rules || []).forEach((rule, ri) => {
      if (!ruleIsComplete(rule, pages, i, workflow)) return;
      edges.push({ from: i, to: target(pages, i, rule.goTo), kind: "rule", ruleIndex: ri });
    });
    const other = cfg ? target(pages, i, cfg.otherwise) : null;
    // "Everyone else → the very next page" is just the normal step.
    if (other !== null && other !== i + 1) edges.push({ from: i, to: other, kind: "otherwise" });
    else edges.push({ from: i, to: i + 1 < pages.length ? i + 1 : "end", kind: "next" });
  });
  return edges;
}

/** Pages no answer can ever reach. */
export function unreachable(pages, edges) {
  if (!pages.length) return new Set();
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const at = queue.shift();
    edges.forEach((e) => {
      if (e.from === at && e.to !== "end" && !seen.has(e.to)) {
        seen.add(e.to);
        queue.push(e.to);
      }
    });
  }
  return new Set(pages.map((_, i) => i).filter((i) => !seen.has(i)));
}

export const pageLabel = (pages, i) =>
  `Page ${i + 1}${pages[i] && pages[i].name ? ` · ${pages[i].name}` : ""}`;




