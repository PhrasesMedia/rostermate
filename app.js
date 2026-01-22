// Roster Mate (Website) — uses localStorage instead of chrome.storage

const $ = (s) => document.querySelector(s);

/* ----- Dates ----- */
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (iso) => {
  const [y, m, dd] = iso.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  d.setHours(0, 0, 0, 0);
  return d;
};
const startOfWeekMon = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const k = x.getDay();
  const diff = k === 0 ? -6 : 1 - k;
  x.setDate(x.getDate() + diff);
  return x;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dayNames = (m) => Array.from({ length: 7 }, (_, i) => addDays(m, i));
const formatLong = (d) =>
  d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const mod = (n, m) => ((n % m) + m) % m;
const weeksBetween = (a, b) => Math.round((b - a) / (7 * 24 * 60 * 60 * 1000)); // DST-safe

/* ----- Storage ----- */
const SKEY = "rosterMate:v1";
let STATE = null;
let viewMonday = null;

function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function loadState() {
  const snap = lsGet(SKEY);
  if (snap) return snap;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const anchor = toISO(startOfWeekMon(today));

  const shifts = {
    RDO: { label: "RDO", start: "", end: "" },
    EARLY: { label: "Early", start: "05:00", end: "15:00" },
    MID: { label: "Mid", start: "10:00", end: "18:00" },
    NIGHT: { label: "Night", start: "22:00", end: "06:00" },
  };

  const pattern = [
    ["EARLY", "EARLY", "EARLY", "EARLY", "EARLY", "RDO", "RDO"],
    ["MID", "MID", "MID", "MID", "MID", "RDO", "RDO"],
    ["NIGHT", "NIGHT", "NIGHT", "NIGHT", "NIGHT", "RDO", "RDO"],
    ["RDO", "RDO", "EARLY", "EARLY", "EARLY", "EARLY", "EARLY"],
    ["RDO", "RDO", "MID", "MID", "MID", "MID", "MID"],
    ["RDO", "RDO", "NIGHT", "NIGHT", "NIGHT", "NIGHT", "NIGHT"],
    ["EARLY", "RDO", "RDO", "MID", "RDO", "NIGHT", "RDO"],
  ];

  const names = ["Alice", "Bob", "Charlie", "Dylan", "Eve", "Frank", "Grace"];
  const state = { anchor, shifts, pattern, names };
  lsSet(SKEY, state);
  return state;
}

async function saveState(next) {
  lsSet(SKEY, next);
}

/* ----- Rendering ----- */
function classify(code) {
  if (!code) return "";
  const u = String(code).toUpperCase();
  if (u.includes("RDO")) return "shift-RDO";
  if (u.includes("NIGHT")) return "shift-NIGHT";
  if (u.includes("MID")) return "shift-MID";
  if (u.includes("EARLY")) return "shift-EARLY";
  return "";
}

function buildLegend(shifts) {
  const legend = $("#legend");
  legend.innerHTML = "";
  for (const [code, def] of Object.entries(shifts)) {
    const span = document.createElement("span");
    const times = def.start && def.end ? ` ${def.start}–${def.end}` : "";
    span.textContent = `${code}${times}`;
    legend.appendChild(span);
  }
}

function renderHeader() {
  const mon = viewMonday,
    sun = addDays(mon, 6);
  const weekRange = $("#weekRange");
  const todayMon = startOfWeekMon(new Date());
  const anchorMon = fromISO(STATE.anchor);
  const currentWeek = mod(weeksBetween(anchorMon, todayMon), 7) + 1;
  weekRange.textContent = `Week of ${formatLong(mon)} – ${formatLong(sun)} · Current Week ${currentWeek}`;

  const jump = $("#jumpDate");
  if (jump) jump.value = toISO(mon);
}

