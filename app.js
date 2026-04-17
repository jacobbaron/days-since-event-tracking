import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://mpxubmgrrfobnjajidbk.supabase.co";
const SUPABASE_KEY = "sb_publishable_iAcTeCamuwnVnbhKdudE5Q_5lhvV9Vv";
const CACHE_PREFIX = "days-since-cache-v2:";
const MS_PER_DAY = 86_400_000;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const authView    = document.getElementById("auth-view");
const appView     = document.getElementById("app-view");
const loadingView = document.getElementById("loading-view");
const listEl      = document.getElementById("list");
const emptyEl     = document.getElementById("empty");
const addBtn      = document.getElementById("add-btn");
const dialog      = document.getElementById("edit-dialog");
const form        = document.getElementById("edit-form");
const nameInput   = document.getElementById("edit-name");
const intervalInput = document.getElementById("edit-interval");
const titleEl     = document.getElementById("edit-title");
const deleteBtn   = document.getElementById("edit-delete");
const cancelBtn   = document.getElementById("edit-cancel");
const signInForm   = document.getElementById("signin-form");
const signInEmail  = document.getElementById("signin-email");
const signInStatus = document.getElementById("signin-status");
const signOutBtn   = document.getElementById("signout-btn");

let items = [];
let editingId = null;
let confirmingId = null;
let session = null;

function loadCache(userId) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + userId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveCache(userId, data) {
  try { localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(data)); } catch {}
}

function daysSince(iso) {
  const start = new Date(iso); start.setHours(0, 0, 0, 0);
  const today = new Date();    today.setHours(0, 0, 0, 0);
  return Math.floor((today - start) / MS_PER_DAY);
}

function statusFor(days, interval) {
  const ratio = days / interval;
  if (ratio >= 1) return "over";
  if (ratio >= 0.8) return "soon";
  return "ok";
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function render() {
  listEl.innerHTML = "";
  emptyEl.hidden = items.length > 0;

  for (const item of items) {
    const days = daysSince(item.last_reset_at);
    const status = statusFor(days, item.interval_days);

    const li = document.createElement("li");
    li.className = `card status-${status}`;
    li.dataset.id = item.id;

    const unit = days === 1 ? "day" : "days";
    const intervalLabel = item.interval_days === 1 ? "day" : "days";

    li.innerHTML = `
      <h2 class="card-name">${escapeHtml(item.name)}</h2>
      <p class="card-meta">every ${item.interval_days} ${intervalLabel}</p>
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
        e.stopPropagation(); resetItem(item.id);
      });
      confirmRow.querySelector(".confirm-no").addEventListener("click", (e) => {
        e.stopPropagation(); confirmingId = null; render();
      });
      confirmRow.querySelector(".edit-btn").addEventListener("click", (e) => {
        e.stopPropagation(); confirmingId = null; openEdit(item.id);
      });
    }

    li.addEventListener("click", () => {
      if (confirmingId === item.id) return;
      confirmingId = item.id; render();
    });

    listEl.appendChild(li);
  }
}

async function fetchItems() {
  if (!session) return;
  const { data, error } = await supabase
    .from("trackers")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) { console.error("fetch failed:", error); return; }
  items = data;
  saveCache(session.user.id, items);
  render();
}

async function resetItem(id) {
  const item = items.find((x) => x.id === id);
  if (!item) return;
  const newDate = new Date().toISOString();
  item.last_reset_at = newDate;
  confirmingId = null;
  saveCache(session.user.id, items);
  render();
  const { error } = await supabase
    .from("trackers")
    .update({ last_reset_at: newDate })
    .eq("id", id);
  if (error) console.error("reset failed:", error);
}

async function createItem(name, interval) {
  const { data, error } = await supabase
    .from("trackers")
    .insert({ name, interval_days: interval, user_id: session.user.id })
    .select()
    .single();
  if (error) { alert("Couldn't create: " + error.message); return; }
  items.push(data);
  saveCache(session.user.id, items);
  render();
}

async function updateItem(id, name, interval) {
  const item = items.find((x) => x.id === id);
  if (!item) return;
  item.name = name;
  item.interval_days = interval;
  saveCache(session.user.id, items);
  render();
  const { error } = await supabase
    .from("trackers")
    .update({ name, interval_days: interval })
    .eq("id", id);
  if (error) console.error("update failed:", error);
}

async function deleteItem(id) {
  items = items.filter((x) => x.id !== id);
  saveCache(session.user.id, items);
  render();
  const { error } = await supabase
    .from("trackers")
    .delete()
    .eq("id", id);
  if (error) console.error("delete failed:", error);
}

function openEdit(id) {
  editingId = id;
  if (id) {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    titleEl.textContent = "Edit tracker";
    nameInput.value = item.name;
    intervalInput.value = item.interval_days;
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
  const id = editingId; editingId = null;
  dialog.close();
  if (id) updateItem(id, name, interval);
  else    createItem(name, interval);
});

cancelBtn.addEventListener("click", () => { editingId = null; dialog.close(); });

deleteBtn.addEventListener("click", () => {
  if (!editingId) return;
  if (!confirm("Delete this tracker?")) return;
  const id = editingId; editingId = null;
  dialog.close();
  deleteItem(id);
});

addBtn.addEventListener("click", () => openEdit(null));

document.addEventListener("click", (e) => {
  if (confirmingId && !e.target.closest(".card")) {
    confirmingId = null; render();
  }
});

signInForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = signInEmail.value.trim();
  if (!email) return;
  signInStatus.textContent = "Sending…";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
  signInStatus.textContent = error
    ? "Error: " + error.message
    : "Check your email for a sign-in link.";
});

signOutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  items = [];
  confirmingId = null;
});

function setSession(newSession) {
  session = newSession;
  loadingView.hidden = true;
  if (session) {
    authView.hidden = true;
    appView.hidden = false;
    addBtn.hidden = false;
    items = loadCache(session.user.id);
    render();
    fetchItems();
  } else {
    authView.hidden = false;
    appView.hidden = true;
    addBtn.hidden = true;
    listEl.innerHTML = "";
  }
}

async function init() {
  const { data: { session: current } } = await supabase.auth.getSession();
  setSession(current);
  supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

init();
