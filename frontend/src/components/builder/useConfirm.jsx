import { useCallback, useRef, useState } from "react";
import { Modal } from "react-bootstrap";

/**
 * A confirmation step for anything destructive.
 *
 *   const [confirmDialog, confirm] = useConfirm();
 *   ...
 *   if (!(await confirm({ title: "Delete page?", body: "…", action: "Delete page" }))) return;
 *   ...
 *   return <>{confirmDialog} …</>;
 *
 * confirm() resolves true when the person confirms, false on Cancel,
 * the close button, Escape, or a click on the backdrop.
 */
export default function useConfirm() {
  const [request, setRequest] = useState(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setRequest(options);
        setOpen(true);
      }),
    []
  );

  const finish = (answer) => {
    setOpen(false);
    resolver.current?.(answer);
    resolver.current = null;
  };

  const dialog = (
    <Modal
      show={open}
      onHide={() => finish(false)}
      onExited={() => setRequest(null)}
      centered
      size="sm"
      contentClassName="cf"
      backdropClassName="cf-backdrop"
    >
      {request && (
        <>
          <div className="cf-body">
            <span className="cf-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
              </svg>
            </span>
            <h2 className="cf-title">{request.title}</h2>
            {request.body && <p className="cf-text">{request.body}</p>}
          </div>
          <div className="cf-foot">
            <button type="button" className="fb-btn" onClick={() => finish(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="fb-btn fb-btn-danger"
              onClick={() => finish(true)}
              autoFocus
            >
              {request.action || "Delete"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );

  return [dialog, confirm];
}





















