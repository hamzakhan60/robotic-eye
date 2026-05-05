"use client";

import { useEffect, useState, useCallback } from "react";
import { getClient } from "@/lib/supabase/client";
import {
  Scale, Download, Search, X, ChevronLeft, ChevronRight,
  AlertTriangle, Clock, CheckCircle2, Eye, RefreshCw,
  Calendar, User, Truck, Flag, Hash, Weight, Camera, Ban,
} from "lucide-react";

const supabase = getClient();

// ── Types ─────────────────────────────────────────────────────────────────────
type Status = "all" | "waiting" | "complete" | "flagged" | "dismissed";

interface Operator { id: string; name: string; employee_id: string }

interface AuditEntry {
  id: string; field: string;
  ocr_value: string | null; operator_value: string | null;
  was_edited: boolean; action: string | null; created_at: string;
  operator?: { name: string } | null;
}

interface Weighing {
  id: string; token_number: string; plate_number: string | null;
  loaded_weight: number | null; empty_weight: number | null; net_load: number | null;
  status: string; entry_at: string; return_at: string | null;
  flag_reason: string | null;
  entry_snapshot_url: string | null;
  return_snapshot_url: string | null;
  entry_indoor_snapshot_url: string | null;
  return_indoor_snapshot_url: string | null;
  plate_ocr_confidence: number | null;
  loaded_weight_ocr_conf: number | null; empty_weight_ocr_conf: number | null;
  entry_operator?: { name: string } | null;
  return_operator?: { name: string } | null;
  _kind: "weighing";
}

interface DismissedRow {
  id: string;
  plate_ocr: string | null;
  weight_ocr: string | null;
  triggered_at: string;
  outdoor_snapshot_url: string | null;
  indoor_snapshot_url: string | null;
  dismiss_reason: string | null;
  status: "dismissed";
  _kind: "dismissed";
}

type TableRow = Weighing | DismissedRow;

interface SnapshotSet {
  outdoor_entry: string | null; indoor_entry: string | null;
  outdoor_exit: string | null;  indoor_exit: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 12;

const STATUS_CFG = {
  complete:  { label: "COMPLETE",  bg: "bg-emerald-500", dot: "bg-emerald-300" },
  waiting:   { label: "WAITING",   bg: "bg-amber-500",   dot: "bg-amber-300"   },
  flagged:   { label: "FLAGGED",   bg: "bg-red-500",     dot: "bg-red-300"     },
  dismissed: { label: "DISMISSED", bg: "bg-slate-500",   dot: "bg-slate-300"   },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) =>
  n != null ? n.toLocaleString("en-IN") : "—";

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "—";

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as keyof typeof STATUS_CFG];
  if (!cfg) return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wide">
      {status}
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white tracking-wide ${cfg.bg}`}>
      <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Confidence Pill ───────────────────────────────────────────────────────────
function ConfPill({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-400 text-[10px]">—</span>;
  const pct = Math.round(value * 100);
  const cls = pct >= 90 ? "bg-emerald-100 text-emerald-700"
            : pct >= 70 ? "bg-amber-100 text-amber-700"
            : "bg-red-100 text-red-700";
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cls}`}>{pct}%</span>;
}

