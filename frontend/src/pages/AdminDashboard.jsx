import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Container, Dropdown, Form, Modal, Spinner, Table } from "react-bootstrap";
import { createPortal } from "react-dom";
import { api } from "../services/api";
import "../styles/admin.css";

const BLANK = { name: "", email: "", password: "", isActive: true };

/**
 * The row menu renders into <body>, so the table card can never clip it,
 * and Popper anchors it to its own button. (A fixed-strategy popperConfig
 * mis-anchors menus in react-bootstrap 2.10, so it is not used.)
 */
function PortalMenu(props) {
  return createPortal(<Dropdown.Menu {...props} />, document.body);
}

/**
 * A plain icon button. Using a custom toggle keeps Bootstrap's
 * .dropdown-toggle class off the element, so there is no bordered box
 * and no caret arrow next to the dots.
 */
const DotsToggle = forwardRef(({ onClick, disabled, "aria-label": label }, ref) => (
  <button
    type="button"
    ref={ref}
    className="adm-dots"
    disabled={disabled}
    aria-label={label}
    onClick={(e) => {
      e.preventDefault();
      onClick(e);
    }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </svg>
  </button>
));
DotsToggle.displayName = "DotsToggle";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Each of these holds the user being acted on, or null.
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", isActive: true });
  const [resetting, setResetting] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const { users } = await api.listUsers();
      setUsers(users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, query]);

  const activeCount = users.filter((u) => u.isActive).length;

  /* ---------------- create ---------------- */

  const update = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  };

  const openCreate = () => {
    setForm(BLANK);
    setFormError("");
    setShowCreate(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await api.createUser(form);
      setShowCreate(false);
      setNotice(`Login created for ${form.email}.`);
      setForm(BLANK);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- edit ---------------- */

  const openEdit = (user) => {
    setEditing(user);
    setEditForm({ name: user.name, email: user.email, isActive: user.isActive });
    setFormError("");
  };

  const updateEdit = (e) => {
    const { name, value, type, checked } = e.target;
    setEditForm({ ...editForm, [name]: type === "checkbox" ? checked : value });
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const { user: updated } = await api.updateUser(editing.id, editForm);
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      setEditing(null);
      setNotice(`${updated.name} was updated.`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- block / allow ---------------- */

  const toggleAccess = async (user) => {
    setBusyId(user.id);
    setError("");
    try {
      const { user: updated } = await api.setUserAccess(user.id, !user.isActive);
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      setNotice(
        updated.isActive
          ? `${updated.name} can log in again.`
          : `${updated.name} is blocked.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  /* ---------------- password ---------------- */

  const openReset = (user) => {
    setResetting(user);
    setNewPassword("");
    setFormError("");
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await api.resetUserPassword(resetting.id, newPassword);
      setNotice(`Password changed for ${resetting.email}. Share it with them.`);
      setResetting(null);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ---------------- delete ---------------- */

  const handleDelete = async () => {
    const target = confirmDelete;
    setBusyId(target.id);
    try {
      await api.deleteUser(target.id);
      setUsers((list) => list.filter((u) => u.id !== target.id));
      setNotice(`Login for ${target.email} was deleted.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  };

  return (
    <Container fluid className="dash-wrap px-3 px-md-4">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Users</h1>
          <p className="dash-sub">
            Users cannot sign up on their own. Every login is created here.
            {users.length > 0 && (
              <>
                {" "}
                {activeCount} active of {users.length}.
              </>
            )}
          </p>
        </div>
        <button className="btn btn-brand" onClick={openCreate}>
          Create user
        </button>
      </div>

      {error && (
        <Alert variant="danger" className="py-2 small" dismissible onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert variant="success" className="py-2 small" dismissible onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}

      {users.length > 0 && (
        <Form.Control
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search users"
          className="mb-3"
          style={{ maxWidth: "320px" }}
        />
      )}

      {loading ? (
        <div className="route-loading">
          <Spinner animation="border" size="sm" />
        </div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <p className="mb-1 fw-semibold">No logins yet.</p>
          <p className="mb-0">
            Use <strong>Create user</strong> to add the first one.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <p className="mb-0">No user matches “{query}”.</p>
        </div>
      ) : (
        <div className="table-card">
          <Table className="dash-table mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Access</th>
                <th>Created</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id}>
                  <td className="fw-semibold">{u.name}</td>
                  <td className="text-muted-cell">{u.email}</td>
                  <td>
                    <span className={u.isActive ? "pill pill-on" : "pill pill-off"}>
                      {u.isActive ? "Active" : "Blocked"}
                    </span>
                  </td>
                  <td className="text-muted-cell">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="adm-td-menu">
                    <Dropdown align="end">
                      <Dropdown.Toggle
                        as={DotsToggle}
                        disabled={busyId === u.id}
                        aria-label={`Actions for ${u.name}`}
                      />
                      <PortalMenu className="adm-menu">
                        <Dropdown.Item onClick={() => openEdit(u)}>Edit</Dropdown.Item>
                        <Dropdown.Item onClick={() => toggleAccess(u)}>
                          {u.isActive ? "Block" : "Allow"}
                        </Dropdown.Item>
                        <Dropdown.Item onClick={() => openReset(u)}>Password</Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item
                          className="adm-menu-danger"
                          onClick={() => setConfirmDelete(u)}
                        >
                          Delete
                        </Dropdown.Item>
                      </PortalMenu>
                    </Dropdown>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* ---------- create ---------- */}
      <Modal show={showCreate} onHide={() => setShowCreate(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5 mb-0">Create user login</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleCreate}>
          <Modal.Body>
            {formError && <Alert variant="danger" className="py-2 small">{formError}</Alert>}
            <Form.Group className="mb-3" controlId="newName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                name="name"
                value={form.name}
                onChange={update}
                placeholder="Full name"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="newEmail">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={form.email}
                onChange={update}
                placeholder="person@client.com"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="newPassword">
              <Form.Label>Temporary password</Form.Label>
              <Form.Control
                type="text"
                name="password"
                value={form.password}
                onChange={update}
                placeholder="At least 8 characters, with a letter and a number"
                required
              />
              <Form.Text className="text-muted">
                Share this with the user. It is stored hashed and cannot be read
                back later.
              </Form.Text>
            </Form.Group>
            <Form.Check
              type="switch"
              id="newActive"
              name="isActive"
              checked={form.isActive}
              onChange={update}
              label="Allow this user to log in immediately"
            />
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn-mini" onClick={() => setShowCreate(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-brand" disabled={saving}>
              {saving ? "Creating…" : "Create user"}
            </button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------- edit ---------- */}
      <Modal show={Boolean(editing)} onHide={() => setEditing(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5 mb-0">Edit user</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleEdit}>
          <Modal.Body>
            {formError && <Alert variant="danger" className="py-2 small">{formError}</Alert>}
            <Form.Group className="mb-3" controlId="editName">
              <Form.Label>Name</Form.Label>
              <Form.Control
                name="name"
                value={editForm.name}
                onChange={updateEdit}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3" controlId="editEmail">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={editForm.email}
                onChange={updateEdit}
                required
              />
              <Form.Text className="text-muted">
                The user logs in with this address, so tell them if it changes.
              </Form.Text>
            </Form.Group>
            <Form.Check
              type="switch"
              id="editActive"
              name="isActive"
              checked={editForm.isActive}
              onChange={updateEdit}
              label="Allowed to log in"
            />
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn-mini" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-brand" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------- password ---------- */}
      <Modal show={Boolean(resetting)} onHide={() => setResetting(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5 mb-0">Set a new password</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleReset}>
          <Modal.Body>
            {formError && <Alert variant="danger" className="py-2 small">{formError}</Alert>}
            <p className="small text-muted mb-3">
              For <strong>{resetting?.name}</strong> ({resetting?.email}).
            </p>
            <Form.Group controlId="resetPassword">
              <Form.Label>New password</Form.Label>
              <Form.Control
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters, with a letter and a number"
                required
              />
              <Form.Text className="text-muted">
                The old password stops working straight away.
              </Form.Text>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn-mini" onClick={() => setResetting(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-brand" disabled={saving}>
              {saving ? "Saving…" : "Set password"}
            </button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ---------- delete ---------- */}
      <Modal show={Boolean(confirmDelete)} onHide={() => setConfirmDelete(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h5 mb-0">Delete this login?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>{confirmDelete?.name}</strong> ({confirmDelete?.email}) will be
            removed permanently and will not be able to log in.
          </p>
          <p className="mb-0 text-muted small">
            To stop access temporarily instead, close this and use <strong>Block</strong>.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn-mini" onClick={() => setConfirmDelete(null)}>
            Cancel
          </button>
          <button
            className="btn btn-brand"
            onClick={handleDelete}
            disabled={busyId === confirmDelete?.id}
          >
            Delete
          </button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}