'use strict';

const STORAGE_KEY = 'auftragsboard-v1';

const UI_KEY = 'auftragsboard-ui';

// Einfache, selbst erzeugte Titelbilder (SVG) für die Beispielaufträge
function illustration(sky, ground, accent) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 280">
    <rect width="600" height="280" fill="${sky}"/>
    <circle cx="470" cy="80" r="38" fill="#fff" opacity=".7"/>
    <path d="M0 210 Q150 150 300 200 T600 190 V280 H0Z" fill="${ground}"/>
    <rect x="150" y="120" width="130" height="100" rx="6" fill="#fff"/>
    <path d="M140 126 L215 70 L290 126Z" fill="${accent}"/>
    <rect x="200" y="170" width="30" height="50" rx="3" fill="${accent}" opacity=".8"/>
    <rect x="165" y="138" width="26" height="22" rx="3" fill="${ground}" opacity=".6"/>
    <rect x="240" y="138" width="26" height="22" rx="3" fill="${ground}" opacity=".6"/>
    <path d="M0 240 Q200 205 380 235 T600 230 V280 H0Z" fill="${accent}" opacity=".35"/>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function exampleState() {
  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return isoDate(d);
  };
  const AREA_NAMES = { a1: 'Eingang', a2: 'In Bearbeitung', a3: 'Prüfung', a4: 'Erledigt' };
  const created = (area) => [{ at: Date.now(), text: `Erstellt in „${area}“` }];
  const task = (id, area, title, extra) => ({
    id, area, title, description: '', assignee: '', due: '', priority: 'normal', done: false, cover: '',
    fields: {}, history: created(AREA_NAMES[area]), ...extra,
  });
  return {
    areas: [
      ...Object.entries(AREA_NAMES).map(([id, name]) => ({ id, name })),
    ],
    fields: [
      { id: 'f1', name: 'Kunde', type: 'text', onCard: true },
      { id: 'f2', name: 'Auftragsart', type: 'select', onCard: true, options: ['Reparatur', 'Wartung', 'Neubau', 'Beratung'] },
      { id: 'f3', name: 'Betrag (€)', type: 'number', onCard: false },
    ],
    tasks: [
      task('t1', 'a1', 'Angebot Badsanierung erstellen', {
        assignee: 'Ben Keller', due: day(1), priority: 'hoch',
        cover: illustration('#d4e2fb', '#9fbcf0', '#4573d2'),
        description: 'Aufmaß liegt vor. Fliesen und Sanitärobjekte kalkulieren.',
        fields: { f1: 'Familie Yilmaz', f2: 'Neubau', f3: 8400 },
      }),
      task('t2', 'a1', 'Heizungswartung Familie Weber', {
        assignee: 'Anna Schmidt', due: day(3), fields: { f1: 'Familie Weber', f2: 'Wartung', f3: 180 },
      }),
      task('t3', 'a1', 'Rückruf Hausverwaltung Nord', { due: day(0), priority: 'niedrig', fields: { f2: 'Beratung' } }),
      task('t4', 'a2', 'Dachrinne reparieren – Lindenstr. 12', {
        assignee: 'Clara Wolf', due: day(-1), priority: 'hoch',
        cover: illustration('#fde8d4', '#f4b38a', '#f06a6a'),
        fields: { f1: 'Hausverwaltung Nord', f2: 'Reparatur', f3: 650 },
      }),
      task('t5', 'a2', 'Material für Baustelle bestellen', { assignee: 'Ben Keller', due: day(5) }),
      task('t6', 'a3', 'Abnahme Küchenmontage', {
        assignee: 'Anna Schmidt', due: day(2),
        cover: illustration('#d9f2e6', '#a3dcc0', '#58a182'),
        fields: { f1: 'Müller GmbH', f2: 'Neubau', f3: 12500 },
      }),
      task('t7', 'a4', 'Rechnung an Müller GmbH senden', {
        assignee: 'Clara Wolf', due: day(-3), done: true, fields: { f1: 'Müller GmbH' },
      }),
    ],
  };
}

let state = load();
let editingTaskId = null;
let editingAreaId = null;
let pendingCover = '';
let pendingDone = false;
let ui = loadUi();

const board = document.getElementById('board');
const listView = document.getElementById('list');
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
  try { return { view: 'board', hideDone: false, ...JSON.parse(localStorage.getItem(UI_KEY)) }; } catch (e) { return { view: 'board', hideDone: false }; }
}

function saveUi() {
  try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* ignorieren */ }
}

