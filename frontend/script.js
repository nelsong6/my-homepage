import { CONFIG } from './config.js';
import { initAuth, login, logout, getToken, isAuthenticated, getUser } from './auth.js';

// ── DOM references ──────────────────────────────────────────────
const loadingEl = document.getElementById("loading");
const appEl = document.getElementById("app");
const loginBtn = document.getElementById("login-btn");
const loginPicker = document.getElementById("login-picker");
const logoutBtn = document.getElementById("logout-btn");
const tree = document.getElementById("tree");
const editBtn = document.getElementById("edit-btn");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-btn");
const moreBtn = document.getElementById("more-btn");
const apiError = document.getElementById("api-error");

const CACHE_KEY = "cached_bookmarks";
const PLAYGROUND_KEY = "playground_bookmarks";

// ── Edit mode state ─────────────────────────────────────────────
let editMode = false;
let editBookmarks = null;   // deep clone used during editing
let currentBookmarks = [];  // last-fetched/rendered bookmarks
let userAuthenticated = false;
let playgroundMode = false;

const SAMPLE_BOOKMARKS = [
  {
    name: "Getting Started",
    children: [
      { name: "Add your own bookmarks" },
      { name: "Organize into folders" },
      { name: "Log in to save permanently" },
    ],
  },
  {
    name: "Example Links",
    children: [
      { name: "Wikipedia", url: "https://en.wikipedia.org" },
      { name: "Hacker News", url: "https://news.ycombinator.com" },
    ],
  },
];

// ── App entry point ─────────────────────────────────────────────

(async function main() {
  const cached = loadCachedBookmarks();

  // If we have cached data, paint immediately.
  if (cached) {
    loadingEl.classList.add("hidden");
    appEl.classList.remove("hidden");
    currentBookmarks = cached;
    renderBookmarks(cached);
  } else {
    loadingEl.classList.remove("hidden");
  }

  // Synchronous — picks up #token= from URL fragment if present.
  initAuth();

  if (isAuthenticated()) {
    await showApp(cached);
  } else {
    showLogin();
  }
})();

// ── Auth flows ──────────────────────────────────────────────────

function showLogin() {
  userAuthenticated = false;
  playgroundMode = true;
  loadingEl.classList.add("hidden");
  appEl.classList.remove("hidden");
  // Show anonymous profile with placeholder avatar
  document.getElementById("user-email").textContent = "Anonymous";
  const avatar = document.getElementById("user-avatar");
  avatar.src = "https://www.gravatar.com/avatar/?s=48&d=mp";
  avatar.classList.remove("hidden");
  logoutBtn.classList.add("hidden");
  loginBtn.classList.remove("hidden");

  // Hide Apple button on bypass URL (auth.romaine.life unreachable from R1)
  if (CONFIG.isBypass) {
    const appleBtn = document.getElementById("apple-login-btn");
    if (appleBtn) appleBtn.classList.add("hidden");
  }

  // Load playground bookmarks (persisted locally or use samples)
  const saved = loadPlaygroundBookmarks();
  currentBookmarks = saved || deepClone(SAMPLE_BOOKMARKS);
  savePlaygroundBookmarks(currentBookmarks);
  renderBookmarks(currentBookmarks);
}

async function showApp(alreadyRenderedCache) {
  userAuthenticated = true;
  playgroundMode = false;
  loadingEl.classList.add("hidden");
  appEl.classList.remove("hidden");
  loginBtn.classList.add("hidden");
  loginPicker.classList.add("hidden");
  clearPlaygroundBookmarks();
  if (editMode) exitEditMode();

  // Show user info
  const user = getUser();
  const email = user?.email || "";
  document.getElementById("user-email").textContent = email || user?.name || "";
  if (email) {
    const hash = await sha256(email.trim().toLowerCase());
    const avatar = document.getElementById("user-avatar");
    avatar.src = `https://www.gravatar.com/avatar/${hash}?s=48&d=identicon`;
    avatar.classList.remove("hidden");
  }

  // Fetch fresh bookmarks from API (background revalidation)
  const fresh = await fetchBookmarks();

  // Only re-render if the data actually changed (or if we had no cache)
  if (!alreadyRenderedCache || !bookmarksEqual(alreadyRenderedCache, fresh)) {
    saveCachedBookmarks(fresh);
    currentBookmarks = fresh;
    renderBookmarks(fresh);
  }

}

