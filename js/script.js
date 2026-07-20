// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// ===== LOADER / PAGE REVEAL =====
const loader = document.getElementById('loader');

// Tracks whether the entrance animations have run for THIS script execution.
// Because the back-forward cache preserves JS state, this flag survives a
// bfcache restore and lets us tell "mid loader intro" apart from "already shown".
let animationsStarted = false;

function startAnimationsOnce() {
  if (animationsStarted) return;
  animationsStarted = true;
  initAnimations();
}

// Single source of truth for making the page visible. Whatever path we arrive
// through (first-visit loader, seamless in-session entry, or a Safari bfcache
// restore), this guarantees the body is shown and the loader is gone. It is the
// safety net that prevents content from ever being stuck at opacity:0.
function revealPage() {
  document.documentElement.classList.remove('seamless-entry', 'show-loader');
  document.body.classList.remove('page-leaving');
  if (loader) loader.style.display = 'none';
  startAnimationsOnce();
}

const shouldShowLoader = document.documentElement.classList.contains('show-loader');

if (shouldShowLoader && loader) {
  window.addEventListener('load', () => {
    setTimeout(() => {
      gsap.to(loader, {
        yPercent: -100,
        duration: 0.9,
        ease: 'power3.inOut',
        delay: 0.2,
        onComplete: revealPage
      });
    }, 1600);
  });
  // Failsafe: if the 'load' event is delayed or never fires (a stalled font or
  // GSAP CDN request on Safari), still reveal so the black loader can't hang.
  setTimeout(revealPage, 4200);
} else {
  // In-session navigation: there is no loader, so reveal immediately and
  // SYNCHRONOUSLY. We must NOT gate this behind requestAnimationFrame: iOS/iPadOS
  // Safari defers rAF callbacks until after the first post-navigation paint,
  // which was the artificial ~1s delay that left the main content blank while
  // the navbar/footer were already visible. Running now (script is at the end of
  // <body>, so the DOM is ready) starts the content reveal on the same frame.
  revealPage();
}

// ===== CUSTOM CURSOR =====
const cursor = document.getElementById('cursor');
const cursorLabel = document.getElementById('cursorLabel');
let mouseX = -100, mouseY = -100;
let cursorX = -100, cursorY = -100;
let rafCursor;

document.addEventListener('mousemove', e => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

function animateCursor() {
  const dx = mouseX - cursorX;
  const dy = mouseY - cursorY;
  cursorX += dx * 0.12;
  cursorY += dy * 0.12;
  cursor.style.left = cursorX + 'px';
  cursor.style.top  = cursorY + 'px';
  rafCursor = requestAnimationFrame(animateCursor);
}
animateCursor();

document.addEventListener('mousedown', () => cursor.classList.add('click'));
document.addEventListener('mouseup',   () => cursor.classList.remove('click'));

// Hover elements
document.querySelectorAll('a, button, .project-card, .h-scroll-item, .journal-card, .service-header, .team-card').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.classList.add('hover');
    cursorLabel.textContent = el.dataset.cursor || 'View';
  });
  el.addEventListener('mouseleave', () => {
    cursor.classList.remove('hover');
    cursorLabel.textContent = '';
  });
});

// ===== PAGE NAVIGATION =====
const currentPage = document.body.dataset.page || 'home';

// Internal links now navigate natively via their href. We previously called
// window.location.assign() on every click WITHOUT event.preventDefault(), which
// triggered a SECOND, redundant navigation to the same URL. On iOS/iPadOS Safari
// that duplicate navigation interfered with the back-forward cache and produced
// inconsistent loads. Native anchor navigation is simpler and bfcache-friendly.

// Restore pages served from the back-forward cache. On a bfcache restore the
// page's scripts do NOT re-execute, so this handler is effectively the only code
// that runs and it must return the page to a correct, visible state.
//
// We deliberately reveal when `event.persisted` OR `animationsStarted` is true,
// instead of trusting `event.persisted` alone: that flag is an unreliable
// false-negative on iOS/iPadOS Safari, which was the core cause of the stale
// content. Using the persisted JS state as a secondary signal means a restored
// page is always re-shown, while a genuine first load still lets the loader
// intro play (animationsStarted is still false at that point).
window.addEventListener('pageshow', (event) => {
  document.body.classList.remove('page-leaving');

  if (event.persisted || animationsStarted) {
    revealPage();
    // Re-sync scroll-driven state and reveal anything not yet shown.
    if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
      ScrollTrigger.refresh();
    }
    initRevealObserver();
  }
});

