'use strict';
/* =====================================================================
   PLANTÃO BEZERRA — registro de plantões (HTML + CSS + JS puro)
   Dados salvos apenas neste aparelho (localStorage). Nada é enviado.
   Seções: 1 Utilitários · 2 Dados/Armazenamento · 3 Regras do plantão ·
           4 Relatório · 5 Telas · 6 Diálogos · 7 Ações · 8 Início
   ===================================================================== */

/* ---------- 1. Utilitários ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, '0');
const str = v => (typeof v === 'string' ? v : '');
const arr = v => (Array.isArray(v) ? v : []);

const ICONS = {
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  plantao:'<path d="M9 2h6v4H9z"/><path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/><path d="M9 14l2 2 4-4"/>',
  ajustes:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  report:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>'
};
const icon = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;

function todayISO(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(iso, n) { const [y, m, d] = iso.split('-').map(Number); return todayISO(new Date(y, m - 1, d + n)); }
function nowLocal() { const d = new Date(); return `${todayISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const fmtDate = iso => iso.split('-').reverse().join('/');
const fmtDateShort = iso => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; };
function fmtHour(t) { if (!t) return ''; const [h, m] = t.split(':'); return m === '00' ? `${+h}h` : `${+h}h${m}`; }

let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- 2. Dados e armazenamento ---------- */
const KEY = 'plantao-bezerra.v1';
const SHIFTS = { D: 'Diurno', N: 'Noturno' };
const SHIFT_ICON = { D: '☀️', N: '🌙' };
const PERIODS = ['manha', 'tarde', 'noite'];
const PERIOD_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const PERIOD_ICON = { manha: '🌅', tarde: '☀️', noite: '🌙' };
const STATES = { ok: { icon: '✅', label: 'Administrado' }, no: { icon: '❌', label: 'Não dado' }, pending: { icon: '⏳', label: 'Pendente' } };

const shiftKey = (date, sh) => `${date}|${sh}`;

function defaultData() {
  // med(nome, horário, dose, período, observação, ícone)  — manhã/tarde = plantão diurno, noite = noturno
  const med = (name, time, dose, period, notes = '', icon = '💊') =>
    ({ id: uid(), name, time, dose, notes, period, icon, shift: period === 'noite' ? 'N' : 'D' });
  const type = (name, unit) => ({ id: uid(), name, unit });
  return {
    version: 1, lastResponsible: '', shifts: {},
    meds: [
      // Manhã
      med('Omeprazol', '06:00', '2cp', 'manha'),
      med('Bisacodil', '06:00', '2cp', 'manha'),
      med('Budesonida', '07:00', '', 'manha', '2 jatos em cada nariz'),
      med('Losartana', '08:00', '1cp', 'manha'),
      med('Zisque', '08:00', '1cp', 'manha'),
      med('Colchicina', '09:00', '1cp', 'manha'),
      med('Pomada de dexametasona', '', '', 'manha', 'no dedo após o banho'),
      med('Pomada na barriga', '', '', 'manha', '', '🧴'),
      // Tarde
      med('Clopidogrel', '14:00', '1cp', 'tarde'),
      med('AAS', '14:00', '1cp', 'tarde'),
      // Noite
      med('Bisoprolol', '18:00', '1cp', 'noite'),
      med('Anlodipino 5mg', '18:00', '2cp', 'noite'),
      med('Alopurinol', '18:00', '1cp', 'noite'),
      med('Budesonida', '19:00', '', 'noite', '2 jatos em cada nariz'),
      med('Zisque', '20:00', '1cp', 'noite'),
      med('Enoxaparina', '21:00', '', 'noite', '', '💉'),
      med('Atorvastatina 10mg', '21:00', '4cp', 'noite'),
      med('Losartana', '21:00', '1cp', 'noite'),
      med('Dexclorfeniramina', '22:00', '1cp', 'noite'),
      med('Colchicina', '22:00', '1cp', 'noite'),
      med('Quetiapina', '22:00', '1/2cp', 'noite', 'se insônia'),
      med('Bisacodil', '22:00', '1cp', 'noite', 'laxante')
    ],
    types: [
      type('Pressão arterial', ''), type('Glicose', 'mg/dL'), type('Saturação', '%'),
      type('Batimentos', 'bpm'), type('Temperatura', '°C')
    ]
  };
}

