import React from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';

// Bump the storage-key suffix whenever the steps change shape so returning
// users see the new tour.
const STORAGE_KEY = 'll_tour_step_v3';
// Wait this long after entering a profile before the spotlight steps fire,
// so the page has time to settle visually.
const PROFILE_DELAY_MS = 800;

// Step definitions. `selector` is the DOM target for the spotlight (or null
// for a centered banner). `route` is the path the step belongs on; if the
// user is elsewhere, the step waits (or shows a hint) until they get there.
const STEPS = [
  {
    id: 1,
    route: '/district',
    selector: null,
    title: 'Explore the district map',
    body: 'Pinch and zoom on any district to see who won and who ran in that constituency.',
    placement: 'bottom-banner',
  },
  {
    id: 2,
    route: '/district',
    selector: '[data-tour="nav-list"]',
    title: 'Open the Candidates page',
    body: 'Tap the List tab below to browse every candidate.',
    placement: 'above',
  },
  {
    id: 3,
    route: '/list',
    selector: '[data-tour="search"]',
    title: 'Search a candidate',
    body: 'Type a candidate name, constituency or ministry into the search bar.',
    placement: 'below',
  },
  {
    id: 4,
    route: '/list',
    selector: '[data-tour="count"]',
    title: 'Watch the counter',
    body: 'This shows how many of the 175 candidates match your search. Scroll down to see them.',
    placement: 'below',
  },
  // Profile-route steps are ordered to follow the visual flow down a
  // candidate profile on mobile (hero buttons → info grid top-to-bottom →
  // right column criminal card). When the page layout changes, reorder
  // these to match and bump STORAGE_KEY.
  {
    id: 5,
    route: '/profile',
    selector: '[data-tour="bookmark"]',
    title: 'Bookmark your favourite',
    body: 'Bookmark your favourite candidate to get future updates on them.',
    placement: 'below',
  },
  {
    id: 6,
    route: '/profile',
    selector: '[data-tour="report"]',
    title: 'Spotted something wrong?',
    body: 'Report any false data you find on this candidate — we review every report.',
    placement: 'below',
  },
  {
    id: 7,
    route: '/profile',
    selector: '[data-tour="education"]',
    title: 'Education',
    body: 'The candidate’s self-declared educational qualifications.',
    placement: 'below',
  },
  {
    id: 8,
    route: '/profile',
    selector: '[data-tour="profession"]',
    title: 'Profession',
    body: 'How the candidate earns a living, per their affidavit.',
    placement: 'below',
  },
  {
    id: 9,
    route: '/profile',
    selector: '[data-tour="ministries"]',
    title: 'Portfolios held',
    body: 'See every ministry this leader holds — the primary portfolio is marked.',
    placement: 'above',
    optional: true,
  },
  {
    id: 10,
    route: '/profile',
    selector: '[data-tour="social"]',
    title: 'Official socials',
    body: 'Verified handles and contact info for this candidate.',
    placement: 'above',
    optional: true,
  },
  {
    id: 11,
    route: '/profile',
    selector: '[data-tour="criminal"]',
    title: 'Criminal record',
    body: 'Pending cases and convictions pulled from this candidate’s ECI affidavit.',
    placement: 'above',
  },
];

const readStoredStep = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'done') return 'done';
    const n = parseInt(v || '1', 10);
    return Number.isFinite(n) && n >= 1 && n <= STEPS.length ? n : 1;
  } catch (_e) {
    return 1;
  }
};

const writeStoredStep = (v) => {
  try { localStorage.setItem(STORAGE_KEY, String(v)); } catch (_e) { /* ignore */ }
};

// Poll for a target node for up to ~1.5s — route transitions and Firestore
// gates can delay when [data-tour="..."] elements mount.
const useTargetRect = (selector, deps) => {
  const [rect, setRect] = React.useState(null);

  React.useEffect(() => {
    if (!selector) { setRect(null); return undefined; }

    let cancelled = false;
    let raf = 0;
    const start = performance.now();

    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
          return;
        }
      }
      if (performance.now() - start < 1500) {
        raf = requestAnimationFrame(tick);
      } else {
        setRect(null);
      }
    };
    raf = requestAnimationFrame(tick);

    const onChange = () => {
      const el = document.querySelector(selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, ...(deps || [])]);

  return rect;
};

const PinchAnimation = () => (
  <div className="tour-pinch" aria-hidden="true">
    <div className="tour-pinch-dot tour-pinch-dot--left" />
    <div className="tour-pinch-dot tour-pinch-dot--right" />
  </div>
);

