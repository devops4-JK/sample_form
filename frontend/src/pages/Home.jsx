import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Icon({ d }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

const POINTS = [
  {
    title: "Build in minutes",
    text: "Pages, questions and product choices, laid out the way your customer reads them.",
    icon: ["M4 5h16", "M4 12h10", "M4 19h7", "M18 15v6", "M15 18h6"],
  },
  {
    title: "Your brand, every page",
    text: "Themes for colours, type and buttons, so each form looks like it came from you.",
    icon: ["M12 3a9 9 0 1 0 9 9c0-1.7-1.3-2-2.5-2H16a2 2 0 0 1-2-2V6.5C14 4.6 13.4 3 12 3Z", "M7.5 11h.01", "M10 7.5h.01"],
  },
  {
    title: "Answers where you work",
    text: "Every response lands in Excel or Google Sheets, ready for your team.",
    icon: ["M4 4h16v16H4z", "M4 10h16", "M10 4v16"],
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Already signed in? Send them straight to their forms.
  const target = user ? "/forms" : "/login";

  return (
    <section className="home-center home-hero">
      <span className="home-eyebrow">
        <span className="home-eyebrow-tag">CompanyStore</span>
        Forms for gifting and merchandise
      </span>

      <h1 className="home-title">
        Forms that feel <span>made for your brand</span>
      </h1>

      <p className="home-lead">
        Collect gift choices, sizes and delivery details in one clean flow, then send every
        answer straight to your team.
      </p>

      <div className="home-actions">
        <button
          type="button"
          className="btn btn-brand btn-brand-lg"
          onClick={() => navigate(target)}
        >
          Create form
          <Icon d={["M5 12h14", "m13 6 6 6-6 6"]} />
        </button>
        <Link to="/how-it-works" className="home-ghost">
          How it works
        </Link>
      </div>

      <ul className="home-points">
        {POINTS.map((p) => (
          <li key={p.title} className="home-point">
            <span className="home-point-icon">
              <Icon d={p.icon} />
            </span>
            <span className="home-point-title">{p.title}</span>
            <span className="home-point-text">{p.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}