/* Valida/normaliza qualquer dado vindo do disco ou de um backup. */
function normalize(d) {
  const out = { version: 1, lastResponsible: str(d.lastResponsible), meds: [], types: [], shifts: {} };
  arr(d.meds).forEach(m => {
    if (!m || !str(m.name).trim()) return;
    out.meds.push({
      id: str(m.id) || uid(), name: m.name.trim(), time: /^\d{2}:\d{2}$/.test(m.time) ? m.time : '',
      dose: str(m.dose), notes: str(m.notes), icon: str(m.icon) || '💊',
      period: PERIODS.includes(m.period) ? m.period : 'manha', shift: ['D', 'N', 'A'].includes(m.shift) ? m.shift : 'D'
    });
  });
  arr(d.types).forEach(t => { if (t && str(t.name).trim()) out.types.push({ id: str(t.id) || uid(), name: t.name.trim(), unit: str(t.unit) }); });
  Object.values(d.shifts && typeof d.shifts === 'object' ? d.shifts : {}).forEach(s => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !SHIFTS[s.shift]) return;
    const ns = { key: shiftKey(s.date, s.shift), date: s.date, shift: s.shift, responsible: str(s.responsible), notes: str(s.notes), meds: [], measures: [] };
    arr(s.meds).forEach(e => {
      if (!e || !str(e.name)) return;
      ns.meds.push({
        medId: str(e.medId), name: e.name, time: /^\d{2}:\d{2}$/.test(e.time) ? e.time : '', dose: str(e.dose), notes: str(e.notes), icon: str(e.icon) || '💊',
        period: PERIODS.includes(e.period) ? e.period : 'manha', state: STATES[e.state] ? e.state : 'pending'
      });
    });
    arr(s.measures).forEach(x => {
      if (!x || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(x.dt) || !str(x.typeName)) return;
      ns.measures.push({ id: str(x.id) || uid(), typeId: str(x.typeId), typeName: x.typeName, unit: str(x.unit), value: str(x.value), dt: x.dt.slice(0, 16), note: str(x.note) });
    });
    out.shifts[ns.key] = ns;
  });
  return out;
}

let storageOk = true;
function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { storageOk = false; console.warn('Falha ao ler dados', e); }
  return defaultData();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); storageOk = true; }
  catch (e) { storageOk = false; toast('⚠️ Não foi possível salvar neste navegador'); }
}

let db = loadData();
const hour = new Date().getHours();
const cur = { date: todayISO(), shift: hour >= 19 || hour < 7 ? 'N' : 'D' };
let tab = 'plantao';
let draft = null; // plantão ainda vazio (só vira registro ao ser alterado)

/* ---------- 3. Regras do plantão ---------- */
const snapMed = m => ({ name: m.name, time: m.time, dose: m.dose, notes: m.notes, icon: m.icon, period: m.period });

function newShift(date, sh) { return { key: shiftKey(date, sh), date, shift: sh, responsible: db.lastResponsible, notes: '', meds: [], measures: [] }; }

function currentShift() {
  const k = shiftKey(cur.date, cur.shift);
  if (db.shifts[k]) return db.shifts[k];
  if (!draft || draft.key !== k) draft = newShift(cur.date, cur.shift);
  return draft;
}
/* Grava o plantão (se ainda era rascunho) e salva. */
function touch(s) { db.shifts[s.key] = s; if (draft === s) draft = null; save(); }

/* Copia a lista de medicamentos para dentro do plantão (cada plantão guarda seu próprio retrato).
   Plantões antigos (anteriores a ontem) ficam congelados e não são alterados. */
