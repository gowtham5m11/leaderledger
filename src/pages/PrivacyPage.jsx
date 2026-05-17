import React from 'react';

// LeaderLedger Privacy Policy
// ---------------------------
// This is a STARTER draft that reflects what the app actually collects.
// Before launch, replace every [BRACKETED] placeholder with real values
// and have it reviewed by counsel — particularly the legal-basis section
// (GDPR Art. 6 & DPDP § 7) and the named Grievance Officer (DPDP § 8(9)).

const LAST_UPDATED = '2026-05-17';

const Section = ({ id, title, children }) => (
  <section id={id} style={{ marginTop: '2.5rem' }}>
    <h2 className="font-headline" style={{ fontSize: '1.3rem', margin: '0 0 0.75rem', color: 'var(--on-surface)' }}>
      {title}
    </h2>
    <div style={{ color: 'var(--on-surface-variant)', lineHeight: 1.65, fontSize: '0.95rem' }}>
      {children}
    </div>
  </section>
);

const PrivacyPage = () => (
  <div className="page-main" style={{ maxWidth: 820, margin: '0 auto', padding: '3rem 1.5rem 6rem' }}>
    <h1 className="font-headline" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.4rem)', margin: 0, color: 'var(--on-surface)' }}>
      Privacy Policy
    </h1>
    <p style={{ marginTop: '0.5rem', color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
      Last updated: {LAST_UPDATED}
    </p>

    <Section id="who" title="1. Who we are">
      <p>
        LeaderLedger (“we”, “our”, the “Service”) is a public-data site at{' '}
        <strong>leaderledger.in</strong> that aggregates information about Andhra Pradesh
        Legislative Assembly candidates from public sources (Election Commission of India
        affidavits, MyNeta, etc.). The site is operated by <strong>Gowtham Jadapalli</strong>{' '}
        and is not affiliated with the Election Commission of India or any political party.
      </p>
      <p>
        Questions about this policy can be sent to <strong>admin@leaderledger.in</strong>.
      </p>
    </Section>

    <Section id="what" title="2. What data we collect">
      <p>You can use the entire public site — map, candidate list, profiles — without signing in. We only collect personal data from <strong>signed-in users</strong>:</p>
      <ul>
        <li>
          <strong>Google account profile</strong> when you sign in: your name, email
          address, and profile photo URL. We receive these from Google’s OAuth API.
        </li>
        <li>
          <strong>Your bookmarks</strong>: a list of candidate IDs you’ve saved. Stored
          under <code>users/&#123;uid&#125;/bookmarks/</code> in Firestore.
        </li>
        <li>
          <strong>Reports you submit</strong>: when you flag a data inaccuracy, we
          record your uid, the candidate, the field, the value you flagged, your
          suggested correction (optional), and your free-text reason.
        </li>
        <li>
          <strong>Rate-limit timestamp</strong>: the time of your most recent report,
          used to prevent abuse (10-second per-user throttle).
        </li>
      </ul>
      <p>
        We also use <strong>Google Analytics 4</strong> for aggregate traffic analytics
        (pageviews, country, device type). Analytics is loaded with{' '}
        <strong>Consent Mode v2</strong>: by default, no analytics cookies are set; we only
        begin collecting analytics after you accept the cookie banner. IP addresses are
        anonymised by Google before storage.
      </p>
      <p>
        Locally on your device, we store small preferences in your browser’s{' '}
        <code>localStorage</code> (theme choice, onboarding-tour state, cookie-consent
        choice). These never leave your device.
      </p>
    </Section>

    <Section id="why" title="3. Why we collect it (legal basis)">
      <p>
        Under <strong>India’s Digital Personal Data Protection Act, 2023</strong> we rely on
        your <strong>consent</strong> (DPDP § 7(a)) for analytics and on the{' '}
        <strong>specified purpose</strong> of operating bookmarks and reports (DPDP § 7(b))
        for the account data you provide at sign-in.
      </p>
      <p>
        Under <strong>EU/UK GDPR</strong>, our lawful bases are:
      </p>
      <ul>
        <li><strong>Consent</strong> (Art. 6(1)(a)) — analytics cookies and the data you submit in reports.</li>
        <li><strong>Performance of a contract</strong> (Art. 6(1)(b)) — operating the bookmark and account features you sign up for.</li>
        <li><strong>Legitimate interests</strong> (Art. 6(1)(f)) — anti-abuse rate limiting and security logging.</li>
      </ul>
    </Section>

    <Section id="share" title="4. Who we share data with">
      <p>We do not sell your data. We share data only with the processors needed to run the Service:</p>
      <ul>
        <li>
          <strong>Google LLC / Google Cloud</strong> — provides Firebase Authentication,
          Cloud Firestore (database), Firebase Hosting, and Google Analytics. Google
          processes the data as our sub-processor under its{' '}
          <a href="https://firebase.google.com/terms/data-processing-terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
            Firebase Data Processing Terms
          </a>.
        </li>
      </ul>
      <p>
        We may disclose data if compelled by a valid legal order — but we will
        challenge over-broad requests and notify affected users where the law permits.
      </p>
    </Section>

    <Section id="where" title="5. Where data is stored">
      <p>
        Firestore data is hosted in Google’s <code>us-central1</code> region (Iowa, USA).
        Google’s standard contractual clauses cover the EU→US transfer; for users
        in India, we rely on the DPDP Act’s permitted-territory framework.
      </p>
      <p>
        Firebase Hosting serves the site through Google’s global CDN — only your
        request metadata (IP, user-agent) reaches the nearest edge node.
      </p>
    </Section>

    <Section id="retention" title="6. How long we keep it">
      <ul>
        <li><strong>Account & bookmarks</strong>: until you delete your account. You can delete it any time from <a href="#/account" style={{ color: 'var(--primary)' }}>your account page</a>.</li>
        <li><strong>Reports</strong>: retained for moderation and audit (we need to act on them). On account deletion, your reports are kept but your uid is no longer linked to your identity. Email <strong>admin@leaderledger.in</strong> if you want a specific report removed.</li>
        <li><strong>Analytics events</strong>: retained per the GA4 default of <strong>14 months</strong>, then auto-deleted.</li>
        <li><strong>Server-side request logs</strong>: rolling 90 days, used only for abuse investigation.</li>
      </ul>
    </Section>

    <Section id="rights" title="7. Your rights">
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access</strong> — see what we hold about you. Your <a href="#/account" style={{ color: 'var(--primary)' }}>account page</a> shows it all.</li>
        <li><strong>Correct</strong> — your name and photo come from Google; update them there and the change flows through on next sign-in.</li>
        <li><strong>Erase</strong> — “Delete account” on the account page wipes your user document and bookmarks. Reports become anonymous.</li>
        <li><strong>Withdraw consent</strong> — for analytics, click “Manage cookies” in the footer.</li>
        <li><strong>Portability</strong> — bookmarks are a list of candidate IDs; you can copy them from the account page.</li>
        <li><strong>Lodge a complaint</strong> — with your local data-protection authority (in India: the Data Protection Board under the DPDP Act).</li>
      </ul>
    </Section>

    <Section id="cookies" title="8. Cookies & tracking">
      <p>We use the following client-side storage:</p>
      <ul>
        <li><strong>Firebase Auth</strong> stores an ID token in <code>IndexedDB</code> while you’re signed in (strictly necessary — no consent required).</li>
        <li><strong>App Check</strong> stores a short-lived integrity token (strictly necessary).</li>
        <li><strong>Google Analytics 4</strong> sets <code>_ga</code> and <code>_ga_*</code> cookies <em>only after you accept</em> the cookie banner.</li>
        <li><strong>localStorage</strong>: <code>theme</code>, <code>ll_tour_step_v3</code>, <code>ll_desktop_hint_v1</code>, <code>ll_consent_v1</code> (strictly necessary or preference).</li>
      </ul>
    </Section>

    <Section id="children" title="9. Children">
      <p>
        The Service is not directed at children under <strong>18</strong>. We do not knowingly
        collect data from minors. Under DPDP § 9, processing children’s data requires
        verifiable parental consent, which we are not equipped to obtain — so we ask
        minors not to sign in. If you believe a child has signed in, please contact us.
      </p>
    </Section>

    <Section id="changes" title="10. Changes to this policy">
      <p>
        We’ll post material changes here with an updated date at the top. For
        substantial changes affecting signed-in users, we’ll show an in-app notice
        at next sign-in.
      </p>
    </Section>

    <Section id="contact" title="11. Contact & Grievance Officer">
      <p>
        For privacy questions, data requests, or to exercise any of the rights
        above, contact:
      </p>
      <div style={{ marginTop: '0.75rem', padding: '1rem 1.25rem', border: '1px solid var(--outline-variant)', borderRadius: '0.75rem', background: 'var(--surface-container-lowest)' }}>
        <strong>Gowtham Jadapalli</strong><br />
        Grievance Officer, LeaderLedger<br />
        Email: <strong>admin@leaderledger.in</strong><br />
        Response window: <strong>30 days</strong> from receipt (DPDP Rule).
      </div>
    </Section>

    <p style={{ marginTop: '3rem', fontSize: '0.8rem', color: 'var(--on-surface-variant)', textAlign: 'center' }}>
      This document is provided as a starting point. <strong>It is not legal advice.</strong> Consult a qualified lawyer before publishing.
    </p>
  </div>
);

export default PrivacyPage;