function showApiError(msg) {
  apiError.textContent = msg;
  apiError.classList.remove("hidden");
}

function hideApiError() {
  apiError.classList.add("hidden");
}

// ── localStorage helpers ────────────────────────────────────────

function loadCachedBookmarks() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveCachedBookmarks(bookmarks) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(bookmarks));
  } catch {
    // Storage full or unavailable — non-critical
  }
}

function bookmarksEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── Playground localStorage helpers ──────────────────────────────

function loadPlaygroundBookmarks() {
  try {
    const raw = localStorage.getItem(PLAYGROUND_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function savePlaygroundBookmarks(bookmarks) {
  try {
    localStorage.setItem(PLAYGROUND_KEY, JSON.stringify(bookmarks));
  } catch { /* non-critical */ }
}

function clearPlaygroundBookmarks() {
  try { localStorage.removeItem(PLAYGROUND_KEY); } catch { /* non-critical */ }
}

// ── API ─────────────────────────────────────────────────────────

async function fetchBookmarks() {
  try {
    const token = getToken();
    const res = await fetch(`${CONFIG.apiUrl}/api/bookmarks`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    hideApiError();
    return data.bookmarks || [];
  } catch (err) {
    console.error("Failed to fetch bookmarks:", err);
    showApiError(`Could not reach the API (${err.message})`);
    // On network failure, return whatever we have cached
    return loadCachedBookmarks() || [];
  }
}

async function putBookmarks(bookmarks) {
  const token = getToken();
  const res = await fetch(`${CONFIG.apiUrl}/api/bookmarks`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bookmarks }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ── SHA-256 helper (for Gravatar) ────────────────────────────────

async function sha256(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Deep clone helper ───────────────────────────────────────────

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ── Rendering ───────────────────────────────────────────────────

function renderBookmarks(bookmarks) {
  tree.innerHTML = "";

  if (bookmarks.length === 0 && !editMode) {
    const msg = document.createElement("div");
    msg.className = "empty-state";
    msg.textContent = 'No bookmarks yet. Click "Edit" to add some.';
    tree.appendChild(msg);
    return;
  }

  if (!editMode) {
    tree.style.setProperty(
      "--url-left",
      Math.ceil(calcMaxRowWidth(bookmarks, "")) + 2 + "ch"
    );
  }

  tree.appendChild(renderList(bookmarks, "", bookmarks));

  if (editMode) {
    if (bookmarks.length === 0) {
      const hint = document.createElement("div");
      hint.className = "empty-state";
      hint.textContent = "Add your first bookmark below.";
      tree.appendChild(hint);
    }
    const addBtn = document.createElement("button");
    addBtn.className = "add-root-btn";
    addBtn.textContent = "+ Add bookmark";
    addBtn.addEventListener("click", () => {
      addNode(bookmarks, bookmarks.length);
    });
    tree.appendChild(addBtn);
  }
}

// Calculate the max visual width of all tree rows (in ch units) so
// hover-revealed URLs can be aligned in a single consistent column.
function calcMaxRowWidth(items, prefix) {
  let max = 0;
  items.forEach((item, i) => {
    const isLast = i === items.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
    // prefix+connector chars + toggle/spacer (1ch + 0.6ch gap) + name + arrow if link
    const width = (prefix + connector).length + 1.6 + item.name.length + (item.url ? 1.15 : 0);
    if (width > max) max = width;
    if (hasChildren) {
      const childMax = calcMaxRowWidth(item.children, childPrefix);
      if (childMax > max) max = childMax;
    }
  });
  return max;
}

// Build DOM for a list of sibling nodes.
// `prefix` is the inherited string of "│   " / "    " segments from ancestors.
// `parentArray` is the array containing these items (needed for edit mutations).
function renderList(items, prefix, parentArray) {
  const frag = document.createDocumentFragment();
  items.forEach((item, i) => {
    const isLast = i === items.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = prefix + (isLast ? "    " : "│   ");
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;

    // Row
    const row = document.createElement("div");
    row.className = "node";

    // Prefix (inherited tree lines)
    const pre = document.createElement("span");
    pre.className = "node-prefix";
    pre.textContent = prefix + connector;
    row.appendChild(pre);

    // Toggle button or spacer
    if (hasChildren) {
      const btn = document.createElement("button");
      btn.className = "node-toggle";
      btn.textContent = ">";
      btn.setAttribute("aria-label", "expand");
      row.appendChild(btn);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "node-spacer";
      row.appendChild(spacer);
    }

    // Label
    const label = document.createElement("span");
    label.className = "node-label" + (hasChildren ? " folder" : "");
    if (item.url) {
      const a = document.createElement("a");
      a.href = item.url;
      a.textContent = item.name;
      label.appendChild(a);
      const arrow = document.createElement("span");
      arrow.className = "link-indicator";
      arrow.textContent = "↗";
      arrow.setAttribute("aria-hidden", "true");
      label.appendChild(arrow);
    } else {
      label.textContent = item.name;
    }
    row.appendChild(label);

    // URL hint shown on hover (view mode only)
    if (item.url && !editMode) {
      const urlSpan = document.createElement("span");
      urlSpan.className = "node-url";
      urlSpan.textContent = item.url;
      row.appendChild(urlSpan);
    }

    // Edit mode action buttons
    if (editMode) {
      const actions = document.createElement("span");
      actions.className = "edit-actions";

      // Edit (pencil)
      const editNodeBtn = document.createElement("button");
      editNodeBtn.textContent = "✎";
      editNodeBtn.title = "Edit";
      editNodeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        startInlineEdit(row, item, parentArray);
      });
      actions.appendChild(editNodeBtn);

      // Add child
      const addChildBtn = document.createElement("button");
      addChildBtn.className = "action-add";
      addChildBtn.textContent = "+";
      addChildBtn.title = "Add child";
      addChildBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!item.children) item.children = [];
        addNode(item.children, item.children.length);
      });
      actions.appendChild(addChildBtn);

      // Move up
      if (i > 0) {
        const upBtn = document.createElement("button");
        upBtn.textContent = "↑";
        upBtn.title = "Move up";
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveNode(parentArray, i, -1);
        });
        actions.appendChild(upBtn);
      }

      // Move down
      if (i < items.length - 1) {
        const downBtn = document.createElement("button");
        downBtn.textContent = "↓";
        downBtn.title = "Move down";
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveNode(parentArray, i, 1);
        });
        actions.appendChild(downBtn);
      }

      // Delete
      const delBtn = document.createElement("button");
      delBtn.className = "action-delete";
      delBtn.textContent = "✕";
      delBtn.title = "Delete";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteNode(parentArray, i, hasChildren);
      });
      actions.appendChild(delBtn);

      row.appendChild(actions);
    }

    frag.appendChild(row);

    // Children
    if (hasChildren) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "children";
      childrenContainer.appendChild(renderList(item.children, childPrefix, item.children));
      frag.appendChild(childrenContainer);

      // Wire toggle — whole row triggers expand/collapse
      const btn = row.querySelector(".node-toggle");
      row.classList.add("clickable");
      row.addEventListener("click", (e) => {
        if (editMode && e.target.closest(".edit-actions")) return;
        if (e.target.closest("a") && !editMode) return;
        const open = childrenContainer.classList.toggle("open");
        btn.classList.toggle("open", open);
        btn.textContent = open ? "v" : ">";
        btn.setAttribute("aria-label", open ? "collapse" : "expand");
        syncToggleAllBtn();
      });
    } else if (item.url && !editMode) {
      // Wire link — whole row navigates (view mode only)
      row.classList.add("clickable");
      row.addEventListener("click", (e) => {
        if (e.target.tagName === "A") return;
        window.location.href = item.url;
      });
    }
  });
  return frag;
}