// Ältere Daten (ohne eigene Felder) auf aktuelles Format bringen
function normalize(data) {
  data.fields ??= [];
  for (const t of data.tasks) {
    t.fields ??= {};
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
  if (ui.view === 'list') renderList();
  else renderBoard();
}

function renderBoard() {
  board.replaceChildren();

  state.areas.forEach((area, areaIdx) => {
    const el = areaTpl.content.firstElementChild.cloneNode(true);
    el.dataset.id = area.id;
    el.querySelector('.area-title').textContent = area.name;
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
      pills.append(priorityPill(task));
      for (const f of state.fields) {
        const p = f.onCard && fieldPill(f, task.fields[f.id]);
        if (p) pills.append(p);
      }

      if (task.assignee) card.querySelector('.avatar').replaceWith(avatar(task.assignee));
      const due = dueInfo(task);
      if (due) {
        const dueEl = card.querySelector('.due');
        dueEl.textContent = due.text;
        dueEl.className = `due ${due.cls}`.trim();
        dueEl.title = `Fällig am ${formatDate(task.due)}`;
      }
      if (task.description) card.querySelector('.extras').append(Object.assign(span('≡'), { title: 'Hat eine Beschreibung' }));
      card.querySelector('.prev').disabled = areaIdx === 0;
      card.querySelector('.next').disabled = areaIdx === state.areas.length - 1;
      list.append(card);
    }
    board.append(el);
  });
  board.append(addAreaTpl.content.firstElementChild.cloneNode(true));
}

function renderList() {
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const h of ['Name', 'Zuständig', 'Fällig', 'Priorität', ...state.fields.map((f) => f.name)]) {
    const th = document.createElement('th');
    th.textContent = h;
    head.append(th);
  }
  const body = table.createTBody();
  const cols = 4 + state.fields.length;

  for (const area of state.areas) {
    const tasks = visibleTasks(area.id);
    const sec = body.insertRow();
    sec.className = 'section';
    const secCell = sec.insertCell();
    secCell.colSpan = cols;
    secCell.textContent = `${area.name} `;
    secCell.append(span(String(tasks.length), 'count'));

    for (const task of tasks) {
      const row = body.insertRow();
      row.className = 'task-row';
      row.classList.toggle('done', task.done);
      row.dataset.id = task.id;

      const nameCell = row.insertCell();
      const name = document.createElement('div');
      name.className = 'name-cell';
      const check = document.createElement('button');
      check.className = 'check-btn';
      check.setAttribute('aria-label', 'Erledigt');
      name.append(check, span(task.title));
      nameCell.append(name);

      const who = row.insertCell();
      if (task.assignee) {
        const person = span('', 'person');
        person.append(avatar(task.assignee), task.assignee);
        who.append(person);
      }

      const dueCell = row.insertCell();
      const due = dueInfo(task);
      if (due) dueCell.append(span(due.text, `due ${due.cls}`.trim()));

      row.insertCell().append(priorityPill(task));
      for (const f of state.fields) {
        const cell = row.insertCell();
        const v = task.fields[f.id];
        if (f.type === 'url' && v) {
          const a = document.createElement('a');
          a.href = v;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = v;
          cell.append(a);
        } else {
          const p = fieldPill(f, v);
          if (p) cell.append(f.type === 'select' || f.type === 'checkbox' ? p : displayValue(f, v));
        }
      }
    }

    const add = body.insertRow();
    add.className = 'add-row';
    add.dataset.area = area.id;
    const addCell = add.insertCell();
    addCell.colSpan = cols;
    addCell.textContent = '+ Auftrag hinzufügen …';
  }
  listView.replaceChildren(table);
}

function displayValue(field, value) {
  if (field.type === 'date') return formatDate(value);
  if (field.type === 'checkbox') return value ? 'Ja' : '';
  if (field.type === 'number') return Number(value).toLocaleString('de-DE');
  return String(value);
}

function searchText(task) {
  const custom = state.fields.map((f) => task.fields[f.id]).filter((v) => typeof v === 'string' || typeof v === 'number');
  return [task.title, task.description, task.assignee, ...custom].join(' ').toLowerCase();
}

function span(text, cls = '') {
  const s = document.createElement('span');
  s.textContent = text;
  if (cls) s.className = cls;
  return s;
}

// ---------- Dialog ----------

function openTask(taskId, areaId) {
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
  form.area.value = task?.area ?? areaId ?? state.areas[0].id;
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
  const row = e.target.closest('.task-row');
  if (row && e.target.closest('.check-btn')) return toggleDone(row.dataset.id);
  if (row && !e.target.closest('a')) return openTask(row.dataset.id);
  const add = e.target.closest('.add-row');
  if (add) openTask(null, add.dataset.area);
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

document.getElementById('manage-fields').addEventListener('click', () => {
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

document.getElementById('export-download').addEventListener('click', () => {
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