function syncShift(s) {
  if (s.meds.length && s.date < addDays(todayISO(), -1)) return false;
  const want = db.meds.filter(m => m.shift === s.shift || m.shift === 'A');
  let changed = false;
  want.forEach(m => {
    const e = s.meds.find(x => x.medId === m.id);
    if (!e) { s.meds.push({ medId: m.id, ...snapMed(m), state: 'pending' }); changed = true; }
    else if (JSON.stringify(snapMed(e)) !== JSON.stringify(snapMed(m))) { Object.assign(e, snapMed(m)); changed = true; }
  });
  const kept = s.meds.filter(e => e.state !== 'pending' || want.some(m => m.id === e.medId));
  if (kept.length !== s.meds.length) { s.meds = kept; changed = true; }
  return changed;
}

const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.name.localeCompare(b.name, 'pt-BR');
function medsByPeriod(s) {
  return PERIODS.map(p => ({ period: p, items: s.meds.filter(e => e.period === p).sort(byTime) })).filter(g => g.items.length);
}
function measureGroups(s) {
  const map = new Map();
  [...s.measures].sort((a, b) => a.dt.localeCompare(b.dt)).forEach(m => {
    const k = m.typeId || m.typeName;
    if (!map.has(k)) map.set(k, { key: k, items: [] });
    map.get(k).items.push(m);
  });
  const order = k => { const i = db.types.findIndex(t => t.id === k); return i < 0 ? 999 : i; };
  return [...map.values()].sort((a, b) => order(a.key) - order(b.key))
    .map(g => ({ ...g, label: g.items[g.items.length - 1].typeName }));
}
const fmtValue = m => m.value + (m.unit ? (/^[%°]/.test(m.unit) ? '' : ' ') + m.unit : '');
function fmtMTime(m, s) {
  const [d, t] = m.dt.split('T');
  return d === s.date ? t : `${d.slice(8, 10)}/${d.slice(5, 7)} ${t}`;
}
const countStates = s => ({
  ok: s.meds.filter(e => e.state === 'ok').length,
  no: s.meds.filter(e => e.state === 'no').length,
  pending: s.meds.filter(e => e.state === 'pending').length
});

/* ---------- 4. Relatório (formato WhatsApp) ---------- */
function buildReport(s) {
  const L = [`*PLANTÃO - ${s.responsible.trim() || 'Sem responsável'} (${fmtDateShort(s.date)})*`];
  medsByPeriod(s).forEach(g => {
    L.push('', `*${PERIOD_LABEL[g.period].toUpperCase()}*`);
    g.items.forEach(e => {
      const h = fmtHour(e.time), dose = e.dose.trim(), note = e.notes.trim();
      const what = dose ? `${dose} de ${e.name.toLowerCase()}` : e.name;
      const mark = e.state === 'pending' ? '' : ' ' + STATES[e.state].icon;
      L.push(`* ${e.icon} ${h ? h + ' - ' : ''}${what}${note ? (dose ? ' (' + note + ')' : ' - ' + note) : ''}${mark}`);
    });
  });
  const groups = measureGroups(s);
  if (groups.length) {
    L.push('', '*🩺 AFERIÇÕES 🩺*', '');
    groups.forEach(g => {
      L.push(`* ${g.label}: ${g.items.map(m => fmtValue(m) + (m.note.trim() ? ' (' + m.note.trim() + ')' : '')).join(' / ')}`);
    });
  }
  const notes = s.notes.split('\n').map(l => l.trim().replace(/^[-•*]\s*/, '')).filter(Boolean);
  if (notes.length) { L.push('', '*OBSERVAÇÕES*'); notes.forEach(n => L.push(`- ${n}`)); }
  if (L.length === 1) L.push('', 'Sem registros neste plantão.');
  return L.join('\n');
}

/* ---------- 5. Telas ---------- */
function medCardHTML(e) {
  const btn = st => `<button type="button" class="${st} ${e.state === st ? 'on' : ''}" data-action="setstate" data-id="${esc(e.medId)}" data-state="${st}"
      aria-pressed="${e.state === st}"><b>${STATES[st].icon}</b>${STATES[st].label}</button>`;
  return `<article class="med s-${e.state}">
    <div class="med-top">${e.time ? `<span class="time">${fmtHour(e.time)}</span>` : `<span class="time">${esc(e.icon)}</span>`}
      <div class="med-info"><strong>${esc(e.name)}</strong>${e.dose ? `<span>${esc(e.dose)}</span>` : ''}${e.notes ? `<em>${esc(e.notes)}</em>` : ''}</div></div>
    <div class="states">${btn('ok')}${btn('no')}${btn('pending')}</div></article>`;
}

