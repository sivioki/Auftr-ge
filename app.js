'use strict';

const STORAGE_KEY = 'auftragsboard-v1';

const UI_KEY = 'auftragsboard-ui';
const UI_DEFAULTS = { view: 'board', hideDone: false, area: 'all', sort: null, collapsed: [] };

// Beispiel-Board nach dem Vorbild einer Produktion mit mehreren Stationen.
// Kunden, Bestellnummern und Namen sind ausgedacht.
function exampleState() {
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return isoDate(d);
  };
  const AREAS = ['Resinvorbereitung', 'Kommissionieren', 'Laser', 'Aufbau', 'Produktion', 'Quality', 'Verpackung', 'Erledigt'];
  const areas = AREAS.map((name, i) => ({ id: `a${i + 1}`, name }));
  const areaId = (name) => areas.find((a) => a.name === name).id;
  let n = 0;
  const sub = (...titles) => titles.map((title, i) => ({ id: `s${++n}`, title, done: i === 0 }));
  const task = (area, group, title, f, extra = {}) => ({
    id: `t${++n}`, area: areaId(area), group, title, description: '', assignee: '', due: day(f.due ?? 7),
    priority: 'normal', done: false, cover: '', subtasks: [],
    fields: {
      artikel: group === 'g1' ? 'Valichrom' : 'Minichrom',
      ende: f.ende === undefined ? '' : day(f.ende),
      ma: f.ma ?? '', saeulen: f.saeulen ?? '', moisture: f.moisture ?? '', coa: f.coa ?? '',
      lager: f.lager ?? false, customized: f.customized ?? '',
    },
    history: [{ at: Date.now(), text: `Erstellt in „${area}“` }],
    ...extra,
  });
  return {
    areas,
    groups: [{ id: 'g1', name: 'VC' }, { id: 'g2', name: 'MC' }],
    builtins: { assignee: false, due: true, priority: false },
    fields: [
      { id: 'artikel', name: 'Artikel', type: 'select', onCard: true, options: ['Valichrom', 'Minichrom'] },
      { id: 'ende', name: 'Enddatum', type: 'date', onCard: false },
      { id: 'ma', name: 'MA-Zuordnung', type: 'select', onCard: true, options: ['Anna', 'Ben', 'Clara', 'David'] },
      { id: 'saeulen', name: 'Säulen', type: 'number', onCard: true },
      { id: 'moisture', name: 'Moisture-Analyse', type: 'select', onCard: false, options: ['Ja', 'Teilweise'] },
      { id: 'coa', name: 'CoA/KB', type: 'select', onCard: false, options: ['Ja'] },
      { id: 'lager', name: 'Lagersäule', type: 'checkbox', onCard: true },
      { id: 'customized', name: 'Customized', type: 'select', onCard: true, options: ['Customized'] },
    ],
    tasks: [
      task('Resinvorbereitung', 'g1', 'Kunde Alpha SO 300101 PO 4500012345', { due: 9, saeulen: 12 }, { subtasks: sub('Resin abwiegen', 'Slurry ansetzen') }),
      task('Resinvorbereitung', 'g2', 'Kunde Beta SO 300102 PO 7700045678', { due: 11, saeulen: 4 }),
      task('Kommissionieren', 'g1', 'Kunde Gamma SO 300095 PO PO-000321', { due: 6, saeulen: 6, ma: 'Ben' }, { subtasks: sub('Hardware kommissionieren', 'Etiketten drucken') }),
      task('Laser', 'g1', 'Kunde Delta SO 300090 PO 3200019876 / MA', { due: 5, saeulen: 3 }),
      task('Aufbau', 'g2', 'Kunde Epsilon SO 300088 PO 8800023456', { due: 4, saeulen: 10, ma: 'David' }),
      task('Produktion', 'g1', 'Kunde Zeta SO 300071 PO 9500013411 / 52', { due: -1, ende: -8, saeulen: 8, ma: 'Anna', coa: 'Ja', customized: 'Customized' }, { subtasks: sub('Säulen packen', 'Test', 'Dokumentation') }),
      task('Produktion', 'g1', 'Kunde Eta SO 300072 PO 9949961790 / MA', { due: 0, ende: -7, saeulen: 35, ma: 'Clara', moisture: 'Ja', coa: 'Ja' }, { subtasks: sub('Säulen packen', 'Test') }),
      task('Produktion', 'g1', 'Kunde Theta STO 60000476669', { due: 2, ende: -5, saeulen: 9, ma: 'Ben', coa: 'Ja' }),
      task('Produktion', 'g1', 'Kunde Iota SO 300080 PO DR5969323 / MA', { due: 6, ende: -1, saeulen: 6, moisture: 'Ja', coa: 'Ja' }),
      task('Produktion', 'g1', 'Kunde Kappa SO 300081 PO 4519507070', { due: 10, ende: 3, saeulen: 4, moisture: 'Teilweise', coa: 'Ja' }, { subtasks: sub('Säulen packen', 'Test', 'Druckprüfung', 'Dokumentation') }),
      task('Produktion', 'g1', 'Kunde Lambda SO 300083 PO 3100019358 PRIO', { due: 10, ende: 3, saeulen: 6, moisture: 'Teilweise', coa: 'Ja' }, { priority: 'hoch' }),
      task('Produktion', 'g2', 'Kunde My PA 20219386 Pure PL EA', { due: 8, ende: 1, saeulen: 20, coa: 'Ja', lager: true }),
      task('Quality', 'g1', 'Kunde Ny SO 300060 PO 4300427706 / MA', { due: 3, ende: -2, saeulen: 2, moisture: 'Ja', coa: 'Ja', ma: 'Clara' }),
      task('Verpackung', 'g2', 'Kunde Xi SO 300055 PO DR6025838 / MA', { due: 1, ende: -4, saeulen: 4, coa: 'Ja' }),
      task('Erledigt', 'g1', 'Kunde Omikron SO 300040 PO 4503007004', { due: -3, ende: -10, saeulen: 5, coa: 'Ja' }, { done: true }),
    ],
  };
}

