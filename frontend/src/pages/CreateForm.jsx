import { useState } from "react";
import { Alert, Col, Container, Form, Row } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { OCCASIONS } from "../constants/formOptions";
import { useAuth } from "../context/AuthContext";

/**
 * TO ADD OR REMOVE A FIELD:
 *   1. add it to BLANK below
 *   2. add the matching <Form.Group> in the JSX
 *   3. add the column in backend/models/GiftRequest.js
 *   4. add the name to USER_FIELDS in backend/controllers/requestController.js
 */
const BLANK = {
  companyName: "",
  contactPerson: "",
  contactEmail: "",
  contactPhone: "",
  occasion: "",
  giftType: "",
  quantity: "",
  budgetPerGift: "",
  requiredBy: "",
  deliveryCity: "",
  deliveryAddress: "",
  customization: "",
};

export default function CreateForm() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    ...BLANK,
    contactPerson: user?.name || "",
    contactEmail: user?.email || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const total =
    Number(form.quantity || 0) * Number(form.budgetPerGift || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.createRequest(form);
      navigate("/requests", { state: { created: true } });
    } catch (err) {
      setError(err.message);
      window.scrollTo(0, 0);
    } finally {
      setBusy(false);
    }
  };

  // Block past dates in the picker.
  const today = new Date().toISOString().split("T")[0];

  return (
    <Container fluid className="dash-wrap px-3 px-md-4">
      <div className="form-shell">
        <h1 className="dash-title">New gift request</h1>
        <p className="dash-sub mb-4">
          Fill this in and our team will review it. You will see the decision
          under My requests.
        </p>

        {error && (
          <Alert variant="danger" className="py-2 small">
            {error}
          </Alert>
        )}

        <Form onSubmit={handleSubmit} noValidate>
          {/* ---------- contact ---------- */}
          <div className="form-section">
            <h2 className="section-title">Your details</h2>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group controlId="companyName">
                  <Form.Label>Company name</Form.Label>
                  <Form.Control
                    name="companyName"
                    value={form.companyName}
                    onChange={update}
                    placeholder="Acme Technologies Pvt Ltd"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="contactPerson">
                  <Form.Label>Contact person</Form.Label>
                  <Form.Control
                    name="contactPerson"
                    value={form.contactPerson}
                    onChange={update}
                    placeholder="Full name"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="contactEmail">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="contactEmail"
                    value={form.contactEmail}
                    onChange={update}
                    placeholder="you@company.com"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="contactPhone">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    name="contactPhone"
                    value={form.contactPhone}
                    onChange={update}
                    placeholder="+91 98765 43210"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
          </div>

          {/* ---------- gift ---------- */}
          <div className="form-section">
            <h2 className="section-title">Gift details</h2>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group controlId="occasion">
                  <Form.Label>Occasion</Form.Label>
                  <Form.Select
                    name="occasion"
                    value={form.occasion}
                    onChange={update}
                    required
                  >
                    <option value="">Choose an occasion</option>
                    {OCCASIONS.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="giftType">
                  <Form.Label>Gift type</Form.Label>
                  <Form.Control
                    name="giftType"
                    value={form.giftType}
                    onChange={update}
                    placeholder="Plush toy, hamper, desk kit…"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group controlId="quantity">
                  <Form.Label>Quantity</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    name="quantity"
                    value={form.quantity}
                    onChange={update}
                    placeholder="100"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group controlId="budgetPerGift">
                  <Form.Label>Budget per gift (INR)</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    step="1"
                    name="budgetPerGift"
                    value={form.budgetPerGift}
                    onChange={update}
                    placeholder="750"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group controlId="requiredBy">
                  <Form.Label>Required by</Form.Label>
                  <Form.Control
                    type="date"
                    name="requiredBy"
                    min={today}
                    value={form.requiredBy}
                    onChange={update}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            {total > 0 && (
              <div className="total-strip">
                Estimated total
                <strong>
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  }).format(total)}
                </strong>
              </div>
            )}
          </div>

          {/* ---------- delivery ---------- */}
          <div className="form-section">
            <h2 className="section-title">Delivery</h2>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group controlId="deliveryCity">
                  <Form.Label>City</Form.Label>
                  <Form.Control
                    name="deliveryCity"
                    value={form.deliveryCity}
                    onChange={update}
                    placeholder="Bengaluru"
                    required
                  />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group controlId="deliveryAddress">
                  <Form.Label>Delivery address</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="deliveryAddress"
                    value={form.deliveryAddress}
                    onChange={update}
                    placeholder="Street, area, landmark, PIN code"
                    required
                  />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group controlId="customization">
                  <Form.Label>
                    Branding or customization{" "}
                    <span className="optional">optional</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="customization"
                    value={form.customization}
                    onChange={update}
                    placeholder="Logo placement, packaging colour, gift note…"
                  />
                </Form.Group>
              </Col>
            </Row>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-mini"
              onClick={() => navigate("/requests")}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-brand" disabled={busy}>
              {busy ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </Form>
      </div>
    </Container>
  );
}