// ── Edit mode: inline editing ───────────────────────────────────

function startInlineEdit(row, item, parentArray) {
  // Replace label and actions with an inline form
  const label = row.querySelector(".node-label");
  const actions = row.querySelector(".edit-actions");
  if (label) label.classList.add("hidden");
  if (actions) actions.classList.add("hidden");

  const form = document.createElement("span");
  form.className = "node-edit-form";

  const nameInput = document.createElement("input");
  nameInput.className = "edit-name";
  nameInput.type = "text";
  nameInput.value = item.name;
  nameInput.placeholder = "Name";
  form.appendChild(nameInput);

  const urlInput = document.createElement("input");
  urlInput.className = "edit-url";
  urlInput.type = "text";
  urlInput.value = item.url || "";
  urlInput.placeholder = "URL (empty = folder)";
  form.appendChild(urlInput);

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "edit-confirm";
  confirmBtn.textContent = "✓";
  confirmBtn.title = "Confirm";
  form.appendChild(confirmBtn);

  const cancelEditBtn = document.createElement("button");
  cancelEditBtn.className = "edit-cancel";
  cancelEditBtn.textContent = "✕";
  cancelEditBtn.title = "Cancel";
  form.appendChild(cancelEditBtn);

  row.appendChild(form);
  nameInput.focus();
  nameInput.select();

  function confirm() {
    const name = nameInput.value.trim();
    if (!name) return; // don't allow empty name
    item.name = name;
    const url = urlInput.value.trim();
    if (url) {
      item.url = url;
    } else {
      delete item.url;
    }
    reRenderEdit();
  }

  function cancel() {
    form.remove();
    if (label) label.classList.remove("hidden");
    if (actions) actions.classList.remove("hidden");
  }

  confirmBtn.addEventListener("click", (e) => { e.stopPropagation(); confirm(); });
  cancelEditBtn.addEventListener("click", (e) => { e.stopPropagation(); cancel(); });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); confirm(); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  });
  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); confirm(); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  });
}

