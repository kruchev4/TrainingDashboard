import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, Users, GraduationCap, CalendarDays, AlertTriangle,
  Plus, Trash2, Pencil, X, Search, CheckCircle2, RotateCcw, Loader2,
} from "lucide-react";

const storage = {
  get: (key) =>
    new Promise((resolve, reject) => {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw === null) { reject(new Error("not found: " + key)); return; }
        resolve({ key, value: raw, shared: false });
      } catch (e) { reject(e); }
    }),
  set: (key, value) =>
    new Promise((resolve, reject) => {
      try {
        window.localStorage.setItem(key, value);
        resolve({ key, value, shared: false });
      } catch (e) { reject(e); }
    }),
};

const EQUIPMENT = ["Forklift", "Reach Truck", "Order Picker", "Power Jack", "Tugger", "Power Skate", "Overhead Crane", "Scissor Lift"];
const EQUIPMENT_PROGRAM = {
  "Forklift": "MHE / Powered Industrial Trucks",
  "Reach Truck": "MHE / Powered Industrial Trucks",
  "Order Picker": "MHE / Powered Industrial Trucks",
  "Power Jack": "MHE / Powered Industrial Trucks",
  "Tugger": "MHE / Powered Industrial Trucks",
  "Power Skate": "MHE / Powered Industrial Trucks",
  "Overhead Crane": "Overhead Cranes (1910.179)",
  "Scissor Lift": "Scissor Lifts / MEWPs (Scaffold + ANSI A92)",
};
const PROGRAM_ORDER = [
  "MHE / Powered Industrial Trucks",
  "Overhead Cranes (1910.179)",
  "Scissor Lifts / MEWPs (Scaffold + ANSI A92)",
];
function groupEquipmentByProgram() {
  return PROGRAM_ORDER.map((program) => ({
    program,
    items: EQUIPMENT.filter((eq) => EQUIPMENT_PROGRAM[eq] === program),
  }));
}
const CYCLE_DAYS = 365; // Jabil site policy: 1-year cycle (stricter than OSHA's 3-year floor)
const SHIFTS = ["1st Shift", "2nd Shift", "3rd Shift"];
const SESSION_TYPES = ["Initial", "Refresher", "Evaluation", "Recert"];

const NAVY = "#12233F";
const NAVY_SOFT = "#1B3660";
const GOLD = "#C99A3C";
const BORDER = "#E2E4E8";
const MUTED = "#5B6472";

const STATUS_STYLE = {
  Overdue: "bg-red-50 text-red-700 border-red-200",
  "Due Soon": "bg-amber-50 text-amber-700 border-amber-200",
  Current: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Not Certified": "bg-gray-100 text-gray-500 border-gray-200",
};

const BAR_COLOR = {
  Overdue: "#E24B4A",
  "Due Soon": "#EF9F27",
  Current: "#63A97A",
  "Not Certified": "#D1D4D9",
};

// ---------- date / status helpers ----------
function uid(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function iso(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return iso(d);
}
function daysFromToday(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d - today) / 86400000);
}
function fmtDate(dateStr) {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function dueDateFor(cert) {
  if (!cert || !cert.certified || !cert.certDate) return null;
  return addDays(cert.certDate, CYCLE_DAYS);
}
function statusFor(cert) {
  if (!cert || !cert.certified || !cert.certDate) return "Not Certified";
  const diff = daysFromToday(dueDateFor(cert));
  if (diff < 0) return "Overdue";
  if (diff <= 60) return "Due Soon";
  return "Current";
}
function todayStr() {
  return iso(new Date());
}
function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return iso(d);
}
function pastDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return iso(d);
}