// ===== MOBILE MENU =====
const menuBtn  = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');
let menuOpen = false;

menuBtn.addEventListener('click', () => {
  menuOpen = !menuOpen;
  mobileMenu.classList.toggle('open', menuOpen);
  menuBtn.setAttribute('aria-expanded', menuOpen);
  const spans = menuBtn.querySelectorAll('span');
  spans[0].style.transform = menuOpen ? 'rotate(45deg) translate(4px, 5px)' : '';
  spans[1].style.opacity   = menuOpen ? '0' : '1';
  spans[2].style.transform = menuOpen ? 'rotate(-45deg) translate(4px, -5px)' : '';
});

function closeMobileMenu() {
  menuOpen = false;
  mobileMenu.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', false);
  menuBtn.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
}

// ===== SCROLL PROGRESS =====
const scrollBar = document.getElementById('scrollProgress');
window.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  scrollBar.style.width = (scrollTop / docHeight * 100) + '%';
}, { passive: true });

// ===== INIT ANIMATIONS =====
function initAnimations() {
  // Home hero lines
  if (document.querySelector('.hero-headline')) {
    gsap.set('.hero-headline .line-reveal-inner', { y: '110%' });
    gsap.to('.hero-headline .line-reveal-inner', {
      y: '0%',
      duration: 1.1,
      stagger: 0.12,
      ease: 'power3.out',
      delay: 0.1
    });
    gsap.to('#heroEyebrow', { opacity: 1, y: 0, duration: 0.8, delay: 0.2 });
    gsap.to('#heroDesc',    { opacity: 1, duration: 0.9, delay: 0.7 });
    gsap.to('#heroScroll',  { opacity: 1, duration: 0.7, delay: 1.0 });
    gsap.to('#heroIndex',   { opacity: 1, duration: 0.7, delay: 1.1 });
  }

  initRevealObserver();
  initLineRevealScroll();
  initCountUp();
  initHScrollDrag();
  initFilterBtns();
  initHeroParallax();
}

// ===== SCROLL REVEAL =====
function initRevealObserver() {
  const revealEls = document.querySelectorAll('.reveal-up:not(.revealed), .reveal-fade:not(.revealed)');

  const reveal = (el) => {
    if (el.classList.contains('revealed')) return;
    el.classList.add('revealed');
    const delay = parseFloat(el.style.transitionDelay || el.dataset.delay || 0);
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 0.75,
      ease: 'power3.out',
      delay: delay
    });
  };

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        reveal(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  revealEls.forEach(el => {
    // Reveal anything already on screen straight away. The IntersectionObserver
    // callback is deferred by iOS Safari right after a navigation, so relying on
    // it alone left above-the-fold content blank for ~1s. Below-the-fold elements
    // still animate in on scroll via the observer.
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) {
      reveal(el);
    } else {
      obs.observe(el);
    }
  });
}

// Line reveals on scroll (page headings). Called from initAnimations() so it
// runs on the same frame as everything else — the old standalone
// setTimeout(..., 200) added a flat 200ms delay before the heading could appear.
function initLineRevealScroll() {
  document.querySelectorAll('.page-section.active .line-reveal').forEach(container => {
    // The home hero headline is animated by the hero timeline in initAnimations();
    // skip it here so we don't override its staggered entrance.
    if (container.closest('.hero-headline')) return;

    const inner = container.querySelector('.line-reveal-inner');
    if (!inner || inner.dataset.revealed === 'true') return;

    const show = () => {
      inner.dataset.revealed = 'true';
      gsap.to(inner, { y: '0%', duration: 0.85, ease: 'power3.out' });
    };

    // Headings already on screen reveal immediately instead of waiting for the
    // IntersectionObserver callback, which iOS Safari defers after a navigation.
    const rect = container.getBoundingClientRect();
    const inView = rect.top < window.innerHeight && rect.bottom > 0;
    if (inView) {
      show();
      return;
    }

    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        show();
        obs.disconnect();
      }
    }, { threshold: 0.1 });
    obs.observe(container);
  });
}

