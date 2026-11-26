import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../services/api";

const EMPTY = { pages: {}, hidden: [], variables: [], scoring: {}, calcs: [], tags: [], outcomes: [] };

/**
 * A form's workflow in the editor: loads it once, and saves every change
 * shortly after it is made. The server sends back a cleaned copy, but the
 * editor keeps its own — swapping it in mid-typing would lose half-made
 * rules — so the cleaned copy is only used on the next load.
 */
export default function useWorkflow(formId) {
  const [workflow, setLocal] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const [error, setError] = useState("");
  const dirty = useRef(false);

  useEffect(() => {
    if (!formId) return undefined;
    let alive = true;
    setReady(false);
    api
      .formWorkflow(formId)
      .then(({ workflow: w }) => alive && setLocal(w && w.pages ? { ...EMPTY, ...w } : EMPTY))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [formId]);

  useEffect(() => {
    if (!ready || !dirty.current) return undefined;
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        await api.saveWorkflow(formId, workflow);
        dirty.current = false;
        setSaveState("saved");
        setError("");
      } catch (err) {
        setSaveState("error");
        setError(err.message);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [workflow, formId, ready]);

  const setWorkflow = useCallback((next) => {
    dirty.current = true;
    setLocal((w) => (typeof next === "function" ? next(w) : next));
  }, []);

  return { workflow, setWorkflow, ready, saveState, error };
}