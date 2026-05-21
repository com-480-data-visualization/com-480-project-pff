// ── Scroll reveal ─────────────────────────────────────────────────────────
const revealObs = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObs.unobserve(e.target);
    }
  }),
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// ── Active nav link highlight ─────────────────────────────────────────────
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');

const navObs = new IntersectionObserver(
  entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(a => a.classList.remove('active'));
        const link = document.querySelector(`.nav-links a[href="#${e.target.id}"]`);
        if (link) link.classList.add('active');
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);
sections.forEach(s => navObs.observe(s));

navLinks.forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href')?.slice(1);
    const el = id && document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// ── Section scroll magnet (proximity snap + wheel threshold at edges) ─────
(function initSectionSnap() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const snapSections = [...document.querySelectorAll('#hero, section[id]')];
  const WHEEL_THRESHOLD = 95;
  const ALIGN_PX = 72;
  const MOSTLY_ONE_RATIO = 0.68;
  const IDLE_SNAP_MS = 140;

  let wheelAccum = 0;
  let snapLock = false;
  let scrollIdleTimer;

  function sectionDocTop(el) {
    return el.getBoundingClientRect().top + window.scrollY;
  }

  function visibilityRatio(el) {
    const r = el.getBoundingClientRect();
    const visible = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
    return Math.max(0, visible / window.innerHeight);
  }

  function dominantSection() {
    let best = snapSections[0];
    let bestRatio = 0;
    for (const s of snapSections) {
      const ratio = visibilityRatio(s);
      if (ratio > bestRatio) {
        bestRatio = ratio;
        best = s;
      }
    }
    const top = best.getBoundingClientRect().top;
    const aligned = Math.abs(top) < ALIGN_PX;
    return { el: best, ratio: bestRatio, aligned, top };
  }

  function scrollableAncestor(node) {
    let el = node;
    while (el && el !== document.body) {
      const { overflowY } = getComputedStyle(el);
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function snapTo(el, behavior = 'smooth') {
    snapLock = true;
    wheelAccum = 0;
    el.scrollIntoView({ behavior, block: 'start' });
    window.setTimeout(() => { snapLock = false; }, behavior === 'smooth' ? 520 : 60);
  }

  function atSectionEdge(el, dir) {
    const r = el.getBoundingClientRect();
    const tallerThanView = r.height > window.innerHeight + 24;
    if (!tallerThanView) return true;
    if (dir > 0) return r.bottom <= window.innerHeight + 16;
    return r.top >= -16;
  }

  window.addEventListener('wheel', e => {
    if (snapLock || e.ctrlKey) return;
    if (scrollableAncestor(e.target)) return;

    const dir = Math.sign(e.deltaY);
    if (!dir) return;

    const { el, ratio, aligned } = dominantSection();
    const mostlyOne = ratio >= MOSTLY_ONE_RATIO;
    if (!mostlyOne && !aligned) {
      wheelAccum = 0;
      return;
    }

    if (!atSectionEdge(el, dir)) {
      wheelAccum = 0;
      return;
    }

    const idx = snapSections.indexOf(el);
    const next = snapSections[idx + dir];
    if (!next) {
      wheelAccum = 0;
      return;
    }

    wheelAccum += e.deltaY;
    if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    snapTo(next);
  }, { passive: false });

  window.addEventListener('scroll', () => {
    if (snapLock) return;
    clearTimeout(scrollIdleTimer);
    scrollIdleTimer = setTimeout(() => {
      const { el, ratio, aligned, top } = dominantSection();
      if (aligned || ratio >= 0.92) return;
      if (ratio < 0.35) return;
      const dist = Math.abs(top);
      if (dist < window.innerHeight * 0.05) snapTo(el);
    }, IDLE_SNAP_MS);
  }, { passive: true });
})();
