"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mapUrl } from "@/components/AttendanceBoard";

export type PersonnelLiveItem = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  employeeNo: string | null;
  department: string | null;
  position: string | null;
  statusGroup: string;
  statusLabel: string;
  statusIcon: string;
  statusTone: "success" | "brand" | "warning" | "danger" | "neutral";
  statusDetail?: string;
  isWorking: boolean;
  isIssue: boolean;
  isBreak: boolean;
  isLate: boolean;
  isOnLeave: boolean;
  isTimedOut: boolean;
  shift: string;
  firstInTime: string | null;
  firstInIso: string | null;
  lastOutTime: string | null;
  workedMinutes: number;
  liveWork: { baseSec: number; sinceIso: string; running: boolean } | null;
  pause?: {
    name: string;
    icon: string;
    isIssue: boolean;
    sinceIso: string;
    sinceTime: string;
    overMinutes: number;
  };
  location?: {
    lat: number;
    lng: number;
    accuracy: number | null;
    device: string | null;
    locSource: string | null;
    weak: boolean;
  } | null;
  events: {
    id: string;
    atTime: string;
    type: string;
    name: string;
    icon: string;
    page: string | null;
    source: string;
    note: string | null;
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    device: string | null;
  }[];
};

const TONE_CLASSES: Record<"success" | "brand" | "warning" | "danger" | "neutral", { badge: string; border: string; ring: string; dot: string }> = {
  success: {
    badge: "border-success/40 bg-success/15 text-success dark:text-emerald-400",
    border: "border-success/30",
    ring: "ring-success/30",
    dot: "bg-success",
  },
  brand: {
    badge: "border-brand/40 bg-brand/15 text-brand dark:text-indigo-400",
    border: "border-brand/30",
    ring: "ring-brand/30",
    dot: "bg-brand",
  },
  warning: {
    badge: "border-warning/50 bg-warning/20 text-warning dark:text-amber-400",
    border: "border-warning/40",
    ring: "ring-warning/30",
    dot: "bg-warning",
  },
  danger: {
    badge: "border-danger/40 bg-danger/15 text-danger dark:text-rose-400",
    border: "border-danger/40",
    ring: "ring-danger/30",
    dot: "bg-danger",
  },
  neutral: {
    badge: "border-line bg-line/40 text-muted",
    border: "border-line",
    ring: "ring-line",
    dot: "bg-muted",
  },
};

function formatElapsedSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const rem = s % 3600;
  const mins = Math.floor(rem / 60);
  const secs = rem % 60;
  if (hrs > 0) return `${hrs}h ${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
  if (mins > 0) return `${mins}m ${String(secs).padStart(2, "0")}s`;
  return `${secs}s`;
}

// Time in operation: breaks and issues are never counted, and the figure stops while one is open.
function workedSeconds(item: { workedMinutes: number; liveWork: { baseSec: number; sinceIso: string; running: boolean } | null }, now: number): number {
  const w = item.liveWork;
  if (!w) return item.workedMinutes * 60;
  return Math.max(0, w.baseSec + (w.running ? (now - new Date(w.sinceIso).getTime()) / 1000 : 0));
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function LivePersonnelReport({
  items,
}: {
  items: PersonnelLiveItem[];
  tz: string;
  isApprover?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState<number>(() => Date.now());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"GRID" | "TABLE">("GRID");
  const [expandedPunches, setExpandedPunches] = useState<Record<string, boolean>>({});
  const [lastSynced, setLastSynced] = useState<string>(() => new Date().toLocaleTimeString());

  // Second-by-second ticker for live elapsed duration
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Periodic auto-refresh every 20 seconds to sync server punch updates
  useEffect(() => {
    const autoSync = setInterval(() => {
      startTransition(() => {
        router.refresh();
        setLastSynced(new Date().toLocaleTimeString());
      });
    }, 20000);
    return () => clearInterval(autoSync);
  }, [router]);

  const handleManualRefresh = () => {
    startTransition(() => {
      router.refresh();
      setLastSynced(new Date().toLocaleTimeString());
    });
  };

  const togglePunch = (id: string) => {
    setExpandedPunches((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.department) set.add(item.department);
    }
    return Array.from(set).sort();
  }, [items]);

  // Aggregate stats
  const stats = useMemo(() => {
    const working = items.filter((x) => x.isWorking).length;
    const issue = items.filter((x) => x.isIssue).length;
    const breakCount = items.filter((x) => x.isBreak).length;
    const late = items.filter((x) => x.isLate || x.statusGroup === "Late, not in" || x.statusGroup === "No show").length;
    const onLeave = items.filter((x) => x.isOnLeave || x.statusGroup === "Day off").length;
    const timedOut = items.filter((x) => x.isTimedOut).length;
    const notIn = items.filter((x) => x.statusGroup === "Not in yet" || x.statusGroup === "No schedule" || x.statusGroup === "Not in").length;
    return { working, issue, breakCount, late, onLeave, timedOut, notIn, total: items.length };
  }, [items]);

  // Filtered personnel
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      // Search match
      if (q) {
        const matchName = item.name.toLowerCase().includes(q);
        const matchEmpNo = item.employeeNo?.toLowerCase().includes(q) ?? false;
        const matchDept = item.department?.toLowerCase().includes(q) ?? false;
        const matchPos = item.position?.toLowerCase().includes(q) ?? false;
        const matchStatus = item.statusLabel.toLowerCase().includes(q);
        if (!matchName && !matchEmpNo && !matchDept && !matchPos && !matchStatus) {
          return false;
        }
      }

      // Department filter
      if (selectedDept !== "ALL" && item.department !== selectedDept) {
        return false;
      }

      // Status group filter
      if (statusFilter === "WORKING") return item.isWorking;
      if (statusFilter === "ISSUE") return item.isIssue;
      if (statusFilter === "BREAK") return item.isBreak;
      if (statusFilter === "LATE") return item.isLate || item.statusGroup === "Late, not in" || item.statusGroup === "No show";
      if (statusFilter === "LEAVE") return item.isOnLeave || item.statusGroup === "Day off";
      if (statusFilter === "TIMED_OUT") return item.isTimedOut;
      if (statusFilter === "NOT_IN") return item.statusGroup === "Not in yet" || item.statusGroup === "No schedule" || item.statusGroup === "Not in";

      return true;
    });
  }, [items, search, selectedDept, statusFilter]);

  return (
    <section
      aria-label="Live Personnel Report"
      className="overflow-hidden rounded-3xl border-2 border-brand/20 bg-surface shadow-xl shadow-brand/5"
    >
      {/* Top Header Banner */}
      <div className="relative border-b border-line bg-gradient-to-r from-brand/10 via-brand/5 to-surface px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                LIVE PERSONNEL REPORT
              </span>
              {/* Clock text differs by a second between the server render and the phone: React keeps the phone's. */}
              <span suppressHydrationWarning className="text-xs text-muted">· Auto-syncs every 20s (last: {lastSynced})</span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Real-Time Workforce & Attendance
            </h2>
            <p className="text-xs text-muted sm:text-sm">
              Live status across active working personnel, system or calamity issues, break timers, and attendance logs.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-xl border border-line bg-bg p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("GRID")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === "GRID"
                    ? "bg-surface text-brand shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>🗂️</span> Big Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("TABLE")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                  viewMode === "TABLE"
                    ? "bg-surface text-brand shadow-sm"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>📋</span> Table View
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isPending}
              aria-label="Refresh live data"
              title="Refresh live data now"
              className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-sm transition hover:border-brand hover:text-brand disabled:opacity-50"
            >
              <span className={`inline-block ${isPending ? "animate-spin" : ""}`}>🔄</span>
              <span>{isPending ? "Syncing..." : "Refresh"}</span>
            </button>

            {/* Link to Fullscreen Live View */}
            <Link
              href="/schedule/live"
              className="flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand transition hover:bg-brand hover:text-brand-ink"
            >
              <span>↗ Full Live View</span>
            </Link>
          </div>
        </div>

        {/* Big Metric Tiles */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {/* Working Now */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "WORKING" ? "ALL" : "WORKING")}
            className={`group rounded-2xl border p-3.5 text-left transition ${
              statusFilter === "WORKING"
                ? "border-emerald-500 bg-emerald-500/15 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500"
                : "border-line bg-surface/80 hover:border-emerald-400/50 hover:bg-surface"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Working Now</span>
              <span className="text-sm">🟢</span>
            </div>
            <p className="mt-1 text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.working}
            </p>
            <p className="mt-0.5 text-[11px] text-muted group-hover:text-ink">
              Actively on clock
            </p>
          </button>

          {/* On Issue */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "ISSUE" ? "ALL" : "ISSUE")}
            className={`group rounded-2xl border p-3.5 text-left transition ${
              statusFilter === "ISSUE"
                ? "border-rose-500 bg-rose-500/15 shadow-md shadow-rose-500/10 ring-2 ring-rose-500"
                : stats.issue > 0
                ? "border-rose-300 bg-rose-500/10 hover:border-rose-400"
                : "border-line bg-surface/80 hover:border-rose-400/50 hover:bg-surface"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">On System Issue</span>
              <span className="text-sm">⚠️</span>
            </div>
            <p className={`mt-1 text-2xl font-black tracking-tight ${stats.issue > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted"}`}>
              {stats.issue}
            </p>
            <p className="mt-0.5 text-[11px] text-muted group-hover:text-ink">
              Weather, power, bug
            </p>
          </button>

          {/* On Break */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "BREAK" ? "ALL" : "BREAK")}
            className={`group rounded-2xl border p-3.5 text-left transition ${
              statusFilter === "BREAK"
                ? "border-indigo-500 bg-indigo-500/15 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500"
                : "border-line bg-surface/80 hover:border-indigo-400/50 hover:bg-surface"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">On Break</span>
              <span className="text-sm">☕</span>
            </div>
            <p className="mt-1 text-2xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
              {stats.breakCount}
            </p>
            <p className="mt-0.5 text-[11px] text-muted group-hover:text-ink">
              Meal, coffee, prayer
            </p>
          </button>

          {/* Late / No Show */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "LATE" ? "ALL" : "LATE")}
            className={`group rounded-2xl border p-3.5 text-left transition ${
              statusFilter === "LATE"
                ? "border-amber-500 bg-amber-500/15 shadow-md shadow-amber-500/10 ring-2 ring-amber-500"
                : "border-line bg-surface/80 hover:border-amber-400/50 hover:bg-surface"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Late / No-Show</span>
              <span className="text-sm">⏰</span>
            </div>
            <p className={`mt-1 text-2xl font-black tracking-tight ${stats.late > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted"}`}>
              {stats.late}
            </p>
            <p className="mt-0.5 text-[11px] text-muted group-hover:text-ink">
              Requires attention
            </p>
          </button>

          {/* On Leave / Day Off */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "LEAVE" ? "ALL" : "LEAVE")}
            className={`group rounded-2xl border p-3.5 text-left transition ${
              statusFilter === "LEAVE"
                ? "border-brand bg-brand/15 shadow-md shadow-brand/10 ring-2 ring-brand"
                : "border-line bg-surface/80 hover:border-brand/40 hover:bg-surface"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">On Leave / Off</span>
              <span className="text-sm">🏖️</span>
            </div>
            <p className="mt-1 text-2xl font-black tracking-tight text-brand">
              {stats.onLeave}
            </p>
            <p className="mt-0.5 text-[11px] text-muted group-hover:text-ink">
              Planned leaves & off
            </p>
          </button>

          {/* Timed Out */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "TIMED_OUT" ? "ALL" : "TIMED_OUT")}
            className={`group rounded-2xl border p-3.5 text-left transition ${
              statusFilter === "TIMED_OUT"
                ? "border-muted bg-muted/15 shadow-md ring-2 ring-muted"
                : "border-line bg-surface/80 hover:border-muted/50 hover:bg-surface"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Timed Out</span>
              <span className="text-sm">✓</span>
            </div>
            <p className="mt-1 text-2xl font-black tracking-tight text-ink">
              {stats.timedOut}
            </p>
            <p className="mt-0.5 text-[11px] text-muted group-hover:text-ink">
              Completed shift
            </p>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="border-b border-line bg-bg/40 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative min-w-0 flex-1 basis-64">
            <span className="pointer-events-none absolute left-3 top-2.5 text-muted">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personnel by name, employee ID, department, position..."
              className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-8 text-sm text-ink shadow-sm placeholder:text-muted focus:border-brand focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-xs text-muted hover:text-ink"
              >
                ✕
              </button>
            )}
          </div>

          {/* Department Filter (if multiple) */}
          {departments.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-muted">Department:</span>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="rounded-xl border border-line bg-surface px-3 py-2 font-medium text-ink shadow-sm focus:border-brand focus:outline-none"
              >
                <option value="ALL">All Departments ({departments.length})</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Filter Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`rounded-full border px-3 py-1 transition ${
              statusFilter === "ALL"
                ? "border-brand bg-brand text-brand-ink shadow-sm"
                : "border-line bg-surface text-muted hover:border-brand/40 hover:text-ink"
            }`}
          >
            All Personnel ({stats.total})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("WORKING")}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 transition ${
              statusFilter === "WORKING"
                ? "border-emerald-500 bg-emerald-600 text-white shadow-sm"
                : "border-line bg-surface text-muted hover:border-emerald-400 hover:text-emerald-600"
            }`}
          >
            <span>🟢 Working</span>
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">{stats.working}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("ISSUE")}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 transition ${
              statusFilter === "ISSUE"
                ? "border-rose-500 bg-rose-600 text-white shadow-sm"
                : stats.issue > 0
                ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
                : "border-line bg-surface text-muted hover:border-rose-400 hover:text-rose-600"
            }`}
          >
            <span>⚠️ On Issue</span>
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">{stats.issue}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("BREAK")}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 transition ${
              statusFilter === "BREAK"
                ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                : "border-line bg-surface text-muted hover:border-indigo-400 hover:text-indigo-600"
            }`}
          >
            <span>☕ On Break</span>
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">{stats.breakCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("LATE")}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 transition ${
              statusFilter === "LATE"
                ? "border-amber-500 bg-amber-600 text-white shadow-sm"
                : "border-line bg-surface text-muted hover:border-amber-400 hover:text-amber-600"
            }`}
          >
            <span>⏰ Late / No Show</span>
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">{stats.late}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("LEAVE")}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 transition ${
              statusFilter === "LEAVE"
                ? "border-brand bg-brand text-brand-ink shadow-sm"
                : "border-line bg-surface text-muted hover:border-brand/40 hover:text-brand"
            }`}
          >
            <span>🏖️ On Leave</span>
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">{stats.onLeave}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("TIMED_OUT")}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 transition ${
              statusFilter === "TIMED_OUT"
                ? "border-muted bg-ink text-surface shadow-sm"
                : "border-line bg-surface text-muted hover:border-muted hover:text-ink"
            }`}
          >
            <span>✓ Timed Out</span>
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">{stats.timedOut}</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("NOT_IN")}
            className={`flex items-center gap-1 rounded-full border px-3 py-1 transition ${
              statusFilter === "NOT_IN"
                ? "border-line bg-line/80 text-ink shadow-sm"
                : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            <span>⚪ Not In Yet</span>
            <span className="rounded-full bg-black/10 px-1.5 py-0.2 text-[10px]">{stats.notIn}</span>
          </button>

          {(statusFilter !== "ALL" || search || selectedDept !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setSearch("");
                setSelectedDept("ALL");
              }}
              className="ml-auto text-xs text-brand hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Main Personnel Content */}
      <div className="p-6">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-bg/50 p-12 text-center">
            <p className="text-3xl">👥</p>
            <h3 className="mt-2 text-base font-bold text-ink">No personnel found</h3>
            <p className="mt-1 text-sm text-muted">
              No staff members match the selected status or search query.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setSearch("");
                setSelectedDept("ALL");
              }}
              className="mt-4 rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-brand shadow-sm hover:border-brand"
            >
              Clear filters
            </button>
          </div>
        ) : viewMode === "GRID" ? (
          /* BIG CARDS GRID VIEW */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const tone = TONE_CLASSES[item.statusTone] ?? TONE_CLASSES.neutral;
              const isExpanded = !!expandedPunches[item.id];

              // Live elapsed duration calculation
              let liveTimerText: string | null = null;
              if (item.isWorking && item.liveWork) {
                liveTimerText = `Worked: ${formatElapsedSeconds(workedSeconds(item, now))}`;
              } else if ((item.isBreak || item.isIssue) && item.pause?.sinceIso) {
                const elapsedSec = (now - new Date(item.pause.sinceIso).getTime()) / 1000;
                liveTimerText = `Duration: ${formatElapsedSeconds(elapsedSec)}`;
              }

              return (
                <article
                  key={item.id}
                  className={`flex flex-col justify-between rounded-2xl border bg-surface p-4 shadow-sm transition hover:shadow-md ${tone.border}`}
                >
                  <div>
                    {/* Person Header */}
                    <div className="flex items-start gap-3">
                      {/* Avatar initials with status dot */}
                      <div className="relative shrink-0">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 to-brand/20 text-sm font-bold text-brand shadow-inner">
                          {getInitials(item.name)}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface ${tone.dot}`}
                          title={item.statusLabel}
                        />
                      </div>

                      {/* Name & ID */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <Link
                            href={`/dtr?employee=${item.id}`}
                            className="truncate text-base font-bold text-ink hover:text-brand hover:underline"
                          >
                            {item.name}
                          </Link>
                          {item.employeeNo && (
                            <span className="shrink-0 rounded-md bg-line/50 px-1.5 py-0.5 font-mono text-[11px] text-muted">
                              {item.employeeNo}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted">
                          {[item.position, item.department].filter(Boolean).join(" · ") || "Team Member"}
                        </p>
                      </div>
                    </div>

                    {/* Prominent Live Status Pill */}
                    <div className="mt-3.5">
                      <div
                        className={`flex flex-wrap items-center justify-between gap-1.5 rounded-xl border p-2.5 text-xs font-semibold ${tone.badge}`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-base" aria-hidden>
                            {item.statusIcon}
                          </span>
                          <span className="truncate">{item.statusLabel}</span>
                        </div>
                        {liveTimerText && (
                          <span suppressHydrationWarning className="shrink-0 font-mono text-[11px] tabular-nums opacity-90">
                            ⏱️ {liveTimerText}
                          </span>
                        )}
                      </div>

                      {/* Status Detail Note if any */}
                      {item.statusDetail && (
                        <p className="mt-1 text-right text-[11px] text-muted">
                          {item.statusDetail}
                        </p>
                      )}
                    </div>

                    {/* Schedule & Hours Info */}
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-line/60 bg-bg/50 p-2.5 text-xs">
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-muted">Shift Plan</span>
                        <span className="font-medium text-ink">{item.shift}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-muted">Worked Today</span>
                        <span className="font-medium tabular-nums text-ink">
                          {formatMinutes(Math.floor(workedSeconds(item, now) / 60)) || "0m"}
                        </span>
                      </div>
                    </div>

                    {/* Punch Times & Location Pin */}
                    <div className="mt-2 space-y-1 text-xs">
                      {item.firstInTime && (
                        <div className="flex items-center justify-between text-muted">
                          <span>First In:</span>
                          <span className="font-medium tabular-nums text-ink">{item.firstInTime}</span>
                        </div>
                      )}
                      {item.lastOutTime && (
                        <div className="flex items-center justify-between text-muted">
                          <span>Last Out:</span>
                          <span className="font-medium tabular-nums text-ink">{item.lastOutTime}</span>
                        </div>
                      )}
                      {item.location && (
                        <div className="flex items-center justify-between text-muted pt-0.5">
                          <span>Location:</span>
                          <a
                            href={mapUrl(item.location.lat, item.location.lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 font-medium text-brand hover:underline"
                          >
                            <span>📍 Map</span>
                            <span className="text-[10px] text-muted">
                              (±{Math.round(item.location.accuracy ?? 0)}m)
                            </span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Punch Timeline Expandable Drawer */}
                  <div className="mt-4 border-t border-line/60 pt-3">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => togglePunch(item.id)}
                        className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                      >
                        <span>{isExpanded ? "Hide punches" : "Today's punches"}</span>
                        <span className="rounded-full bg-brand/10 px-1.5 py-0.2 text-[10px]">
                          {item.events.length}
                        </span>
                        <span>{isExpanded ? "▴" : "▾"}</span>
                      </button>

                      <Link
                        href={`/dtr?employee=${item.id}`}
                        className="text-xs font-medium text-muted hover:text-brand hover:underline"
                      >
                        Open DTR →
                      </Link>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 rounded-xl border border-line bg-bg/80 p-3">
                        {item.events.length === 0 ? (
                          <p className="text-xs text-muted">No punches recorded today.</p>
                        ) : (
                          <ol className="relative space-y-2 border-l border-line pl-3 text-xs">
                            {item.events.map((e) => (
                              <li key={e.id} className="relative">
                                <span
                                  className={`absolute -left-[17px] top-1 h-2 w-2 rounded-full ${
                                    e.page === "ISSUE"
                                      ? "bg-danger"
                                      : e.type === "IN"
                                      ? "bg-success"
                                      : e.type === "OUT"
                                      ? "bg-muted"
                                      : "bg-brand"
                                  }`}
                                />
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-semibold text-ink">
                                    {e.icon} {e.name}
                                  </span>
                                  <span className="font-mono text-[11px] tabular-nums text-muted">
                                    {e.atTime}
                                  </span>
                                </div>
                                {e.page === "ISSUE" && (
                                  <span className="text-[11px] font-semibold text-danger">
                                    (System/Calamity Issue)
                                  </span>
                                )}
                                {e.note && (
                                  <p className="text-[11px] italic text-muted">“{e.note}”</p>
                                )}
                                {e.lat != null && e.lng != null && (
                                  <a
                                    href={mapUrl(e.lat, e.lng)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block text-[11px] text-brand hover:underline"
                                  >
                                    📍 ±{Math.round(e.accuracy ?? 0)}m
                                  </a>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW */
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[750px] text-left text-sm">
              <thead className="border-b border-line bg-bg/60 text-xs font-semibold text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Shift</th>
                  <th className="py-3 px-4">First In</th>
                  <th className="py-3 px-4">Last Out</th>
                  <th className="py-3 px-4">Worked</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((item) => {
                  const tone = TONE_CLASSES[item.statusTone] ?? TONE_CLASSES.neutral;
                  return (
                    <tr key={item.id} className="transition hover:bg-bg/40">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-bold text-brand">
                            {getInitials(item.name)}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/dtr?employee=${item.id}`}
                              className="font-semibold text-ink hover:text-brand hover:underline"
                            >
                              {item.name}
                            </Link>
                            <p className="text-xs text-muted">
                              {[item.employeeNo, item.department].filter(Boolean).join(" · ") || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone.badge}`}
                        >
                          <span>{item.statusIcon}</span>
                          <span>{item.statusLabel}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted">{item.shift}</td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-ink">
                        {item.firstInTime || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums text-ink">
                        {item.lastOutTime || "—"}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums font-semibold text-ink">
                        {workedSeconds(item, now) >= 60 ? formatMinutes(Math.floor(workedSeconds(item, now) / 60)) : "—"}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {item.location ? (
                          <a
                            href={mapUrl(item.location.lat, item.location.lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand hover:underline"
                          >
                            📍 ±{Math.round(item.location.accuracy ?? 0)}m
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/dtr?employee=${item.id}`}
                          className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-brand shadow-sm hover:border-brand"
                        >
                          DTR
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