function measuresHTML(s, editable) {
  const groups = measureGroups(s);
  if (!groups.length) return '<p class="empty">Nenhuma aferição registrada.</p>';
  return groups.map(g => `<div class="m-group"><h3>${esc(g.label)}</h3>${g.items.map(m => `
    <div class="m-item"><span class="t">${fmtMTime(m, s)}</span>
      <span class="grow"><span class="v">${esc(fmtValue(m))}</span>${m.note ? `<span class="n">${esc(m.note)}</span>` : ''}</span>
      ${editable ? `<button class="icon-btn" data-action="edit-measure" data-id="${m.id}" aria-label="Editar aferição">${icon('edit', 'sm')}</button>
      <button class="icon-btn del" data-action="del-measure" data-id="${m.id}" aria-label="Excluir aferição">${icon('trash', 'sm')}</button>` : ''}
    </div>`).join('')}</div>`).join('');
}

function viewPlantao() {
  const s = currentShift();
  if (syncShift(s) && db.shifts[s.key]) save();
  const c = countStates(s);
  const groups = medsByPeriod(s);
  return `
  ${storageOk ? '' : '<p class="warn">⚠️ Este navegador não permite salvar dados. Use o backup (Ajustes) com frequência.</p>'}
  <section class="card">
    <label class="field"><span>Responsável pelo plantão</span>
      <input id="f-resp" type="text" autocomplete="off" placeholder="Seu nome" value="${esc(s.responsible)}"></label>
    <label class="field"><span>Data do plantão</span><input id="f-date" type="date" value="${s.date}"></label>
    <div class="seg" role="group" aria-label="Período do plantão">
      ${Object.keys(SHIFTS).map(k => `<button type="button" class="${cur.shift === k ? 'on' : ''}" data-action="shift" data-v="${k}">${SHIFT_ICON[k]} ${SHIFTS[k]}</button>`).join('')}
    </div>
  </section>

  <section class="card">
    <div class="card-title"><h2>💊 Medicamentos</h2></div>
    ${groups.length ? groups.map(g => `<h3 class="period-h">${PERIOD_ICON[g.period]} ${PERIOD_LABEL[g.period]}</h3>${g.items.map(medCardHTML).join('')}`).join('')
      : `<p class="empty">Nenhum medicamento cadastrado para o plantão ${SHIFTS[s.shift].toLowerCase()}.<br>Cadastre em <b>Ajustes</b>.</p>`}
    ${groups.length ? `<div class="chips"><span class="chip ok">✅ ${c.ok}</span><span class="chip no">❌ ${c.no}</span><span class="chip pending">⏳ ${c.pending}</span></div>` : ''}
  </section>

  <section class="card">
    <div class="card-title"><h2>🩺 Aferições</h2></div>
    ${measuresHTML(s, true)}
    <button class="btn primary block" data-action="add-measure">${icon('plus')} Adicionar aferição</button>
  </section>

  <section class="card">
    <div class="card-title"><h2>📝 Observações</h2></div>
    <textarea id="f-notes" placeholder="Alterações percebidas, medicamentos indisponíveis, informações da equipe médica, ocorrências…">${esc(s.notes)}</textarea>
    <p class="hint" style="margin:6px 0 0">Salvo automaticamente.</p>
  </section>

  <button class="btn primary block" style="min-height:56px;font-size:1.05rem" data-action="report" data-key="${esc(s.key)}">${icon('report')} Gerar relatório</button>`;
}

