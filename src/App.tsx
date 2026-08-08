import { useCallback, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface LogEntry {
  timeCreated: string;
  id: number;
  level: string;
  message: string | null;
}

type Key = "timeCreated" | "id" | "level";
type Dir = "asc" | "desc";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// PowerShell 5.1 emits TimeCreated as `\/Date(<unix ms>)\/`; ISO also possible.
function parsePowerTime(value: string): Date {
  const m = /^\/Date\((-?\d+)\)\//.exec(value);
  return m ? new Date(Number(m[1])) : new Date(value);
}

function formatTime(value: string): string {
  const d = parsePowerTime(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function levelTone(level: string): "info" | "warn" | "error" | "crit" | "verb" {
  const l = level.toLowerCase();
  if (l.includes("error")) return "error";
  if (l.includes("crit")) return "crit";
  if (l.includes("warn")) return "warn";
  if (l.includes("info")) return "info";
  return "verb";
}

function App() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [key, setKey] = useState<Key>("timeCreated");
  const [dir, setDir] = useState<Dir>("desc");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const copyTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const logs = await invoke<LogEntry[]>("get_power_logs");
      setEntries(Array.isArray(logs) ? logs : []);
      setScanned(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? entries.filter(
          (e) =>
            e.message?.toLowerCase().includes(q) ||
            e.level.toLowerCase().includes(q) ||
            String(e.id).includes(q),
        )
      : entries;

    const sorted = [...filtered];
    const mult = dir === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      if (key === "id") return (a.id - b.id) * mult;
      if (key === "level") return a.level.localeCompare(b.level) * mult;
      return (parsePowerTime(a.timeCreated).getTime() - parsePowerTime(b.timeCreated).getTime()) * mult;
    });
    return sorted;
  }, [entries, search, key, dir]);

  const toggleSort = (nextKey: Key) => {
    if (nextKey === key) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setKey(nextKey);
      setDir(nextKey === "id" || nextKey === "level" ? "asc" : "desc");
    }
  };

  const copy = async (entry: LogEntry) => {
    const text = entry.message?.trim() || "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for restricted clipboard contexts.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedId(entry.id);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedId(null), 1600);
  };

  const sortGlyph = (k: Key) =>
    key === k ? (dir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/icon.png" alt="PowerLog" draggable={false} />
          <div>
            <h1>PowerLog</h1>
            <p className="subtitle">PowerShell Operational Event Log</p>
          </div>
        </div>

        <div className="controls">
          <div className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search message, event ID or level…"
              autoFocus
            />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading} title="Load the latest 200 events">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {loading ? "Scanning…" : scanned ? "Refresh" : "Scan"}
          </button>
        </div>
      </header>

      <div className="statusbar">
        {loading
          ? "Scanning the PowerShell Operational event log…"
          : error
            ? "⚠ " + error
            : scanned
              ? `${rows.length} of ${entries.length} events`
              : "The log has not been scanned yet — click Scan to continue."}
      </div>

      <main className="table-wrap">
{!scanned && !loading && (
          <div className="scan-cta">
            <img className="scan-cta-logo" src="/icon.png" alt="" draggable={false} />
            <h2>Scan PowerShell event log</h2>
            <p>
              Load the latest 200 events from the{" "}
              <code>Microsoft-Windows-PowerShell/Operational</code> event log.
            </p>
            <button className="btn btn-primary btn-large" onClick={load}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Scan
            </button>
          </div>
        )}

        {loading && entries.length === 0 && (
          <div className="empty">Scanning…</div>
        )}

        {scanned && !loading && entries.length === 0 && (
          <div className="empty">No entries found in the PowerShell Operational log.</div>
        )}

        {scanned && entries.length > 0 && rows.length === 0 && (
          <div className="empty">No results match your search.</div>
        )}

        {scanned && entries.length > 0 && rows.length > 0 && (
          <table className="log-table">
            <thead>
              <tr>
                <th className="col-time" onClick={() => toggleSort("timeCreated")}>
                  Time{sortGlyph("timeCreated")}
                </th>
                <th className="col-level" onClick={() => toggleSort("level")}>
                  Level{sortGlyph("level")}
                </th>
                <th className="col-id" onClick={() => toggleSort("id")}>
                  Event ID{sortGlyph("id")}
                </th>
                <th className="col-msg">Message / Command</th>
                <th className="col-copy" aria-label="Copy"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const tone = levelTone(e.level);
                return (
                  <tr key={e.id + "|" + e.timeCreated} className={`tone-${tone}`}>
                    <td className="col-time mono">{formatTime(e.timeCreated)}</td>
                    <td className="col-level">
                      <span className={`badge badge-${tone}`}>{e.level || "Verbose"}</span>
                    </td>
                    <td className="col-id mono">{e.id}</td>
                    <td className="col-msg mono">{e.message?.trim() || "—"}</td>
                    <td className="col-copy">
                      <button
                        className={`btn copy${copiedId === e.id ? " copied" : ""}`}
                        onClick={() => copy(e)}
                        title="Copy text to clipboard"
                        aria-label="Copy to clipboard"
                      >
                        {copiedId === e.id ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}

export default App;