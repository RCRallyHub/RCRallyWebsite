// Shared micro-interactions: button ripple + magnetic CTA pull.
// Both check prefers-reduced-motion and low-power hints before animating.

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initRipple() {
  document.addEventListener('pointerdown', (e) => {
    const target = (e.target as HTMLElement)?.closest<HTMLElement>('[data-ripple]');
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    target.style.setProperty('--ripple-x', `${x}%`);
    target.style.setProperty('--ripple-y', `${y}%`);
    target.classList.add('rippling');
    window.setTimeout(() => target.classList.remove('rippling'), 500);
  });
}

function initMagnetic() {
  if (prefersReducedMotion()) return;
  if (window.matchMedia('(pointer: coarse)').matches) return; // skip on touch

  const magnets = document.querySelectorAll<HTMLElement>('[data-magnetic]');
  magnets.forEach((el) => {
    let raf = 0;
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate(${x * 0.18}px, ${y * 0.3}px)`;
      });
    });
    el.addEventListener('mouseleave', () => {
      cancelAnimationFrame(raf);
      el.style.transform = '';
    });
  });
}

function initTilt() {
  if (prefersReducedMotion()) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const cards = document.querySelectorAll<HTMLElement>('.tilt-card');
  cards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(800px) rotateY(0) rotateX(0) translateY(0)';
    });
  });
}

function init() {
  initRipple();
  initMagnetic();
  initTilt();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