// ── Edit mode: mutations ────────────────────────────────────────

function addNode(parentArray, index) {
  const newItem = { name: "New bookmark", url: "" };
  parentArray.splice(index, 0, newItem);
  reRenderEdit();

  requestAnimationFrame(() => {
    const nodes = tree.querySelectorAll(".node");
    for (const node of nodes) {
      const label = node.querySelector(".node-label");
      if (label && label.textContent.includes("New bookmark")) {
        const editPencil = node.querySelector(".edit-actions button");
        if (editPencil) editPencil.click();
        break;
      }
    }
  });
}

function deleteNode(parentArray, index, hasChildren) {
  if (hasChildren) {
    if (!confirm("Delete this folder and all its contents?")) return;
  }
  parentArray.splice(index, 1);
  reRenderEdit();
}

function moveNode(parentArray, index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= parentArray.length) return;
  const item = parentArray.splice(index, 1)[0];
  parentArray.splice(newIndex, 0, item);
  reRenderEdit();
}

function reRenderEdit() {
  tree.classList.add("edit-mode");
  renderBookmarks(editBookmarks);
  tree.querySelectorAll(".children").forEach((c) => c.classList.add("open"));
  tree.querySelectorAll(".node-toggle").forEach((btn) => {
    btn.classList.add("open");
    btn.textContent = "v";
    btn.setAttribute("aria-label", "collapse");
  });
}

// ── Edit mode: enter / save / cancel ────────────────────────────

function enterEditMode() {
  editMode = true;
  editBookmarks = deepClone(currentBookmarks);
  moreBtn.classList.add("hidden");
  editBtn.classList.add("hidden");
  importExportBtn.classList.add("hidden");
  importExportPanel.classList.add("hidden");
  saveBtn.classList.remove("hidden");
  cancelBtn.classList.remove("hidden");
  reRenderEdit();
}

