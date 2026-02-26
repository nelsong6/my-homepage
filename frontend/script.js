import { CONFIG } from './config.js';
import { initAuth, login, logout, getToken, isAuthenticated, getUser } from './auth.js';

// ── DOM references ──────────────────────────────────────────────
const loginScreen = document.getElementById("login-screen");
const loadingEl = document.getElementById("loading");
const appEl = document.getElementById("app");
const tree = document.getElementById("tree");

const CACHE_KEY = "cached_bookmarks";

// ── App entry point ─────────────────────────────────────────────

(async function main() {
  const cached = loadCachedBookmarks();

  // If we have cached data, paint immediately — no waiting for Auth0.
  if (cached) {
    loginScreen.classList.add("hidden");
    loadingEl.classList.add("hidden");
    appEl.classList.remove("hidden");
    renderBookmarks(cached);
  } else {
    // No cache — show loading while Auth0 initializes
    loginScreen.classList.add("hidden");
    loadingEl.classList.remove("hidden");
  }

  // Auth0 init happens in the background while cached UI is already visible.
  await initAuth();

  if (await isAuthenticated()) {
    await showApp(cached);
  } else if (cached) {
    // Had stale cache but session expired — fall back to login
    showLogin();
  } else {
    showLogin();
  }
})();

// ── Auth flows ──────────────────────────────────────────────────

function showLogin() {
  loadingEl.classList.add("hidden");
  appEl.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

async function showApp(alreadyRenderedCache) {
  loadingEl.classList.add("hidden");
  loginScreen.classList.add("hidden");
  appEl.classList.remove("hidden");

  // Show user email
  const user = await getUser();
  document.getElementById("user-email").textContent = user.email || user.name || "";

  // Fetch fresh bookmarks from API (background revalidation)
  const fresh = await fetchBookmarks();

  // Only re-render if the data actually changed (or if we had no cache)
  if (!alreadyRenderedCache || !bookmarksEqual(alreadyRenderedCache, fresh)) {
    saveCachedBookmarks(fresh);
    renderBookmarks(fresh);
  }
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

// ── API ─────────────────────────────────────────────────────────

async function fetchBookmarks() {
  try {
    const token = await getToken();
    const res = await fetch(`${CONFIG.apiUrl}/api/bookmarks`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    return data.bookmarks || [];
  } catch (err) {
    console.error("Failed to fetch bookmarks:", err);
    // On network failure, return whatever we have cached
    return loadCachedBookmarks() || [];
  }
}

// ── Rendering ───────────────────────────────────────────────────

function renderBookmarks(bookmarks) {
  tree.innerHTML = "";

  if (bookmarks.length === 0) {
    tree.textContent = "No bookmarks yet.";
    return;
  }

  tree.style.setProperty(
    "--url-left",
    Math.ceil(calcMaxRowWidth(bookmarks, "")) + 2 + "ch"
  );
  tree.appendChild(renderList(bookmarks, ""));
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
function renderList(items, prefix) {
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

    // URL hint shown on hover
    if (item.url) {
      const urlSpan = document.createElement("span");
      urlSpan.className = "node-url";
      urlSpan.textContent = item.url;
      row.appendChild(urlSpan);
    }

    frag.appendChild(row);

    // Children
    if (hasChildren) {
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "children";
      childrenContainer.appendChild(renderList(item.children, childPrefix));
      frag.appendChild(childrenContainer);

      // Wire toggle — whole row triggers expand/collapse
      const btn = row.querySelector(".node-toggle");
      row.classList.add("clickable");
      row.addEventListener("click", (e) => {
        // If click landed on a link, let it navigate instead of toggling
        if (e.target.closest("a")) return;
        const open = childrenContainer.classList.toggle("open");
        btn.classList.toggle("open", open);
        btn.textContent = open ? "v" : ">";
        btn.setAttribute("aria-label", open ? "collapse" : "expand");
      });
    } else if (item.url) {
      // Wire link — whole row navigates
      row.classList.add("clickable");
      row.addEventListener("click", (e) => {
        if (e.target.tagName === "A") return; // let native <a> handle itself
        window.location.href = item.url;
      });
    }
  });
  return frag;
}

// ── Toolbar ─────────────────────────────────────────────────────

document.getElementById("expand-all").addEventListener("click", () => {
  document.querySelectorAll(".children").forEach((c) => c.classList.add("open"));
  document.querySelectorAll(".node-toggle").forEach((btn) => {
    btn.classList.add("open");
    btn.textContent = "v";
    btn.setAttribute("aria-label", "collapse");
  });
});

document.getElementById("collapse-all").addEventListener("click", () => {
  document.querySelectorAll(".children").forEach((c) => c.classList.remove("open"));
  document.querySelectorAll(".node-toggle").forEach((btn) => {
    btn.classList.remove("open");
    btn.textContent = ">";
    btn.setAttribute("aria-label", "expand");
  });
});

document.getElementById("login-btn").addEventListener("click", login);
document.getElementById("logout-btn").addEventListener("click", logout);