function viewSettings() {
  const medGroups = [['D', 'Diurno'], ['N', 'Noturno'], ['A', 'Diurno e noturno']].map(([k, label]) => {
    const items = db.meds.filter(m => m.shift === k).sort((a, b) => PERIODS.indexOf(a.period) - PERIODS.indexOf(b.period) || byTime(a, b));
    if (!items.length) return '';
    return `<h3 class="period-h">${label}</h3>${items.map(m => `
      <div class="list-item"><span class="time">${m.time ? fmtHour(m.time) : esc(m.icon)}</span>
        <div class="grow"><strong>${esc(m.name)}</strong>
          <span class="badge">${PERIOD_LABEL[m.period]}</span>${m.dose ? `<span class="muted">${esc(m.dose)}</span>` : ''}
          ${m.notes ? `<div class="muted">${esc(m.notes)}</div>` : ''}</div>
        <button class="icon-btn" data-action="med-edit" data-id="${m.id}" aria-label="Editar">${icon('edit', 'sm')}</button>
        <button class="icon-btn del" data-action="med-del" data-id="${m.id}" aria-label="Excluir">${icon('trash', 'sm')}</button></div>`).join('')}`;
  }).join('');
  return `
  <section class="card">
    <div class="card-title"><h2>💊 Medicamentos</h2><button class="btn small primary" data-action="med-new">${icon('plus', 'sm')} Novo</button></div>
    <p class="muted">Cadastrados uma vez e usados em todos os plantões. Alterações valem para plantões de hoje em diante; plantões antigos não mudam.</p>
    ${medGroups || '<p class="empty">Nenhum medicamento cadastrado.</p>'}
  </section>
  <section class="card">
    <div class="card-title"><h2>🩺 Tipos de aferição</h2><button class="btn small primary" data-action="type-new">${icon('plus', 'sm')} Novo</button></div>
    ${db.types.length ? db.types.map(t => `<div class="list-item"><div class="grow"><strong>${esc(t.name)}</strong><span class="muted">${esc(t.unit) || 'sem unidade'}</span></div>
      <button class="icon-btn" data-action="type-edit" data-id="${t.id}" aria-label="Editar">${icon('edit', 'sm')}</button>
      <button class="icon-btn del" data-action="type-del" data-id="${t.id}" aria-label="Excluir">${icon('trash', 'sm')}</button></div>`).join('')
      : '<p class="empty">Nenhum tipo cadastrado.</p>'}
  </section>
  <section class="card">
    <div class="card-title"><h2>💾 Backup</h2></div>
    <p class="muted" style="margin-bottom:12px">Os dados ficam somente neste aparelho e nunca são enviados pela internet. Exporte um backup de vez em quando ou para levar os dados a outro aparelho.</p>
    <div class="row2"><button class="btn" data-action="export">${icon('download')} Exportar</button><button class="btn" data-action="import">${icon('upload')} Importar</button></div>
  </section>`;
}

function render() {
  const y = window.scrollY;
  $('#view').innerHTML = { plantao: viewPlantao, ajustes: viewSettings }[tab]();
  document.querySelectorAll('#tabbar button').forEach(b => {
    b.classList.toggle('on', b.dataset.v === tab);
    b.querySelector('svg').innerHTML = ICONS[b.dataset.v];
    b.querySelector('svg').setAttribute('viewBox', '0 0 24 24');
  });
  $('#hdr-sub').textContent = tab === 'plantao' ? `${SHIFTS[cur.shift]} · ${fmtDate(cur.date)}` : 'Medicamentos, aferições e backup';
  window.scrollTo(0, y);
}

/* ---------- 6. Diálogos ---------- */
function openDialog(html, backdropClose = false) {
  const d = document.createElement('dialog');
  d.className = 'sheet'; d.innerHTML = html; document.body.appendChild(d);
  d.addEventListener('close', () => d.remove());
  if (backdropClose) d.addEventListener('click', e => { if (e.target === d) d.close(); });
  d.showModal();
  return d;
}

function formDialog({ title, body, submitLabel = 'Salvar', onSubmit }) {
  const d = openDialog(`<form class="dlg-body" novalidate><h2>${title}</h2>${body}
    <div class="dlg-actions"><button type="button" class="btn" data-action="close">Cancelar</button><button class="btn primary">${submitLabel}</button></div></form>`);
  const f = d.querySelector('form');
  f.addEventListener('submit', e => {
    e.preventDefault();
    const bad = [...f.elements].find(el => el.required && !el.value.trim());
    if (bad) { bad.focus(); toast('Preencha o campo obrigatório'); return; }
    if (onSubmit(new FormData(f)) !== false) d.close();
  });
  return d;
}

