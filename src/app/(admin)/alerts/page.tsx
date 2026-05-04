"use client";

import { useEffect, useState, useCallback } from "react";
import { getClient } from "@/lib/supabase/client";
import {
  AlertTriangle, Bell, Camera, CheckCircle2, ChevronLeft, ChevronRight,
  Clock, Download, Eye, Filter, Hash, LayoutGrid, LayoutList,
  RefreshCw, Search, Shield, Truck, Weight, X, ZapOff, CheckCheck,
  Calendar, SlidersHorizontal,
} from "lucide-react";

const supabase = getClient();

// ── Types ─────────────────────────────────────────────────────────────────────
type CategoryFilter = "all" | "low_visibility" | "pulp_overflow" | "paper_cut";
type SeverityFilter = "all" | "critical" | "warning" | "info";
type ViewMode = "grid" | "list";

interface Alert {
  id: string;
  camera_id: string | null;
  detector: string;
  event_type: string;
  severity: string;
  confidence: number | null;
  message: string | null;
  extra: Record<string, unknown> | null;
  snapshot_url: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_snapshot_url: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [12, 24, 48];

const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
  { key: "all",            label: "ALL" },
  { key: "low_visibility", label: "LOW VISIBILITY" },
  { key: "pulp_overflow",  label: "PULP OVERFLOW" },
  { key: "paper_cut",      label: "PAPER CUT" },
];

const SEVERITY_CFG = {
  critical: { label: "CRITICAL", bg: "bg-red-500",    text: "text-red-600",    border: "border-red-400",    dot: "bg-red-400",    light: "bg-red-50",    icon: "text-red-500" },
  warning:  { label: "WARNING",  bg: "bg-amber-500",  text: "text-amber-600",  border: "border-amber-400",  dot: "bg-amber-400",  light: "bg-amber-50",  icon: "text-amber-500" },
  info:     { label: "INFO",     bg: "bg-blue-500",   text: "text-blue-600",   border: "border-blue-300",   dot: "bg-blue-400",   light: "bg-blue-50",   icon: "text-blue-500" },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "—";

const timeAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) !== 1 ? "s" : ""} ago`;
};

// Map detector/event_type to category filter
const getCategory = (alert: Alert): CategoryFilter => {
  const d = (alert.detector + alert.event_type).toLowerCase();
  if (d.includes("visibility") || d.includes("fog") || d.includes("low_vis")) return "low_visibility";
  if (d.includes("pulp") || d.includes("overflow"))                            return "pulp_overflow";
  if (d.includes("paper") || d.includes("cut"))                               return "paper_cut";
  return "all";
};

// ── Severity Badge ─────────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CFG[severity as keyof typeof SEVERITY_CFG] ?? SEVERITY_CFG.warning;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white tracking-wide ${cfg.bg}`}>
      <span className={`w-1 h-1 rounded-full bg-white/60`} />
      {cfg.label}
    </span>
  );
}

