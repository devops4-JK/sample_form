import { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";

/**
 * A labelled box for naming a theme. Used for Rename, and ready for any
 * other place in the Design section that needs a name — never a browser
 * prompt.
 */
export default function NameDialog({ show, title, value, action = "Save", onClose, onSave }) {
  const [name, setName] = useState(value);
  const [error, setError] = useState("");

  useEffect(() => {
    if (show) {
      setName(value);
      setError("");
    }
  }, [show, value]);

  const submit = (e) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError("Give the theme a name.");
      return;
    }
    onSave(clean);
  };

  return (
    <Modal show={show} onHide={onClose} centered contentClassName="ds-dialog" backdropClassName="ds-backdrop-top">
      <form onSubmit={submit}>
        <div className="ds-dialog-body">
          <h2 className="ds-dialog-title">{title}</h2>
          <label className="ds-dialog-field">
            <span className="ds-dialog-label">Theme name</span>
            <input
              className="ds-dialog-input"
              value={name}
              maxLength={60}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {error && <p className="ds-dialog-error">{error}</p>}
        </div>
        <div className="ds-dialog-foot">
          <button type="button" className="ds-btn ds-btn-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="ds-btn ds-btn-primary">
            {action}
          </button>
        </div>
      </form>
    </Modal>
  );
}