function confirmBox(msg, ok = 'Excluir', danger = true) {
  return new Promise(resolve => {
    const d = openDialog(`<div class="dlg-body"><h2>Confirmar</h2><p>${msg}</p>
      <div class="dlg-actions"><button class="btn" data-v="0">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-v="1">${ok}</button></div></div>`);
    d.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { resolve(b.dataset.v === '1'); d.close(); } });
    d.addEventListener('close', () => resolve(false)); // Esc: só vale se ainda não resolvido
  });
}

function showReport(s) {
  const d = openDialog(`<div class="dlg-body"><h2>Relatório para WhatsApp</h2>
    <textarea class="report-box" id="report-text" spellcheck="false"></textarea>
    <p class="hint" style="margin:0">Você pode ajustar o texto antes de copiar.</p>
    <div class="dlg-actions"><button class="btn" data-action="close">Fechar</button>
    <button class="btn" data-action="copy-report">${icon('copy')} Copiar</button>
    <button class="btn primary" data-action="share-report">${icon('share')} WhatsApp</button></div></div>`);
  $('#report-text', d).value = buildReport(s);
}

async function copyText(text, ta) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* tenta alternativa */ }
  try { ta.focus(); ta.select(); return document.execCommand('copy'); } catch (e) { return false; }
}

