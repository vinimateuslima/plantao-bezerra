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
  alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  prontuario:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><circle cx="12" cy="12" r="2.5"/><path d="M7.5 18c.7-2 2.4-3 4.5-3s3.8 1 4.5 3"/>',
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

/* base = lista vinda do JSON (fixa). ov = alterações feitas neste aparelho por cima dela:
   edits (itens editados, por id), hidden (ids excluídos) e custom (itens criados aqui). */
const emptyOv = () => ({ edits: {}, hidden: [], custom: [] });
function emptyData() {
  return { version: 1, lastResponsible: '', shifts: {}, meds: [], types: [],
    base: { meds: [], types: [] }, ov: { meds: emptyOv(), types: emptyOv() } };
}
function applyOv(base, ov) {
  return [...base.filter(x => !ov.hidden.includes(x.id)).map(x => ov.edits[x.id] ? { ...x, ...ov.edits[x.id] } : x), ...ov.custom];
}
function rebuildLists(o) { o.meds = applyOv(o.base.meds, o.ov.meds); o.types = applyOv(o.base.types, o.ov.types); }

/* ---------- Catálogo (data/medicamentos.json) ----------
   A lista de medicamentos e de tipos de aferição vem desse arquivo. */
const CATALOG_URL = 'data/medicamentos.json';
let catalogError = '';