let state = load();
let editingTaskId = null;
let editingAreaId = null;
let pendingCover = '';
let pendingDone = false;
let pendingSubtasks = [];
let ui = loadUi();

const board = document.getElementById('board');
const listView = document.getElementById('list');
const sidebar = document.getElementById('sidebar');
const search = document.getElementById('search');
const dialog = document.getElementById('task-dialog');
const form = document.getElementById('task-form');
const areaTpl = document.getElementById('area-template');
const cardTpl = document.getElementById('card-template');
const addAreaTpl = document.getElementById('add-area-template');
const fieldsDialog = document.getElementById('fields-dialog');
const fieldForm = document.getElementById('field-form');
const FIELD_TYPES = {
  text: 'Text', textarea: 'Mehrzeiliger Text', number: 'Zahl', date: 'Datum',
  select: 'Auswahl', checkbox: 'Ja/Nein', url: 'Link',
};

// ---------- Rückfragen (statt alert/confirm, die nicht überall funktionieren) ----------

function ask(message, { okText = 'OK', cancel = true } = {}) {
  const box = document.getElementById('confirm-dialog');
  document.getElementById('confirm-text').textContent = message;
  const yes = document.getElementById('confirm-yes');
  const no = document.getElementById('confirm-no');
  yes.textContent = okText;
  no.hidden = !cancel;
  return new Promise((resolve) => {
    const finish = (result) => {
      yes.onclick = no.onclick = box.oncancel = null;
      box.close();
      resolve(result);
    };
    yes.onclick = () => finish(true);
    no.onclick = () => finish(false);
    box.oncancel = (e) => { e.preventDefault(); finish(false); };
    box.showModal();
    yes.focus();
  });
}

function notify(message) {
  return ask(message, { cancel: false });
}

// ---------- Persistenz ----------

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.areas) && Array.isArray(parsed.tasks)) return normalize(parsed);
    }
  } catch (e) { /* Speicher nicht verfügbar */ }
  return exampleState();
}

function loadUi() {
  try { return { ...UI_DEFAULTS, ...JSON.parse(localStorage.getItem(UI_KEY)) }; } catch (e) { return { ...UI_DEFAULTS }; }
}

function saveUi() {
  try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* ignorieren */ }
}

// Ältere Daten (ohne eigene Felder) auf aktuelles Format bringen
function normalize(data) {
  data.fields ??= [];
  data.groups ??= [];
  data.builtins = { assignee: true, due: true, priority: true, ...data.builtins };
  for (const t of data.tasks) {
    t.fields ??= {};
    t.subtasks ??= [];
    t.group ??= '';
    t.done ??= false;
    t.cover ??= '';
  }
  return data;
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    notify('Speichern fehlgeschlagen – der Browser-Speicher ist voll. Bitte große Titelbilder entfernen.');
  }
}

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const areaName = (id) => state.areas.find((a) => a.id === id)?.name ?? '?';

// ---------- Logik ----------

function moveTask(taskId, targetAreaId, beforeTaskId = null) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  const from = task.area;
  state.tasks.splice(state.tasks.indexOf(task), 1);
  task.area = targetAreaId;
  if (from !== targetAreaId) {
    task.history.push({ at: Date.now(), text: `Verschoben: „${areaName(from)}“ → „${areaName(targetAreaId)}“` });
  }
  const beforeIdx = beforeTaskId ? state.tasks.findIndex((t) => t.id === beforeTaskId) : -1;
  if (beforeIdx >= 0) state.tasks.splice(beforeIdx, 0, task);
  else state.tasks.push(task);
  save();
  render();
}

function stepTask(taskId, dir) {
  const task = state.tasks.find((t) => t.id === taskId);
  const idx = state.areas.findIndex((a) => a.id === task.area);
  const target = state.areas[idx + dir];
  if (target) moveTask(taskId, target.id);
}

function toggleDone(taskId) {
  const task = state.tasks.find((t) => t.id === taskId);
  task.done = !task.done;
  task.history.push({ at: Date.now(), text: task.done ? 'Als erledigt markiert' : 'Wieder geöffnet' });
  save();
  render();
}

function addArea(name, afterAreaId = null) {
  const area = { id: uid('a'), name };
  const idx = afterAreaId ? state.areas.findIndex((a) => a.id === afterAreaId) + 1 : state.areas.length;
  state.areas.splice(idx, 0, area);
  save();
  render();
  return area;
}

function startRename(areaId) {
  const title = board.querySelector(`.area[data-id="${areaId}"] .area-title`);
  if (!title) return;
  editingAreaId = areaId;
  title.contentEditable = 'true';
  title.focus();
  title.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  document.getSelection().selectAllChildren(title);
}

async function deleteArea(areaId) {
  const count = state.tasks.filter((t) => t.area === areaId).length;
  if (state.areas.length === 1) { notify('Mindestens ein Bereich muss bestehen bleiben.'); return; }
  const msg = count
    ? `Bereich „${areaName(areaId)}“ und ${count} Auftrag/Aufträge darin löschen?`
    : `Bereich „${areaName(areaId)}“ löschen?`;
  if (!await ask(msg)) return;
  state.areas = state.areas.filter((a) => a.id !== areaId);
  state.tasks = state.tasks.filter((t) => t.area !== areaId);
  if (ui.area === areaId) { ui.area = 'all'; saveUi(); }
  save();
  render();
}

