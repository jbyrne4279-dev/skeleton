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


// Services accordion + sample report screen
const row = (k, v) => `<li><span>${k}</span><b>${v}</b></li>`;
const report = (title, items) => `<p class="scr-title">${title}</p>
  <div class="scr-cols"><div class="scr-card"><h5>Rebuild cost summary</h5><ul>${items.map(i => row(...i)).join('')}</ul></div>
  <div class="scr-card"><h5>Cost breakdown</h5><div class="bars">${[85, 22, 30, 18].map((h, i) => `<div style="height:${h}%;animation-delay:${i * 80}ms"></div>`).join('')}</div><div class="bar-l"><span>Build</span><span>Demo</span><span>Fees</span><span>Ext.</span></div></div></div>`;
const screens = [
  () => report('Sample · 3-bed detached house', [['Gross internal area', '142 m²'], ['Construction', 'Brick / tile'], ['Demolition & clearance', 'Included'], ['Professional fees', 'Included'], ['Region', 'South East']]),
  () => report('Sample · 24-unit residential block', [['Gross internal area', '1,960 m²'], ['Construction', 'Concrete frame'], ['Communal & lifts', 'Included'], ['External works', 'Included'], ['Region', 'North West']]),
  () => report('Sample · light industrial unit', [['Gross internal area', '820 m²'], ['Construction', 'Steel portal'], ['Plant & services', 'Included'], ['Demolition & clearance', 'Included'], ['Region', 'Yorkshire']]),
  () => report('Sample · Grade II listed cottage', [['Gross internal area', '118 m²'], ['Construction', 'Natural stone'], ['Specialist trades', 'Included'], ['Like-for-like materials', 'Included'], ['Region', 'South West']]),
];
const setFeat = i => {
  $$('#feat-acc .acc-item').forEach((el, j) => el.classList.toggle('open', i === j));
  $('#screen').innerHTML = screens[i]();
};
$$('#feat-acc .acc-item').forEach((el, i) => $('button', el).onclick = () => setFeat(i));
setFeat(0);

$$('[data-plan]').forEach(b => b.onclick = () => openModal(`${b.dataset.plan} assessment`, "Tell us about the property and we'll be in touch with a quote within one business day.", `${b.dataset.plan} assessment: `));

// FAQ
const faqs = [
  ['What is a rebuild cost assessment (RCA report)?', 'A rebuild cost assessment, often called an RCA report or reinstatement cost assessment, calculates how much it would cost to completely rebuild your property if it were destroyed. That includes demolition, site clearance, professional fees and VAT where applicable. It is the figure your buildings insurance sum insured should be based on.'],
  ['Is the rebuild cost the same as market value?', 'No. Market value includes the land and reflects local demand, while rebuild cost reflects labour, materials and construction method. A city-centre flat may have a rebuild cost well below its market value, while a rural stone cottage can cost more to rebuild than it would sell for.'],
  ['Why does under-insurance matter?', 'If your sum insured is too low, insurers can apply the average clause and reduce any claim proportionally, even for partial damage. Insured for 60% of the true rebuild cost? You may only receive 60% of your claim. If you over-insure, you pay higher premiums for cover you can never claim.'],
  ['Are your assessments RICS certified?', 'Yes. Assessments are carried out by RICS-regulated surveyors following RICS guidance, using current BCIS (Building Cost Information Service) rebuild cost data adjusted for your region and specification.'],
  ['Do I need a desktop assessment or a site inspection?', 'A desktop assessment uses floor plans, measurements and photographs and suits most standard homes. A site inspection is recommended for blocks of flats, commercial premises, listed buildings and anything with unusual construction or a high value.'],
  ['How often should I get a new assessment?', 'RICS recommends a full rebuild cost assessment at least every three years, with the figure index-linked annually in between. You should also reassess after any extension, conversion or major refurbishment.'],
  ['I own a leasehold flat. Do I need one?', 'Usually the freeholder or management company insures the whole building, so the assessment should cover the entire block. We work with freeholders, RMCs, RTM companies and managing agents to provide whole-building reports.'],
  ['How long does it take?', 'Most residential desktop reports are delivered within 3 to 5 working days. Site inspections are typically booked within a week, with the report following shortly after. Let us know if you have a renewal deadline.'],
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
function openModal(title, sub, prefill = '') {
  const f = $('#modal-form');
  f.reset();
  $('#modal-title').textContent = title;
  $('#modal-sub').textContent = sub;
  f.message.value = prefill;
  modal.showModal();
  f.name.focus();
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-report]')) {
    e.preventDefault();
    $('#menu').classList.remove('open');
    openModal('Get your rebuild cost assessment', "Tell us about the property and we'll come back with your RCA report quote within one business day.");
    return;
  }
  if (e.target.closest('[data-contact]')) {
    e.preventDefault();
    openModal('Speak to a surveyor', 'Tell us about your property and a RICS surveyor will be in touch within one business day.');
  }
});
modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
$('#modal-form').addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok') return;
  const f = e.target;
  if (!f.name.value.trim() || !isEmail(f.email.value)) { e.preventDefault(); f.reportValidity(); return; }
  toast(`Thanks, ${f.name.value.trim()}! A surveyor will be in touch soon.`);
  f.reset();
});

// Reminder sign-up
$('#news-form').onsubmit = e => {
  e.preventDefault();
  const inp = $('input', e.target), msg = $('#news-msg');
  if (!isEmail(inp.value)) { inp.classList.add('err'); msg.textContent = 'Please enter a valid email.'; return; }
  inp.classList.remove('err'); inp.value = '';
  msg.textContent = "Thanks. We'll remind you when it's time to reassess.";
};

// Reveal on scroll
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
$$('.reveal').forEach(el => io.observe(el));

$('#yr').textContent = new Date().getFullYear();