/* ---------- Prontuário (data/prontuario.json) ---------- */
const PRONT_URL = 'data/prontuario.json', PRONT_KEY = 'plantao-bezerra.prontuario.v1';
let pront = null, prontError = '';
async function loadProntuario() {
  try {
    const r = await fetch(PRONT_URL, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    pront = await r.json(); prontError = '';
    try { localStorage.setItem(PRONT_KEY, JSON.stringify(pront)); } catch (e) { /* sem cache */ }
  } catch (e) {
    console.warn('Falha ao ler ' + PRONT_URL, e);
    try { pront = JSON.parse(localStorage.getItem(PRONT_KEY)); } catch (e2) { pront = null; }
    prontError = 'Não foi possível carregar data/prontuario.json.' + (pront ? ' Mostrando a última ficha salva neste aparelho.' : '');
  }
}
const slug = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function uniqueId(base, used) { let id = base, n = 2; while (used.has(id)) id = `${base}-${n++}`; used.add(id); return id; }

function parseCatalog(j) {
  const usedM = new Set(), usedT = new Set();
  const meds = arr(j.medicamentos).filter(m => m && str(m.nome).trim()).map(m => {
    const period = PERIODS.includes(m.periodo) ? m.periodo : 'manha';
    const time = /^\d{1,2}:\d{2}$/.test(str(m.horario)) ? m.horario.padStart(5, '0') : '';
    return {
      id: uniqueId(`m-${period}-${time || 'sh'}-${slug(m.nome)}`, usedM), name: m.nome.trim(), time, dose: str(m.dose).trim(),
      notes: str(m.obs).trim(), icon: str(m.icone) || '💊', alert: str(m.alerta).trim(), generic: str(m.generico).trim(), use: str(m.paraQueServe).trim(), period,
      shift: ['D', 'N', 'A'].includes(m.plantao) ? m.plantao : (period === 'noite' ? 'N' : 'D')
    };
  });
  const types = arr(j.afericoes).filter(t => t && str(t.nome).trim())
    .map(t => ({ id: uniqueId(`t-${slug(t.nome)}`, usedT), name: t.nome.trim(), unit: str(t.unidade).trim() }));
  return { meds, types };
}

async function loadCatalog() {
  try {
    const r = await fetch(CATALOG_URL, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const c = parseCatalog(await r.json());
    db.base = c; rebuildLists(db); catalogError = ''; save();
  } catch (e) {
    console.warn('Falha ao ler ' + CATALOG_URL, e);
    catalogError = location.protocol === 'file:'
      ? 'Não foi possível ler data/medicamentos.json ao abrir o arquivo direto. Abra o app por um servidor (ex.: Vercel ou "python -m http.server").'
      : 'Não foi possível carregar data/medicamentos.json.';
    if (db.base.meds.length) catalogError += ' Usando a última lista salva neste aparelho.';
  }
}

const normMed = m => (!m || !str(m.name).trim()) ? null : ({
  id: str(m.id) || uid(), name: m.name.trim(), time: /^\d{2}:\d{2}$/.test(m.time) ? m.time : '',
  dose: str(m.dose), notes: str(m.notes), icon: str(m.icon) || '💊', alert: str(m.alert), generic: str(m.generic), use: str(m.use),
  period: PERIODS.includes(m.period) ? m.period : 'manha', shift: ['D', 'N', 'A'].includes(m.shift) ? m.shift : 'D'
});
const normType = t => (!t || !str(t.name).trim()) ? null : ({ id: str(t.id) || uid(), name: t.name.trim(), unit: str(t.unit) });
const MED_KEYS = ['name', 'time', 'dose', 'notes', 'period', 'shift', 'icon', 'alert', 'generic', 'use'], TYPE_KEYS = ['name', 'unit'];
function normOv(o, fn, keys) {
  o = o && typeof o === 'object' ? o : {};
  const edits = {};
  Object.entries(o.edits && typeof o.edits === 'object' ? o.edits : {}).forEach(([k, v]) => {
    if (!v || typeof v !== 'object') return;
    const e = {}; keys.forEach(f => { if (typeof v[f] === 'string') e[f] = v[f]; });
    if (Object.keys(e).length) edits[k] = e;
  });
  return { edits, hidden: arr(o.hidden).filter(x => typeof x === 'string'), custom: arr(o.custom).map(fn).filter(Boolean) };
}

/* Valida/normaliza qualquer dado vindo do disco ou de um backup. */
function normalize(d) {
  const b = d.base && typeof d.base === 'object' ? d.base : {}, ov = d.ov && typeof d.ov === 'object' ? d.ov : {};
  const out = {
    version: 1, lastResponsible: str(d.lastResponsible), meds: [], types: [], shifts: {},
    base: { meds: arr(b.meds).map(normMed).filter(Boolean), types: arr(b.types).map(normType).filter(Boolean) },
    ov: { meds: normOv(ov.meds, normMed, MED_KEYS), types: normOv(ov.types, normType, TYPE_KEYS) }
  };
  rebuildLists(out);
  Object.values(d.shifts && typeof d.shifts === 'object' ? d.shifts : {}).forEach(s => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !SHIFTS[s.shift]) return;
    const ns = { key: shiftKey(s.date, s.shift), date: s.date, shift: s.shift, responsible: str(s.responsible), notes: str(s.notes), meds: [], measures: [] };
    arr(s.meds).forEach(e => {
      if (!e || !str(e.name)) return;
      ns.meds.push({
        medId: str(e.medId), name: e.name, time: /^\d{2}:\d{2}$/.test(e.time) ? e.time : '', dose: str(e.dose), notes: str(e.notes), icon: str(e.icon) || '💊', alert: str(e.alert), generic: str(e.generic), use: str(e.use),
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
  return emptyData();
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
const snapMed = m => ({ name: m.name, time: m.time, dose: m.dose, notes: m.notes, icon: m.icon, alert: m.alert, generic: m.generic, use: m.use, period: m.period });

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
      const what = dose ? `${dose} de ${/^[A-ZÀ-Ú][^A-ZÀ-Ú]*$/.test(e.name) ? e.name.toLowerCase() : e.name}` : e.name;
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
/* Ícone "?" com tooltip: princípio ativo + para que serve (campos generico / paraQueServe do JSON). */
function infoHTML(e) {
  if (!e.generic && !e.use) return '';
  return ` <span class="info"><button type="button" class="info-btn" data-action="med-info" aria-label="O que é ${esc(e.name)}?">?</button>
    <span class="tip" role="tooltip">${e.generic ? `<b>${esc(e.generic)}</b>` : ''}${e.use ? `<span>${esc(e.use)}</span>` : ''}</span></span>`;
}

function medCardHTML(e) {
  const btn = st => `<button type="button" class="${st} ${e.state === st ? 'on' : ''}" data-action="setstate" data-id="${esc(e.medId)}" data-state="${st}"
      aria-pressed="${e.state === st}"><b>${STATES[st].icon}</b>${STATES[st].label}</button>`;
  return `<article class="med s-${e.state}">
    <div class="med-top">${e.time ? `<span class="time">${fmtHour(e.time)}</span>` : `<span class="time">${esc(e.icon)}</span>`}
      <div class="med-info"><strong>${esc(e.name)}${e.alert ? ` <button type="button" class="alert-btn" data-action="med-alert" data-id="${esc(e.medId)}" aria-label="Aviso sobre ${esc(e.name)}">${icon('alert', 'sm')}</button>` : ''}${infoHTML(e)}</strong>${e.dose ? `<span>${esc(e.dose)}</span>` : ''}${e.notes ? `<em>${esc(e.notes)}</em>` : ''}</div>
      <button type="button" class="icon-btn" style="margin-left:auto" data-action="med-edit" data-id="${esc(e.medId)}" aria-label="Editar medicamento">${icon('edit', 'sm')}</button></div>
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
  ${catalogError ? `<p class="warn">⚠️ ${esc(catalogError)}</p>` : ''}
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
      : `<p class="empty">Nenhum medicamento cadastrado para o plantão ${SHIFTS[s.shift].toLowerCase()}.<br>Edite <b>data/medicamentos.json</b>.</p>`}
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

function fmtPhone(t) {
  const d = String(t || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(t || '');
}
function ageFrom(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return '';
  const n = new Date(); let a = n.getFullYear() - +m[1];
  if (n.getMonth() + 1 < +m[2] || (n.getMonth() + 1 === +m[2] && n.getDate() < +m[3])) a--;
  return a >= 0 ? `${a} anos` : '';
}
function daysSince(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return null;
  const t = new Date(), a = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()), b = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return Math.max(0, Math.round((a - b) / 86400000));
}
const roomLine = () => { const i = (pront && pront.internacao) || {}; return [i.quarto ? `Quarto ${i.quarto}` : '', str(i.andar)].filter(Boolean).join(' · '); };

function viewProntuario() {
  const P = pront || {}, pa = P.paciente || {}, en = pa.endereco || {}, it = P.internacao || {}, al = P.alergias || {}, sa = P.saude || {}, cv = P.convenio || {};
  const dash = '<span class="muted">—</span>';
  const kv = (k, v, tel) => `<div class="kv-row"><dt>${k}</dt><dd>${v ? (tel ? `<a href="tel:${esc(String(v).replace(/[^\d+]/g, ''))}">${esc(v)}</a>` : esc(v)) : dash}</dd></div>`;
  const chips = list => arr(list).filter(x => str(x).trim()).length ? `<div class="chips" style="margin:0">${arr(list).filter(x => str(x).trim()).map(x => `<span class="chip neutral">${esc(x)}</span>`).join('')}</div>` : dash;
  const addr = [[en.logradouro, en.numero].filter(Boolean).join(', '), en.complemento, en.bairro, [en.cidade, en.uf].filter(Boolean).join(' - '), en.cep && 'CEP ' + en.cep].filter(Boolean).join(' · ');
  const nasc = /^\d{4}-\d{2}-\d{2}/.test(str(pa.dataNascimento)) ? fmtDate(pa.dataNascimento.slice(0, 10)) : '';
  const dt = /^\d{4}-\d{2}-\d{2}/.test(str(it.dataAtendimento)) ? `${fmtDate(it.dataAtendimento.slice(0, 10))}${it.dataAtendimento.slice(11, 16) ? ' às ' + it.dataAtendimento.slice(11, 16) : ''}` : '';
  const dias = daysSince(it.dataAtendimento);
  const meds = arr(al.medicamentos).filter(x => str(x).trim());
  const allergy = meds.length
    ? `<div class="allergy bad"><b>⚠️ Alergia a medicamentos</b><br>${meds.map(esc).join(', ')}</div>`
    : al.semAlergiaMedicamentosa === true ? '<div class="allergy ok"><b>✅ Sem alergia a medicamentos</b></div>'
    : '<p class="muted">Alergias a medicamentos: não informado.</p>';
  const contacts = arr(P.contatos).filter(c => c && (str(c.nome).trim() || str(c.telefone).trim()));
  return `
  ${prontError ? `<p class="warn">⚠️ ${esc(prontError)}</p>` : ''}
  <section class="card">
    <div class="card-title"><h2>👤 Paciente</h2></div>
    <p class="pt-name">${esc(pa.nomeCompleto) || 'Nome não informado'}</p>
    <p class="muted" style="margin-bottom:10px">${[ageFrom(pa.dataNascimento), nasc && 'nasc. ' + nasc, pa.sexo].filter(Boolean).map(esc).join(' · ')}</p>
    ${allergy}
    <dl class="kv">
      ${kv('Nome da mãe', pa.nomeMae)}${kv('CNS (Cartão SUS)', pa.cns)}
      ${kv('Telefone', fmtPhone(pa.telefone), true)}${kv('Endereço', addr)}
    </dl>
  </section>

  <section class="card">
    <div class="card-title"><h2>🏥 Internação</h2></div>
    <dl class="kv">
      ${kv('Hospital', it.hospital)}${kv('Clínica', it.clinica)}${kv('Quarto', [it.quarto, it.andar].filter(Boolean).join(' · '))}
      ${kv('Prontuário nº', it.prontuario)}${kv('Atendimento nº', it.atendimento)}
      ${kv('Entrada', dt + (dias != null && dt ? ` (há ${dias} dia${dias === 1 ? '' : 's'})` : ''))}
      ${kv('Motivo da internação', it.motivoInternacao)}${kv('Diagnóstico principal', it.diagnosticoPrincipal)}
      ${kv('Médico responsável', it.medicoResponsavel)}${kv('Previsão de alta', it.previsaoAlta)}
    </dl>
  </section>

  <section class="card">
    <div class="card-title"><h2>🩺 Saúde</h2></div>
    <dl class="kv">
      ${kv('Tipo sanguíneo', sa.tipoSanguineo)}${kv('Peso', sa.pesoKg && sa.pesoKg + ' kg')}${kv('Altura', sa.alturaCm && sa.alturaCm + ' cm')}
      <div class="kv-row"><dt>Comorbidades</dt><dd>${chips(sa.comorbidades)}</dd></div>
      <div class="kv-row"><dt>Cirurgias prévias</dt><dd>${chips(sa.cirurgiasPrevias)}</dd></div>
      <div class="kv-row"><dt>Outras alergias</dt><dd>${chips(al.outras)}</dd></div>
      ${kv('Dieta', sa.dieta)}${kv('Mobilidade', sa.mobilidade)}${kv('Risco de queda', sa.riscoQueda)}
      ${kv('Obs. clínicas', sa.observacoesClinicas)}
    </dl>
  </section>

  <section class="card">
    <div class="card-title"><h2>📞 Contatos</h2></div>
    ${contacts.length ? contacts.map(c => `<div class="list-item"><div class="grow"><strong>${esc(c.nome) || 'Sem nome'}</strong><span class="muted">${esc(c.parentesco)}</span></div>${c.telefone ? `<a class="btn small" href="tel:${esc(String(c.telefone).replace(/[^\d+]/g, ''))}">${esc(fmtPhone(c.telefone))}</a>` : ''}</div>`).join('')
      : '<p class="empty">Nenhum contato cadastrado.</p>'}
  </section>

  <section class="card">
    <div class="card-title"><h2>🧾 Convênio e observações</h2></div>
    <dl class="kv">${kv('Plano / convênio', cv.plano)}${kv('Carteirinha', cv.carteirinha)}${kv('Observações', P.observacoes)}</dl>
    <p class="hint" style="margin:8px 0 0">Informações lidas de data/prontuario.json.</p>
  </section>`;
}

function viewSettings() {
  const medGroups = [['D', 'Diurno'], ['N', 'Noturno'], ['A', 'Diurno e noturno']].map(([k, label]) => {
    const items = db.meds.filter(m => m.shift === k).sort((a, b) => PERIODS.indexOf(a.period) - PERIODS.indexOf(b.period) || byTime(a, b));
    if (!items.length) return '';
    return `<h3 class="period-h">${label}</h3>${items.map(m => `
      <div class="list-item"><span class="time">${m.time ? fmtHour(m.time) : esc(m.icon)}</span>
        <div class="grow"><strong>${esc(m.name)}</strong>
          <span class="badge">${PERIOD_LABEL[m.period]}</span>${isChanged('meds', m.id) ? '<span class="badge">alterado</span>' : ''}${m.dose ? `<span class="muted">${esc(m.dose)}</span>` : ''}
          ${m.notes ? `<div class="muted">${esc(m.notes)}</div>` : ''}</div>
        <button class="icon-btn" data-action="med-edit" data-id="${m.id}" aria-label="Editar">${icon('edit', 'sm')}</button>
        <button class="icon-btn del" data-action="med-del" data-id="${m.id}" aria-label="Excluir">${icon('trash', 'sm')}</button></div>`).join('')}`;
  }).join('');
  return `
  <section class="card">
    <div class="card-title"><h2>💊 Medicamentos</h2><button class="btn small primary" data-action="med-new">${icon('plus', 'sm')} Novo</button></div>
    <p class="muted">A lista base vem de <b>data/medicamentos.json</b>. Suas edições ficam salvas só neste aparelho, por cima dela.</p>
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
    <button class="btn block" data-action="restore-defaults">Restaurar lista padrão (JSON)</button>
  </section>
  <section class="card">
    <div class="card-title"><h2>💾 Backup</h2></div>
    <p class="muted" style="margin-bottom:12px">Os dados ficam somente neste aparelho e nunca são enviados pela internet. Exporte um backup de vez em quando ou para levar os dados a outro aparelho.</p>
    <div class="row2"><button class="btn" data-action="export">${icon('download')} Exportar</button><button class="btn" data-action="import">${icon('upload')} Importar</button></div>
  </section>`;
}

function render() {
  const y = window.scrollY;
  $('#view').innerHTML = { plantao: viewPlantao, prontuario: viewProntuario, ajustes: viewSettings }[tab]();
  document.querySelectorAll('#tabbar button').forEach(b => {
    b.classList.toggle('on', b.dataset.v === tab);
    b.querySelector('svg').innerHTML = ICONS[b.dataset.v];
    b.querySelector('svg').setAttribute('viewBox', '0 0 24 24');
  });
  $('#hdr-sub').textContent = tab === 'plantao' ? `${SHIFTS[cur.shift]} · ${fmtDate(cur.date)}` : tab === 'prontuario' ? 'Prontuário / ficha do paciente' : 'Medicamentos, aferições e backup';
  const room = roomLine(); $('#hdr-room').textContent = room;
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
  if (!types.length) { toast('Nenhum tipo de aferição em data/medicamentos.json'); return; }
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
      <label class="field"><span>Instruções adicionais (opcional)</span><input name="notes" type="text" autocomplete="off" value="${esc(m ? m.notes : '')}"></label>
      <label class="field"><span>Aviso (opcional — mostra um ⚠️ no remédio)</span><input name="alert" type="text" autocomplete="off" value="${esc(m ? m.alert : '')}"></label>
      <p class="hint">Alterações ficam salvas só neste aparelho; o arquivo JSON não é modificado.</p>`,
    onSubmit(fd) {
      const rec = { name: fd.get('name').trim(), time: fd.get('time'), dose: fd.get('dose').trim(), period: fd.get('period'), shift: fd.get('shift'), notes: fd.get('notes').trim(), alert: fd.get('alert').trim() };
      saveItem('meds', m, rec, { icon: '💊' });
      toast('Medicamento salvo');
    }
  });
  const time = d.querySelector('[name=time]'), period = d.querySelector('[name=period]'), shift = d.querySelector('[name=shift]');
  const sync = () => { if (shift.value !== 'A') shift.value = period.value === 'noite' ? 'N' : 'D'; };
  time.addEventListener('change', () => { if (!time.value) return; const h = +time.value.slice(0, 2); period.value = h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite'; sync(); });
  period.addEventListener('change', sync);
}

function typeDialog(t) {
  formDialog({
    title: t ? 'Editar tipo de aferição' : 'Novo tipo de aferição',
    body: `<label class="field"><span>Nome</span><input name="name" type="text" required autocomplete="off" placeholder="Ex.: Pressão arterial" value="${esc(t ? t.name : '')}"></label>
      <label class="field"><span>Unidade de medida</span><input name="unit" type="text" autocomplete="off" placeholder="Ex.: mmHg" value="${esc(t ? t.unit : '')}"></label>`,
    onSubmit(fd) { saveItem('types', t, { name: fd.get('name').trim(), unit: fd.get('unit').trim() }); toast('Tipo salvo'); }
  });
}

/* Salva um item (medicamento/tipo) por cima do JSON: item do JSON vira "edição"; item criado aqui é atualizado direto. */
function saveItem(kind, item, rec, defaults = {}) {
  const ov = db.ov[kind];
  if (!item) ov.custom.push({ id: 'c-' + uid(), ...defaults, ...rec });
  else {
    const i = ov.custom.findIndex(x => x.id === item.id);
    if (i >= 0) ov.custom[i] = { ...ov.custom[i], ...rec };
    else {
      const base = db.base[kind].find(x => x.id === item.id) || {};
      const ch = {}; Object.keys(rec).forEach(k => { if (rec[k] !== base[k]) ch[k] = rec[k]; });
      if (Object.keys(ch).length) ov.edits[item.id] = ch; else delete ov.edits[item.id];
    }
  }
  rebuildLists(db); save(); render();
}
function deleteItem(kind, item) {
  const ov = db.ov[kind];
  if (ov.custom.some(x => x.id === item.id)) ov.custom = ov.custom.filter(x => x.id !== item.id);
  else { ov.hidden.push(item.id); delete ov.edits[item.id]; }
  rebuildLists(db); save(); render();
}
const isChanged = (kind, id) => db.ov[kind].edits[id] || db.ov[kind].custom.some(x => x.id === id);

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
    <p>O arquivo contém <b>${n}</b> plantão(ões) e as edições de medicamentos feitas neste aparelho. A lista base continua vindo de data/medicamentos.json.</p>
    <p class="muted"><b>Mesclar</b> mantém seus dados e acrescenta os do arquivo. <b>Substituir</b> apaga tudo o que está neste aparelho.</p>
    <div class="dlg-actions"><button class="btn" data-action="close">Cancelar</button>
    <button class="btn danger" data-v="replace">Substituir tudo</button><button class="btn primary" data-v="merge">Mesclar</button></div></div>`);
  d.addEventListener('click', async e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    if (b.dataset.v === 'replace') {
      if (!(await confirmBox('Todos os dados atuais deste aparelho serão apagados e trocados pelos do backup. Continuar?', 'Substituir'))) return;
      inc.base = db.base; rebuildLists(inc); db = inc;
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
  'med-alert': el => {
    const m = currentShift().meds.find(x => x.medId === el.dataset.id); if (!m || !m.alert) return;
    openDialog(`<div class="dlg-body"><h2>⚠️ ${esc(m.name)}</h2><p style="white-space:pre-wrap">${esc(m.alert)}</p>
      <div class="dlg-actions"><button class="btn primary" data-action="close">Entendi</button></div></div>`, true);
  },
  'med-info': el => { const i = el.closest('.info'); i.classList.toggle('open'); placeTip(i); },
  'med-new': () => medDialog(null),
  'med-edit': el => { const m = db.meds.find(x => x.id === el.dataset.id); if (m) medDialog(m); },
  'med-del': async el => {
    const m = db.meds.find(x => x.id === el.dataset.id); if (!m) return;
    if (await confirmBox(`Excluir o medicamento <b>${esc(m.name)}</b> (${fmtHour(m.time) || 'sem horário'})?<br><span class="muted">Fica excluído só neste aparelho; "Restaurar lista padrão" traz de volta.</span>`)) { deleteItem('meds', m); toast('Medicamento excluído'); }
  },
  'type-new': () => typeDialog(null),
  'type-edit': el => { const t = db.types.find(x => x.id === el.dataset.id); if (t) typeDialog(t); },
  'type-del': async el => {
    const t = db.types.find(x => x.id === el.dataset.id); if (!t) return;
    if (await confirmBox(`Excluir o tipo de aferição <b>${esc(t.name)}</b>?<br><span class="muted">Registros já feitos continuam nos plantões.</span>`)) { deleteItem('types', t); toast('Tipo excluído'); }
  },
  'restore-defaults': async () => {
    if (await confirmBox('Descartar todas as edições, exclusões e itens criados neste aparelho e voltar à lista do arquivo JSON?', 'Restaurar', false)) {
      db.ov = { meds: emptyOv(), types: emptyOv() }; rebuildLists(db); save(); render(); toast('Lista padrão restaurada');
    }
  },
  export: exportBackup,
  import: () => { $('#file-import').value = ''; $('#file-import').click(); }
};

/* Tooltip "?": posição fixa calculada para nunca ultrapassar as bordas da tela. */
function placeTip(info) {
  const tip = info.querySelector('.tip'), b = info.querySelector('.info-btn').getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight, vw = document.documentElement.clientWidth, m = 8;
  if (!w) return;
  const cx = b.left + b.width / 2;
  tip.style.left = Math.max(m, Math.min(cx - w / 2, vw - w - m)) + 'px';
  const below = b.bottom + 8, above = b.top - h - 8;
  tip.style.top = (below + h > window.innerHeight - m && above > m ? above : below) + 'px';
}
document.addEventListener('mouseover', e => { const i = e.target.closest('.info'); if (i) placeTip(i); });
document.addEventListener('focusin', e => { const i = e.target.closest('.info'); if (i) placeTip(i); });
window.addEventListener('scroll', () => document.querySelectorAll('.info.open').forEach(x => x.classList.remove('open')), { passive: true });

document.addEventListener('click', e => {
  document.querySelectorAll('.info.open').forEach(x => { if (!x.contains(e.target)) x.classList.remove('open'); });
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
Promise.all([loadCatalog(), loadProntuario()]).then(render);