async function saveEdits() {
  const cleaned = cleanBookmarks(editBookmarks);

  if (playgroundMode) {
    savePlaygroundBookmarks(cleaned);
    currentBookmarks = cleaned;
    exitEditMode();
    renderBookmarks(currentBookmarks);
    return;
  }

  try {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    await putBookmarks(cleaned);
    saveCachedBookmarks(cleaned);
    currentBookmarks = cleaned;
    exitEditMode();
    renderBookmarks(currentBookmarks);
  } catch (err) {
    console.error("Failed to save bookmarks:", err);
    alert("Failed to save. Please try again.");
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
}

function cancelEdits() {
  exitEditMode();
  renderBookmarks(currentBookmarks);
}

function exitEditMode() {
  editMode = false;
  editBookmarks = null;
  tree.classList.remove("edit-mode");
  moreBtn.classList.remove("hidden");
  editBtn.classList.add("hidden");
  importExportBtn.classList.add("hidden");
  saveBtn.classList.add("hidden");
  cancelBtn.classList.add("hidden");
  saveBtn.disabled = false;
  saveBtn.textContent = "Save";
}

function cleanBookmarks(items) {
  return items
    .filter((item) => item.name && item.name.trim())
    .map((item) => {
      const clean = { name: item.name.trim() };
      if (item.url && item.url.trim()) clean.url = item.url.trim();
      if (Array.isArray(item.children) && item.children.length > 0) {
        clean.children = cleanBookmarks(item.children);
      }
      return clean;
    });
}

// ── Import / Export ──────────────────────────────────────────────

const importExportBtn = document.getElementById("import-export-btn");
const importExportPanel = document.getElementById("import-export-panel");
const importExportText = document.getElementById("import-export-text");
const importBtn = document.getElementById("import-btn");
const yamlStatus = document.getElementById("yaml-status");
let currentFormat = "yaml";

const SAMPLE_YAML = `- name: Example Folder
  children:
    - name: Example Link
      url: https://example.com
    - name: Another Link
      url: https://example.org
`;

function validateYaml() {
  const text = importExportText.value.trim();
  if (!text) {
    yamlStatus.textContent = "";
    yamlStatus.className = "";
    importBtn.disabled = true;
    return;
  }
  try {
    const parsed = deserializeBookmarks(text, currentFormat);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      yamlStatus.textContent = "invalid yaml";
      yamlStatus.className = "invalid";
      importBtn.disabled = true;
    } else {
      yamlStatus.textContent = "valid yaml";
      yamlStatus.className = "valid";
      importBtn.disabled = false;
    }
  } catch {
    yamlStatus.textContent = "invalid yaml";
    yamlStatus.className = "invalid";
    importBtn.disabled = true;
  }
}

importExportText.addEventListener("input", validateYaml);

importExportBtn.addEventListener("click", () => {
  const opening = importExportPanel.classList.toggle("hidden") === false;
  if (opening) {
    const yaml = serializeBookmarks(currentBookmarks, currentFormat);
    importExportText.value = yaml.trim() ? yaml : SAMPLE_YAML;
    validateYaml();
  }
});

importBtn.addEventListener("click", async () => {
  const text = importExportText.value.trim();
  if (!text) return;

  let parsed;
  try {
    parsed = deserializeBookmarks(text, currentFormat);
  } catch (err) {
    alert("Failed to parse: " + err.message);
    return;
  }

  if (!Array.isArray(parsed)) {
    alert("Import data must be an array of bookmarks.");
    return;
  }

  const cleaned = cleanBookmarks(parsed);
  try {
    importBtn.disabled = true;
    importBtn.textContent = "Importing…";
    await putBookmarks(cleaned);
    saveCachedBookmarks(cleaned);
    currentBookmarks = cleaned;
    renderBookmarks(currentBookmarks);
    importExportPanel.classList.add("hidden");
  } catch (err) {
    console.error("Failed to import bookmarks:", err);
    alert("Failed to save imported bookmarks. Please try again.");
  } finally {
    importBtn.disabled = false;
    importBtn.textContent = "Import";
  }
});

// ── Serializers ─────────────────────────────────────────────────

function serializeBookmarks(bookmarks, format) {
  switch (format) {
    default: return bookmarksToYaml(bookmarks);
  }
}

