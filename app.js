const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// If any later script error stops set-up, still show all content
addEventListener('error', () => document.documentElement.classList.add('no-reveal'));

// Reveal on scroll (set up first so content always appears)
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  $$('.reveal').forEach(el => io.observe(el));
} else document.documentElement.classList.add('no-reveal');

function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2800);
}

// Nav dropdowns
const hoverable = matchMedia('(hover: hover) and (min-width: 901px)');
$$('.dd').forEach(dd => {
  const close = () => dd.classList.remove('open');
  $('.dd-btn', dd).onclick = e => {
    e.stopPropagation();
    const was = dd.classList.contains('open') && !hoverable.matches;
    $$('.dd.open').forEach(d => d.classList.remove('open'));
    dd.classList.toggle('open', !was);
  };
  dd.addEventListener('mouseenter', () => { if (hoverable.matches) { $$('.dd.open').forEach(d => d.classList.remove('open')); dd.classList.add('open'); } });
  dd.addEventListener('mouseleave', () => { if (hoverable.matches) close(); });
});
document.addEventListener('click', e => { if (!e.target.closest('.dd')) $$('.dd.open').forEach(d => d.classList.remove('open')); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $$('.dd.open').forEach(d => d.classList.remove('open')); });

// Mobile menu
const burger = $('#burger');
const setMenu = open => {
  document.documentElement.classList.toggle('m-open', open);
  if (!burger) return;
  burger.setAttribute('aria-expanded', open);
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
};
if (burger) {
  burger.onclick = () => setMenu(!document.documentElement.classList.contains('m-open'));
  $$('#m-menu a, #m-menu button').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  matchMedia('(min-width: 901px)').addEventListener('change', e => { if (e.matches) setMenu(false); });
}

// Sticky Get report button (desktop pill / mobile bar): show once the hero button has scrolled away
const heroCta = $('.hero-cta'), mBar = $('#m-bar');
if (heroCta && mBar && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => mBar.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0))
    .observe(heroCta);
}

// Services accordion + photo for each service (home page)
const accItems = $$('#feat-acc .acc-item');
if (accItems.length) {
  const setFeat = i => {
    accItems.forEach((el, j) => { el.classList.toggle('open', i === j); $('button', el).setAttribute('aria-expanded', String(i === j)); });
    $$('#screen .ph').forEach((ph, j) => ph.classList.toggle('on', i === j));
  };
  accItems.forEach((el, i) => $('button', el).onclick = () => setFeat(i));
  setFeat(0);
}

// FAQ
$$('.faq-item').forEach(item => $('button', item).onclick = () => {
  const open = !item.classList.contains('open');
  $$('.faq-item').forEach(x => { x.classList.remove('open'); $('button', x).setAttribute('aria-expanded', 'false'); });
  item.classList.toggle('open', open);
  $('button', item).setAttribute('aria-expanded', open);
});

// Enquiry pop-up
const modal = $('#modal');
function openModal(title, sub, prefill = '') {
  const f = $('#modal-form');
  f.reset();
  $('#modal-title').textContent = title;
  $('#modal-sub').textContent = sub;
  f.message.value = prefill;
  modal.showModal();
  modal.scrollTop = 0;
  if (matchMedia('(min-width: 901px) and (min-height: 561px)').matches) f.name.focus();
  else $('#modal-title').focus({ preventScroll: true });
}
if (modal) {
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-report]');
    if (!btn) return;
    e.preventDefault();
    openModal('Get Rebuild Cost Assessment Report', "Tell us about the property and we'll come back with your RCA report quote within one business day.", btn.dataset.service ? `${btn.dataset.service}: ` : '');
  });
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
  $('#modal-form').addEventListener('submit', e => {
    if (e.submitter?.value !== 'ok') return;
    const f = e.target;
    if (!f.name.value.trim() || !isEmail(f.email.value)) { e.preventDefault(); f.reportValidity(); return; }
    toast(`Thanks, ${f.name.value.trim()}! A surveyor will be in touch soon.`);
    f.reset();
  });
}

// Reminder sign-up
const newsForm = $('#news-form');
if (newsForm) newsForm.onsubmit = e => {
  e.preventDefault();
  const inp = $('input', e.target), msg = $('#news-msg');
  if (!isEmail(inp.value)) { inp.classList.add('err'); msg.textContent = 'Please enter a valid email.'; return; }
  inp.classList.remove('err'); inp.value = '';
  msg.textContent = "Thanks. We'll remind you when it's time to reassess.";
};

const yr = $('#yr');
if (yr) yr.textContent = String(new Date().getFullYear());