// ---------- seed data ----------
function seedData() {
  const operators = [
    { id: uid("op"), name: "Jordan Rivera", employeeId: "EMP-04821", certs: {
      "Forklift": { certified: true, certDate: pastDate(40) },
      "Reach Truck": { certified: true, certDate: pastDate(320) },
      "Order Picker": { certified: false, certDate: "" },
      "Power Jack": { certified: true, certDate: pastDate(400) },
      "Tugger": { certified: true, certDate: pastDate(20) },
      "Power Skate": { certified: false, certDate: "" },
      "Overhead Crane": { certified: false, certDate: "" },
      "Scissor Lift": { certified: false, certDate: "" },
    }},
    { id: uid("op"), name: "Casey Nguyen", employeeId: "EMP-04833", certs: {
      "Forklift": { certified: true, certDate: pastDate(10) },
      "Reach Truck": { certified: false, certDate: "" },
      "Order Picker": { certified: true, certDate: pastDate(330) },
      "Power Jack": { certified: true, certDate: pastDate(60) },
      "Tugger": { certified: false, certDate: "" },
      "Power Skate": { certified: true, certDate: pastDate(45) },
      "Overhead Crane": { certified: true, certDate: pastDate(355) },
      "Scissor Lift": { certified: false, certDate: "" },
    }},
    { id: uid("op"), name: "Deshawn Miller", employeeId: "EMP-04850", certs: {
      "Forklift": { certified: true, certDate: pastDate(200) },
      "Reach Truck": { certified: true, certDate: pastDate(370) },
      "Order Picker": { certified: false, certDate: "" },
      "Power Jack": { certified: false, certDate: "" },
      "Tugger": { certified: false, certDate: "" },
      "Power Skate": { certified: false, certDate: "" },
      "Overhead Crane": { certified: false, certDate: "" },
      "Scissor Lift": { certified: true, certDate: pastDate(300) },
    }},
    { id: uid("op"), name: "Amelia Ortiz", employeeId: "EMP-04862", certs: {
      "Forklift": { certified: false, certDate: "" },
      "Reach Truck": { certified: false, certDate: "" },
      "Order Picker": { certified: true, certDate: pastDate(15) },
      "Power Jack": { certified: true, certDate: pastDate(25) },
      "Tugger": { certified: true, certDate: pastDate(5) },
      "Power Skate": { certified: false, certDate: "" },
      "Overhead Crane": { certified: false, certDate: "" },
      "Scissor Lift": { certified: true, certDate: pastDate(12) },
    }},
    { id: uid("op"), name: "Wyatt Barnes", employeeId: "EMP-04879", certs: {
      "Forklift": { certified: true, certDate: pastDate(315) },
      "Reach Truck": { certified: false, certDate: "" },
      "Order Picker": { certified: false, certDate: "" },
      "Power Jack": { certified: true, certDate: pastDate(5) },
      "Tugger": { certified: false, certDate: "" },
      "Power Skate": { certified: false, certDate: "" },
      "Overhead Crane": { certified: false, certDate: "" },
      "Scissor Lift": { certified: false, certDate: "" },
    }},
    { id: uid("op"), name: "Renee Castillo", employeeId: "EMP-04891", certs: {
      "Forklift": { certified: true, certDate: pastDate(80) },
      "Reach Truck": { certified: true, certDate: pastDate(50) },
      "Order Picker": { certified: true, certDate: pastDate(340) },
      "Power Jack": { certified: false, certDate: "" },
      "Tugger": { certified: false, certDate: "" },
      "Power Skate": { certified: false, certDate: "" },
      "Overhead Crane": { certified: true, certDate: pastDate(60) },
      "Scissor Lift": { certified: false, certDate: "" },
    }},
  ];

  const trainers = [
    { id: uid("tr"), name: "Marcus Webb", equipment: ["Forklift", "Power Jack", "Tugger"], shifts: ["1st Shift"] },
    { id: uid("tr"), name: "Priya Shah", equipment: ["Reach Truck", "Order Picker", "Scissor Lift"], shifts: ["1st Shift", "2nd Shift"] },
    { id: uid("tr"), name: "Alan Cole", equipment: ["Forklift", "Overhead Crane"], shifts: ["2nd Shift"] },
  ];

  const sessions = [
    { id: uid("se"), date: futureDate(6), equipment: "Reach Truck", type: "Refresher", trainerId: trainers[1].id, trainees: [operators[0].id], status: "Scheduled" },
    { id: uid("se"), date: futureDate(12), equipment: "Power Jack", type: "Recert", trainerId: trainers[0].id, trainees: [operators[0].id], status: "Scheduled" },
    { id: uid("se"), date: futureDate(3), equipment: "Forklift", type: "Initial", trainerId: trainers[2].id, trainees: [operators[3].id, operators[4].id], status: "Scheduled" },
    { id: uid("se"), date: futureDate(9), equipment: "Overhead Crane", type: "Initial", trainerId: trainers[2].id, trainees: [operators[0].id], status: "Scheduled" },
    { id: uid("se"), date: pastDate(9), equipment: "Order Picker", type: "Initial", trainerId: trainers[1].id, trainees: [operators[3].id], status: "Completed" },
  ];

  return { operators, trainers, sessions };
}

