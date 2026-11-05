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
const setDd = (dd, open) => {
  clearTimeout(dd._t);
  dd.classList.toggle('open', open);
  const btn = $('.dd-btn', dd);
  if (btn) btn.setAttribute('aria-expanded', String(open));
};
const closeAllDd = except => $$('.dd.open').forEach(d => { if (d !== except) setDd(d, false); });
$$('.dd').forEach(dd => {
  $('.dd-btn', dd).onclick = e => {
    e.stopPropagation();
    const open = !dd.classList.contains('open');
    closeAllDd(dd);
    setDd(dd, open);
    if (open && e.detail === 0) { const first = $('.dd-panel a', dd); if (first) first.focus(); }
  };
  // Hover: open straight away, close only after a short pause so small slips do not shut it
  dd.addEventListener('mouseenter', () => { if (hoverable.matches) { closeAllDd(dd); setDd(dd, true); } });
  dd.addEventListener('mouseleave', () => { if (hoverable.matches) dd._t = setTimeout(() => setDd(dd, false), 300); });
  dd.addEventListener('focusout', e => { if (!dd.contains(e.relatedTarget)) setDd(dd, false); });
});
document.addEventListener('click', e => { if (!e.target.closest('.dd')) closeAllDd(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const openDd = $('.dd.open');
  closeAllDd();
  if (openDd && openDd.contains(document.activeElement)) $('.dd-btn', openDd).focus();
});

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

// Send a form to Formspree in the background (falls back to a normal POST without JavaScript)
async function sendForm(f) {
  const page = f.elements.namedItem('page');
  if (page) page.value = location.href;
  const res = await fetch(f.action, { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Form not sent: ' + res.status);
}
const field = (f, n) => f.elements.namedItem(n);

// Enquiry pop-up
const modal = $('#modal');
function openModal(title, sub, prefill = '') {
  const f = $('#modal-form');
  f.reset();
  $('#modal-msg').textContent = '';
  $('#modal-title').textContent = title;
  $('#modal-sub').textContent = sub;
  field(f, 'message').value = prefill;
  modal.showModal();
  modal.scrollTop = 0;
  if (matchMedia('(min-width: 901px) and (min-height: 561px)').matches) field(f, 'name').focus();
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
  $('#modal .x').addEventListener('click', () => modal.close());
  $('#modal-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, msg = $('#modal-msg'), btn = $('[type=submit]', f);
    const name = field(f, 'name'), email = field(f, 'email');
    msg.className = 'form-msg'; msg.textContent = '';
    if (!name.value.trim()) { f.reportValidity(); return; }
    if (!isEmail(email.value)) { msg.className = 'form-msg err'; msg.textContent = 'Please enter a valid email address.'; email.focus(); return; }
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      await sendForm(f);
      const who = name.value.trim();
      modal.close();
      f.reset();
      toast(`Thanks, ${who}! We'll be in touch within one business day.`);
    } catch {
      msg.className = 'form-msg err';
      msg.textContent = 'Sorry, your message did not send. Please check your connection and try again.';
    } finally {
      btn.disabled = false; btn.textContent = 'Submit';
    }
  });
}

// Reminder sign-up
const newsForm = $('#news-form');
if (newsForm) newsForm.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, inp = field(f, 'email'), msg = $('#news-msg'), btn = $('[type=submit]', f);
  if (!isEmail(inp.value)) { inp.classList.add('err'); msg.textContent = 'Please enter a valid email.'; return; }
  inp.classList.remove('err'); btn.disabled = true;
  try {
    await sendForm(f);
    f.reset();
    msg.textContent = "Thanks. We'll remind you when it's time to reassess.";
  } catch {
    msg.textContent = 'Sorry, that did not send. Please try again.';
  } finally {
    btn.disabled = false;
  }
});

const yr = $('#yr');
if (yr) yr.textContent = String(new Date().getFullYear());
