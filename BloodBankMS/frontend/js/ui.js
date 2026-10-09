const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function groupOptions(selected, withAll) {
  let html = withAll ? '<option value="">All groups</option>' : "";
  BLOOD_GROUPS.forEach((g) => {
    html += `<option value="${g}" ${g === selected ? "selected" : ""}>${g}</option>`;
  });
  return html;
}

function badge(text, cls) {
  return `<span class="badge ${esc(cls || text)}">${esc(text)}</span>`;
}

function groupTag(group) {
  return `<span class="group-tag">${esc(group)}</span>`;
}

function fmtDate(value) {
  if (!value) return "-";
  const d = new Date(value.length === 10 ? value + "T00:00:00" : value.replace(" ", "T") + "Z");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function toast(message, type) {
  const box = document.createElement("div");
  box.className = "toast " + (type || "");
  box.textContent = message;
  document.getElementById("toast-root").appendChild(box);
  setTimeout(() => box.remove(), 3500);
}

function closeModal() {
  document.getElementById("modal-root").innerHTML = "";
}

function openModal(title, bodyHtml, options) {
  const opts = options || {};
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="modal-back">
      <div class="modal">
        <h2>${esc(title)}</h2>
        <div id="modal-body">${bodyHtml}</div>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="modal-cancel">${opts.onSubmit ? "Cancel" : "Close"}</button>
          ${opts.onSubmit ? `<button class="btn" id="modal-ok">${esc(opts.submitText || "Save")}</button>` : ""}
        </div>
      </div>
    </div>`;
  document.getElementById("modal-cancel").onclick = closeModal;
  if (opts.onSubmit) {
    document.getElementById("modal-ok").onclick = async () => {
      try {
        await opts.onSubmit();
      } catch (e) {
        toast(e.message, "error");
      }
    };
  }
}

async function guard(action, successMessage) {
  try {
    const result = await action();
    if (successMessage) toast(successMessage, "success");
    return result;
  } catch (e) {
    toast(e.message, "error");
    return null;
  }
}

function formData(containerId) {
  const data = {};
  document.querySelectorAll(`#${containerId} [name]`).forEach((input) => {
    data[input.name] = input.type === "checkbox" ? input.checked : input.value;
  });
  return data;
}

function drawBarChart(canvasId, labels, values, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 500;
  const height = 240;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.height = height + "px";
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 20, right: 10, bottom: 30, left: 34 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(5, ...values);
  const step = Math.ceil(max / 5);
  const top = step * 5;

  ctx.font = "12px Segoe UI, Arial";
  ctx.fillStyle = "#6b7785";
  ctx.strokeStyle = "#e4e7eb";
  for (let i = 0; i <= 5; i++) {
    const y = pad.top + plotH - (plotH * i) / 5;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(step * i, pad.left - 6, y + 4);
  }

  const slot = plotW / labels.length;
  const barW = Math.min(46, slot * 0.6);
  labels.forEach((label, i) => {
    const barH = (values[i] / top) * plotH;
    const x = pad.left + slot * i + (slot - barW) / 2;
    const y = pad.top + plotH - barH;
    const c = typeof color === "function" ? color(values[i], label) : color;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = "#1f2933";
    ctx.textAlign = "center";
    ctx.fillText(values[i], x + barW / 2, y - 5);
    ctx.fillStyle = "#6b7785";
    ctx.fillText(label, x + barW / 2, height - 10);
  });
}

function compatibilityCard() {
  return `
    <div class="card">
      <h2>Blood compatibility checker</h2>
      <div class="toolbar">
        <div><label>Blood group</label><select id="compat-group" onchange="showCompatibility()">${groupOptions("O+")}</select></div>
      </div>
      <div id="compat-result"></div>
    </div>`;
}

async function showCompatibility() {
  const select = document.getElementById("compat-group");
  const box = document.getElementById("compat-result");
  if (!select || !box) return;
  const group = select.value;
  const info = await fetch("/api/public/compatibility/" + encodeURIComponent(group)).then((r) => r.json());
  const chips = (list) => list.map(groupTag).join(" ");
  box.innerHTML = `
    <div><b>${esc(group)}</b> can donate to:</div><div class="chips">${chips(info.can_donate_to)}</div>
    <div><b>${esc(group)}</b> can receive from:</div><div class="chips">${chips(info.can_receive_from)}</div>`;
}