// ---------- small UI atoms ----------
function StatusPill({ status }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

function KpiCard({ label, value, sub, tone }) {
  const toneColor = tone === "danger" ? "#B3261E" : tone === "warn" ? "#8A5D0B" : tone === "good" ? "#1F6B49" : NAVY;
  return (
    <div className="bg-white rounded p-4" style={{ border: `1px solid ${BORDER}` }}>
      <div className="text-xs mb-1" style={{ color: MUTED }}>{label}</div>
      <div className="text-2xl font-semibold" style={{ color: toneColor }}>{value}</div>
      {sub ? <div className="text-xs mt-1" style={{ color: MUTED }}>{sub}</div> : null}
    </div>
  );
}

function FieldLabel({ children }) {
  return <label className="text-xs block mb-1" style={{ color: MUTED }}>{children}</label>;
}

function PrimaryButton({ children, onClick, type = "button", disabled }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-50"
      style={{ background: NAVY }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded text-sm font-medium"
      style={{ border: `1px solid ${BORDER}`, color: NAVY }}
    >
      {children}
    </button>
  );
}

// ---------- main component ----------
export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [operators, setOperators] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");

  const [operatorPanel, setOperatorPanel] = useState(null);
  const [trainerPanel, setTrainerPanel] = useState(null);
  const [sessionPanel, setSessionPanel] = useState(null);
  const [sessionPrefill, setSessionPrefill] = useState(null);

  const [operatorSearch, setOperatorSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // { kind, id }

  useEffect(() => {
    (async () => {
      let ops = null, trs = null, ses = null;
      try {
        const opRes = await storage.get("mhe_operators", false).catch(() => null);
        const trRes = await storage.get("mhe_trainers", false).catch(() => null);
        const seRes = await storage.get("mhe_sessions", false).catch(() => null);
        if (opRes) ops = JSON.parse(opRes.value);
        if (trRes) trs = JSON.parse(trRes.value);
        if (seRes) ses = JSON.parse(seRes.value);
      } catch (e) {
        console.error("Storage read failed", e);
      }
      if (!ops || !trs) {
        const seed = seedData();
        ops = ops || seed.operators;
        trs = trs || seed.trainers;
        ses = ses || seed.sessions;
        try {
          await storage.set("mhe_operators", JSON.stringify(ops), false);
          await storage.set("mhe_trainers", JSON.stringify(trs), false);
          await storage.set("mhe_sessions", JSON.stringify(ses || []), false);
        } catch (e) {
          console.error("Storage seed write failed", e);
        }
      }
      setOperators(ops || []);
      setTrainers(trs || []);
      setSessions(ses || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (sessionPrefill) {
      setSessionPanel({
        id: null,
        date: "",
        equipment: sessionPrefill.equipment,
        type: "Refresher",
        trainerId: "",
        trainees: [sessionPrefill.operatorId],
        status: "Scheduled",
      });
      setSessionPrefill(null);
    }
  }, [sessionPrefill]);

  async function saveOperators(next) {
    setOperators(next);
    try { await storage.set("mhe_operators", JSON.stringify(next), false); }
    catch (e) { console.error("Save operators failed", e); }
  }
  async function saveTrainers(next) {
    setTrainers(next);
    try { await storage.set("mhe_trainers", JSON.stringify(next), false); }
    catch (e) { console.error("Save trainers failed", e); }
  }
  async function saveSessions(next) {
    setSessions(next);
    try { await storage.set("mhe_sessions", JSON.stringify(next), false); }
    catch (e) { console.error("Save sessions failed", e); }
  }

  async function resetSampleData() {
    const seed = seedData();
    await saveOperators(seed.operators);
    await saveTrainers(seed.trainers);
    await saveSessions(seed.sessions);
    setConfirmDelete(null);
  }
  async function clearAllData() {
    await saveOperators([]);
    await saveTrainers([]);
    await saveSessions([]);
    setConfirmDelete(null);
  }

  // ---------- derived data ----------
  const operatorRows = useMemo(() => {
    const rows = [];
    operators.forEach((op) => {
      EQUIPMENT.forEach((eq) => {
        const cert = op.certs?.[eq];
        const status = statusFor(cert);
        if (status === "Not Certified") return;
        const due = dueDateFor(cert);
        rows.push({
          operatorId: op.id, name: op.name, employeeId: op.employeeId,
          equipment: eq, certDate: cert.certDate, dueDate: due,
          status, daysLeft: daysFromToday(due),
        });
      });
    });
    return rows;
  }, [operators]);

  const counts = useMemo(() => {
    const c = { Overdue: 0, "Due Soon": 0, Current: 0 };
    operatorRows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [operatorRows]);

  const trainerCoverage = useMemo(() => EQUIPMENT.map((eq) => ({
    equipment: eq,
    trainerCount: trainers.filter((t) => t.equipment.includes(eq)).length,
    dueCount: operatorRows.filter((r) => r.equipment === eq && (r.status === "Overdue" || r.status === "Due Soon")).length,
  })), [trainers, operatorRows]);

  const reminders = useMemo(() => (
    operatorRows.filter((r) => r.status === "Overdue" || r.status === "Due Soon")
      .sort((a, b) => a.daysLeft - b.daysLeft)
  ), [operatorRows]);

  const upcomingSessions = useMemo(() => (
    sessions.filter((s) => s.status === "Scheduled").sort((a, b) => a.date.localeCompare(b.date))
  ), [sessions]);

  const equipmentBreakdown = useMemo(() => EQUIPMENT.map((eq) => {
    const b = { Current: 0, "Due Soon": 0, Overdue: 0, "Not Certified": 0 };
    operators.forEach((op) => { b[statusFor(op.certs?.[eq])]++; });
    return { equipment: eq, ...b, total: operators.length || 1 };
  }), [operators]);

  const filteredOperators = useMemo(() => {
    const q = operatorSearch.trim().toLowerCase();
    if (!q) return operators;
    return operators.filter((op) => op.name.toLowerCase().includes(q) || op.employeeId.toLowerCase().includes(q));
  }, [operators, operatorSearch]);

  function trainerName(id) {
    return trainers.find((t) => t.id === id)?.name || "\u2014";
  }
  function operatorName(id) {
    return operators.find((o) => o.id === id)?.name || "(removed operator)";
  }
  function trainerConflicts(trainerId, date, excludeSessionId) {
    if (!trainerId || !date) return [];
    return sessions.filter((s) => s.id !== excludeSessionId && s.trainerId === trainerId && s.date === date && s.status === "Scheduled");
  }

  // ---------- operator handlers ----------
  function openNewOperator() {
    const certs = {};
    EQUIPMENT.forEach((eq) => { certs[eq] = { certified: false, certDate: "" }; });
    setOperatorPanel({ id: null, name: "", employeeId: "", certs });
  }
  function openEditOperator(op) {
    setOperatorPanel(JSON.parse(JSON.stringify(op)));
  }
  async function saveOperatorPanel() {
    if (!operatorPanel.name.trim()) return;
    let next;
    if (operatorPanel.id) {
      next = operators.map((o) => (o.id === operatorPanel.id ? operatorPanel : o));
    } else {
      next = [...operators, { ...operatorPanel, id: uid("op") }];
    }
    await saveOperators(next);
    setOperatorPanel(null);
  }
  async function deleteOperator(id) {
    await saveOperators(operators.filter((o) => o.id !== id));
    await saveSessions(sessions.map((s) => ({ ...s, trainees: s.trainees.filter((t) => t !== id) })));
    setConfirmDelete(null);
  }

  // ---------- trainer handlers ----------
  function openNewTrainer() {
    setTrainerPanel({ id: null, name: "", equipment: [], shifts: [] });
  }
  function openEditTrainer(t) {
    setTrainerPanel(JSON.parse(JSON.stringify(t)));
  }
  async function saveTrainerPanel() {
    if (!trainerPanel.name.trim()) return;
    let next;
    if (trainerPanel.id) {
      next = trainers.map((t) => (t.id === trainerPanel.id ? trainerPanel : t));
    } else {
      next = [...trainers, { ...trainerPanel, id: uid("tr") }];
    }
    await saveTrainers(next);
    setTrainerPanel(null);
  }
  async function deleteTrainer(id) {
    await saveTrainers(trainers.filter((t) => t.id !== id));
    setConfirmDelete(null);
  }

  // ---------- session handlers ----------
  function openNewSession() {
    setSessionPanel({ id: null, date: "", equipment: EQUIPMENT[0], type: "Initial", trainerId: "", trainees: [], status: "Scheduled" });
  }
  function openEditSession(s) {
    setSessionPanel(JSON.parse(JSON.stringify(s)));
  }
  async function saveSessionPanel() {
    if (!sessionPanel.date || !sessionPanel.equipment || !sessionPanel.trainerId) return;
    let next;
    if (sessionPanel.id) {
      next = sessions.map((s) => (s.id === sessionPanel.id ? sessionPanel : s));
    } else {
      next = [...sessions, { ...sessionPanel, id: uid("se") }];
    }
    await saveSessions(next);
    setSessionPanel(null);
  }
  async function deleteSession(id) {
    await saveSessions(sessions.filter((s) => s.id !== id));
    setConfirmDelete(null);
  }
  async function markSessionStatus(id, status) {
    await saveSessions(sessions.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-24" style={{ color: MUTED }}>
        <Loader2 className="animate-spin mr-2" size={18} /> Loading dashboard…
      </div>
    );
  }

  const NAV_ITEMS = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "operators", label: "Operators", icon: Users },
    { key: "trainers", label: "Trainers", icon: GraduationCap },
    { key: "schedule", label: "Schedule", icon: CalendarDays },
  ];

  return (
    <div className="w-full flex" style={{ minHeight: 640, fontFamily: "inherit" }}>
      {/* Sidebar */}
      <div className="w-52 shrink-0 flex flex-col justify-between" style={{ background: NAVY }}>
        <div>
          <div className="px-5 py-5" style={{ borderBottom: `1px solid ${NAVY_SOFT}` }}>
            <div className="text-white font-semibold text-sm tracking-wide">MHE CERTIFICATION</div>
            <div className="text-xs mt-0.5" style={{ color: GOLD }}>Jabil Prince George</div>
          </div>
          <nav className="py-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className="w-full flex items-center gap-2.5 px-5 py-2.5 text-sm text-left"
                  style={{
                    color: active ? "#FFFFFF" : "#B7C0D1",
                    background: active ? NAVY_SOFT : "transparent",
                    borderLeft: active ? `3px solid ${GOLD}` : "3px solid transparent",
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="px-5 py-4 text-xs" style={{ borderTop: `1px solid ${NAVY_SOFT}`, color: "#8895AC" }}>
          1-year recert cycle
          <div className="mt-2 flex flex-col gap-1">
            <button onClick={() => setConfirmDelete({ kind: "reset" })} className="text-left underline decoration-dotted">Reset sample data</button>
            <button onClick={() => setConfirmDelete({ kind: "clear" })} className="text-left underline decoration-dotted">Clear all data</button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1" style={{ background: "#F5F6F8" }}>
        <div className="max-w-5xl mx-auto p-7">

          {confirmDelete?.kind === "reset" || confirmDelete?.kind === "clear" ? (
            <div className="mb-5 p-3 rounded flex items-center justify-between bg-amber-50 border border-amber-200">
              <div className="text-sm text-amber-800">
                {confirmDelete.kind === "reset" ? "Replace current data with sample data?" : "Delete all operators, trainers, and sessions?"}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmDelete.kind === "reset" ? resetSampleData : clearAllData}
                  className="px-3 py-1 rounded text-xs font-medium text-white bg-red-600"
                >Confirm</button>
                <button onClick={() => setConfirmDelete(null)} className="px-3 py-1 rounded text-xs font-medium border border-amber-300 text-amber-800">Cancel</button>
              </div>
            </div>
          ) : null}

          {activeTab === "overview" && (
            <OverviewTab
              counts={counts}
              operatorsCount={operators.length}
              trainersCount={trainers.length}
              trainerCoverage={trainerCoverage}
              reminders={reminders}
              equipmentBreakdown={equipmentBreakdown}
              upcomingSessions={upcomingSessions}
              trainerName={trainerName}
              onSchedule={(equipment, operatorId) => { setSessionPrefill({ equipment, operatorId }); setActiveTab("schedule"); }}
            />
          )}

          {activeTab === "operators" && (
            <OperatorsTab
              operators={filteredOperators}
              search={operatorSearch}
              setSearch={setOperatorSearch}
              onAdd={openNewOperator}
              onEdit={openEditOperator}
              onDelete={(id) => setConfirmDelete({ kind: "operator", id })}
              confirmDelete={confirmDelete}
              onConfirmDelete={deleteOperator}
              onCancelDelete={() => setConfirmDelete(null)}
              panel={operatorPanel}
              setPanel={setOperatorPanel}
              onSavePanel={saveOperatorPanel}
            />
          )}

          {activeTab === "trainers" && (
            <TrainersTab
              trainers={trainers}
              sessions={sessions}
              trainerCoverage={trainerCoverage}
              onAdd={openNewTrainer}
              onEdit={openEditTrainer}
              onDelete={(id) => setConfirmDelete({ kind: "trainer", id })}
              confirmDelete={confirmDelete}
              onConfirmDelete={deleteTrainer}
              onCancelDelete={() => setConfirmDelete(null)}
              panel={trainerPanel}
              setPanel={setTrainerPanel}
              onSavePanel={saveTrainerPanel}
            />
          )}

          {activeTab === "schedule" && (
            <ScheduleTab
              sessions={sessions}
              trainers={trainers}
              operators={operators}
              trainerName={trainerName}
              operatorName={operatorName}
              onAdd={openNewSession}
              onEdit={openEditSession}
              onDelete={(id) => setConfirmDelete({ kind: "session", id })}
              confirmDelete={confirmDelete}
              onConfirmDelete={deleteSession}
              onCancelDelete={() => setConfirmDelete(null)}
              onMarkStatus={markSessionStatus}
              panel={sessionPanel}
              setPanel={setSessionPanel}
              onSavePanel={saveSessionPanel}
              trainerConflicts={trainerConflicts}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ================= OVERVIEW =================
function OverviewTab({ counts, operatorsCount, trainersCount, trainerCoverage, reminders, equipmentBreakdown, upcomingSessions, trainerName, onSchedule }) {
  const gaps = trainerCoverage.filter((tc) => tc.trainerCount === 0 && tc.dueCount > 0);
  return (
    <div>
      <h1 className="text-lg font-semibold mb-1" style={{ color: NAVY }}>Overview</h1>
      <p className="text-sm mb-5" style={{ color: MUTED }}>Operator certification status across all MHE equipment, 1-year cycle.</p>

      <div className="grid grid-cols-5 gap-3 mb-6">
        <KpiCard label="Operators" value={operatorsCount} />
        <KpiCard label="Current" value={counts.Current || 0} tone="good" />
        <KpiCard label="Due within 60 days" value={counts["Due Soon"] || 0} tone="warn" />
        <KpiCard label="Overdue" value={counts.Overdue || 0} tone="danger" />
        <KpiCard label="Trainers" value={trainersCount} />
      </div>

      {gaps.length > 0 && (
        <div className="mb-6 p-3 rounded bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-1">
            <AlertTriangle size={15} /> Trainer coverage gap
          </div>
          {gaps.map((g) => (
            <div key={g.equipment} className="text-sm text-red-700 ml-6">
              No authorized trainer for {g.equipment} — {g.dueCount} operator(s) due or overdue
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded p-4 mb-6" style={{ border: `1px solid ${BORDER}` }}>
        <div className="text-sm font-medium mb-3" style={{ color: NAVY }}>Certification status by equipment</div>
        <div className="flex flex-col gap-3">
          {equipmentBreakdown.map((row, idx) => {
            const program = EQUIPMENT_PROGRAM[row.equipment];
            const prevProgram = idx > 0 ? EQUIPMENT_PROGRAM[equipmentBreakdown[idx - 1].equipment] : null;
            return (
            <div key={row.equipment}>
              {program !== prevProgram && (
                <div className="text-xs font-medium mb-1.5" style={{ color: NAVY, marginTop: idx > 0 ? 6 : 0 }}>{program}</div>
              )}
              <div className="flex justify-between text-xs mb-1" style={{ color: MUTED }}>
                <span>{row.equipment}</span>
                <span>{row.Current + row["Due Soon"] + row.Overdue} certified of {row.total}</span>
              </div>
              <div className="w-full h-2.5 rounded overflow-hidden flex" style={{ background: "#F1F2F4" }}>
                {["Current", "Due Soon", "Overdue", "Not Certified"].map((k) => {
                  const pct = (row[k] / row.total) * 100;
                  if (pct <= 0) return null;
                  return <div key={k} style={{ width: `${pct}%`, background: BAR_COLOR[k] }} />;
                })}
              </div>
            </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs" style={{ color: MUTED }}>
          {["Current", "Due Soon", "Overdue", "Not Certified"].map((k) => (
            <div key={k} className="flex items-center gap-1.5">
              <span style={{ width: 8, height: 8, borderRadius: 2, background: BAR_COLOR[k], display: "inline-block" }} />
              {k}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded p-4" style={{ border: `1px solid ${BORDER}` }}>
          <div className="text-sm font-medium mb-3" style={{ color: NAVY }}>Retrain reminders</div>
          {reminders.length === 0 ? (
            <div className="text-sm" style={{ color: MUTED }}>No operators due or overdue.</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-96 overflow-auto">
              {reminders.map((r) => (
                <div key={r.operatorId + r.equipment} className="flex items-center justify-between text-sm py-1.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <div>
                    <div className="font-medium" style={{ color: NAVY }}>{r.name}</div>
                    <div className="text-xs" style={{ color: MUTED }}>{r.equipment} — due {fmtDate(r.dueDate)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={r.status} />
                    <button
                      onClick={() => onSchedule(r.equipment, r.operatorId)}
                      className="text-xs font-medium px-2 py-1 rounded"
                      style={{ border: `1px solid ${BORDER}`, color: NAVY }}
                    >Schedule</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded p-4" style={{ border: `1px solid ${BORDER}` }}>
          <div className="text-sm font-medium mb-3" style={{ color: NAVY }}>Upcoming training sessions</div>
          {upcomingSessions.length === 0 ? (
            <div className="text-sm" style={{ color: MUTED }}>Nothing scheduled.</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-96 overflow-auto">
              {upcomingSessions.map((s) => (
                <div key={s.id} className="text-sm py-1.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <div className="font-medium" style={{ color: NAVY }}>{fmtDate(s.date)} — {s.equipment}</div>
                  <div className="text-xs" style={{ color: MUTED }}>{s.type} · {trainerName(s.trainerId)} · {s.trainees.length} trainee(s)</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ================= OPERATORS =================
function OperatorsTab({ operators, search, setSearch, onAdd, onEdit, onDelete, confirmDelete, onConfirmDelete, onCancelDelete, panel, setPanel, onSavePanel }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold" style={{ color: NAVY }}>Operators</h1>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-white" style={{ background: NAVY }}>
          <Plus size={14} /> Add operator
        </button>
      </div>
      <p className="text-sm mb-4" style={{ color: MUTED }}>Certification status per equipment type, 1-year cycle from certification date.</p>

      <div className="relative mb-4" style={{ maxWidth: 320 }}>
        <Search size={14} className="absolute left-2.5 top-2.5" style={{ color: MUTED }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or employee ID"
          className="w-full pl-8 pr-3 py-1.5 rounded text-sm border"
          style={{ borderColor: BORDER }}
        />
      </div>

      {panel && (
        <OperatorPanel panel={panel} setPanel={setPanel} onSave={onSavePanel} onCancel={() => setPanel(null)} />
      )}

      <div className="bg-white rounded overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: NAVY }}>
              <th className="text-left text-white text-xs font-medium px-3 py-2" style={{ width: "18%" }}>Name</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2" style={{ width: "12%" }}>Employee ID</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2">Certifications</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2" style={{ width: "8%" }}></th>
            </tr>
          </thead>
          <tbody>
            {operators.length === 0 && (
              <tr><td colSpan={4} className="text-center text-sm py-6" style={{ color: MUTED }}>No operators yet.</td></tr>
            )}
            {operators.map((op, i) => {
              const certifiedEquipment = EQUIPMENT.filter((eq) => op.certs?.[eq]?.certified);
              return (
              <tr key={op.id} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FAFBFC", borderTop: `1px solid ${BORDER}` }}>
                <td className="px-3 py-2 font-medium align-top" style={{ color: NAVY }}>{op.name}</td>
                <td className="px-3 py-2 align-top" style={{ color: MUTED }}>{op.employeeId}</td>
                <td className="px-3 py-2">
                  {certifiedEquipment.length === 0 ? (
                    <span className="text-xs" style={{ color: MUTED }}>Not yet certified on any equipment</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {certifiedEquipment.map((eq) => (
                        <span key={eq} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${STATUS_STYLE[statusFor(op.certs[eq])]}`}>
                          {eq}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(op)} title="Edit"><Pencil size={14} style={{ color: MUTED }} /></button>
                    {confirmDelete?.kind === "operator" && confirmDelete.id === op.id ? (
                      <>
                        <button onClick={() => onConfirmDelete(op.id)} className="text-xs text-red-600 font-medium">Confirm</button>
                        <button onClick={onCancelDelete} className="text-xs" style={{ color: MUTED }}>Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => onDelete(op.id)} title="Delete"><Trash2 size={14} style={{ color: MUTED }} /></button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OperatorPanel({ panel, setPanel, onSave, onCancel }) {
  return (
    <div className="bg-white rounded p-5 mb-5" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: NAVY }}>{panel.id ? "Edit operator" : "Add operator"}</h3>
        <button onClick={onCancel}><X size={16} style={{ color: MUTED }} /></button>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <FieldLabel>Name</FieldLabel>
          <input className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} value={panel.name}
            onChange={(e) => setPanel({ ...panel, name: e.target.value })} placeholder="Jordan Rivera" />
        </div>
        <div>
          <FieldLabel>Employee ID</FieldLabel>
          <input className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} value={panel.employeeId}
            onChange={(e) => setPanel({ ...panel, employeeId: e.target.value })} placeholder="EMP-04821" />
        </div>
      </div>
      <div className="text-xs mb-2" style={{ color: MUTED }}>Equipment certifications</div>
      {groupEquipmentByProgram().map(({ program, items }) => (
        <div key={program} className="mb-4">
          <div className="text-xs font-medium mb-2" style={{ color: NAVY }}>{program}</div>
          <div className="grid grid-cols-2 gap-3">
            {items.map((eq) => {
              const cert = panel.certs?.[eq] || { certified: false, certDate: "" };
              return (
                <div key={eq} className="rounded p-3" style={{ border: `1px solid ${BORDER}` }}>
                  <label className="flex items-center gap-2 text-sm font-medium mb-2">
                    <input type="checkbox" checked={cert.certified}
                      onChange={(e) => setPanel({ ...panel, certs: { ...panel.certs, [eq]: { ...cert, certified: e.target.checked } } })} />
                    {eq}
                  </label>
                  {cert.certified && (
                    <div>
                      <FieldLabel>Certification date</FieldLabel>
                      <input type="date" className="w-full border rounded px-2 py-1.5 text-sm" style={{ borderColor: BORDER }}
                        value={cert.certDate || ""}
                        onChange={(e) => setPanel({ ...panel, certs: { ...panel.certs, [eq]: { ...cert, certDate: e.target.value } } })} />
                      {cert.certDate && <div className="text-xs mt-1" style={{ color: MUTED }}>Due {fmtDate(addDays(cert.certDate, CYCLE_DAYS))}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <PrimaryButton onClick={onSave}>Save operator</PrimaryButton>
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
      </div>
    </div>
  );
}

// ================= TRAINERS =================
function TrainersTab({ trainers, sessions, trainerCoverage, onAdd, onEdit, onDelete, confirmDelete, onConfirmDelete, onCancelDelete, panel, setPanel, onSavePanel }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold" style={{ color: NAVY }}>Trainers</h1>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-white" style={{ background: NAVY }}>
          <Plus size={14} /> Add trainer
        </button>
      </div>
      <p className="text-sm mb-4" style={{ color: MUTED }}>Trainer authorization is equipment-specific, per the Train-the-Trainer program.</p>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {trainerCoverage.map((tc) => (
          <div key={tc.equipment} className="bg-white rounded p-3" style={{ border: `1px solid ${tc.trainerCount === 0 ? "#F0997B" : BORDER}` }}>
            <div className="text-xs" style={{ color: MUTED }}>{tc.equipment}</div>
            <div className="text-xl font-semibold" style={{ color: tc.trainerCount === 0 ? "#B3261E" : NAVY }}>{tc.trainerCount}</div>
            <div className="text-xs" style={{ color: MUTED }}>trainer(s) authorized</div>
          </div>
        ))}
      </div>

      {panel && <TrainerPanel panel={panel} setPanel={setPanel} onSave={onSavePanel} onCancel={() => setPanel(null)} />}

      <div className="bg-white rounded overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: NAVY }}>
              <th className="text-left text-white text-xs font-medium px-3 py-2">Name</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2">Authorized equipment</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2">Shift availability</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2">Upcoming sessions</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2" style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {trainers.length === 0 && (
              <tr><td colSpan={5} className="text-center text-sm py-6" style={{ color: MUTED }}>No trainers yet.</td></tr>
            )}
            {trainers.map((t, i) => {
              const upcoming = sessions.filter((s) => s.trainerId === t.id && s.status === "Scheduled").length;
              return (
                <tr key={t.id} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FAFBFC", borderTop: `1px solid ${BORDER}` }}>
                  <td className="px-3 py-2 font-medium" style={{ color: NAVY }}>{t.name}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {t.equipment.length === 0 ? <span style={{ color: MUTED }}>—</span> : t.equipment.map((eq) => (
                        <span key={eq} className="text-xs px-1.5 py-0.5 rounded bg-gray-100" style={{ color: NAVY }}>{eq}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2" style={{ color: MUTED }}>{t.shifts.length === 0 ? "\u2014" : t.shifts.join(", ")}</td>
                  <td className="px-3 py-2" style={{ color: MUTED }}>{upcoming}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => onEdit(t)} title="Edit"><Pencil size={14} style={{ color: MUTED }} /></button>
                      {confirmDelete?.kind === "trainer" && confirmDelete.id === t.id ? (
                        <>
                          <button onClick={() => onConfirmDelete(t.id)} className="text-xs text-red-600 font-medium">Confirm</button>
                          <button onClick={onCancelDelete} className="text-xs" style={{ color: MUTED }}>Cancel</button>
                        </>
                      ) : (
                        <button onClick={() => onDelete(t.id)} title="Delete"><Trash2 size={14} style={{ color: MUTED }} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrainerPanel({ panel, setPanel, onSave, onCancel }) {
  function toggleEquipment(eq) {
    const next = panel.equipment.includes(eq) ? panel.equipment.filter((e) => e !== eq) : [...panel.equipment, eq];
    setPanel({ ...panel, equipment: next });
  }
  function toggleShift(sh) {
    const next = panel.shifts.includes(sh) ? panel.shifts.filter((s) => s !== sh) : [...panel.shifts, sh];
    setPanel({ ...panel, shifts: next });
  }
  return (
    <div className="bg-white rounded p-5 mb-5" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: NAVY }}>{panel.id ? "Edit trainer" : "Add trainer"}</h3>
        <button onClick={onCancel}><X size={16} style={{ color: MUTED }} /></button>
      </div>
      <div className="mb-4" style={{ maxWidth: 320 }}>
        <FieldLabel>Name</FieldLabel>
        <input className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} value={panel.name}
          onChange={(e) => setPanel({ ...panel, name: e.target.value })} placeholder="Marcus Webb" />
      </div>
      <div className="grid grid-cols-2 gap-6 mb-5">
        <div>
          <div className="text-xs mb-2" style={{ color: MUTED }}>Authorized equipment</div>
          {groupEquipmentByProgram().map(({ program, items }) => (
            <div key={program} className="mb-3">
              <div className="text-xs mb-1" style={{ color: NAVY, fontWeight: 600 }}>{program}</div>
              {items.map((eq) => (
                <label key={eq} className="flex items-center gap-2 text-sm mb-1.5">
                  <input type="checkbox" checked={panel.equipment.includes(eq)} onChange={() => toggleEquipment(eq)} /> {eq}
                </label>
              ))}
            </div>
          ))}
        </div>
        <div>
          <div className="text-xs mb-2" style={{ color: MUTED }}>Shift availability</div>
          {SHIFTS.map((sh) => (
            <label key={sh} className="flex items-center gap-2 text-sm mb-1.5">
              <input type="checkbox" checked={panel.shifts.includes(sh)} onChange={() => toggleShift(sh)} /> {sh}
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <PrimaryButton onClick={onSave}>Save trainer</PrimaryButton>
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
      </div>
    </div>
  );
}

// ================= SCHEDULE =================
function ScheduleTab({ sessions, trainers, operators, trainerName, operatorName, onAdd, onEdit, onDelete, confirmDelete, onConfirmDelete, onCancelDelete, onMarkStatus, panel, setPanel, onSavePanel, trainerConflicts }) {
  const today = todayStr();
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter((s) => s.date >= today || s.status === "Scheduled");
  const past = sorted.filter((s) => !(s.date >= today || s.status === "Scheduled"));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-lg font-semibold" style={{ color: NAVY }}>Schedule</h1>
        <button onClick={onAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-white" style={{ background: NAVY }}>
          <Plus size={14} /> Add session
        </button>
      </div>
      <p className="text-sm mb-4" style={{ color: MUTED }}>Training sessions and trainer assignment.</p>

      {panel && (
        <SessionPanel panel={panel} setPanel={setPanel} onSave={onSavePanel} onCancel={() => setPanel(null)}
          trainers={trainers} operators={operators} trainerConflicts={trainerConflicts} trainerName={trainerName} />
      )}

      <SessionTable
        title="Upcoming"
        rows={upcoming}
        emptyText="Nothing scheduled."
        trainerName={trainerName}
        operatorName={operatorName}
        onEdit={onEdit}
        onDelete={onDelete}
        confirmDelete={confirmDelete}
        onConfirmDelete={onConfirmDelete}
        onCancelDelete={onCancelDelete}
        onMarkStatus={onMarkStatus}
      />
      {past.length > 0 && (
        <div className="mt-6">
          <SessionTable
            title="Past"
            rows={past}
            emptyText=""
            trainerName={trainerName}
            operatorName={operatorName}
            onEdit={onEdit}
            onDelete={onDelete}
            confirmDelete={confirmDelete}
            onConfirmDelete={onConfirmDelete}
            onCancelDelete={onCancelDelete}
            onMarkStatus={onMarkStatus}
          />
        </div>
      )}
    </div>
  );
}

function SessionTable({ title, rows, emptyText, trainerName, operatorName, onEdit, onDelete, confirmDelete, onConfirmDelete, onCancelDelete, onMarkStatus }) {
  return (
    <div>
      <div className="text-sm font-medium mb-2" style={{ color: NAVY }}>{title}</div>
      <div className="bg-white rounded overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: NAVY }}>
              <th className="text-left text-white text-xs font-medium px-3 py-2">Date</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2">Equipment</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2">Type</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2">Trainer</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2">Trainees</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2">Status</th>
              <th className="text-left text-white text-xs font-medium px-3 py-2" style={{ width: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-center text-sm py-6" style={{ color: MUTED }}>{emptyText}</td></tr>
            )}
            {rows.map((s, i) => (
              <tr key={s.id} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#FAFBFC", borderTop: `1px solid ${BORDER}` }}>
                <td className="px-3 py-2" style={{ color: NAVY }}>{fmtDate(s.date)}</td>
                <td className="px-3 py-2" style={{ color: NAVY }}>{s.equipment}</td>
                <td className="px-3 py-2" style={{ color: MUTED }}>{s.type}</td>
                <td className="px-3 py-2" style={{ color: MUTED }}>{trainerName(s.trainerId)}</td>
                <td className="px-3 py-2" style={{ color: MUTED }}>{s.trainees.map(operatorName).join(", ") || "\u2014"}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded border ${s.status === "Completed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : s.status === "Cancelled" ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {s.status === "Scheduled" && (
                      <button onClick={() => onMarkStatus(s.id, "Completed")} title="Mark completed"><CheckCircle2 size={14} style={{ color: "#2E7D5B" }} /></button>
                    )}
                    <button onClick={() => onEdit(s)} title="Edit"><Pencil size={14} style={{ color: MUTED }} /></button>
                    {confirmDelete?.kind === "session" && confirmDelete.id === s.id ? (
                      <>
                        <button onClick={() => onConfirmDelete(s.id)} className="text-xs text-red-600 font-medium">Confirm</button>
                        <button onClick={onCancelDelete} className="text-xs" style={{ color: MUTED }}>Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => onDelete(s.id)} title="Delete"><Trash2 size={14} style={{ color: MUTED }} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionPanel({ panel, setPanel, onSave, onCancel, trainers, operators, trainerConflicts, trainerName }) {
  const eligibleTrainers = trainers.filter((t) => t.equipment.includes(panel.equipment));
  const conflicts = trainerConflicts(panel.trainerId, panel.date, panel.id);

  function toggleTrainee(id) {
    const next = panel.trainees.includes(id) ? panel.trainees.filter((t) => t !== id) : [...panel.trainees, id];
    setPanel({ ...panel, trainees: next });
  }

  return (
    <div className="bg-white rounded p-5 mb-5" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium" style={{ color: NAVY }}>{panel.id ? "Edit session" : "Add session"}</h3>
        <button onClick={onCancel}><X size={16} style={{ color: MUTED }} /></button>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <FieldLabel>Date</FieldLabel>
          <input type="date" className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} value={panel.date}
            onChange={(e) => setPanel({ ...panel, date: e.target.value })} />
        </div>
        <div>
          <FieldLabel>Equipment</FieldLabel>
          <select className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} value={panel.equipment}
            onChange={(e) => setPanel({ ...panel, equipment: e.target.value, trainerId: "" })}>
            {groupEquipmentByProgram().map(({ program, items }) => (
              <optgroup key={program} label={program}>
                {items.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Session type</FieldLabel>
          <select className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} value={panel.type}
            onChange={(e) => setPanel({ ...panel, type: e.target.value })}>
            {SESSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <FieldLabel>Trainer (authorized for {panel.equipment})</FieldLabel>
          <select className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} value={panel.trainerId}
            onChange={(e) => setPanel({ ...panel, trainerId: e.target.value })}>
            <option value="">Select trainer…</option>
            {eligibleTrainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {eligibleTrainers.length === 0 && (
            <div className="text-xs mt-1" style={{ color: "#B3261E" }}>No trainer authorized for {panel.equipment} yet.</div>
          )}
          {conflicts.length > 0 && (
            <div className="text-xs mt-1 flex items-center gap-1" style={{ color: "#8A5D0B" }}>
              <AlertTriangle size={12} /> {trainerName(panel.trainerId)} already has a session on {fmtDate(panel.date)}.
            </div>
          )}
        </div>
        <div>
          <FieldLabel>Status</FieldLabel>
          <select className="w-full border rounded px-3 py-2 text-sm" style={{ borderColor: BORDER }} value={panel.status}
            onChange={(e) => setPanel({ ...panel, status: e.target.value })}>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <div className="mb-5">
        <FieldLabel>Trainees</FieldLabel>
        <div className="border rounded p-2 max-h-32 overflow-auto" style={{ borderColor: BORDER }}>
          {operators.length === 0 && <div className="text-sm px-1 py-1" style={{ color: MUTED }}>No operators yet.</div>}
          {operators.map((op) => (
            <label key={op.id} className="flex items-center gap-2 text-sm px-1 py-1">
              <input type="checkbox" checked={panel.trainees.includes(op.id)} onChange={() => toggleTrainee(op.id)} /> {op.name}
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <PrimaryButton onClick={onSave} disabled={!panel.date || !panel.trainerId}>Save session</PrimaryButton>
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
      </div>
    </div>
  );
}
