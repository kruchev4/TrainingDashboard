// Supabase Edge Function: teams-digest
// Reads the dashboard data from the kv table, builds an Adaptive Card digest, and posts it to a
// Microsoft Teams Workflows webhook. Triggered daily by pg_cron, or manually from the dashboard's
// Alerts tab ("Send test message").
//
// Secrets (Edge Functions > Secrets):  TEAMS_WEBHOOK_URL   CRON_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
// Deploy with JWT verification OFF (this function does its own auth):
//   supabase functions deploy teams-digest --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const TZ = "America/New_York";
const DEFAULT_SETTINGS = {
  teamsEnabled: false,
  leadDays: 30,        // list recerts due within this many days
  sessionDays: 7,      // list training sessions in the next N days
  frequency: "weekdays", // "weekdays" | "mondays"
  showNames: true,     // false = counts per equipment only
  siteUrl: "",
};
const MAX_LINES = 10;

// ---------- date helpers (pure, timezone-safe: all math on YYYY-MM-DD strings) ----------
export function todayInZone(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now); // YYYY-MM-DD
}
function toUtcMs(d) { const [y, m, day] = d.split("-").map(Number); return Date.UTC(y, m - 1, day); }
export function diffDays(a, b) { return Math.round((toUtcMs(a) - toUtcMs(b)) / 86400000); } // a - b
export function addDays(d, n) { return new Date(toUtcMs(d) + n * 86400000).toISOString().slice(0, 10); }
function weekdayOf(d) { return new Date(toUtcMs(d)).getUTCDay(); } // 0=Sun
function fmt(d) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

// ---------- digest builder (pure) ----------
export function buildDigest(data, settingsIn, today) {
  const settings = { ...DEFAULT_SETTINGS, ...(settingsIn || {}) };
  const catalog = data.catalog || [];
  const cycleOf = (eq) => {
    const c = catalog.find((x) => x.name === eq);
    return c && Number.isFinite(c.cycleDays) ? c.cycleDays : 365;
  };
  const known = new Set(catalog.map((c) => c.name));

  const overdue = [], dueSoon = [];
  for (const op of data.operators || []) {
    for (const [eq, cert] of Object.entries(op.certs || {})) {
      if (!known.has(eq) || !cert || !cert.certified || !cert.certDate) continue;
      const cycle = cycleOf(eq);
      if (!cycle) continue;
      const due = addDays(cert.certDate, cycle);
      const left = diffDays(due, today);
      const row = { name: op.name, equipment: eq, due, left };
      if (left < 0) overdue.push(row);
      else if (left <= settings.leadDays) dueSoon.push(row);
    }
  }
  overdue.sort((a, b) => a.left - b.left);
  dueSoon.sort((a, b) => a.left - b.left);

  const opName = (id) => (data.operators || []).find((o) => o.id === id)?.name || "removed operator";
  const trName = (id) => (data.trainers || []).find((t) => t.id === id)?.name || "unassigned";
  const horizon = addDays(today, settings.sessionDays);
  const sessions = (data.sessions || [])
    .filter((s) => s.status === "Scheduled" && s.date >= today && s.date <= horizon)
    .sort((a, b) => a.date.localeCompare(b.date));

  // equipment with due/overdue operators but no authorized trainer
  const gaps = [];
  for (const eq of new Set([...overdue, ...dueSoon].map((r) => r.equipment))) {
    const trainers = (data.trainers || []).filter((t) => (t.equipment || []).includes(eq)).length;
    if (trainers === 0) gaps.push(eq);
  }

  const counts = { overdue: overdue.length, dueSoon: dueSoon.length, sessions: sessions.length, gaps: gaps.length };
  const nothing = !counts.overdue && !counts.dueSoon && !counts.sessions && !counts.gaps;
  return { settings, overdue, dueSoon, sessions, gaps, counts, nothing, opName, trName, today };
}

function byEquipmentCounts(rows) {
  const m = {};
  rows.forEach((r) => { m[r.equipment] = (m[r.equipment] || 0) + 1; });
  return Object.entries(m).map(([eq, n]) => `${eq}: ${n}`).join(" · ");
}