function shiftArea(areaId, dir) {
  const i = state.areas.findIndex((a) => a.id === areaId);
  const j = i + dir;
  if (j < 0 || j >= state.areas.length) return;
  [state.areas[i], state.areas[j]] = [state.areas[j], state.areas[i]];
  save();
  render();
}

// ---------- Darstellung ----------

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// Fälligkeit wie in Asana: „Heute“, „Morgen“, „Gestern“ oder „24. Okt.“
function dueInfo(task) {
  if (!task.due) return null;
  const [y, m, d] = task.due.split('-').map(Number);
  const due = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((due - today) / 86400000);
  let text;
  if (diff === 0) text = 'Heute';
  else if (diff === 1) text = 'Morgen';
  else if (diff === -1) text = 'Gestern';
  else {
    const opts = { day: 'numeric', month: 'short' };
    if (y !== now.getFullYear()) opts.year = 'numeric';
    text = due.toLocaleDateString('de-DE', opts);
  }
  const cls = task.done ? '' : diff < 0 ? 'overdue' : diff <= 1 ? 'soon' : '';
  return { text, cls };
}

const AVATAR_COLORS = ['#f06a6a', '#4573d2', '#58a182', '#aa62e3', '#e8a33b', '#3fb1ab', '#ea4e9d', '#8d84e8'];
const PILL_COLORS = ['blue', 'green', 'purple', 'yellow', 'pink', 'red'];
const GROUP_COLORS = ['blue', 'purple', 'pink', 'yellow', 'green', 'red'];
const groupName = (id) => state.groups.find((g) => g.id === id)?.name ?? '';
const PRIORITY_PILL = { hoch: ['Hoch', 'red'], normal: ['Normal', 'yellow'], niedrig: ['Niedrig', 'green'] };

function avatar(name) {
  const el = document.createElement('span');
  el.className = 'avatar';
  const words = name.trim().split(/\s+/);
  el.textContent = (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  el.style.background = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  el.title = name;
  return el;
}

function pill(text, color = '', title = '') {
  const el = span(text, `pill ${color}`.trim());
  if (title) el.title = title;
  return el;
}

function groupPill(task) {
  const idx = state.groups.findIndex((g) => g.id === task.group);
  return idx < 0 ? null : pill(state.groups[idx].name, GROUP_COLORS[idx % GROUP_COLORS.length], 'Gruppe');
}

function subtaskInfo(task) {
  if (!task.subtasks.length) return null;
  const done = task.subtasks.filter((st) => st.done).length;
  const el = span(`☑ ${done}/${task.subtasks.length}`, 'subtask-count');
  el.title = 'Erledigte Unteraufgaben';
  return el;
}

function priorityPill(task) {
  const [text, color] = PRIORITY_PILL[task.priority] ?? PRIORITY_PILL.normal;
  return pill(text, color, 'Priorität');
}

function fieldPill(f, v) {
  if (v === undefined || v === '' || v === false) return null;
  if (f.type === 'checkbox') return pill(`✓ ${f.name}`, 'green');
  if (f.type === 'select') {
    const idx = f.options.indexOf(v);
    return pill(v, idx >= 0 ? PILL_COLORS[idx % PILL_COLORS.length] : '', f.name);
  }
  return pill(`${f.name}: ${displayValue(f, v)}`, '', f.name);
}

function visibleTasks(areaId) {
  const q = search.value.trim().toLowerCase();
  return state.tasks.filter((t) => t.area === areaId && !(ui.hideDone && t.done) && (!q || searchText(t).includes(q)));
}

function render() {
  board.hidden = ui.view !== 'board';
  listView.hidden = ui.view !== 'list';
  for (const tab of document.querySelectorAll('.tab')) tab.setAttribute('aria-selected', tab.dataset.view === ui.view);
  document.getElementById('hide-done').checked = ui.hideDone;
  if (ui.area !== 'all' && !state.areas.some((a) => a.id === ui.area)) ui.area = 'all';
  document.getElementById('project-name').textContent = ui.area === 'all' ? 'Alle Aufträge' : areaName(ui.area);
  renderSidebar();
  if (ui.view === 'list') renderList();
  else renderBoard();
}

function renderBoard() {
  board.replaceChildren();

  state.areas.forEach((area, areaIdx) => {
    const el = areaTpl.content.firstElementChild.cloneNode(true);
    el.dataset.id = area.id;
    el.querySelector('.area-title').textContent = area.name;
    el.classList.toggle('selected', ui.area === area.id);
    el.querySelector('.move-left').disabled = areaIdx === 0;
    el.querySelector('.move-right').disabled = areaIdx === state.areas.length - 1;

    const total = state.tasks.filter((t) => t.area === area.id).length;
    const visible = visibleTasks(area.id);
    el.querySelector('.count').textContent = visible.length === total ? total : `${visible.length}/${total}`;

    const list = el.querySelector('.cards');
    for (const task of visible) {
      const card = cardTpl.content.firstElementChild.cloneNode(true);
      card.dataset.id = task.id;
      card.classList.toggle('done', task.done);
      card.querySelector('.check-btn').title = task.done ? 'Als nicht erledigt markieren' : 'Als erledigt markieren';
      if (task.cover) {
        const img = card.querySelector('.card-cover');
        img.src = task.cover;
        img.hidden = false;
      }
      card.querySelector('.card-title').textContent = task.title;

      const pills = card.querySelector('.pills');
      const gp = groupPill(task);
      if (gp) pills.append(gp);
      if (state.builtins.priority) pills.append(priorityPill(task));
      for (const f of state.fields) {
        const p = f.onCard && fieldPill(f, task.fields[f.id]);
        if (p) pills.append(p);
      }

      if (state.builtins.assignee && task.assignee) card.querySelector('.avatar').replaceWith(avatar(task.assignee));
      const due = state.builtins.due && dueInfo(task);
      if (due) {
        const dueEl = card.querySelector('.due');
        dueEl.textContent = due.text;
        dueEl.className = `due ${due.cls}`.trim();
        dueEl.title = `Fällig am ${formatDate(task.due)}`;
      }
      const st = subtaskInfo(task);
      if (st) card.querySelector('.extras').append(st);
      if (task.description) card.querySelector('.extras').append(Object.assign(span('≡'), { title: 'Hat eine Beschreibung' }));
      card.querySelector('.prev').disabled = areaIdx === 0;
      card.querySelector('.next').disabled = areaIdx === state.areas.length - 1;
      list.append(card);
    }
    board.append(el);
  });
  board.append(addAreaTpl.content.firstElementChild.cloneNode(true));
}

function renderSidebar() {
  const item = (id, label, count) => {
    const b = document.createElement('button');
    b.className = 'side-item';
    b.dataset.area = id;
    b.setAttribute('aria-current', ui.area === id ? 'page' : 'false');
    b.append(span(label, 'side-label'));
    if (count !== null) b.append(span(String(count), 'side-count'));
    return b;
  };
  const open = (id) => state.tasks.filter((t) => (id === 'all' || t.area === id) && !t.done).length;
  sidebar.replaceChildren(
    item('all', 'Übersicht', open('all')),
    span('Bereiche', 'side-heading'),
    ...state.areas.map((a) => item(a.id, a.name, open(a.id))),
  );
}

// Spalten der Listenansicht: Standardfelder (sofern eingeblendet) und eigene Felder
function listColumns() {
  const cols = [{ key: 'title', name: 'Name' }];
  if (ui.area === 'all' && state.groups.length) cols.push({ key: 'group', name: 'Gruppe' });
  if (state.builtins.assignee) cols.push({ key: 'assignee', name: 'Zuständig' });
  if (state.builtins.due) cols.push({ key: 'due', name: 'Fälligkeit' });
  if (state.builtins.priority) cols.push({ key: 'priority', name: 'Priorität' });
  for (const f of state.fields) cols.push({ key: f.id, name: f.name, field: f });
  return cols;
}

function sortValue(task, key) {
  if (key === 'title') return task.title.toLowerCase();
  if (key === 'group') return groupName(task.group).toLowerCase();
  if (key === 'priority') return { hoch: 0, normal: 1, niedrig: 2 }[task.priority] ?? 1;
  if (key === 'assignee' || key === 'due') return task[key] || null;
  const f = state.fields.find((x) => x.id === key);
  const v = task.fields[key];
  if (v === undefined || v === '' || v === false) return null;
  if (f?.type === 'select') return f.options.indexOf(v);
  return typeof v === 'string' ? v.toLowerCase() : Number(v);
}

function sortTasks(tasks) {
  if (!ui.sort) return tasks;
  const { key, dir } = ui.sort;
  return tasks.slice().sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va === vb) return 0;
    if (va === null) return 1; // leere Werte immer ans Ende
    if (vb === null) return -1;
    return (va < vb ? -1 : 1) * dir;
  });
}