function deserializeBookmarks(text, format) {
  switch (format) {
    default: return yamlToBookmarks(text);
  }
}

// ── YAML serializer ─────────────────────────────────────────────

function bookmarksToYaml(items, indent) {
  indent = indent || 0;
  const pad = "  ".repeat(indent);
  let out = "";
  for (const item of items) {
    out += pad + "- name: " + item.name + "\n";
    if (item.url) out += pad + "  url: " + item.url + "\n";
    if (Array.isArray(item.children) && item.children.length > 0) {
      out += pad + "  children:\n";
      out += bookmarksToYaml(item.children, indent + 2);
    }
  }
  return out;
}

// ── YAML parser (minimal, for our bookmark schema only) ─────────

function yamlToBookmarks(text) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  let pos = 0;

  function parseList(baseIndent) {
    const items = [];
    while (pos < lines.length) {
      const line = lines[pos];
      const indent = line.search(/\S/);
      if (indent < baseIndent) break;

      const nameMatch = line.match(/^(\s*)- name:\s*(.+)/);
      if (!nameMatch) break;
      if (nameMatch[1].length !== baseIndent) break;

      const item = { name: nameMatch[2].trim() };
      pos++;

      const propIndent = baseIndent + 2;
      while (pos < lines.length) {
        const propLine = lines[pos];
        const pi = propLine.search(/\S/);
        if (pi !== propIndent) break;
        const trimmed = propLine.trim();

        if (trimmed.startsWith("- ")) break;

        const urlMatch = trimmed.match(/^url:\s*(.+)/);
        if (urlMatch) {
          item.url = urlMatch[1].trim();
          pos++;
          continue;
        }

        if (trimmed === "children:") {
          pos++;
          item.children = parseList(propIndent + 2);
          continue;
        }

        pos++;
      }

      items.push(item);
    }
    return items;
  }

  return parseList(0);
}

// ── Toolbar ─────────────────────────────────────────────────────

const toggleAllBtn = document.getElementById("toggle-all");

function syncToggleAllBtn() {
  const anyOpen = document.querySelectorAll(".children.open").length > 0;
  toggleAllBtn.textContent = anyOpen ? "-" : "+";
}

toggleAllBtn.addEventListener("click", () => {
  const anyOpen = document.querySelectorAll(".children.open").length > 0;
  if (anyOpen) {
    document.querySelectorAll(".children").forEach((c) => c.classList.remove("open"));
    document.querySelectorAll(".node-toggle").forEach((btn) => {
      btn.classList.remove("open");
      btn.textContent = ">";
      btn.setAttribute("aria-label", "expand");
    });
    toggleAllBtn.textContent = "+";
  } else {
    document.querySelectorAll(".children").forEach((c) => c.classList.add("open"));
    document.querySelectorAll(".node-toggle").forEach((btn) => {
      btn.classList.add("open");
      btn.textContent = "v";
      btn.setAttribute("aria-label", "collapse");
    });
    toggleAllBtn.textContent = "-";
  }
});

moreBtn.addEventListener("click", () => {
  const showing = editBtn.classList.toggle("hidden");
  if (showing) {
    importExportBtn.classList.add("hidden");
    importExportPanel.classList.add("hidden");
  } else {
    importExportBtn.classList.remove("hidden");
  }
});

editBtn.addEventListener("click", enterEditMode);
saveBtn.addEventListener("click", saveEdits);
cancelBtn.addEventListener("click", cancelEdits);

const userBtn = document.getElementById("user-btn");

userBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (userAuthenticated) {
    logoutBtn.classList.toggle("hidden");
    loginBtn.classList.add("hidden");
    loginPicker.classList.add("hidden");
  } else {
    loginPicker.classList.toggle("hidden");
  }
});

loginBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  loginPicker.classList.toggle("hidden");
});

document.querySelectorAll(".login-provider").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    login(btn.dataset.provider);
  });
});

logoutBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  logout();
});

document.addEventListener("click", () => {
  logoutBtn.classList.add("hidden");
  loginPicker.classList.add("hidden");
});