export function buildCard(d, { test = false } = {}) {
  const { settings, counts } = d;
  const body = [];
  const heading = (text, color) => body.push({ type: "TextBlock", text, weight: "Bolder", color, spacing: "Medium", wrap: true });
  const line = (text) => body.push({ type: "TextBlock", text, wrap: true, spacing: "None", size: "Small" });
  const more = (n) => n > MAX_LINES && line(`…and ${n - MAX_LINES} more (see the dashboard)`);

  body.push({ type: "TextBlock", text: (test ? "TEST — " : "") + "MHE Certification Alerts — Jabil Prince George", weight: "Bolder", size: "Medium", wrap: true });
  body.push({ type: "TextBlock", text: `${fmt(d.today)} · ${counts.overdue} overdue · ${counts.dueSoon} due within ${settings.leadDays} days · ${counts.sessions} session(s) in next ${settings.sessionDays} days`, wrap: true, isSubtle: true, spacing: "Small", size: "Small" });

  if (d.nothing) {
    heading("All clear — nothing overdue, due soon, or scheduled in this window.", "Good");
  }
  if (counts.overdue) {
    heading(`Overdue (${counts.overdue})`, "Attention");
    if (settings.showNames) {
      d.overdue.slice(0, MAX_LINES).forEach((r) => line(`${r.name} — ${r.equipment} (${-r.left} day${-r.left === 1 ? "" : "s"} overdue, was due ${fmt(r.due)})`));
      more(counts.overdue);
    } else line(byEquipmentCounts(d.overdue));
  }
  if (counts.dueSoon) {
    heading(`Due within ${settings.leadDays} days (${counts.dueSoon})`, "Warning");
    if (settings.showNames) {
      d.dueSoon.slice(0, MAX_LINES).forEach((r) => line(`${r.name} — ${r.equipment} (due ${fmt(r.due)}, ${r.left === 0 ? "today" : r.left + " day" + (r.left === 1 ? "" : "s")})`));
      more(counts.dueSoon);
    } else line(byEquipmentCounts(d.dueSoon));
  }
  if (counts.sessions) {
    heading(`Training sessions — next ${settings.sessionDays} days (${counts.sessions})`, "Accent");
    d.sessions.slice(0, MAX_LINES).forEach((s) =>
      line(`${fmt(s.date)} — ${s.type}: ${s.equipment} · ${d.trName(s.trainerId)} · ${(s.trainees || []).length} trainee(s)`));
    more(counts.sessions);
  }
  if (counts.gaps) {
    heading("Trainer coverage gap", "Attention");
    line("No authorized trainer for: " + d.gaps.join(", "));
  }

  const card = { type: "AdaptiveCard", $schema: "http://adaptivecards.io/schemas/adaptive-card.json", version: "1.4", body };
  if (settings.siteUrl) card.actions = [{ type: "Action.OpenUrl", title: "Open dashboard", url: settings.siteUrl }];
  return { type: "message", attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null, content: card }] };
}

// ---------- HTTP handler ----------
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "access-control-allow-methods": "POST, OPTIONS",
};
function json(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, "content-type": "application/json" } });
}

export async function handle(req, env, deps = {}) {
  const makeClient = deps.createClient || createClient;
  const doFetch = deps.fetch || fetch;
  const now = deps.now || new Date();

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const admin = makeClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // --- auth: cron secret, or a signed-in dashboard user (the public anon key alone is NOT enough)
  const cronOk = env.CRON_SECRET && req.headers.get("x-cron-secret") === env.CRON_SECRET;
  let userOk = false;
  if (!cronOk) {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (token) {
      const { data, error } = await admin.auth.getUser(token);
      userOk = !error && !!data?.user;
    }
  }
  if (!cronOk && !userOk) return json(401, { error: "Not authorized" });

  let body = {};
  try { body = await req.json(); } catch (_) { /* empty body is fine */ }
  const test = !!body.test && userOk; // only signed-in users can force a test send

  // --- load data
  const { data: rows, error: readErr } = await admin.from("kv").select("key,value");
  if (readErr) return json(500, { error: "Could not read data: " + readErr.message });
  const kv = {};
  for (const r of rows || []) { try { kv[r.key] = JSON.parse(r.value); } catch (_) { /* skip bad row */ } }
  const settings = { ...DEFAULT_SETTINGS, ...(kv.mhe_settings || {}) };
  const today = todayInZone(now);

  if (!test) {
    if (!settings.teamsEnabled) return json(200, { skipped: "Teams alerts are turned off in the dashboard." });
    if (settings.frequency === "mondays" && weekdayOf(today) !== 1) return json(200, { skipped: "Mondays-only schedule." });
  }

  const digest = buildDigest(
    { operators: kv.mhe_operators, trainers: kv.mhe_trainers, sessions: kv.mhe_sessions, catalog: kv.mhe_catalog },
    settings, today);

  if (!test && digest.nothing) {
    await writeLog(admin, { at: now.toISOString(), ok: true, skipped: "nothing to report", counts: digest.counts, test: false });
    return json(200, { skipped: "Nothing to report today.", counts: digest.counts });
  }

  const hook = env.TEAMS_WEBHOOK_URL;
  if (!hook) {
    const msg = "TEAMS_WEBHOOK_URL secret is not set on the Edge Function.";
    await writeLog(admin, { at: now.toISOString(), ok: false, error: msg, test });
    return json(500, { error: msg });
  }

  let status = 0, errText = "";
  try {
    const res = await doFetch(hook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(buildCard(digest, { test })) });
    status = res.status;
    if (!res.ok) errText = (await res.text()).slice(0, 300);
  } catch (e) { errText = String(e && e.message ? e.message : e); }

  const ok = status >= 200 && status < 300;
  await writeLog(admin, { at: now.toISOString(), ok, status, counts: digest.counts, test, error: ok ? undefined : (errText || "HTTP " + status) });
  if (!ok) return json(502, { error: "Teams webhook rejected the message (HTTP " + status + "). " + errText });
  return json(200, { sent: true, counts: digest.counts, test });
}

async function writeLog(admin, entry) {
  try {
    await admin.from("kv").upsert({ key: "mhe_alert_log", value: JSON.stringify(entry), updated_at: new Date().toISOString(), updated_by: "teams-digest" });
  } catch (_) { /* logging is best-effort */ }
}

// @ts-ignore Deno global
if (typeof Deno !== "undefined" && Deno.serve) {
  // @ts-ignore
  Deno.serve((req) => handle(req, {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    TEAMS_WEBHOOK_URL: Deno.env.get("TEAMS_WEBHOOK_URL"),
    CRON_SECRET: Deno.env.get("CRON_SECRET"),
  }));
}
