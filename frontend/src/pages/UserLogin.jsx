import { useState } from "react";
import { Alert, Container, Form } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function UserLogin() {
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
      await login(form.email, form.password);
      navigate("/forms");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container fluid className="auth-wrap px-3">
      <div className="auth-card">
        <h1 className="auth-title">Log in</h1>
        <p className="auth-subtitle">
          Use the email address your access was sent to.
        </p>

        {error && (
          <Alert variant="danger" className="py-2 small">
            {error}
          </Alert>
        )}

        <Form onSubmit={handleSubmit} noValidate>
          <Form.Group className="mb-3" controlId="userEmail">
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              name="email"
              value={form.email}
              onChange={update}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </Form.Group>

          <Form.Group className="mb-4" controlId="userPassword">
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
          No access yet? Ask your account manager, or{" "}
          <Link className="text-link" to="/">
            go back home
          </Link>
          .
        </p>
      </div>
    </Container>
  );
}