// ===== COUNT UP =====
function initCountUp() {
  const counters = document.querySelectorAll('.count-up');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target);
        gsap.to({ val: 0 }, {
          val: target,
          duration: 1.8,
          ease: 'power2.out',
          onUpdate: function() {
            el.textContent = Math.round(this.targets()[0].val);
          }
        });
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => obs.observe(c));
}

// ===== HERO PARALLAX =====
function initHeroParallax() {
  window.addEventListener('scroll', () => {
    if (currentPage !== 'home') return;
    const y = window.scrollY;
    const bgSvg = document.querySelector('.hero-bg-svg');
    if (bgSvg) bgSvg.style.transform = `translateY(${y * 0.25}px)`;
    const heroContent = document.querySelector('.hero-content');
    if (heroContent) heroContent.style.transform = `translateY(${y * 0.15}px)`;
  }, { passive: true });
}

// ===== HORIZONTAL SCROLL DRAG =====
function initHScrollDrag() {
  const tracks = document.querySelectorAll('.h-scroll-track');

  tracks.forEach(track => {
    let isDown = false, startX, scrollLeft;
    const wrap = track.parentElement;

    // Desktop
    wrap.addEventListener('mousedown', e => {
      isDown = true;
      wrap.style.cursor = 'grabbing';
      startX = e.pageX - wrap.offsetLeft;
      scrollLeft = wrap.scrollLeft;
    });

    wrap.addEventListener('mouseleave', () => {
      isDown = false;
      wrap.style.cursor = 'grab';
    });

    wrap.addEventListener('mouseup', () => {
      isDown = false;
      wrap.style.cursor = 'grab';
    });

    wrap.addEventListener('mousemove', e => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - wrap.offsetLeft;
      wrap.scrollLeft = scrollLeft - (x - startX) * 1.4;
    });

    // Mobile
    let touchStartX = 0;
    let touchScrollLeft = 0;

    wrap.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchScrollLeft = wrap.scrollLeft;
    }, { passive: true });

    wrap.addEventListener('touchmove', e => {
      const x = e.touches[0].clientX;
      wrap.scrollLeft = touchScrollLeft - (x - touchStartX);
    }, { passive: true });

    wrap.style.cursor = 'grab';
    wrap.style.overflowX = 'auto';
    wrap.style.scrollbarWidth = 'none';
    wrap.style.webkitOverflowScrolling = 'touch';
    wrap.style.touchAction = 'pan-x';
  });
}

// ===== SERVICES ACCORDION =====
function toggleService(header) {
  const item = header.parentElement;
  const isOpen = item.classList.contains('open');
  // Close all
  document.querySelectorAll('.service-item').forEach(s => s.classList.remove('open'));
  // Open clicked if it was closed
  if (!isOpen) item.classList.add('open');
}

// ===== PROJECTS FILTER =====
function initFilterBtns() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.project-card').forEach(card => {
        const show = filter === 'all' || card.dataset.cat === filter;
        gsap.to(card, {
          opacity: show ? 1 : 0.15,
          scale: show ? 1 : 0.97,
          duration: 0.4,
          ease: 'power2.out'
        });
      });
    });
  });
}

// ===== FORM =====
function handleSubmit(e) {
  e.preventDefault();
  const success = document.getElementById('formSuccess');
  success.style.display = 'block';
  gsap.from(success, { opacity: 0, y: 8, duration: 0.5 });
  e.target.reset();
}

// ===== SMOOTH ANCHOR IN SAME PAGE =====
// No Lenis CDN available, use native smooth scroll
document.querySelectorAll('a[href^="#"]:not([data-page])').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Initialise scroll reveals for visible sections
window.addEventListener('scroll', () => {
  initRevealObserver();
}, { passive: true, once: true });