// ── Confidence Pill ───────────────────────────────────────────────────────────
function ConfPill({ value }: { value: number | null }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const cls = pct >= 90 ? "bg-emerald-100 text-emerald-700"
            : pct >= 70 ? "bg-amber-100 text-amber-700"
            : "bg-red-100 text-red-700";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cls}`}>{pct}%</span>;
}

// ── Pagination Button ─────────────────────────────────────────────────────────
function PagBtn({ onClick, disabled, children }: {
  onClick: () => void; disabled: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold">
      {children}
    </button>
  );
}

// ── Snapshot Lightbox ─────────────────────────────────────────────────────────
function SnapshotLightbox({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}>
      <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg z-10">
          <X size={13} className="text-slate-700" />
        </button>
        <img src={url} alt={label} className="w-full rounded-xl shadow-2xl" />
        <p className="mt-2 text-center text-xs text-white/60 font-medium">{label}</p>
      </div>
    </div>
  );
}

// ── Alert Detail Drawer ───────────────────────────────────────────────────────
function AlertDrawer({ alert, onClose, onResolve }: {
  alert: Alert;
  onClose: () => void;
  onResolve: (id: string) => void;
}) {
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [resolving, setResolving] = useState(false);
  const cfg = SEVERITY_CFG[alert.severity as keyof typeof SEVERITY_CFG] ?? SEVERITY_CFG.warning;

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const handleResolve = async () => {
    setResolving(true);
    await supabase.from("alerts").update({
      is_resolved: true,
      resolved_at: new Date().toISOString(),
    }).eq("id", alert.id);
    onResolve(alert.id);
    setResolving(false);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-[480px] bg-white z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className={`shrink-0 px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 ${cfg.light}`}>
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
              <AlertTriangle size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-0.5">Alert Details</p>
              <h2 className="text-sm font-bold text-slate-900 leading-snug">{alert.event_type}</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{alert.detector}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-all shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

          {/* Status + meta */}
          <div className="px-5 pt-4 pb-3">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
              {[
                { label: "Camera",    value: alert.camera_id ?? "—" },
                { label: "Severity",  value: <SeverityBadge severity={alert.severity} /> },
                { label: "Status",    value: alert.is_resolved
                  ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} />Resolved</span>
                  : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><Clock size={10} />Active</span>
                },
                { label: "Confidence", value: <ConfPill value={alert.confidence} /> },
                { label: "Triggered",  value: fmtDate(alert.created_at) },
                { label: "Resolved",   value: fmtDate(alert.resolved_at) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-slate-400 font-semibold mb-0.5 uppercase tracking-wider">{label}</p>
                  <div className="text-xs font-semibold text-slate-800">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Message */}
          {alert.message && (
            <div className="px-5 pb-3">
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">Message</p>
              <div className={`flex items-start gap-2 rounded-xl border p-3 ${cfg.light} border-${cfg.border}`}>
                <AlertTriangle size={13} className={`${cfg.icon} mt-0.5 shrink-0`} />
                <p className="text-xs text-slate-700 leading-relaxed">{alert.message}</p>
              </div>
            </div>
          )}

          {/* Snapshots */}
          <div className="px-5 pb-3">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">Snapshots</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { url: alert.snapshot_url,          label: "TRIGGER SNAPSHOT",  sub: "At detection" },
                { url: alert.resolved_snapshot_url,  label: "RESOLVED SNAPSHOT", sub: "At resolution" },
              ].map(({ url, label, sub }) => (
                <div key={label}
                  onClick={() => url && setLightbox({ url, label })}
                  className={`relative rounded-lg overflow-hidden bg-slate-900 aspect-video flex flex-col ${url ? "cursor-zoom-in" : ""}`}>
                  {url ? (
                    <img src={url} alt={label} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                      <Camera size={18} className="text-slate-600" />
                      <span className="text-[9px] text-slate-600 font-medium">No snapshot</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                    <span className="text-[9px] font-bold text-white/90 tracking-widest">{label}</span>
                    <span className="block text-[8px] text-white/50">{sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Extra data */}
          {alert.extra && Object.keys(alert.extra).length > 0 && (
            <div className="px-5 pb-5">
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">Additional Data</p>
              <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                {Object.entries(alert.extra).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between px-3 py-2 bg-white">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{k.replace(/_/g, " ")}</span>
                    <span className="text-xs font-mono text-slate-800">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer action */}
        {!alert.is_resolved && (
          <div className="shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50/60">
            <button onClick={handleResolve} disabled={resolving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-60">
              {resolving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCheck size={14} />}
              {resolving ? "Resolving…" : "Mark as Resolved"}
            </button>
          </div>
        )}
      </div>

      {lightbox && (
        <SnapshotLightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

// ── Alert Card (Grid) ─────────────────────────────────────────────────────────
function AlertCard({ alert, onClick }: { alert: Alert; onClick: () => void }) {
  const cfg = SEVERITY_CFG[alert.severity as keyof typeof SEVERITY_CFG] ?? SEVERITY_CFG.warning;
  const borderColor = alert.severity === "critical" ? "border-red-400"
    : alert.severity === "warning" ? "border-amber-400"
    : "border-blue-300";

  return (
    <div onClick={onClick}
      className={`bg-white rounded-xl border-2 ${borderColor} ${alert.is_resolved ? "opacity-70" : ""} overflow-hidden cursor-pointer hover:shadow-md transition-all group`}>
      {/* Snapshot area */}
      <div className="relative bg-slate-900 aspect-video overflow-hidden">
        {alert.snapshot_url ? (
          <img src={alert.snapshot_url} alt="Alert snapshot"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera size={28} className="text-slate-600" />
          </div>
        )}
        {/* Top overlays */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {alert.camera_id && (
            <span className="bg-black/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md tracking-widest">
              {alert.camera_id.toUpperCase()}
            </span>
          )}
          <span className="bg-black/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
            {alert.event_type}
          </span>
        </div>
        {alert.is_resolved && (
          <div className="absolute top-2 right-2">
            <span className="bg-slate-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-md tracking-wider">
              RESOLVED
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5">
        <div className="flex items-start gap-2.5 mb-2.5">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${cfg.light}`}>
            <AlertTriangle size={12} className={cfg.icon} />
          </div>
          <p className="text-xs text-slate-700 leading-relaxed flex-1">
            {alert.message ?? `${alert.event_type} detected by ${alert.detector}`}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">{timeAgo(alert.created_at)}</span>
          <button className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Alert Row (List) ──────────────────────────────────────────────────────────
