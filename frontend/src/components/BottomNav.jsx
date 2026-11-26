import { Container, Row, Col } from "react-bootstrap";
import { Link } from "react-router-dom";

export default function BottomNav() {
  return (
    <footer className="bottom-nav">
      <Container fluid className="px-3 px-md-4">
        <Row className="align-items-center g-2">
          <Col xs={12} sm="auto">
            <p className="copyright">
              &copy; 2026 companystore.io. All rights reserved.
            </p>
          </Col>

          <Col xs={12} sm className="d-flex justify-content-sm-end">
            <nav aria-label="Footer">
              <ul className="foot-links">
                <li>
                  <Link className="foot-link" to="/how-it-works">
                    How it works
                  </Link>
                </li>
                <li>
                  <Link className="foot-link" to="/privacy-policy">
                    Privacy policy
                  </Link>
                </li>
                <li>
                  <Link className="foot-link" to="/terms-of-use">
                    Terms of use
                  </Link>
                </li>
                {/* Empty on purpose: it keeps the footer links where they
                    have always been (it used to hold the Admin link). */}
                <li aria-hidden="true" />
              </ul>
            </nav>
          </Col>
        </Row>
      </Container>
    </footer>
  );
}






