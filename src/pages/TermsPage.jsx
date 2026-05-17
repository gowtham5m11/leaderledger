import React from 'react';

// LeaderLedger Terms of Service
// -----------------------------
// Starter draft to be reviewed by counsel. Fill in [BRACKETED] placeholders
// before publishing. Particularly review §8 (Disclaimer) and §9 (Limitation
// of liability) for your jurisdiction — Indian Consumer Protection Act 2019
// and EU consumer law both restrict what you can disclaim.

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

const TermsPage = () => (
  <div className="page-main" style={{ maxWidth: 820, margin: '0 auto', padding: '3rem 1.5rem 6rem' }}>
    <h1 className="font-headline" style={{ fontSize: 'clamp(1.75rem, 5vw, 2.4rem)', margin: 0, color: 'var(--on-surface)' }}>
      Terms of Service
    </h1>
    <p style={{ marginTop: '0.5rem', color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
      Last updated: {LAST_UPDATED}
    </p>

    <Section id="about" title="1. About the Service">
      <p>
        LeaderLedger is a public-data site that aggregates information about
        Andhra Pradesh Legislative Assembly candidates from public sources.
        All candidate data is sourced from the Election Commission of India’s
        Form-26 affidavits and from MyNeta. We do not generate, alter, or
        endorse any of the underlying information.
      </p>
    </Section>

    <Section id="accept" title="2. Acceptance">
      <p>
        By using the Service, you agree to these Terms and to the{' '}
        <a href="#/privacy" style={{ color: 'var(--primary)' }}>Privacy Policy</a>. If you
        don’t agree, please don’t use the Service.
      </p>
    </Section>

    <Section id="account" title="3. Your account">
      <p>
        Sign-in is optional. You sign in via <strong>Google</strong>. You’re responsible
        for keeping your Google account secure — we never see your Google password.
        You may delete your LeaderLedger account at any time from your account page;
        deletion is described in the{' '}
        <a href="#/privacy" style={{ color: 'var(--primary)' }}>Privacy Policy</a>.
      </p>
    </Section>

    <Section id="accuracy" title="4. Data accuracy">
      <p>
        We aim for accuracy, but the underlying public records contain errors,
        scanned-PDF artefacts, and OCR mistakes. <strong>The data on this site is for
        general information only and may be incomplete or out of date.</strong> Always
        verify against the underlying ECI affidavit before relying on any figure
        (e.g., for journalism, research, or legal purposes).
      </p>
      <p>
        Spotted an error? Use the <strong>Report inaccuracy</strong> button on any candidate
        profile.
      </p>
    </Section>

    <Section id="contributions" title="5. User contributions (reports)">
      <p>By submitting a report, you confirm that:</p>
      <ul>
        <li>The information you provide is, to your knowledge, accurate.</li>
        <li>You grant us a non-exclusive licence to use your report for moderation, correction, and aggregate analysis.</li>
        <li>You will not submit defamatory, harassing, or unlawful content. We may remove reports that violate these terms and, in serious cases, contact authorities.</li>
      </ul>
    </Section>

    <Section id="prohibited" title="6. Prohibited use">
      <p>You agree not to:</p>
      <ul>
        <li>Scrape or bulk-download the Service’s data faster than a reasonable rate, or in a way that bypasses our rate limits.</li>
        <li>Attempt to break, probe, or exploit security or authentication features.</li>
        <li>Use the Service to harass, dox, or defame any candidate or any other user.</li>
        <li>Misrepresent your identity or impersonate someone else.</li>
        <li>Use automated tools to generate reports or bookmarks.</li>
      </ul>
    </Section>

    <Section id="ip" title="7. Intellectual property">
      <p>
        The underlying candidate data is public record and is not owned by us.
        The site design, code, and aggregated/cleaned dataset are{' '}
        <strong>© 2026 LeaderLedger</strong>. You may link to candidate profiles freely;
        bulk republishing of the cleaned dataset requires written permission.
      </p>
    </Section>

    <Section id="disclaimer" title="8. Disclaimer">
      <p>
        The Service is provided <strong>“as is”</strong>, without warranty of any kind,
        express or implied, including merchantability, fitness for a particular
        purpose, or non-infringement. We do not warrant that the Service will be
        uninterrupted, error-free, or that any data displayed is accurate or current.
      </p>
      <p style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
        Note: some warranty disclaimers above are not enforceable against
        consumers in India (Consumer Protection Act 2019) or the EU. The
        Service still complies with the non-disclaimable parts of those laws.
      </p>
    </Section>

    <Section id="liability" title="9. Limitation of liability">
      <p>
        To the maximum extent permitted by law, LeaderLedger and its operators
        will not be liable for indirect, incidental, special, or consequential
        damages arising from your use of, or inability to use, the Service. Our
        aggregate liability under these Terms is limited to <strong>₹100 / €10 / US$10</strong>.
      </p>
    </Section>

    <Section id="indemnity" title="10. Indemnification">
      <p>
        You agree to indemnify and hold harmless LeaderLedger and its operators
        from any third-party claims arising from (a) reports or contributions
        you submit, or (b) your breach of these Terms.
      </p>
    </Section>

    <Section id="law" title="11. Governing law & disputes">
      <p>
        These Terms are governed by the laws of <strong>India</strong>, without regard to
        conflict-of-law principles. Any dispute will be brought in the courts of{' '}
        <strong>Guntur, India</strong>, except that residents of the EU/UK
        retain their statutory right to bring proceedings in their own jurisdiction.
      </p>
    </Section>

    <Section id="changes" title="12. Changes">
      <p>
        We may update these Terms occasionally. Material changes will be
        reflected by a new “Last updated” date at the top of this page;
        substantial changes affecting signed-in users will be shown in-app
        at next sign-in.
      </p>
    </Section>

    <Section id="contact" title="13. Contact">
      <p>
        Questions about these Terms: <strong>admin@leaderledger.in</strong>.
      </p>
    </Section>

    <p style={{ marginTop: '3rem', fontSize: '0.8rem', color: 'var(--on-surface-variant)', textAlign: 'center' }}>
      This document is a starting template. <strong>It is not legal advice.</strong> Consult a qualified lawyer before publishing.
    </p>
  </div>
);

export default TermsPage;