function measureDialog(s, m) {
  const types = db.types.slice();
  if (m && m.typeId && !types.some(t => t.id === m.typeId)) types.push({ id: m.typeId, name: m.typeName + ' (removido)', unit: m.unit });
  if (!types.length) { toast('Cadastre um tipo de aferição em Ajustes'); return; }
  const sel = m ? m.typeId : types[0].id;
  const d = formDialog({
    title: m ? 'Editar aferição' : 'Adicionar aferição',
    body: `<label class="field"><span>Tipo de aferição</span><select name="type">${types.map(t => `<option value="${esc(t.id)}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}${t.unit ? ' (' + esc(t.unit) + ')' : ''}</option>`).join('')}</select></label>
      <label class="field"><span>Valor medido <b id="unit-hint"></b></span><input name="value" type="text" inputmode="text" autocomplete="off" required placeholder="Ex.: 12/8" value="${esc(m ? m.value : '')}"></label>
      <label class="field"><span>Data e horário da medição</span><input name="dt" type="datetime-local" required value="${m ? m.dt : nowLocal()}"></label>
      <label class="field"><span>Observação (opcional)</span><input name="note" type="text" autocomplete="off" value="${esc(m ? m.note : '')}"></label>`,
    onSubmit(fd) {
      const t = types.find(x => x.id === fd.get('type'));
      const rec = { id: m ? m.id : uid(), typeId: t.id, typeName: t.name.replace(/ \(removido\)$/, ''), unit: t.unit, value: fd.get('value').trim(), dt: fd.get('dt'), note: fd.get('note').trim() };
      if (!rec.dt) { toast('Informe data e horário'); return false; }
      if (m) Object.assign(m, rec); else s.measures.push(rec);
      touch(s); render(); toast('Aferição salva');
    }
  });
  const hint = () => { const t = types.find(x => x.id === d.querySelector('[name=type]').value); $('#unit-hint', d).textContent = t && t.unit ? `(${t.unit})` : ''; };
  d.querySelector('[name=type]').addEventListener('change', hint); hint();
  d.querySelector('[name=value]').focus();
}

function medDialog(m) {
  const opt = (val, label, sel) => `<option value="${val}" ${sel === val ? 'selected' : ''}>${label}</option>`;
  const d = formDialog({
    title: m ? 'Editar medicamento' : 'Novo medicamento',
    body: `<label class="field"><span>Nome do medicamento</span><input name="name" type="text" required autocomplete="off" value="${esc(m ? m.name : '')}"></label>
      <div class="row2">
        <label class="field"><span>Horário previsto</span><input name="time" type="time" value="${m ? m.time : '08:00'}"></label>
        <label class="field"><span>Dose / quantidade</span><input name="dose" type="text" autocomplete="off" placeholder="Ex.: 1cp" value="${esc(m ? m.dose : '')}"></label>
      </div>
      <div class="row2">
        <label class="field"><span>Período</span><select name="period">${PERIODS.map(p => opt(p, PERIOD_LABEL[p], m ? m.period : 'manha')).join('')}</select></label>
        <label class="field"><span>Plantão</span><select name="shift">${opt('D', 'Diurno', m ? m.shift : 'D')}${opt('N', 'Noturno', m ? m.shift : 'D')}${opt('A', 'Diurno e noturno', m ? m.shift : 'D')}</select></label>
      </div>
      <label class="field"><span>Instruções adicionais (opcional)</span><input name="notes" type="text" autocomplete="off" value="${esc(m ? m.notes : '')}"></label>`,
    onSubmit(fd) {
      const rec = { name: fd.get('name').trim(), time: fd.get('time'), dose: fd.get('dose').trim(), period: fd.get('period'), shift: fd.get('shift'), notes: fd.get('notes').trim() };
      if (m) Object.assign(m, rec); else db.meds.push({ id: uid(), icon: '💊', ...rec });
      save(); render(); toast('Medicamento salvo');
    }
  });
  const time = d.querySelector('[name=time]'), period = d.querySelector('[name=period]');
  time.addEventListener('change', () => { if (!time.value) return; const h = +time.value.slice(0, 2); period.value = h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite'; });
}

function typeDialog(t) {
  formDialog({
    title: t ? 'Editar tipo de aferição' : 'Novo tipo de aferição',
    body: `<label class="field"><span>Nome</span><input name="name" type="text" required autocomplete="off" placeholder="Ex.: Pressão arterial" value="${esc(t ? t.name : '')}"></label>
      <label class="field"><span>Unidade de medida</span><input name="unit" type="text" autocomplete="off" placeholder="Ex.: mmHg" value="${esc(t ? t.unit : '')}"></label>`,
    onSubmit(fd) {
      const rec = { name: fd.get('name').trim(), unit: fd.get('unit').trim() };
      if (t) Object.assign(t, rec); else db.types.push({ id: uid(), ...rec });
      save(); render(); toast('Tipo salvo');
    }
  });
}

/* ---------- 7. Ações ---------- */
function mergeShift(a, b) {
  if (!a.responsible) a.responsible = b.responsible;
  const na = a.notes.trim(), nb = b.notes.trim();
  if (!na) a.notes = b.notes; else if (nb && na !== nb) a.notes = a.notes.trimEnd() + '\n' + b.notes;
  b.measures.forEach(m => { if (!a.measures.some(x => x.id === m.id)) a.measures.push(m); });
  b.meds.forEach(e => {
    const x = a.meds.find(y => y.medId && y.medId === e.medId);
    if (!x) a.meds.push(e); else if (x.state === 'pending') x.state = e.state;
  });
}
function mergeData(inc) {
  inc.meds.forEach(m => { if (!db.meds.some(x => x.id === m.id)) db.meds.push(m); });
  inc.types.forEach(t => { if (!db.types.some(x => x.id === t.id)) db.types.push(t); });
  Object.values(inc.shifts).forEach(s => { if (db.shifts[s.key]) mergeShift(db.shifts[s.key], s); else db.shifts[s.key] = s; });
  if (!db.lastResponsible) db.lastResponsible = inc.lastResponsible;
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `plantao-backup-${todayISO()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup exportado');
}

async function importBackup(file) {
  let inc;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== 'object' || !('shifts' in data || 'meds' in data)) throw new Error('formato');
    inc = normalize(data);
  } catch (e) { toast('❌ Arquivo de backup inválido'); return; }
  const n = Object.keys(inc.shifts).length;
  const d = openDialog(`<div class="dlg-body"><h2>Importar backup</h2>
    <p>O arquivo contém <b>${n}</b> plantão(ões), <b>${inc.meds.length}</b> medicamento(s) e <b>${inc.types.length}</b> tipo(s) de aferição.</p>
    <p class="muted"><b>Mesclar</b> mantém seus dados e acrescenta os do arquivo. <b>Substituir</b> apaga tudo o que está neste aparelho.</p>
    <div class="dlg-actions"><button class="btn" data-action="close">Cancelar</button>
    <button class="btn danger" data-v="replace">Substituir tudo</button><button class="btn primary" data-v="merge">Mesclar</button></div></div>`);
  d.addEventListener('click', async e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    if (b.dataset.v === 'replace') {
      if (!(await confirmBox('Todos os dados atuais deste aparelho serão apagados e trocados pelos do backup. Continuar?', 'Substituir'))) return;
      db = inc;
    } else mergeData(inc);
    draft = null; save(); d.close(); render(); toast('Backup importado');
  });
}

