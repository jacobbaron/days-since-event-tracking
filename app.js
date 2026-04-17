const STORAGE_KEY = "days-since-items-v1";
const MS_PER_DAY = 86_400_000;

const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const addBtn = document.getElementById("add-btn");
const dialog = document.getElementById("edit-dialog");
const form = document.getElementById("edit-form");
const nameInput = document.getElementById("edit-name");
const intervalInput = document.getElementById("edit-interval");
const titleEl = document.getElementById("edit-title");
const deleteBtn = document.getElementById("edit-delete");
const cancelBtn = document.getElementById("edit-cancel");

let items = load();
let editingId = null;
let confirmingId = null;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function daysSince(iso) {
  const start = new Date(iso);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today - start) / MS_PER_DAY);
}

function statusFor(days, interval) {
  const ratio = days / interval;
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "soon";
  return "ok";
}

function render() {
  listEl.innerHTML = "";
  emptyEl.hidden = items.length > 0;

  for (const item of items) {
    const days = daysSince(item.lastResetAt);
    const status = statusFor(days, item.intervalDays);

    const li = document.createElement("li");
    li.className = `card status-${status}`;
    li.dataset.id = item.id;

    const nameHtml = escapeHtml(item.name);
    const unit = days === 1 ? "day" : "days";
    const metaText = `every ${item.intervalDays} ${item.intervalDays === 1 ? "day" : "days"}`;

    li.innerHTML = `
      <h2 class="card-name">${nameHtml}</h2>
      <p class="card-meta">${metaText}</p>
      <div class="card-number">${days}<span class="unit">${unit} since</span></div>
    `;

    if (confirmingId === item.id) {
      const confirmRow = document.createElement("div");
      confirmRow.className = "card-confirm";
      confirmRow.innerHTML = `
        <button type="button" class="confirm-yes">Reset to 0</button>
        <button type="button" class="confirm-no">Cancel</button>
        <button type="button" class="edit-btn" aria-label="Edit">Edit</button>
      `;
      li.appendChild(confirmRow);

      confirmRow.querySelector(".confirm-yes").addEventListener("click", (e) => {
        e.stopPropagation();
        resetItem(item.id);
      });
      confirmRow.querySelector(".confirm-no").addEventListener("click", (e) => {
        e.stopPropagation();
        confirmingId = null;
        render();
      });
      confirmRow.querySelector(".edit-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        confirmingId = null;
        openEdit(item.id);
      });
    }

    li.addEventListener("click", () => {
      if (confirmingId === item.id) return;
      confirmingId = item.id;
      render();
    });

    listEl.appendChild(li);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function resetItem(id) {
  const item = items.find((x) => x.id === id);
  if (!item) return;
  item.lastResetAt = new Date().toISOString();
  confirmingId = null;
  save();
  render();
}

function openEdit(id) {
  editingId = id;
  if (id) {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    titleEl.textContent = "Edit tracker";
    nameInput.value = item.name;
    intervalInput.value = item.intervalDays;
    deleteBtn.hidden = false;
  } else {
    titleEl.textContent = "New tracker";
    nameInput.value = "";
    intervalInput.value = "7";
    deleteBtn.hidden = true;
  }
  dialog.showModal();
  setTimeout(() => nameInput.focus(), 50);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const interval = parseInt(intervalInput.value, 10);
  if (!name || !Number.isFinite(interval) || interval < 1) return;

  if (editingId) {
    const item = items.find((x) => x.id === editingId);
    if (item) {
      item.name = name;
      item.intervalDays = interval;
    }
  } else {
    items.push({
      id: crypto.randomUUID(),
      name,
      intervalDays: interval,
      lastResetAt: new Date().toISOString(),
    });
  }
  editingId = null;
  save();
  dialog.close();
  render();
});

cancelBtn.addEventListener("click", () => {
  editingId = null;
  dialog.close();
});

deleteBtn.addEventListener("click", () => {
  if (!editingId) return;
  if (!confirm("Delete this tracker?")) return;
  items = items.filter((x) => x.id !== editingId);
  editingId = null;
  save();
  dialog.close();
  render();
});

addBtn.addEventListener("click", () => openEdit(null));

document.addEventListener("click", (e) => {
  if (confirmingId && !e.target.closest(".card")) {
    confirmingId = null;
    render();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

render();