function AlertRow({ alert, onClick, idx }: { alert: Alert; onClick: () => void; idx: number }) {
  const cfg = SEVERITY_CFG[alert.severity as keyof typeof SEVERITY_CFG] ?? SEVERITY_CFG.warning;

  return (
    <tr onClick={onClick}
      className={`border-b border-slate-50 transition-colors hover:bg-blue-50/30 group cursor-pointer ${idx % 2 !== 0 ? "bg-slate-50/30" : ""}`}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${cfg.light}`}>
            <AlertTriangle size={11} className={cfg.icon} />
          </div>
          <span className="text-xs font-semibold text-slate-800">{alert.event_type}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
          {alert.camera_id?.toUpperCase() ?? "—"}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <span className="text-xs text-slate-600">{alert.detector}</span>
      </td>
      <td className="px-4 py-2.5">
        <SeverityBadge severity={alert.severity} />
      </td>
      <td className="px-4 py-2.5">
        {alert.is_resolved
          ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><CheckCircle2 size={9} />Resolved</span>
          : <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><Clock size={9} />Active</span>
        }
      </td>
      <td className="px-4 py-2.5">
        <p className="text-xs text-slate-600 max-w-[200px] truncate">
          {alert.message ?? "—"}
        </p>
      </td>
      <td className="px-4 py-2.5">
        <span className="text-[10px] text-slate-400 whitespace-nowrap">{timeAgo(alert.created_at)}</span>
      </td>
      <td className="px-4 py-2.5">
        <button onClick={e => { e.stopPropagation(); onClick(); }}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all opacity-0 group-hover:opacity-100">
          <Eye size={12} />
        </button>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AlertsPage() {
  const [alerts, setAlerts]               = useState<Alert[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [pageSize, setPageSize]           = useState(12);
  const [loading, setLoading]             = useState(true);
  const [selected, setSelected]           = useState<Alert | null>(null);
  const [category, setCategory]           = useState<CategoryFilter>("all");
  const [severity, setSeverity]           = useState<SeverityFilter>("all");
  const [resolvedFilter, setResolvedFilter] = useState<"all" | "active" | "resolved">("all");
  const [search, setSearch]               = useState("");
  const [searchInput, setSearchInput]     = useState("");
  const [dateFrom, setDateFrom]           = useState("");
  const [dateTo, setDateTo]               = useState("");
  const [showFilters, setShowFilters]     = useState(false);
  const [viewMode, setViewMode]           = useState<ViewMode>("grid");
  const [stats, setStats]                 = useState({ total: 0, active: 0, resolved: 0, critical: 0 });

  // Stats
  useEffect(() => {
    supabase.from("alerts").select("severity, is_resolved").then(({ data }) => {
      if (!data) return;
      const s = { total: data.length, active: 0, resolved: 0, critical: 0 };
      data.forEach((r: { severity: string; is_resolved: boolean }) => {
        if (!r.is_resolved) s.active++;
        if (r.is_resolved)  s.resolved++;
        if (r.severity === "critical") s.critical++;
      });
      setStats(s);
    });
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [category, severity, resolvedFilter, search, dateFrom, dateTo]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("alerts")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (severity !== "all")            q = q.eq("severity", severity);
    if (resolvedFilter === "active")   q = q.eq("is_resolved", false);
    if (resolvedFilter === "resolved") q = q.eq("is_resolved", true);
    if (search)                        q = q.or(`event_type.ilike.%${search}%,detector.ilike.%${search}%,message.ilike.%${search}%,camera_id.ilike.%${search}%`);
    if (dateFrom)                      q = q.gte("created_at", dateFrom);
    if (dateTo)                        q = q.lte("created_at", dateTo + "T23:59:59");

    // Category filter maps to detector/event_type patterns
    if (category !== "all") {
      const patterns: Record<Exclude<CategoryFilter, "all">, string> = {
        low_visibility: "visibility",
        pulp_overflow:  "pulp",
        paper_cut:      "paper",
      };
      q = q.or(`detector.ilike.%${patterns[category]}%,event_type.ilike.%${patterns[category]}%`);
    }

    const { data, count, error } = await q;
    if (!error) { setAlerts(data ?? []); setTotal(count ?? 0); }
    setLoading(false);
  }, [page, pageSize, category, severity, resolvedFilter, search, dateFrom, dateTo]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleResolve = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_resolved: true, resolved_at: new Date().toISOString() } : a));
    setStats(prev => ({ ...prev, active: prev.active - 1, resolved: prev.resolved + 1 }));
  };

  const totalPages = Math.ceil(total / pageSize);
  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | "…")[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

  const hasActiveFilters = severity !== "all" || resolvedFilter !== "all" || dateFrom || dateTo;

  return (
    <div className="h-full flex flex-col bg-[#f4f6f9] overflow-hidden">

      {/* ── Top bar ── */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-6 py-3 flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
            <Bell size={14} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Alerts</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">{total.toLocaleString()} alerts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAlerts} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

        {/* Stat Cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: Hash,          label: "Total Alerts",    value: stats.total,    color: "bg-slate-700" },
            { icon: AlertTriangle, label: "Active",          value: stats.active,   color: "bg-amber-500" },
            { icon: CheckCircle2,  label: "Resolved",        value: stats.resolved, color: "bg-emerald-500" },
            { icon: ZapOff,        label: "Critical",        value: stats.critical, color: "bg-red-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-100 px-3.5 py-3 flex items-center gap-3 shadow-sm">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon size={15} className="text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{value.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Category Tabs + Filters bar */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          {/* Category tabs */}
          <div className="flex items-center border-b border-slate-100 px-3.5 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}>
            {CATEGORY_TABS.map(tab => (
              <button key={tab.key} onClick={() => setCategory(tab.key)}
                className={`relative px-4 py-3 text-[11px] font-bold tracking-widest whitespace-nowrap transition-all ${
                  category === tab.key
                    ? "text-blue-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}>
                {tab.label}
                {category === tab.key && (
                  <span className="absolute bottom-0 inset-x-2 h-0.5 bg-blue-600 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
            {/* Search */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 min-w-[180px]">
              <Search size={12} className="text-slate-400 shrink-0" />
              <input type="text" placeholder="Search event, camera, message…" value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none w-full" />
              {searchInput && (
                <button onClick={() => setSearchInput("")}>
                  <X size={11} className="text-slate-400 hover:text-slate-600" />
                </button>
              )}
            </div>

            {/* Status filter */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
              {([
                { key: "all",      label: "All" },
                { key: "active",   label: "Active" },
                { key: "resolved", label: "Resolved" },
              ] as const).map(s => (
                <button key={s.key} onClick={() => setResolvedFilter(s.key)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    resolvedFilter === s.key ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Severity select */}
            <select value={severity} onChange={e => setSeverity(e.target.value as SeverityFilter)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none cursor-pointer">
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>

            {/* Advanced filters toggle */}
            <div className="relative">
              <button onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  hasActiveFilters
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}>
                <SlidersHorizontal size={12} />
                Filters
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </button>
              {showFilters && (
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-20 w-64">
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Date Range</p>
                    {[{ lbl: "From", val: dateFrom, set: setDateFrom }, { lbl: "To", val: dateTo, set: setDateTo }].map(({ lbl, val, set }) => (
                      <div key={lbl}>
                        <label className="text-[10px] font-semibold text-slate-500 mb-1 block">{lbl}</label>
                        <input type="date" value={val} onChange={e => set(e.target.value)}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none" />
                      </div>
                    ))}
                    <div className="flex gap-1.5 pt-1">
                      <button onClick={() => { setDateFrom(""); setDateTo(""); setShowFilters(false); }}
                        className="flex-1 py-1.5 text-[10px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                        Clear
                      </button>
                      <button onClick={() => setShowFilters(false)}
                        className="flex-1 py-1.5 text-[10px] font-semibold text-white bg-slate-900 rounded-lg">
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* View mode toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5 ml-auto">
              <button onClick={() => setViewMode("grid")}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                  viewMode === "grid" ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}>
                <LayoutGrid size={13} />
              </button>
              <button onClick={() => setViewMode("list")}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                  viewMode === "list" ? "bg-slate-900 text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                }`}>
                <LayoutList size={13} />
              </button>
            </div>

            {/* Page size */}
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 outline-none cursor-pointer">
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} / page</option>)}
            </select>
          </div>
        </div>

        {/* ── Grid View ── */}
        {viewMode === "grid" && (
          <>
            {loading ? (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: pageSize > 6 ? 6 : pageSize }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border-2 border-slate-100 overflow-hidden animate-pulse">
                    <div className="aspect-video bg-slate-200" />
                    <div className="p-3.5 space-y-2">
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 py-20 flex flex-col items-center gap-3 text-slate-400">
                <Bell size={36} className="opacity-20" />
                <p className="text-sm font-medium">No alerts found</p>
                <p className="text-xs">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {alerts.map(alert => (
                  <AlertCard key={alert.id} alert={alert} onClick={() => setSelected(alert)} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── List View ── */}
        {viewMode === "list" && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {["Event", "Camera", "Detector", "Severity", "Status", "Message", "Time", ""].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 tracking-widest uppercase whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-2.5">
                            <div className="h-3 bg-slate-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : alerts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Bell size={28} className="opacity-30" />
                          <p className="text-xs font-medium">No alerts found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    alerts.map((alert, idx) => (
                      <AlertRow key={alert.id} alert={alert} idx={idx} onClick={() => setSelected(alert)} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && total > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3 flex items-center justify-between">
            <p className="text-[10px] text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
              </span>
              {" "}of{" "}
              <span className="font-semibold text-slate-700">{total.toLocaleString()}</span>
            </p>
            <div className="flex items-center gap-1">
              <PagBtn onClick={() => setPage(1)} disabled={page === 1}>«</PagBtn>
              <PagBtn onClick={() => setPage(p => p - 1)} disabled={page === 1}>
                <ChevronLeft size={12} />
              </PagBtn>
              {pageNums.map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="w-7 text-center text-slate-400 text-xs">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)}
                    className={`w-7 h-7 rounded-md text-xs font-semibold transition-all ${
                      page === p ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}>
                    {p}
                  </button>
                )
              )}
              <PagBtn onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
                <ChevronRight size={12} />
              </PagBtn>
              <PagBtn onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</PagBtn>
            </div>
          </div>
        )}

        <div className="h-2" />
      </div>

      {/* ── Detail Drawer ── */}
      {selected && (
        <AlertDrawer
          alert={selected}
          onClose={() => setSelected(null)}
          onResolve={handleResolve}
        />
      )}
    </div>
  );
}