const IntroGuide = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { configured } = useAuth();

  const [step, setStep] = React.useState(() => readStoredStep());
  const [profileReady, setProfileReady] = React.useState(false);

  // Reset the profile-ready delay every time the pathname switches to a new
  // profile id (or off-profile).
  React.useEffect(() => {
    const onProfile = location.pathname.startsWith('/profile/');
    setProfileReady(false);
    if (!onProfile) return undefined;
    const t = setTimeout(() => setProfileReady(true), PROFILE_DELAY_MS);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const persistStep = React.useCallback((next) => {
    setStep(next);
    writeStoredStep(next);
  }, []);

  const finish = React.useCallback(() => persistStep('done'), [persistStep]);

  const currentStep = step === 'done' ? null : STEPS.find((s) => s.id === step);

  // Auto-advance on route / state changes (still fires even with manual
  // nav buttons, so user actions don't get out of sync with the tour).
  React.useEffect(() => {
    if (step === 2 && location.pathname.startsWith('/list')) {
      persistStep(3);
      return;
    }
    if (step === 3) {
      const q = (searchParams.get('q') || '').trim();
      if (q.length > 0) {
        persistStep(4);
        return;
      }
    }
    if (step === 4 && location.pathname.startsWith('/profile/')) {
      persistStep(5);
    }
    // If Firebase isn't configured, Bookmark + Report buttons never mount —
    // end the tour after step 4 instead of hanging.
    if (!configured && (step === 5 || step === 6)) {
      persistStep('done');
    }
  }, [step, location.pathname, searchParams, configured, persistStep]);

  // Walk past optional steps whose target isn't currently in the DOM
  // (e.g. a candidate with no ministries). Walks in the requested direction
  // and returns the first reachable step, or null if it runs off either end.
  const findNextReachable = React.useCallback((startId, direction) => {
    let id = startId;
    while (id >= 1 && id <= STEPS.length) {
      const s = STEPS.find((x) => x.id === id);
      if (!s) return null;
      if (!s.optional || !s.selector) return id;
      if (document.querySelector(s.selector)) return id;
      id += direction;
    }
    return null;
  }, []);

  // Manual step navigation. For /district ↔ /list transitions we navigate
  // automatically; for /profile transitions we just advance state — the
  // tour reappears once the user opens any profile.
  const goToStep = React.useCallback((nextId) => {
    if (!currentStep) return;
    if (nextId < 1) return;
    if (nextId > STEPS.length) { finish(); return; }
    const direction = nextId >= currentStep.id ? 1 : -1;
    const reachable = findNextReachable(nextId, direction);
    if (reachable === null) {
      if (direction === 1) finish();
      return;
    }
    const target = STEPS.find((s) => s.id === reachable);
    persistStep(reachable);
    if (target.route === '/district' && !location.pathname.startsWith('/district')) {
      navigate('/district');
    } else if (target.route === '/list' && !location.pathname.startsWith('/list')) {
      navigate('/list');
    }
  }, [currentStep, finish, persistStep, location.pathname, navigate, findNextReachable]);

  // If the current step is optional and its target hasn't mounted, auto-skip
  // forward to the next reachable step (covers cases where the user lands
  // on an optional step from prior localStorage state).
  React.useEffect(() => {
    if (!currentStep || !currentStep.optional || !currentStep.selector) return undefined;
    const t = setTimeout(() => {
      if (!document.querySelector(currentStep.selector)) {
        const nextReachable = findNextReachable(currentStep.id + 1, 1);
        if (nextReachable === null) finish();
        else persistStep(nextReachable);
      }
    }, 1800);
    return () => clearTimeout(t);
  }, [currentStep, persistStep, finish, findNextReachable]);

  const onRightRoute = React.useMemo(() => {
    if (!currentStep) return false;
    if (currentStep.route === '/profile') return location.pathname.startsWith('/profile/');
    return location.pathname.startsWith(currentStep.route);
  }, [currentStep, location.pathname]);

  const rect = useTargetRect(
    onRightRoute && currentStep ? currentStep.selector : null,
    [step, location.pathname]
  );

  // Auto-scroll the spotlight target into view once per step.
  const scrolledForStepRef = React.useRef(null);
  React.useEffect(() => {
    if (!currentStep || !currentStep.selector) {
      scrolledForStepRef.current = null;
      return;
    }
    if (!rect) return;
    if (scrolledForStepRef.current === currentStep.id) return;
    const el = document.querySelector(currentStep.selector);
    if (!el) return;
    // Profile-route steps: reset main-content scroll first so the
    // bookmark/report steps (top of page) need zero further scrolling
    // and the deeper sections (criminal/education/…) start from a clean
    // baseline before scrollIntoView centers them.
    if (currentStep.route === '/profile') {
      const main = document.querySelector('.main-content');
      if (main) main.scrollTop = 0;
    }
    try {
      // Instant (not smooth) so the spotlight rect on the next render
      // frame matches the post-scroll target position — avoids the
      // "blank screen" bug where the 4 dim panels render against a
      // stale rect during the ~500ms smooth-scroll animation.
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
    } catch (_e) { /* older browsers */ }
    scrolledForStepRef.current = currentStep.id;
  }, [currentStep, rect]);

  if (!isMobile) return null;
  if (!currentStep) return null;
  if (!onRightRoute) return null;
  if (currentStep.route === '/profile' && !profileReady) return null;

  const isFirst = currentStep.id === 1;
  const isLast = currentStep.id >= STEPS.length;

  const NavActions = () => (
    <div className="tour-actions">
      <button
        type="button"
        className="tour-cta tour-cta--ghost"
        onClick={() => goToStep(currentStep.id - 1)}
        disabled={isFirst}
        style={isFirst ? { visibility: 'hidden' } : undefined}
      >
        Previous
      </button>
      <button
        type="button"
        className="tour-cta"
        onClick={() => goToStep(currentStep.id + 1)}
      >
        {isLast ? 'Finish' : 'Next'}
      </button>
    </div>
  );

  const ProgressDots = () => (
    <div className="tour-progress">
      {STEPS.map((s) => (
        <span key={s.id} className={`tour-dot ${s.id === currentStep.id ? 'is-active' : ''}`} />
      ))}
    </div>
  );

  // Banner mode (step 1) — transparent backdrop so the map stays interactive
  // and the pinch animation is visible.
  if (!currentStep.selector || currentStep.placement === 'bottom-banner') {
    return (
      <>
        {currentStep.id === 1 && <PinchAnimation />}
        <div
          className="tour-backdrop tour-backdrop--clear"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
        >
          <div className="tour-sheet">
            <button type="button" className="tour-skip" onClick={finish} aria-label="Skip tour">Skip</button>
            <h2 id="tour-title" className="tour-title">{currentStep.title}</h2>
            <p className="tour-body">{currentStep.body}</p>
            <ProgressDots />
            <NavActions />
          </div>
        </div>
      </>
    );
  }

  // Spotlight target hasn't mounted — fall back to a centered card so the
  // user is never stuck.
  if (!rect) {
    return (
      <div className="tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div className="tour-sheet">
          <button type="button" className="tour-skip" onClick={finish} aria-label="Skip tour">Skip</button>
          <h2 id="tour-title" className="tour-title">{currentStep.title}</h2>
          <p className="tour-body">{currentStep.body}</p>
          <ProgressDots />
          <NavActions />
        </div>
      </div>
    );
  }

  // Spotlight mode — 4 dim panels around the target, glowing ring on top.
  const tooltipHeight = 220;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const preferBelow = currentStep.placement !== 'above';
  const spaceBelow = viewportH - (rect.top + rect.height);
  const placeBelow = preferBelow ? spaceBelow >= tooltipHeight : rect.top < tooltipHeight;

  const tooltipStyle = placeBelow
    ? { top: rect.top + rect.height + 14, left: 16, right: 16 }
    : { bottom: viewportH - rect.top + 14, left: 16, right: 16 };

  const ringPad = 6;
  const ringStyle = {
    top: rect.top - ringPad,
    left: rect.left - ringPad,
    width: rect.width + ringPad * 2,
    height: rect.height + ringPad * 2,
  };

  const dim = 'rgba(15, 20, 18, 0.62)';
  const panels = [
    { top: 0, left: 0, right: 0, height: Math.max(0, rect.top - ringPad) },
    { top: rect.top + rect.height + ringPad, left: 0, right: 0, bottom: 0 },
    { top: rect.top - ringPad, left: 0, width: Math.max(0, rect.left - ringPad), height: rect.height + ringPad * 2 },
    { top: rect.top - ringPad, left: rect.left + rect.width + ringPad, right: 0, height: rect.height + ringPad * 2 },
  ];

  // When the user scrolls past the spotlight, the ring + tooltip end up
  // off-screen too (both are positioned relative to rect). Surface a pill
  // at the visible viewport edge pointing back to the target.
  const offTop = rect.top + rect.height < 0;
  const offBottom = rect.top > viewportH;
  const offDirection = offTop ? 'up' : (offBottom ? 'down' : null);
  const scrollBackToTarget = () => {
    const el = document.querySelector(currentStep.selector);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <>
      {panels.map((p, i) => (
        <div
          key={i}
          className="tour-panel"
          style={{ position: 'fixed', background: dim, zIndex: 9998, pointerEvents: 'none', ...p }}
        />
      ))}
      <div className="tour-ring" style={{ position: 'fixed', zIndex: 9998, ...ringStyle }} />

      <div
        className="tour-tooltip"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        style={{ position: 'fixed', zIndex: 10000, ...tooltipStyle }}
      >
        <button type="button" className="tour-skip" onClick={finish} aria-label="Skip tour">Skip</button>
        <h2 id="tour-title" className="tour-title">{currentStep.title}</h2>
        <p className="tour-body">{currentStep.body}</p>
        <ProgressDots />
        <NavActions />
      </div>

      {offDirection && (
        <button
          type="button"
          className={`tour-pointer tour-pointer--${offDirection}`}
          onClick={scrollBackToTarget}
          aria-label={`Scroll back to ${currentStep.title}`}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {offDirection === 'up' ? 'arrow_upward' : 'arrow_downward'}
          </span>
          <span className="tour-pointer-label">{currentStep.title}</span>
        </button>
      )}
    </>
  );
};

export default IntroGuide;
