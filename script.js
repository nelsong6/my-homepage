document.getElementById("tree").appendChild(renderList(bookmarks, ""));

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
    } else {
      label.textContent = item.name;
    }
    row.appendChild(label);

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
        window.open(item.url, "_self");
      });
    }
  });
  return frag;
}
