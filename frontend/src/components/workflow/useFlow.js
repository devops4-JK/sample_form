import { useCallback, useMemo, useState } from "react";
import { nextStep, varsAfter } from "./engine";

/**
 * Walking a form one page at a time, following its workflow.
 *
 * Keeps the trail of pages actually shown, so Back returns to the page the
 * respondent came from — not simply the one numbered before it. Variables
 * and the score are replayed along that trail, the same way the server
 * replays them when the answers arrive.
 *
 *   varsBefore  the variables as this page opens (for {{recall}} on it)
 *   varsNow     after this page's points and calculations (decides Next)
 */
export default function useFlow(pages, workflow, answers, hidden = {}) {
  const [trail, setTrail] = useState([0]);

  const count = pages.length;
  const raw = trail[trail.length - 1];
  const at = count ? Math.min(raw, count - 1) : 0;
  const shown = useMemo(() => trail.filter((i) => i < count), [trail, count]);

  const varsBefore = useMemo(
    () => varsAfter(pages, workflow, shown.slice(0, -1), answers, hidden),
    [pages, workflow, shown, answers, hidden]
  );
  const varsNow = useMemo(
    () => varsAfter(pages, workflow, shown, answers, hidden),
    [pages, workflow, shown, answers, hidden]
  );

  const upcoming = count ? nextStep(pages, workflow, at, answers, hidden, varsNow) : "end";
  const last = upcoming === "end";

  const goNext = useCallback(() => {
    if (upcoming !== "end") setTrail((t) => [...t, upcoming]);
  }, [upcoming]);

  const goBack = useCallback(() => setTrail((t) => (t.length > 1 ? t.slice(0, -1) : t)), []);
  const reset = useCallback(() => setTrail([0]), []);

  return { at, last, goNext, goBack, reset, step: trail.length, canGoBack: trail.length > 1, varsBefore, varsNow };
}