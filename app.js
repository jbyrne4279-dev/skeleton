const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2800);
}

// Theme
const root = document.documentElement;
const saved = (() => { try { return localStorage.getItem('lume-theme'); } catch { return null; } })();
root.dataset.theme = saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
$('#theme').onclick = () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('lume-theme', root.dataset.theme); } catch {}
};

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
$('#burger').onclick = () => {
  const open = $('#menu').classList.toggle('open');
  $('#burger').setAttribute('aria-expanded', open);
};
$$('#menu a').forEach(a => a.addEventListener('click', () => $('#menu').classList.remove('open')));

// Sticky nav border
addEventListener('scroll', () => $('#nav').classList.toggle('scrolled', scrollY > 10), { passive: true });

// Hero sign-in
$('#hero-form').onsubmit = e => {
  e.preventDefault();
  const inp = $('#hero-email'), msg = $('#hero-msg');
  if (!isEmail(inp.value)) {
    inp.classList.add('err'); msg.className = 'form-msg err'; msg.textContent = 'Please enter a valid email address.';
    return;
  }
  inp.classList.remove('err'); msg.className = 'form-msg ok';
  msg.textContent = `Magic link sent to ${inp.value.trim()} — check your inbox.`;
  inp.value = '';
};
$('#google').onclick = () => toast('Redirecting to Google sign-in…');

// Feature accordion + screen
const screens = [
  () => `<p class="scr-title">AI Agents that do the work for you</p>
    <div class="scr-cols"><div class="scr-card"><h5>AI Agents</h5><ul><li>Data Assistant</li><li>Social Media Scheduler</li><li>Research Assistant</li><li class="hl">● Creative Designer</li></ul></div>
    <div class="scr-card"><h5>Insights · last 7 days</h5><div class="bars">${[40,65,50,80,70,95,60].map((h,i)=>`<div style="height:${h}%;animation-delay:${i*60}ms"></div>`).join('')}</div></div></div>`,
  () => `<div class="prompt">What can I do for you?<div class="row"><span>Lume 1 Mini ▾</span><span>📎 Attach</span><span style="margin-left:auto">Run ↵</span></div></div>`,
  () => `<div class="flow"><span>New lead</span><b>→</b><span>Enrich with AI</span><b>→</b><span>Assign to @maria</span><b>→</b><span>Notify #sales</span></div>`,
];
const setFeat = i => {
  $$('#feat-acc .acc-item').forEach((el, j) => el.classList.toggle('open', i === j));
  $('#screen').innerHTML = screens[i]();
};
$$('#feat-acc .acc-item').forEach((el, i) => $('button', el).onclick = () => setFeat(i));
setFeat(0);

// Pricing
$$('#billing button').forEach(b => b.onclick = () => {
  $$('#billing button').forEach(x => x.classList.toggle('on', x === b));
  const y = b.dataset.b === 'y';
  $$('.amt[data-m]').forEach(a => a.textContent = '$' + (y ? a.dataset.y : a.dataset.m));
});
$$('[data-plan]').forEach(b => b.onclick = () => openModal(`Start ${b.dataset.plan}`, b.dataset.plan === 'Free' ? 'Create your free account — no credit card required.' : 'Your 14-day free trial starts today. No credit card required.', false));

// FAQ
const faqs = [
  ['How does context understanding work?', 'Our AI agents maintain full conversation history and project context across sessions. They understand relationships between files, dependencies, and previous decisions, allowing for more accurate and contextually relevant responses.'],
  ['Can I switch between different AI models?', 'Yes. Pick from leading models per task or per agent, and switch at any time without losing your history or settings.'],
  ['What happens to my data?', 'Your data is encrypted in transit and at rest, never used to train models, and can be exported or deleted whenever you want.'],
  ['Is there a learning curve?', 'Not at all. Our interface is designed for natural conversation. Just describe what you need in plain language, and the AI agent handles the complexity. Most users are productive within minutes.'],
  ['Do agents work offline?', 'Agents need a connection to run models, but drafts and queued tasks are saved locally and sync automatically once you are back online.'],
  ["What's included in the free trial?", 'Full access to all features, all AI models, unlimited conversations, and priority support for 14 days. No credit card required to start. Cancel anytime without charges.'],
];
$('#faq-list').innerHTML = faqs.map(([q, a], i) => `<div class="faq-item${i ? '' : ' open'}"><button aria-expanded="${!i}"><span class="faq-n">(${String(i + 1).padStart(3, '0')})</span>${q}<span class="pm"></span></button><div class="acc-body"><div><p>${a}</p></div></div></div>`).join('');
$$('.faq-item').forEach(item => $('button', item).onclick = () => {
  const open = !item.classList.contains('open');
  $$('.faq-item').forEach(x => { x.classList.remove('open'); $('button', x).setAttribute('aria-expanded', false); });
  item.classList.toggle('open', open);
  $('button', item).setAttribute('aria-expanded', open);
});

// Modal
const modal = $('#modal');
function openModal(title, sub, showMsg = true) {
  $('#modal-title').textContent = title;
  $('#modal-sub').textContent = sub;
  $('#msg-label').hidden = !showMsg;
  modal.showModal();
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-contact]')) {
    e.preventDefault();
    openModal('Contact Sales', "Tell us about your team and we'll be in touch within one business day.");
  }
});
modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
$('#modal-form').addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok') return;
  const f = e.target;
  if (!f.name.value.trim() || !isEmail(f.email.value)) { e.preventDefault(); f.reportValidity(); return; }
  toast(`Thanks, ${f.name.value.trim()}! We'll be in touch soon.`);
  f.reset();
});

// Newsletter
$('#news-form').onsubmit = e => {
  e.preventDefault();
  const inp = $('input', e.target), msg = $('#news-msg');
  if (!isEmail(inp.value)) { inp.classList.add('err'); msg.textContent = 'Please enter a valid email.'; return; }
  inp.classList.remove('err'); inp.value = '';
  msg.textContent = "You're subscribed! 🎉";
};

// Reveal on scroll
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
$$('.reveal').forEach(el => io.observe(el));

$('#yr').textContent = new Date().getFullYear();