function renderList() {
  const cols = listColumns();
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const c of cols) {
    const th = document.createElement('th');
    const b = document.createElement('button');
    b.className = 'sort-btn';
    b.dataset.sort = c.key;
    b.textContent = c.name;
    if (ui.sort?.key === c.key) b.append(span(ui.sort.dir > 0 ? ' ↑' : ' ↓', 'sort-arrow'));
    b.title = 'Sortieren';
    th.append(b);
    if (c.field?.type === 'number') th.className = 'num';
    head.append(th);
  }
  const body = table.createTBody();

  // Abschnitte: in der Übersicht die Bereiche, in einem Bereich die Gruppen
  let sections;
  if (ui.area === 'all') {
    sections = state.areas.map((a) => ({ key: `a:${a.id}`, name: a.name, area: a.id, group: '', tasks: visibleTasks(a.id) }));
  } else {
    const tasks = visibleTasks(ui.area);
    sections = state.groups.map((g) => ({ key: `g:${g.id}`, name: g.name, area: ui.area, group: g.id, tasks: tasks.filter((t) => t.group === g.id) }));
    const rest = tasks.filter((t) => !state.groups.some((g) => g.id === t.group));
    if (rest.length || !sections.length) sections.push({ key: 'g:', name: sections.length ? 'Ohne Gruppe' : 'Aufträge', area: ui.area, group: '', tasks: rest });
  }

  for (const sec of sections) {
    const collapsed = ui.collapsed.includes(sec.key);
    const secRow = body.insertRow();
    secRow.className = 'section';
    secRow.dataset.key = sec.key;
    const secCell = secRow.insertCell();
    secCell.colSpan = cols.length;
    const toggle = document.createElement('button');
    toggle.className = 'section-toggle';
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.append(span(collapsed ? '▸' : '▾', 'caret'), span(sec.name), span(String(sec.tasks.length), 'count'));
    secCell.append(toggle);
    if (collapsed) continue;

    for (const task of sortTasks(sec.tasks)) body.append(taskRow(task, cols));

    const add = body.insertRow();
    add.className = 'add-row';
    add.dataset.area = sec.area;
    add.dataset.group = sec.group;
    for (const c of cols) {
      const cell = add.insertCell();
      if (c.key === 'title') cell.textContent = '+ Auftrag hinzufügen';
      if (c.field?.type === 'number') {
        const sum = sec.tasks.reduce((acc, t) => acc + (Number(t.fields[c.key]) || 0), 0);
        cell.className = 'num sum';
        cell.append(span('Summe ', 'sum-label'), sum.toLocaleString('de-DE'));
      }
    }
  }
  listView.replaceChildren(table);
}