const findShift = k => db.shifts[k];

const actions = {
  tab: el => { tab = el.dataset.v; window.scrollTo(0, 0); render(); },
  close: el => el.closest('dialog').close(),
  shift: el => { cur.shift = el.dataset.v; render(); },
  setstate: el => {
    const s = currentShift(), e = s.meds.find(x => x.medId === el.dataset.id);
    if (!e) return; e.state = el.dataset.state; touch(s); render();
  },
  'add-measure': () => measureDialog(currentShift(), null),
  'edit-measure': el => { const s = currentShift(); measureDialog(s, s.measures.find(m => m.id === el.dataset.id)); },
  'del-measure': async el => {
    const s = currentShift(), m = s.measures.find(x => x.id === el.dataset.id); if (!m) return;
    if (await confirmBox(`Excluir a aferição <b>${esc(m.typeName)}: ${esc(fmtValue(m))}</b> (${fmtMTime(m, s)})?`)) {
      s.measures = s.measures.filter(x => x.id !== m.id); touch(s); render(); toast('Aferição excluída');
    }
  },
  report: el => showReport(findShift(el.dataset.key) || currentShift()),
  'copy-report': async el => {
    const ta = $('#report-text', el.closest('dialog'));
    const ok = await copyText(ta.value, ta);
    toast(ok ? '✅ Relatório copiado!' : 'Não foi possível copiar. Selecione o texto e copie manualmente.');
    if (ok) { el.textContent = 'Copiado ✓'; setTimeout(() => { el.innerHTML = `${icon('copy')} Copiar`; }, 2000); }
  },
  'share-report': el => {
    const text = $('#report-text', el.closest('dialog')).value;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  },
  'med-new': () => medDialog(null),
  'med-edit': el => medDialog(db.meds.find(m => m.id === el.dataset.id)),
  'med-del': async el => {
    const m = db.meds.find(x => x.id === el.dataset.id); if (!m) return;
    if (await confirmBox(`Excluir o medicamento <b>${esc(m.name)}</b> (${fmtHour(m.time)})?<br><span class="muted">Plantões já registrados não são alterados.</span>`)) {
      db.meds = db.meds.filter(x => x.id !== m.id); save(); render(); toast('Medicamento excluído');
    }
  },
  'type-new': () => typeDialog(null),
  'type-edit': el => typeDialog(db.types.find(t => t.id === el.dataset.id)),
  'type-del': async el => {
    const t = db.types.find(x => x.id === el.dataset.id); if (!t) return;
    if (await confirmBox(`Excluir o tipo de aferição <b>${esc(t.name)}</b>?<br><span class="muted">Registros já feitos continuam nos plantões.</span>`)) {
      db.types = db.types.filter(x => x.id !== t.id); save(); render(); toast('Tipo excluído');
    }
  },
  export: exportBackup,
  import: () => { $('#file-import').value = ''; $('#file-import').click(); }
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](el);
});

/* Campos de texto: salvam a cada tecla, sem redesenhar a tela. */
document.addEventListener('input', e => {
  if (e.target.id === 'f-resp') {
    const s = currentShift(); s.responsible = e.target.value; db.lastResponsible = e.target.value; touch(s);
  } else if (e.target.id === 'f-notes') {
    const s = currentShift(); s.notes = e.target.value; touch(s);
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'f-date' && e.target.value) { cur.date = e.target.value; render(); }
  else if (e.target.id === 'file-import' && e.target.files[0]) importBackup(e.target.files[0]);
});

/* ---------- 8. Início ---------- */
render();