// ── Info Cell ─────────────────────────────────────────────────────────────────
function InfoCell({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 font-semibold mb-0.5 uppercase tracking-wider">{label}</p>
      <p className={`text-xs font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

// ── Pagination Button ─────────────────────────────────────────────────────────
function PagBtn({ onClick, disabled, children }: {
  onClick: () => void; disabled: boolean; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold">
      {children}
    </button>
  );
}

// ── Snapshot Tile ─────────────────────────────────────────────────────────────
function SnapshotTile({ url, label, sub, icon: Icon }: {
  url: string | null; label: string; sub: string; icon: React.ElementType;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div onClick={() => url && setExpanded(true)}
        className={`relative rounded-lg overflow-hidden bg-slate-900 aspect-video flex flex-col ${url ? "cursor-zoom-in" : ""}`}>
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center">
              <Icon size={13} className="text-slate-500" />
            </div>
            <span className="text-[9px] text-slate-600 font-medium">No snapshot</span>
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 flex items-end justify-between">
          <span className="text-[9px] font-bold text-white/90 tracking-widest leading-none">{label}</span>
          <span className="text-[8px] text-white/50 leading-none">{sub}</span>
        </div>
      </div>
      {expanded && url && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setExpanded(false)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setExpanded(false)}
              className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg z-10">
              <X size={13} className="text-slate-700" />
            </button>
            <img src={url} alt={label} className="w-full rounded-xl shadow-2xl" />
            <div className="mt-2 text-center">
              <span className="text-xs text-white/60 font-medium">{label} · {sub}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Weighing Drawer ───────────────────────────────────────────────────────────
function WeighingDrawer({ weighing, onClose }: { weighing: Weighing; onClose: () => void }) {
  const [auditLog, setAuditLog]         = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const snapshots: SnapshotSet = {
    outdoor_entry: weighing.entry_snapshot_url,
    indoor_entry:  weighing.entry_indoor_snapshot_url,
    outdoor_exit:  weighing.return_snapshot_url,
    indoor_exit:   weighing.return_indoor_snapshot_url,
  };

  useEffect(() => {
    supabase.from("audit_log")
      .select("*, operator:operators(name)")
      .eq("weighing_id", weighing.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setAuditLog(data ?? []); setAuditLoading(false); });
  }, [weighing.id]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <>
      <style>{`
        .weighing-drawer {
          width: 460px;
        }
        @media (max-width: 639px) {
          .weighing-drawer {
            width: 100%;
            top: auto;
            bottom: 0;
            height: 90%;
            border-radius: 16px 16px 0 0;
          }
        }
        @media (min-width: 640px) and (max-width: 767px) {
          .weighing-drawer { width: 100%; }
        }
      `}</style>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40" onClick={onClose} />
      <div className="weighing-drawer fixed right-0 top-0 h-full bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-0.5">Record Details</p>
            <h2 className="text-base font-bold text-slate-900 font-mono leading-none">{weighing.token_number}</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

          {/* Snapshots 2×2 */}
          <div className="p-4 pb-3">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">Snapshots</p>
            <div className="grid grid-cols-2 gap-x-2 mb-1">
              {["Entry", "Exit"].map(h => (
                <p key={h} className="text-[9px] font-bold text-slate-400 tracking-widest uppercase text-center">{h}</p>
              ))}
            </div>
            <div className="mb-1.5">
              <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Truck size={8} /> Outdoor · Plate Camera
              </p>
              <div className="grid grid-cols-2 gap-2">
                <SnapshotTile url={snapshots.outdoor_entry} label="ENTRY" sub="Outdoor" icon={Truck} />
                <SnapshotTile url={snapshots.outdoor_exit}  label="EXIT"  sub="Outdoor" icon={Flag}  />
              </div>
            </div>
            <div>
              <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                <Camera size={8} /> Indoor · Scale Reading
              </p>
              <div className="grid grid-cols-2 gap-2">
                <SnapshotTile url={snapshots.indoor_entry} label="ENTRY" sub="Indoor / Scale" icon={Camera} />
                <SnapshotTile url={snapshots.indoor_exit}  label="EXIT"  sub="Indoor / Scale" icon={Camera} />
              </div>
            </div>
          </div>

          {/* Core info */}
          <div className="px-4 pb-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 grid grid-cols-2 gap-3">
              <InfoCell label="Token"    value={weighing.token_number}              mono />
              <InfoCell label="Plate"    value={weighing.plate_number ?? "—"}       mono />
              <InfoCell label="Operator" value={weighing.entry_operator?.name ?? "—"} />
              <InfoCell label="Status"   value={<StatusBadge status={weighing.status} />} />
              <InfoCell label="Entry"    value={fmtDate(weighing.entry_at)} />
              <InfoCell label="Return"   value={fmtDate(weighing.return_at)} />
            </div>
          </div>

          {/* Weights */}
          <div className="px-4 pb-3">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">Weight Data</p>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              {[
                { label: "Loaded Weight", value: weighing.loaded_weight, conf: weighing.loaded_weight_ocr_conf, net: false },
                { label: "Empty Weight",  value: weighing.empty_weight,  conf: weighing.empty_weight_ocr_conf,  net: false },
                { label: "Net Load",      value: weighing.net_load,      conf: null,                            net: true  },
              ].map((row, i) => (
                <div key={row.label}
                  className={`flex items-center justify-between px-3 py-2.5 ${i < 2 ? "border-b border-slate-100" : ""} ${row.net ? "bg-slate-900" : "bg-white"}`}>
                  <span className={`text-xs font-medium ${row.net ? "text-slate-300" : "text-slate-600"}`}>{row.label}</span>
                  <div className="flex items-center gap-1.5">
                    {row.conf != null && <ConfPill value={row.conf} />}
                    <span className={`text-xs font-bold font-mono tabular-nums ${row.net ? "text-emerald-400" : "text-slate-800"}`}>
                      {fmt(row.value)}{row.value != null && <span className="font-normal opacity-60 ml-0.5">kg</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Flag reason */}
          {weighing.flag_reason && (
            <div className="px-4 pb-3">
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-red-600 mb-0.5 tracking-wide uppercase">Flag Reason</p>
                  <p className="text-xs text-red-700">{weighing.flag_reason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Audit trail */}
          <div className="px-4 pb-5">
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">Audit Trail</p>
            {auditLoading ? (
              <div className="flex items-center gap-1.5 text-slate-400 text-xs py-3">
                <RefreshCw size={12} className="animate-spin" /> Loading…
              </div>
            ) : auditLog.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">No audit entries</div>
            ) : (
              <div className="space-y-1.5">
                {auditLog.map(entry => (
                  <div key={entry.id} className="rounded-lg border border-slate-100 bg-white p-2.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
                        {entry.field?.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">{fmtDate(entry.created_at)}</span>
                    </div>
                    {entry.was_edited && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <span className="line-through text-red-400 font-mono">{entry.ocr_value ?? "—"}</span>
                        <span className="text-slate-300">→</span>
                        <span className="text-emerald-600 font-mono font-semibold">{entry.operator_value ?? "—"}</span>
                      </div>
                    )}
                    {entry.operator && (
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400">
                        <User size={9} />{entry.operator.name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Dismissed Drawer ──────────────────────────────────────────────────────────
function DismissedDrawer({ row, onClose }: { row: DismissedRow; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <>
      <style>{`
        .dismissed-drawer {
          width: 460px;
        }
        @media (max-width: 639px) {
          .dismissed-drawer {
            width: 100%;
            top: auto;
            bottom: 0;
            height: 90%;
            border-radius: 16px 16px 0 0;
          }
        }
        @media (min-width: 640px) and (max-width: 767px) {
          .dismissed-drawer { width: 100%; }
        }
      `}</style>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40" onClick={onClose} />
      <div className="dismissed-drawer fixed right-0 top-0 h-full bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-0.5">Dismissed Record</p>
            <h2 className="text-base font-bold text-slate-900 font-mono leading-none">
              {row.plate_ocr ?? "Unknown Plate"}
            </h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

          {/* Snapshots */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2">Snapshots</p>
            <div className="grid grid-cols-2 gap-2">
              <SnapshotTile url={row.outdoor_snapshot_url} label="PLATE CAM" sub="Outdoor" icon={Truck}  />
              <SnapshotTile url={row.indoor_snapshot_url}  label="SCALE"     sub="Indoor"  icon={Camera} />
            </div>
          </div>

          {/* Info */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 grid grid-cols-2 gap-3">
            <InfoCell label="Plate OCR"   value={row.plate_ocr  ?? "—"} mono />
            <InfoCell label="Weight OCR"  value={row.weight_ocr ? `${parseInt(row.weight_ocr).toLocaleString()} kg` : "—"} mono />
            <InfoCell label="Detected At" value={fmtDate(row.triggered_at)} />
            <InfoCell label="Status"      value={<StatusBadge status="dismissed" />} />
          </div>

          {/* Dismiss reason */}
          {row.dismiss_reason && (
            <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <Ban size={13} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-slate-500 mb-0.5 tracking-wide uppercase">Dismiss Reason</p>
                <p className="text-xs text-slate-600">{row.dismiss_reason}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportToCSV(data: TableRow[]) {
  const headers = ["Type","Token/Plate","Status","Loaded (kg)","Empty (kg)",
                   "Net (kg)","Operator","Time","Flag/Dismiss Reason"];
  const rows = data.map(r => {
    if (r._kind === "weighing") {
      const w = r as Weighing;
      return [
        "weighing", w.token_number, w.status,
        w.loaded_weight ?? "", w.empty_weight ?? "", w.net_load ?? "",
        w.entry_operator?.name ?? "",
        w.entry_at ? new Date(w.entry_at).toISOString() : "",
        w.flag_reason ?? "",
      ];
    } else {
      const d = r as DismissedRow;
      return [
        "dismissed", d.plate_ocr ?? "", "dismissed",
        "", "", "", "",
        d.triggered_at ? new Date(d.triggered_at).toISOString() : "",
        d.dismiss_reason ?? "",
      ];
    }
  });
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `weighbridge-${Date.now()}.csv`;
  a.click();
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WeighbridgePage() {
  const [rows, setRows]                     = useState<TableRow[]>([]);
  const [operators, setOperators]           = useState<Operator[]>([]);
  const [total, setTotal]                   = useState(0);
  const [page, setPage]                     = useState(1);
  const [loading, setLoading]               = useState(true);
  const [selected, setSelected]             = useState<TableRow | null>(null);
  const [status, setStatus]                 = useState<Status>("all");
  const [search, setSearch]                 = useState("");
  const [searchInput, setSearchInput]       = useState("");
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");
  const [showDateRange, setShowDateRange]   = useState(false);
  const [stats, setStats]                   = useState({ total: 0, waiting: 0, complete: 0, flagged: 0, dismissed: 0 });

  useEffect(() => {
    supabase.from("operators").select("id, name, employee_id")
      .eq("is_active", true).order("name")
      .then(({ data }) => setOperators(data ?? []));
  }, []);

  useEffect(() => {
    Promise.all([
      supabase.from("weighings").select("status"),
      supabase.from("pending_confirmations").select("id").eq("status", "dismissed"),
    ]).then(([{ data: wData }, { data: dData }]) => {
      const s = { total: 0, waiting: 0, complete: 0, flagged: 0, dismissed: dData?.length ?? 0 };
      (wData ?? []).forEach((r: { status: string }) => {
        s.total++;
        if (r.status === "waiting")  s.waiting++;
        if (r.status === "complete") s.complete++;
        if (r.status === "flagged")  s.flagged++;
      });
      s.total += s.dismissed;
      setStats(s);
    });
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);

    if (status === "dismissed") {
      let q = supabase.from("pending_confirmations")
        .select(
          "id, plate_ocr, weight_ocr, triggered_at, outdoor_snapshot_url, indoor_snapshot_url, dismiss_reason, status",
          { count: "exact" }
        )
        .eq("status", "dismissed")
        .order("triggered_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (search)   q = q.ilike("plate_ocr", `%${search}%`);
      if (dateFrom) q = q.gte("triggered_at", dateFrom);
      if (dateTo)   q = q.lte("triggered_at", dateTo + "T23:59:59");

      const { data, count, error } = await q;
      if (!error) {
        setRows((data ?? []).map((d: any) => ({ ...d, _kind: "dismissed" as const })));
        setTotal(count ?? 0);
      }
    } else {
      let q = supabase.from("weighings")
        .select(
          `*, entry_operator:operators!weighings_entry_operator_id_fkey(name),
           return_operator:operators!weighings_return_operator_id_fkey(name)`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (status !== "all")         q = q.eq("status", status);
      if (search)                   q = q.ilike("plate_number", `%${search}%`);
      if (operatorFilter !== "all") q = q.eq("entry_operator_id", operatorFilter);
      if (dateFrom)                 q = q.gte("entry_at", dateFrom);
      if (dateTo)                   q = q.lte("entry_at", dateTo + "T23:59:59");

      const { data, count, error } = await q;
      if (!error) {
        setRows((data ?? []).map((w: any) => ({ ...w, _kind: "weighing" as const })));
        setTotal(count ?? 0);
      }
    }

    setLoading(false);
  }, [page, status, search, operatorFilter, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [status, search, operatorFilter, dateFrom, dateTo]);
  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | "…")[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
      acc.push(p);
      return acc;
    }, []);

  const isDismissedView = status === "dismissed";

  return (
    <>
      {/* ── Responsive overrides ─────────────────────────── */}
      <style>{`
        /* Stat cards: 2-col on mobile, 3-col on sm, 5-col on lg */
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        @media (min-width: 640px)  { .stat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1024px) { .stat-grid { grid-template-columns: repeat(5, 1fr); } }

        /* Status pill tabs: scroll on mobile */
        .status-tabs {
          display: flex;
          align-items: center;
          background: #f1f5f9;
          border-radius: 8px;
          padding: 2px;
          gap: 2px;
          overflow-x: auto;
          flex-shrink: 0;
          scrollbar-width: none;
        }
        .status-tabs::-webkit-scrollbar { display: none; }

        /* Filter row: wrap on small screens */
        .filter-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }

        /* Search: full width on mobile */
        .search-box {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 10px;
          flex: 1;
          min-width: 140px;
        }

        /* Top bar: stack on very small screens */
        .topbar-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        @media (max-width: 479px) {
          .topbar-inner { flex-wrap: wrap; }
          .topbar-actions { width: 100%; justify-content: flex-end; }
        }

        /* Operator select: hide label on mobile */
        @media (max-width: 479px) {
          .op-select-wrap { display: none; }
        }

        /* Pagination: hide first/last on mobile */
        @media (max-width: 479px) {
          .pag-first-last { display: none; }
          .pag-info { font-size: 10px; }
        }

        /* Page content padding */
        .page-content {
          padding: 16px 24px;
        }
        @media (max-width: 639px) {
          .page-content { padding: 12px; }
        }

        /* Top bar padding */
        .topbar-pad {
          padding: 12px 24px;
        }
        @media (max-width: 639px) {
          .topbar-pad { padding: 10px 12px; }
        }
      `}</style>

      <div className="h-full flex flex-col bg-[#f4f6f9] overflow-hidden">

        {/* Top bar */}
        <div className="topbar-pad shrink-0 bg-white border-b border-slate-100 z-20">
          <div className="topbar-inner">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                <Scale size={14} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-none">Weighbridge Records</h1>
                <p className="text-[10px] text-slate-400 mt-0.5">{total.toLocaleString()} records</p>
              </div>
            </div>
            <div className="topbar-actions flex items-center gap-2">
              <button onClick={fetchRows} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 border border-slate-200 transition-all">
                <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button onClick={() => exportToCSV(rows)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-sm">
                <Download size={12} />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto page-content space-y-3"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>

          {/* Stat cards */}
          <div className="stat-grid">
            {[
              { icon: Hash,          label: "Total",     value: stats.total,     color: "bg-slate-700" },
              { icon: Clock,         label: "Waiting",   value: stats.waiting,   color: "bg-amber-500" },
              { icon: CheckCircle2,  label: "Complete",  value: stats.complete,  color: "bg-emerald-500" },
              { icon: AlertTriangle, label: "Flagged",   value: stats.flagged,   color: "bg-red-500" },
              { icon: Ban,           label: "Dismissed", value: stats.dismissed, color: "bg-slate-500" },
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

          {/* Filters */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-3.5 py-2.5">
            <div className="filter-row">
              {/* Status tabs */}
              <div className="status-tabs">
                {(["all", "waiting", "complete", "flagged", "dismissed"] as Status[]).map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize whitespace-nowrap ${
                      status === s ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}>
                    {s}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="search-box">
                <Search size={12} className="text-slate-400 shrink-0" />
                <input type="text"
                  placeholder={isDismissedView ? "Search plate OCR…" : "Search plate…"}
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none w-full" />
                {searchInput && (
                  <button onClick={() => setSearchInput("")}>
                    <X size={11} className="text-slate-400 hover:text-slate-600" />
                  </button>
                )}
              </div>

              {/* Operator filter */}
              {!isDismissedView && (
                <div className="op-select-wrap">
                  <select value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 outline-none cursor-pointer">
                    <option value="all">All Operators</option>
                    {operators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                  </select>
                </div>
              )}

              {/* Date range */}
              <div className="relative">
                <button onClick={() => setShowDateRange(!showDateRange)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    dateFrom || dateTo
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}>
                  <Calendar size={12} />
                  <span className="hidden sm:inline">Date Range</span>
                  <span className="sm:hidden">Date</span>
                  {(dateFrom || dateTo) && <span className="w-1 h-1 rounded-full bg-amber-400" />}
                </button>
                {showDateRange && (
                  <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-20 w-60">
                    <div className="space-y-2">
                      {[{ lbl: "From", val: dateFrom, set: setDateFrom },
                        { lbl: "To",   val: dateTo,   set: setDateTo   }].map(({ lbl, val, set }) => (
                        <div key={lbl}>
                          <label className="text-[10px] font-semibold text-slate-500 mb-1 block">{lbl}</label>
                          <input type="date" value={val} onChange={e => set(e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none" />
                        </div>
                      ))}
                      <div className="flex gap-1.5 pt-1">
                        <button onClick={() => { setDateFrom(""); setDateTo(""); setShowDateRange(false); }}
                          className="flex-1 py-1.5 text-[10px] font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                          Clear
                        </button>
                        <button onClick={() => setShowDateRange(false)}
                          className="flex-1 py-1.5 text-[10px] font-semibold text-white bg-slate-900 rounded-lg">
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#e2e8f0 transparent" }}>
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60">
                    {isDismissedView
                      ? ["Plate OCR", "Weight OCR", "Detected At", "Dismiss Reason", "Status", ""].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 tracking-widest uppercase whitespace-nowrap">{h}</th>
                        ))
                      : ["Token", "Plate", "Operator", "Loaded kg", "Empty kg", "Net kg", "Entry Time", "Status", ""].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-400 tracking-widest uppercase whitespace-nowrap">{h}</th>
                        ))
                    }
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        {Array.from({ length: isDismissedView ? 6 : 9 }).map((_, j) => (
                          <td key={j} className="px-4 py-2.5">
                            <div className="h-3 bg-slate-100 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={isDismissedView ? 6 : 9} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Weight size={28} className="opacity-30" />
                          <p className="text-xs font-medium">No records found</p>
                          <p className="text-[10px]">Try adjusting your filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : isDismissedView ? (
                    rows.map((row, idx) => {
                      const d = row as DismissedRow;
                      return (
                        <tr key={d.id} onClick={() => setSelected(d)}
                          className={`border-b border-slate-50 transition-colors hover:bg-slate-50/60 group cursor-pointer ${idx % 2 !== 0 ? "bg-slate-50/30" : ""}`}>
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-bold font-mono text-slate-700">
                              {d.plate_ocr ?? <span className="text-slate-300 font-normal">—</span>}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-mono text-slate-600">
                            {d.weight_ocr ? `${parseInt(d.weight_ocr).toLocaleString()} kg` : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">{fmtDate(d.triggered_at)}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs text-slate-500 truncate max-w-[160px] block">
                              {d.dismiss_reason ?? <span className="text-slate-300">—</span>}
                            </span>
                          </td>
                          <td className="px-4 py-2.5"><StatusBadge status="dismissed" /></td>
                          <td className="px-4 py-2.5">
                            <button onClick={e => { e.stopPropagation(); setSelected(d); }}
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all opacity-0 group-hover:opacity-100">
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    rows.map((row, idx) => {
                      const w = row as Weighing;
                      return (
                        <tr key={w.id} onClick={() => setSelected(w)}
                          className={`border-b border-slate-50 transition-colors hover:bg-blue-50/30 group cursor-pointer ${idx % 2 !== 0 ? "bg-slate-50/30" : ""}`}>
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] font-bold font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {w.token_number}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-bold font-mono text-slate-800">
                              {w.plate_number ?? <span className="text-slate-300 font-normal">—</span>}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                <User size={10} className="text-slate-500" />
                              </div>
                              <span className="text-xs text-slate-600 whitespace-nowrap">{w.entry_operator?.name ?? "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs font-mono text-slate-700 tabular-nums">{fmt(w.loaded_weight)}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-slate-700 tabular-nums">{fmt(w.empty_weight)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-bold font-mono tabular-nums ${w.net_load != null ? "text-emerald-600" : "text-slate-300"}`}>
                              {fmt(w.net_load)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">{fmtDate(w.entry_at)}</span>
                          </td>
                          <td className="px-4 py-2.5"><StatusBadge status={w.status} /></td>
                          <td className="px-4 py-2.5">
                            <button onClick={e => { e.stopPropagation(); setSelected(w); }}
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all opacity-0 group-hover:opacity-100">
                              <Eye size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 gap-2 flex-wrap">
                <p className="pag-info text-[10px] text-slate-500">
                  Showing{" "}
                  <span className="font-semibold text-slate-700">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
                  </span>
                  {" "}of{" "}
                  <span className="font-semibold text-slate-700">{total.toLocaleString()}</span>
                </p>
                <div className="flex items-center gap-1">
                  <span className="pag-first-last">
                    <PagBtn onClick={() => setPage(1)} disabled={page === 1}>«</PagBtn>
                  </span>
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
                  <span className="pag-first-last">
                    <PagBtn onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</PagBtn>
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="h-2" />
        </div>

        {/* Drawers */}
        {selected?._kind === "weighing"  && <WeighingDrawer  weighing={selected as Weighing}      onClose={() => setSelected(null)} />}
        {selected?._kind === "dismissed" && <DismissedDrawer row={selected as DismissedRow} onClose={() => setSelected(null)} />}
      </div>
    </>
  );
}