function taskRow(task, cols) {
  const row = document.createElement('tr');
  row.className = 'task-row';
  row.classList.toggle('done', task.done);
  row.dataset.id = task.id;
  const areaIdx = state.areas.findIndex((a) => a.id === task.area);
  const next = state.areas[areaIdx + 1];

  for (const c of cols) {
    const cell = row.insertCell();
    if (c.key === 'title') {
      const name = document.createElement('div');
      name.className = 'name-cell';
      const check = document.createElement('button');
      check.className = 'check-btn';
      check.setAttribute('aria-label', 'Erledigt');
      name.append(check, span(task.title, 'task-name'));
      const st = subtaskInfo(task);
      if (st) name.append(st);
      if (ui.area === 'all') name.append(span(areaName(task.area), 'area-tag'));
      if (next) {
        const go = document.createElement('button');
        go.className = 'next-btn';
        go.title = `In „${next.name}“ verschieben`;
        go.textContent = `→ ${next.name}`;
        name.append(go);
      }
      cell.append(name);
    } else if (c.key === 'group') {
      const gp = groupPill(task);
      if (gp) cell.append(gp);
    } else if (c.key === 'assignee') {
      if (task.assignee) {
        const person = span('', 'person');
        person.append(avatar(task.assignee), task.assignee);
        cell.append(person);
      }
    } else if (c.key === 'due') {
      const due = dueInfo(task);
      if (due) cell.append(span(due.text, `due ${due.cls}`.trim()));
    } else if (c.key === 'priority') {
      cell.append(priorityPill(task));
    } else {
      const f = c.field;
      const v = task.fields[f.id];
      if (f.type === 'number') cell.className = 'num';
      if (f.type === 'url' && v) {
        const a = document.createElement('a');
        a.href = v;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = v;
        cell.append(a);
      } else if (f.type === 'checkbox') {
        if (v) cell.append(pill('Ja', 'green', f.name));
      } else {
        const p = fieldPill(f, v);
        if (p) cell.append(f.type === 'select' ? p : displayValue(f, v));
      }
    }
  }
  return row;
}

function displayValue(field, value) {
  if (field.type === 'date') return formatDate(value);
  if (field.type === 'checkbox') return value ? 'Ja' : '';
  if (field.type === 'number') return Number(value).toLocaleString('de-DE');
  return String(value);
}

function searchText(task) {
  const custom = state.fields.map((f) => task.fields[f.id]).filter((v) => typeof v === 'string' || typeof v === 'number');
  return [task.title, task.description, task.assignee, groupName(task.group), ...task.subtasks.map((st) => st.title), ...custom]
    .join(' ').toLowerCase();
}

function span(text, cls = '') {
  const s = document.createElement('span');
  s.textContent = text;
  if (cls) s.className = cls;
  return s;
}

// ---------- Dialog ----------

function openTask(taskId, areaId, groupId) {
  editingTaskId = taskId;
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;
  document.getElementById('task-dialog-title').textContent = task ? 'Auftrag bearbeiten' : 'Neuer Auftrag';
  pendingCover = task?.cover ?? '';
  pendingDone = task?.done ?? false;
  updateCoverPreview();
  updateDoneButton();
  form.area.replaceChildren(...state.areas.map((a) => new Option(a.name, a.id)));
  form.title.value = task?.title ?? '';
  form.description.value = task?.description ?? '';
  form.assignee.value = task?.assignee ?? '';
  form.due.value = task?.due ?? '';
  form.priority.value = task?.priority ?? 'normal';
  form.area.value = task?.area ?? areaId ?? (ui.area !== 'all' ? ui.area : state.areas[0].id);
  form.group.replaceChildren(new Option('–', ''), ...state.groups.map((g) => new Option(g.name, g.id)));
  form.group.value = task?.group ?? groupId ?? '';
  document.getElementById('group-label').hidden = !state.groups.length;
  for (const el of form.querySelectorAll('[data-builtin]')) el.hidden = !state.builtins[el.dataset.builtin];
  pendingSubtasks = structuredClone(task?.subtasks ?? []);
  renderSubtasks();
  renderCustomInputs(task?.fields ?? {});
  document.getElementById('delete-task').hidden = !task;
  const historyBox = document.getElementById('history-box');
  historyBox.hidden = !task;
  historyBox.open = false;
  document.getElementById('history').replaceChildren(
    ...(task?.history ?? []).slice().reverse().map((h) => {
      const li = document.createElement('li');
      li.textContent = `${new Date(h.at).toLocaleString('de-DE')} – ${h.text}`;
      return li;
    }),
  );
  dialog.showModal();
  form.title.focus();
}

function renderSubtasks() {
  const list = document.getElementById('subtask-list');
  list.replaceChildren(...pendingSubtasks.map((st) => {
    const li = document.createElement('li');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = st.done;
    box.setAttribute('aria-label', 'Erledigt');
    box.addEventListener('change', () => { st.done = box.checked; });
    const text = document.createElement('input');
    text.value = st.title;
    text.maxLength = 200;
    text.setAttribute('aria-label', 'Unteraufgabe');
    text.addEventListener('change', () => { st.title = text.value.trim() || st.title; text.value = st.title; });
    const del = iconButton('×', 'Unteraufgabe löschen', false, () => {
      pendingSubtasks = pendingSubtasks.filter((x) => x !== st);
      renderSubtasks();
    });
    li.append(box, text, del);
    return li;
  }));
}

