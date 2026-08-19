// Scroll-reveal: adds `.is-visible` to any `.reveal` element as it enters the
// viewport. Respects prefers-reduced-motion by doing nothing extra (CSS
// already disables the transition/transform in that case).
export function initScrollReveal() {
  const els = document.querySelectorAll<HTMLElement>('.reveal:not(.reveal-init)');
  if (els.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible', 'reveal-init'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const delay = el.dataset.revealDelay || '0';
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add('is-visible');
          observer.unobserve(el);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  els.forEach((el) => {
    el.classList.add('reveal-init');
    observer.observe(el);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScrollReveal);
} else {
  initScrollReveal();
}
// Re-run for any content swapped in later (e.g. gallery filter results).
document.addEventListener('rc:reinit-reveal', initScrollReveal);
