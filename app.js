'use strict';

const STORAGE_KEY = 'auftragsboard-v1';

const DEFAULT_STATE = {
  areas: [
    { id: 'a1', name: 'Eingang' },
    { id: 'a2', name: 'In Bearbeitung' },
    { id: 'a3', name: 'Prüfung' },
    { id: 'a4', name: 'Erledigt' },
  ],
  fields: [],
  tasks: [
    {
      id: 't1', area: 'a1', title: 'Beispielauftrag',
      description: 'Ziehe mich in den nächsten Bereich oder nutze die Pfeile.',
      assignee: '', due: '', priority: 'normal',
      fields: {},
      history: [{ at: Date.now(), text: 'Erstellt in „Eingang“' }],
    },
  ],
};

let state = load();
let editingTaskId = null;
let editingAreaId = null;

const board = document.getElementById('board');
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

// ---------- Persistenz ----------

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.areas) && Array.isArray(parsed.tasks)) return normalize(parsed);
    }
  } catch (e) { /* Speicher nicht verfügbar */ }
  return structuredClone(DEFAULT_STATE);
}

// Ältere Daten (ohne eigene Felder) auf aktuelles Format bringen
function normalize(data) {
  data.fields ??= [];
  for (const t of data.tasks) t.fields ??= {};
  return data;
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignorieren */ }
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

function deleteArea(areaId) {
  const count = state.tasks.filter((t) => t.area === areaId).length;
  if (state.areas.length === 1) { alert('Mindestens ein Bereich muss bestehen bleiben.'); return; }
  const msg = count
    ? `Bereich „${areaName(areaId)}“ und ${count} Auftrag/Aufträge darin löschen?`
    : `Bereich „${areaName(areaId)}“ löschen?`;
  if (!confirm(msg)) return;
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

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function render() {
  const q = search.value.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  board.replaceChildren();

  state.areas.forEach((area, areaIdx) => {
    const el = areaTpl.content.firstElementChild.cloneNode(true);
    el.dataset.id = area.id;
    el.querySelector('.area-title').textContent = area.name;
    el.querySelector('.move-left').disabled = areaIdx === 0;
    el.querySelector('.move-right').disabled = areaIdx === state.areas.length - 1;

    const tasks = state.tasks.filter((t) => t.area === area.id);
    const visible = tasks.filter((t) => !q || searchText(t).includes(q));
    el.querySelector('.count').textContent = q ? `${visible.length}/${tasks.length}` : tasks.length;

    const list = el.querySelector('.cards');
    for (const task of visible) {
      const card = cardTpl.content.firstElementChild.cloneNode(true);
      card.dataset.id = task.id;
      card.dataset.priority = task.priority;
      card.querySelector('.card-title').textContent = task.title;
      const meta = card.querySelector('.card-meta');
      if (task.assignee) meta.append(span(`👤 ${task.assignee}`));
      if (task.due) meta.append(span(`📅 ${formatDate(task.due)}`, task.due < today && areaIdx !== state.areas.length - 1 ? 'overdue' : ''));
      for (const f of state.fields) {
        const v = task.fields[f.id];
        if (!f.onCard || v === undefined || v === '' || v === false) continue;
        meta.append(span(f.type === 'checkbox' ? `✓ ${f.name}` : `${f.name}: ${displayValue(f, v)}`, 'cf-value'));
      }
      if (task.description) meta.append(span('📝'));
      card.querySelector('.prev').disabled = areaIdx === 0;
      card.querySelector('.next').disabled = areaIdx === state.areas.length - 1;
      list.append(card);
    }
    board.append(el);
  });
  board.append(addAreaTpl.content.firstElementChild.cloneNode(true));
}

function displayValue(field, value) {
  if (field.type === 'date') return formatDate(value);
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
  form.area.replaceChildren(...state.areas.map((a) => new Option(a.name, a.id)));
  form.title.value = task?.title ?? '';
  form.description.value = task?.description ?? '';
  form.assignee.value = task?.assignee ?? '';
  form.due.value = task?.due ?? '';
  form.priority.value = task?.priority ?? 'normal';
  form.area.value = task?.area ?? areaId;
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
  };
  if (!data.title) return;
  const area = form.area.value;
  if (editingTaskId) {
    const task = state.tasks.find((t) => t.id === editingTaskId);
    Object.assign(task, data);
    if (task.area !== area) { moveTask(task.id, area); return; }
  } else {
    state.tasks.push({ id: uid('t'), area, ...data, history: [{ at: Date.now(), text: `Erstellt in „${areaName(area)}“` }] });
  }
  save();
  render();
});

document.getElementById('cancel-task').addEventListener('click', () => dialog.close());
document.getElementById('delete-task').addEventListener('click', () => {
  if (!confirm('Diesen Auftrag wirklich löschen?')) return;
  state.tasks = state.tasks.filter((t) => t.id !== editingTaskId);
  save();
  render();
  dialog.close();
});

// ---------- Ereignisse ----------

board.addEventListener('click', (e) => {
  const areaEl = e.target.closest('.area');
  const card = e.target.closest('.card');
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

// Topbar
search.addEventListener('input', render);
document.getElementById('add-area').addEventListener('click', () => {
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
    const del = iconButton('×', 'Feld löschen', false, () => {
      if (!confirm(`Feld „${f.name}“ und alle eingetragenen Werte löschen?`)) return;
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
    if (!field.options.length) { alert('Bitte mindestens einen Auswahlwert angeben.'); return; }
  }
  state.fields.push(field);
  save(); render(); renderFieldList();
  fieldForm.reset();
  fieldForm.querySelector('.options-label').hidden = true;
  fieldForm.name.focus();
});

document.getElementById('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `auftraege-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.areas) || !Array.isArray(data.tasks)) throw new Error('Ungültiges Format');
    if (!confirm('Aktuelles Board durch die Datei ersetzen?')) return;
    state = normalize(data);
    save();
    render();
  } catch (err) {
    alert('Import fehlgeschlagen: ' + err.message);
  }
});

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) { state = load(); render(); }
});

render();