document.getElementById('subtask-new').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const title = e.target.value.trim();
  if (!title) return;
  pendingSubtasks.push({ id: uid('s'), title, done: false });
  e.target.value = '';
  renderSubtasks();
});

function updateCoverPreview() {
  const img = document.getElementById('cover-preview');
  img.hidden = !pendingCover;
  if (pendingCover) img.src = pendingCover;
  else img.removeAttribute('src');
  document.getElementById('cover-remove').hidden = !pendingCover;
}

function updateDoneButton() {
  const btn = document.getElementById('toggle-done');
  btn.classList.toggle('is-done', pendingDone);
  btn.textContent = pendingDone ? '✓ Erledigt' : '✓ Als erledigt markieren';
}

// Bild verkleinern, damit es in den Browser-Speicher passt
function readImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 800 / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
    img.src = URL.createObjectURL(file);
  });
}

document.getElementById('cover-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    pendingCover = await readImage(file);
    updateCoverPreview();
  } catch (err) {
    notify(err.message);
  }
});
document.getElementById('cover-remove').addEventListener('click', () => { pendingCover = ''; updateCoverPreview(); });
document.getElementById('toggle-done').addEventListener('click', () => { pendingDone = !pendingDone; updateDoneButton(); });

function renderCustomInputs(values) {
  const box = document.getElementById('custom-fields');
  box.replaceChildren(...state.fields.map((f) => {
    const label = document.createElement('label');
    let input;
    if (f.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 3;
    } else if (f.type === 'select') {
      input = document.createElement('select');
      input.append(new Option('–', ''), ...f.options.map((o) => new Option(o, o)));
    } else {
      input = document.createElement('input');
      input.type = f.type;
      if (f.type === 'number') input.step = 'any';
    }
    input.dataset.field = f.id;
    const v = values[f.id];
    if (f.type === 'checkbox') {
      input.checked = !!v;
      label.className = 'check';
      label.append(input, f.name);
    } else {
      // Ein gespeicherter Auswahlwert, den es nicht mehr gibt, bleibt erhalten
      if (f.type === 'select' && v && !f.options.includes(v)) input.append(new Option(v, v));
      input.value = v ?? '';
      label.append(f.name, input);
    }
    return label;
  }));
}

function readCustomInputs() {
  const values = {};
  for (const input of document.querySelectorAll('#custom-fields [data-field]')) {
    const f = state.fields.find((x) => x.id === input.dataset.field);
    if (!f) continue;
    if (f.type === 'checkbox') values[f.id] = input.checked;
    else if (f.type === 'number') values[f.id] = input.value === '' ? '' : Number(input.value);
    else values[f.id] = input.value.trim();
  }
  return values;
}

form.addEventListener('submit', () => {
  const data = {
    title: form.title.value.trim(),
    description: form.description.value.trim(),
    assignee: form.assignee.value.trim(),
    due: form.due.value,
    priority: form.priority.value,
    fields: readCustomInputs(),
    cover: pendingCover,
    group: form.group.value,
    subtasks: pendingSubtasks,
  };
  if (!data.title) return;
  const area = form.area.value;
  if (editingTaskId) {
    const task = state.tasks.find((t) => t.id === editingTaskId);
    if (task.done !== pendingDone) task.history.push({ at: Date.now(), text: pendingDone ? 'Als erledigt markiert' : 'Wieder geöffnet' });
    Object.assign(task, data, { done: pendingDone });
    if (task.area !== area) { moveTask(task.id, area); return; }
  } else {
    state.tasks.push({ id: uid('t'), area, ...data, done: pendingDone, history: [{ at: Date.now(), text: `Erstellt in „${areaName(area)}“` }] });
  }
  save();
  render();
});

document.getElementById('cancel-task').addEventListener('click', () => dialog.close());
document.getElementById('delete-task').addEventListener('click', async () => {
  if (!await ask('Diesen Auftrag wirklich löschen?')) return;
  state.tasks = state.tasks.filter((t) => t.id !== editingTaskId);
  save();
  render();
  dialog.close();
});

// ---------- Ereignisse ----------

board.addEventListener('click', (e) => {
  const areaEl = e.target.closest('.area');
  const card = e.target.closest('.card');
  if (e.target.closest('.check-btn')) return toggleDone(card.dataset.id);
  if (e.target.closest('.next')) return stepTask(card.dataset.id, 1);
  if (e.target.closest('.prev')) return stepTask(card.dataset.id, -1);
  if (card) return openTask(card.dataset.id);
  if (e.target.closest('.add-task')) return openTask(null, areaEl.dataset.id);
  if (e.target.closest('.delete-area')) return deleteArea(areaEl.dataset.id);
  if (e.target.closest('.move-left')) return shiftArea(areaEl.dataset.id, -1);
  if (e.target.closest('.move-right')) return shiftArea(areaEl.dataset.id, 1);
  if (e.target.closest('.insert-area')) return startRename(addArea('Neuer Bereich', areaEl.dataset.id).id);
});

board.addEventListener('submit', (e) => {
  if (!e.target.classList.contains('add-area-form')) return;
  e.preventDefault();
  const name = e.target.name.value.trim();
  if (!name) return;
  addArea(name);
  board.querySelector('.add-area-col input').focus();
});

board.addEventListener('keydown', (e) => {
  const card = e.target.closest('.card');
  if (!card || e.target !== card) return;
  if (e.key === 'Enter') openTask(card.dataset.id);
  if (e.key === 'ArrowRight' && e.shiftKey) stepTask(card.dataset.id, 1);
  if (e.key === 'ArrowLeft' && e.shiftKey) stepTask(card.dataset.id, -1);
});

