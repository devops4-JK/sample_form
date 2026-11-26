import { useState } from "react";
import { Alert, Container, Form } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(form.email, form.password, true);
      navigate("/admin");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container fluid className="auth-wrap px-3">
      <div className="auth-card">
        <span className="auth-badge">Admin</span>
        <h1 className="auth-title">Admin log in</h1>
        <p className="auth-subtitle">Approve requests and manage user access.</p>

        {error && (
          <Alert variant="danger" className="py-2 small">
            {error}
          </Alert>
        )}

        <Form onSubmit={handleSubmit} noValidate>
          <Form.Group className="mb-3" controlId="adminEmail">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              name="email"
              value={form.email}
              onChange={update}
              placeholder="admin@companystore.io"
              autoComplete="email"
              required
            />
          </Form.Group>

          <Form.Group className="mb-4" controlId="adminPassword">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              name="password"
              value={form.password}
              onChange={update}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </Form.Group>

          <button type="submit" className="btn btn-brand w-100" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </Form>

        <p className="auth-foot">
          Not an admin?{" "}
          <Link className="text-link" to="/login">
            Go to user login
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}