function renderTable() {
  const { anchor, pattern, names } = STATE;
  const anchorMon = fromISO(anchor);
  const weekOffset = weeksBetween(anchorMon, viewMonday);

  // Forward (Next) → names move DOWN; Back (Prev) → names move UP
  const rotatedNames = Array.from({ length: 7 }, (_, i) => names[mod(i - weekOffset, 7)]);
  const days = dayNames(viewMonday);

  const grid = $("#grid");
  grid.innerHTML = "";
  const thead = document.createElement("thead");
  const trh = document.createElement("tr");
  const th0 = document.createElement("th");
  th0.textContent = "Roster Week";
  trh.appendChild(th0);
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((lbl, i) => {
    const d = days[i];
    const th = document.createElement("th");
    th.textContent = `${lbl} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    trh.appendChild(th);
  });
  thead.appendChild(trh);

  const tbody = document.createElement("tbody");
  for (let r = 0; r < 7; r++) {
    const tr = document.createElement("tr");
    const tdL = document.createElement("td");
    tdL.className = "weekCol";
    tdL.textContent = rotatedNames[r] || "";
    tdL.title = rotatedNames[r] || "";
    tr.appendChild(tdL);

    for (let c = 0; c < 7; c++) {
      const code = pattern[r] && pattern[r][c] ? pattern[r][c] : "";
      const td = document.createElement("td");
      const cls = classify(code);
      if (cls) td.classList.add(cls);

      const def = STATE.shifts[code];
      const times = def && def.start && def.end ? `${def.start}–${def.end}` : "";
      td.innerHTML = `<span class="code">${code}</span><span class="times">${times}</span>`;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  grid.appendChild(thead);
  grid.appendChild(tbody);
}

function renderAll() {
  buildLegend(STATE.shifts);
  renderHeader();
  renderTable();
}

/* ----- Edit Names ----- */
const namesDlg = $("#namesDlg"),
  namesForm = $("#namesForm"),
  namesGrid = $("#namesGrid");

$("#editNamesBtn").addEventListener("click", () => {
  namesGrid.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<label>Week ${i + 1}</label><input type="text" value="${STATE.names[i] || ""}" name="n${i}"/>`;
    namesGrid.appendChild(row);
  }
  namesDlg.showModal();
});

$("#cancelNames").addEventListener("click", () => namesDlg.close());

$("#saveNames").addEventListener("click", async (e) => {
  e.preventDefault();
  const newNames = Array.from({ length: 7 }, (_, i) => namesForm.querySelector(`[name="n${i}"]`).value.trim());
  STATE = { ...STATE, names: newNames };
  await saveState(STATE);
  namesDlg.close();
  renderAll();
});

/* ----- Edit Roster ----- */
const rosterDlg = $("#rosterDlg"),
  shiftTbl = $("#shiftTbl tbody"),
  patternTbl = $("#patternTbl");

$("#editRosterBtn").addEventListener("click", () => {
  $("#anchor").value = STATE.anchor;
  shiftTbl.innerHTML = "";
  for (const [code, def] of Object.entries(STATE.shifts)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><input value="${code}"></td><td><input value="${def.label || ""}"></td><td><input value="${
      def.start || ""
    }"></td><td><input value="${def.end || ""}"></td>`;
    shiftTbl.appendChild(tr);
  }
  patternTbl.innerHTML = "";
  for (let r = 0; r < 7; r++) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<th>Week ${r + 1}</th>` +
      Array.from(
        { length: 7 },
        (_, c) => `<td><input value="${STATE.pattern[r][c] || ""}" style="width:100%;text-align:center"></td>`
      ).join("");
    patternTbl.appendChild(tr);
  }
  rosterDlg.showModal();
});

$("#cancelRoster").addEventListener("click", () => rosterDlg.close());

$("#saveRoster").addEventListener("click", async (e) => {
  e.preventDefault();
  const anchor = $("#anchor").value || STATE.anchor;

  const rows = Array.from(shiftTbl.querySelectorAll("tr"));
  const shifts = {};
  rows.forEach((tr) => {
    const [code, label, start, end] = Array.from(tr.querySelectorAll("input")).map((i) => i.value.trim());
    if (code) shifts[code.toUpperCase()] = { label, start, end };
  });

  const nextPattern = Array.from(patternTbl.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td input")).map((i) => i.value.trim().toUpperCase())
  );

  STATE = { ...STATE, anchor, shifts, pattern: nextPattern };
  await saveState(STATE);
  rosterDlg.close();
  renderAll();
});

/* ----- Controls ----- */
$("#prevWeekBtn").addEventListener("click", () => {
  viewMonday = addDays(viewMonday, -7);
  renderAll();
});
$("#thisWeekBtn").addEventListener("click", () => {
  viewMonday = startOfWeekMon(new Date());
  renderAll();
});
$("#nextWeekBtn").addEventListener("click", () => {
  viewMonday = addDays(viewMonday, 7);
  renderAll();
});
$("#jumpDate").addEventListener("change", (e) => {
  viewMonday = startOfWeekMon(fromISO(e.target.value));
  renderAll();
});

/* ----- Init ----- */
(async function init() {
  STATE = await loadState();
  viewMonday = startOfWeekMon(new Date());
  renderAll();
})();