// Bereich umbenennen per Doppelklick
board.addEventListener('dblclick', (e) => {
  const title = e.target.closest('.area-title');
  if (title) startRename(title.closest('.area').dataset.id);
});

board.addEventListener('keydown', (e) => {
  if (e.target.classList.contains('area-title') && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  if (e.target.classList.contains('area-title') && e.key === 'Escape') { e.target.textContent = areaName(editingAreaId); e.target.blur(); }
});

board.addEventListener('focusout', (e) => {
  if (!e.target.classList.contains('area-title') || !editingAreaId) return;
  const area = state.areas.find((a) => a.id === editingAreaId);
  const name = e.target.textContent.trim();
  if (area && name) area.name = name;
  editingAreaId = null;
  save();
  render();
});

// Drag & Drop
let draggedId = null;

board.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  draggedId = card.dataset.id;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedId);
});

board.addEventListener('dragend', () => {
  draggedId = null;
  board.querySelectorAll('.dragging, .drag-over').forEach((el) => el.classList.remove('dragging', 'drag-over'));
});

board.addEventListener('dragover', (e) => {
  const list = e.target.closest('.area')?.querySelector('.cards');
  if (!list || !draggedId) return;
  e.preventDefault();
  board.querySelectorAll('.drag-over').forEach((el) => el !== list && el.classList.remove('drag-over'));
  list.classList.add('drag-over');
});

board.addEventListener('drop', (e) => {
  const areaEl = e.target.closest('.area:not(.add-area-col)');
  if (!areaEl || !draggedId) return;
  e.preventDefault();
  // Karte vor der Karte einfügen, über deren obere Hälfte gezogen wurde
  const cards = [...areaEl.querySelectorAll('.card:not(.dragging)')];
  const before = cards.find((c) => {
    const r = c.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2;
  });
  moveTask(draggedId, areaEl.dataset.id, before?.dataset.id ?? null);
});

listView.addEventListener('click', (e) => {
  const sortBtn = e.target.closest('.sort-btn');
  if (sortBtn) {
    // Klickfolge: aufsteigend → absteigend → unsortiert
    const key = sortBtn.dataset.sort;
    if (ui.sort?.key !== key) ui.sort = { key, dir: 1 };
    else if (ui.sort.dir === 1) ui.sort.dir = -1;
    else ui.sort = null;
    saveUi();
    return render();
  }
  const section = e.target.closest('.section-toggle');
  if (section) {
    const key = section.closest('tr').dataset.key;
    ui.collapsed = ui.collapsed.includes(key) ? ui.collapsed.filter((k) => k !== key) : [...ui.collapsed, key];
    saveUi();
    return render();
  }
  const row = e.target.closest('.task-row');
  if (row && e.target.closest('.next-btn')) return stepTask(row.dataset.id, 1);
  if (row && e.target.closest('.check-btn')) return toggleDone(row.dataset.id);
  if (row && !e.target.closest('a')) return openTask(row.dataset.id);
  const add = e.target.closest('.add-row');
  if (add) openTask(null, add.dataset.area, add.dataset.group);
});

sidebar.addEventListener('click', (e) => {
  const item = e.target.closest('.side-item');
  if (!item) return;
  ui.area = item.dataset.area;
  if (ui.area !== 'all') ui.view = 'list';
  saveUi();
  render();
});

// Kopf- und Werkzeugleiste
search.addEventListener('input', render);
for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => { ui.view = tab.dataset.view; saveUi(); render(); });
}
document.getElementById('hide-done').addEventListener('change', (e) => { ui.hideDone = e.target.checked; saveUi(); render(); });
document.getElementById('create').addEventListener('click', () => openTask(null));
document.getElementById('add-task-top').addEventListener('click', () => openTask(null));
document.getElementById('load-examples').addEventListener('click', async () => {
  if (!await ask('Beispielaufträge laden? Das aktuelle Board wird dabei ersetzt (vorher ggf. exportieren).')) return;
  state = exampleState();
  save();
  render();
});
document.getElementById('add-area').addEventListener('click', () => {
  if (ui.view !== 'board') { ui.view = 'board'; saveUi(); render(); }
  const input = board.querySelector('.add-area-col input');
  input.scrollIntoView({ block: 'nearest', inline: 'end' });
  input.focus();
});

// ---------- Eigene Felder verwalten ----------

function renderFieldList() {
  const list = document.getElementById('field-list');
  list.replaceChildren(...state.fields.map((f, i) => {
    const li = document.createElement('li');
    li.className = 'field-item';
    li.dataset.id = f.id;

    const name = document.createElement('input');
    name.className = 'field-name';
    name.value = f.name;
    name.maxLength = 60;
    name.setAttribute('aria-label', 'Feldname');
    name.addEventListener('change', () => {
      if (name.value.trim()) f.name = name.value.trim();
      else name.value = f.name;
      save(); render();
    });

    const type = span(FIELD_TYPES[f.type], 'field-type');

    const onCard = document.createElement('input');
    onCard.type = 'checkbox';
    onCard.checked = f.onCard;
    onCard.addEventListener('change', () => { f.onCard = onCard.checked; save(); render(); });
    const onCardLabel = document.createElement('label');
    onCardLabel.className = 'check';
    onCardLabel.append(onCard, 'Karte');

    const up = iconButton('↑', 'Nach oben', i === 0, () => moveField(i, -1));
    const down = iconButton('↓', 'Nach unten', i === state.fields.length - 1, () => moveField(i, 1));
    const del = iconButton('×', 'Feld löschen', false, async () => {
      if (!await ask(`Feld „${f.name}“ und alle eingetragenen Werte löschen?`)) return;
      state.fields = state.fields.filter((x) => x.id !== f.id);
      for (const t of state.tasks) delete t.fields[f.id];
      save(); render(); renderFieldList();
    });

    li.append(name, type, onCardLabel, up, down, del);

    if (f.type === 'select') {
      const opts = document.createElement('input');
      opts.className = 'field-options';
      opts.value = f.options.join(', ');
      opts.placeholder = 'Auswahlwerte, mit Komma getrennt';
      opts.setAttribute('aria-label', 'Auswahlwerte');
      opts.addEventListener('change', () => { f.options = parseOptions(opts.value); save(); });
      li.append(opts);
    }
    return li;
  }));
}

