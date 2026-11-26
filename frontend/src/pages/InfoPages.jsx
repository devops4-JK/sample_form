import { Link } from "react-router-dom";

/**
 * The three public pages behind the footer links: How it works, Privacy
 * policy and Terms of use.
 *
 * They share one layout so the set looks like a set: a hero, then either
 * numbered steps or plain sections, then a closing note.
 *
 * The policy wording is a starting point written for a company gifting
 * portal. Have whoever handles your legal wording read it before launch.
 */

const UPDATED = "24 September 2026";

const ico = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const ICONS = {
  build: ["M4 5h16v14H4z", "M8 9h8M8 13h5"],
  share: ["M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6", "m8.6 13.5 6.8 3.9M15.4 6.6 8.6 10.5"],
  collect: ["M4 7h16v13H4z", "M4 11h16", "M9 3v4M15 3v4"],
  excel: ["M4 4h16v16H4z", "M4 9h16M4 14h16M10 4v16"],
  lock: ["M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4"],
  eye: ["M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18", "M12 7v5l3 2"],
  check: ["m5 12 5 5 9-10"],
};

function Icon({ name }) {
  return (
    <svg {...ico}>
      {ICONS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

function Page({ eyebrow, title, intro, children, updated = true }) {
  return (
    <div className="info">
      <header className="info-hero">
        <div className="info-wrap">
          <p className="info-eyebrow">{eyebrow}</p>
          <h1 className="info-title">{title}</h1>
          <p className="info-intro">{intro}</p>
          {updated && <p className="info-updated">Last updated {UPDATED}</p>}
        </div>
      </header>

      <main className="info-wrap info-body">{children}</main>

      <footer className="info-wrap info-foot">
        <div>
          <h2 className="info-foot-title">Still have a question?</h2>
          <p className="info-foot-text">
            Write to <a href="mailto:hello@companystore.io">hello@companystore.io</a> and a person
            will answer.
          </p>
        </div>
        <nav className="info-foot-links" aria-label="Other pages">
          <Link to="/how-it-works">How it works</Link>
          <Link to="/privacy-policy">Privacy policy</Link>
          <Link to="/terms-of-use">Terms of use</Link>
        </nav>
      </footer>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="info-sec">
      <h2 className="info-sec-title">{title}</h2>
      {children}
    </section>
  );
}

/* ============================ how it works ============================ */

const STEPS = [
  {
    icon: "build",
    title: "Build the form",
    text: "Start from a blank form and add what you need: contact details, an address, a choice of gifts, a rating, a date. Each question carries its own label, placeholder and description, and you can rearrange them until the form reads the way you want.",
  },
  {
    icon: "share",
    title: "Publish and share the link",
    text: "Publishing gives the form a private link. Send it to colleagues, a client, or a whole team. No one needs an account to answer, and the form stays closed until you publish it.",
  },
  {
    icon: "collect",
    title: "Collect the answers",
    text: "Every submission lands against the form with a timestamp, so you always know how many people replied and how many finished. Nothing is thrown away when you edit the form afterwards.",
  },
  {
    icon: "excel",
    title: "Send it to Excel",
    text: "Connect Excel once and paste the link into Data › From Web. After that, Refresh All pulls in the latest answers: one row per response, one column per question, with addresses split into their own columns.",
  },
];

export function HowItWorks() {
  return (
    <Page
      eyebrow="How it works"
      title="From a blank form to a spreadsheet, in four steps"
      intro="companystore.io is where our team builds the forms behind gifting: what people want, where it goes, and when it needs to arrive."
      updated={false}
    >
      <ol className="info-steps">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="info-step-num">{i + 1}</span>
            <div className="info-step-body">
              <h2 className="info-step-title">
                <span className="info-step-icon">
                  <Icon name={s.icon} />
                </span>
                {s.title}
              </h2>
              <p className="info-step-text">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <Section title="A few things worth knowing">
        <ul className="info-list">
          <li>
            <Icon name="check" />
            <span>
              <b>Workbenches are shared.</b> Everyone signed in sees the same workbenches and forms,
              so work carries on when someone is away. The app records who created each form
              and who changed it last.
            </span>
          </li>
          <li>
            <Icon name="check" />
            <span>
              <b>Accounts come from an admin.</b> There is no public sign-up. An administrator
              creates each login and can block or remove it at any time.
            </span>
          </li>
          <li>
            <Icon name="check" />
            <span>
              <b>Drafts stay private.</b> A form accepts answers only while it is published.
              Unpublish it and the link stops working, while the answers you already have stay put.
            </span>
          </li>
        </ul>
      </Section>
    </Page>
  );
}

/* ============================ privacy ============================ */

export function PrivacyPolicy() {
  return (
    <Page
      eyebrow="Privacy policy"
      title="What we collect, and why"
      intro="This policy covers companystore.io: the forms our team builds, and the answers people send back through them."
    >
      <div className="info-cards">
        <article className="info-card">
          <span className="info-card-icon">
            <Icon name="eye" />
          </span>
          <h2 className="info-card-title">What we collect</h2>
          <p>
            Two things. From people who sign in: a name, an email address and a password, stored as
            a one-way hash we cannot read back. From people who answer a form: whatever that form
            asks for, along with the date and time the answer arrived.
          </p>
        </article>
        <article className="info-card">
          <span className="info-card-icon">
            <Icon name="lock" />
          </span>
          <h2 className="info-card-title">How it is kept</h2>
          <p>
            Answers live in our own database and are visible to people with an account on this app.
            Sharing an Excel link shares that form's answers with anyone holding the link, so treat
            it as you would the data itself. Regenerating the link cuts off every older copy.
          </p>
        </article>
        <article className="info-card">
          <span className="info-card-icon">
            <Icon name="clock" />
          </span>
          <h2 className="info-card-title">How long we keep it</h2>
          <p>
            Answers stay until someone deletes the form that collected them, which removes them for
            good. Account records are removed when an administrator deletes the account, while forms
            that person created stay with the company.
          </p>
        </article>
      </div>

      <Section title="What we do not do">
        <ul className="info-list">
          <li>
            <Icon name="check" />
            <span>We do not sell or rent anything collected here.</span>
          </li>
          <li>
            <Icon name="check" />
            <span>
              We do not use answers for advertising, and we do not run advertising trackers on the
              form pages.
            </span>
          </li>
          <li>
            <Icon name="check" />
            <span>
              We store only what the form asks for. If a question is not needed, the honest fix is
              to remove the question.
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Cookies and local storage">
        <p className="info-text">
          Signing in keeps a token for the session, which is cleared when the browser closes. Your
          choice of light or dark mode and the accent colour are remembered in your browser so the
          app looks the same next time. Neither is used to track anyone.
        </p>
      </Section>

      <Section title="Asking for your data">
        <p className="info-text">
          If you answered a form and want to see, correct or remove what you sent, write to{" "}
          <a href="mailto:privacy@companystore.io">privacy@companystore.io</a> with the form's name
          and roughly when you replied. We will come back to you within 30 days.
        </p>
      </Section>
    </Page>
  );
}

/* ============================ terms ============================ */

export function TermsOfUse() {
  return (
    <Page
      eyebrow="Terms of use"
      title="The ground rules"
      intro="These terms cover using companystore.io, whether you build forms here or answer one."
    >
      <Section title="1. Accounts">
        <p className="info-text">
          Logins are created by an administrator; there is no public sign-up. Keep your password to
          yourself, and tell an administrator if you think someone else has it. Anything done with
          your login is treated as done by you. An administrator can block or remove any account.
        </p>
      </Section>

      <Section title="2. Shared work">
        <p className="info-text">
          Workbenches and forms belong to the company rather than to one person. Everyone with an
          account can open, edit and delete them, and every change is recorded with the name of the
          person who made it. Please treat a colleague's form the way you would want yours treated.
        </p>
      </Section>

      <Section title="3. What you send">
        <p className="info-text">
          Do not use a form to collect more than you need, and do not use this app to gather payment
          card numbers, government identity numbers, health records or anything else you are not
          entitled to hold. You are responsible for telling people why you are asking and for having
          a lawful reason to ask.
        </p>
      </Section>

      <Section title="4. Fair use">
        <ul className="info-list">
          <li>
            <Icon name="check" />
            <span>Do not try to reach forms, answers or accounts that are not yours to see.</span>
          </li>
          <li>
            <Icon name="check" />
            <span>Do not upload anything designed to harm a reader's computer.</span>
          </li>
          <li>
            <Icon name="check" />
            <span>
              Do not use a published link for spam, or for anything unlawful or deliberately
              misleading.
            </span>
          </li>
        </ul>
      </Section>

      <Section title="5. Availability">
        <p className="info-text">
          This is an internal tool and we do not promise it will be available without interruption.
          We may change or pause features, and we will give notice inside the app where a change
          affects forms you have already published. Keep your own copy of anything you cannot afford
          to lose; the Excel export is there for exactly that.
        </p>
      </Section>

      <Section title="6. Ending access">
        <p className="info-text">
          An administrator may end access at any time, usually when someone leaves. Forms and
          answers created with that account stay with the company. If the whole service is retired,
          we will say so in advance and give you time to export.
        </p>
      </Section>
    </Page>
  );
}