function iconButton(text, title, disabled, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-btn';
  b.textContent = text;
  b.title = title;
  b.disabled = disabled;
  b.addEventListener('click', onClick);
  return b;
}

function moveField(i, dir) {
  [state.fields[i], state.fields[i + dir]] = [state.fields[i + dir], state.fields[i]];
  save(); render(); renderFieldList();
}

function parseOptions(text) {
  return [...new Set(text.split(',').map((o) => o.trim()).filter(Boolean))];
}

function renderGroupList() {
  document.getElementById('group-list').replaceChildren(...state.groups.map((g, i) => {
    const li = document.createElement('li');
    li.className = 'field-item';
    const name = document.createElement('input');
    name.className = 'field-name';
    name.value = g.name;
    name.maxLength = 40;
    name.setAttribute('aria-label', 'Gruppenname');
    name.addEventListener('change', () => {
      if (name.value.trim()) g.name = name.value.trim();
      else name.value = g.name;
      save(); render();
    });
    const count = state.tasks.filter((t) => t.group === g.id).length;
    li.append(
      name,
      span(`${count} Aufträge`, 'field-type'),
      iconButton('↑', 'Nach oben', i === 0, () => moveGroup(i, -1)),
      iconButton('↓', 'Nach unten', i === state.groups.length - 1, () => moveGroup(i, 1)),
      iconButton('×', 'Gruppe löschen', false, async () => {
        if (!await ask(`Gruppe „${g.name}“ löschen? Die Aufträge bleiben erhalten und sind danach ohne Gruppe.`)) return;
        state.groups = state.groups.filter((x) => x.id !== g.id);
        for (const t of state.tasks) if (t.group === g.id) t.group = '';
        save(); render(); renderGroupList();
      }),
    );
    return li;
  }));
}

function moveGroup(i, dir) {
  [state.groups[i], state.groups[i + dir]] = [state.groups[i + dir], state.groups[i]];
  save(); render(); renderGroupList();
}

document.getElementById('group-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = e.target.name.value.trim();
  if (!name) return;
  state.groups.push({ id: uid('g'), name });
  e.target.reset();
  save(); render(); renderGroupList();
});

for (const key of ['assignee', 'due', 'priority']) {
  document.getElementById(`bi-${key}`).addEventListener('change', (e) => {
    state.builtins[key] = e.target.checked;
    if (!e.target.checked && ui.sort?.key === key) { ui.sort = null; saveUi(); }
    save(); render();
  });
}

document.getElementById('manage-fields').addEventListener('click', () => {
  for (const key of ['assignee', 'due', 'priority']) document.getElementById(`bi-${key}`).checked = state.builtins[key];
  renderGroupList();
  renderFieldList();
  fieldsDialog.showModal();
});
document.getElementById('close-fields').addEventListener('click', () => fieldsDialog.close());

fieldForm.type.addEventListener('change', () => {
  fieldForm.querySelector('.options-label').hidden = fieldForm.type.value !== 'select';
});

fieldForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = fieldForm.name.value.trim();
  if (!name) return;
  const field = { id: uid('f'), name, type: fieldForm.type.value, onCard: fieldForm.onCard.checked };
  if (field.type === 'select') {
    field.options = parseOptions(fieldForm.options.value);
    if (!field.options.length) { notify('Bitte mindestens einen Auswahlwert angeben.'); return; }
  }
  state.fields.push(field);
  save(); render(); renderFieldList();
  fieldForm.reset();
  fieldForm.querySelector('.options-label').hidden = true;
  fieldForm.name.focus();
});

const exportDialog = document.getElementById('export-dialog');
const exportText = document.getElementById('export-text');

document.getElementById('export').addEventListener('click', () => {
  exportText.value = JSON.stringify(state, null, 2);
  document.getElementById('export-status').textContent = '';
  exportDialog.showModal();
});

document.getElementById('export-copy').addEventListener('click', async () => {
  const status = document.getElementById('export-status');
  try {
    await navigator.clipboard.writeText(exportText.value);
    status.textContent = 'Kopiert. Füge den Text in eine Datei mit der Endung .json ein.';
  } catch (e) {
    exportText.select();
    status.textContent = 'Text ist markiert – mit Strg+C (bzw. ⌘+C) kopieren.';
  }
});

document.getElementById('export-download')?.addEventListener('click', () => {
  const blob = new Blob([exportText.value], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `auftraege-${isoDate(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
document.getElementById('export-close').addEventListener('click', () => exportDialog.close());

document.getElementById('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.areas) || !Array.isArray(data.tasks)) throw new Error('Ungültiges Format');
    if (!await ask('Aktuelles Board durch die Datei ersetzen?')) return;
    state = normalize(data);
    save();
    render();
  } catch (err) {
    notify('Import fehlgeschlagen: ' + err.message);
  }
});

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) { state = load(); render(); }
});

render();
