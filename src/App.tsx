import { useCallback, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface LogEntry {
  timeCreated: string;
  id: number;
  level: string;
  message: string | null;
  provider: string;
  recordId: number | null;
  computer: string;
  userId: string | null;
  processId: number | null;
  threadId: number | null;
  task: string | null;
  opcode: string | null;
}

type Key = "timeCreated" | "id" | "level";
type Dir = "asc" | "desc";

function parsePowerTime(value: string): Date {
  const legacy = /^\/Date\((-?\d+)\)\/$/.exec(value);
  return legacy ? new Date(Number(legacy[1])) : new Date(value);
}

function formatTime(value: string): string {
  const date = parsePowerTime(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function levelTone(level: string): "info" | "warn" | "error" | "crit" | "verb" {
  const normalized = level.toLowerCase();
  if (normalized.includes("critical")) return "crit";
  if (normalized.includes("error")) return "error";
  if (normalized.includes("warning")) return "warn";
  if (normalized.includes("information")) return "info";
  return "verb";
}

function eventKind(entry: LogEntry): string {
  if (entry.id === 4104) return "Script block";
  if (entry.id === 4103) return "Module logging";
  if (entry.id === 400 || entry.id === 403) return "Engine lifecycle";
  return entry.task || "PowerShell event";
}

function CopyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
}

function App() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [key, setKey] = useState<Key>("timeCreated");
  const [dir, setDir] = useState<Dir>("desc");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const logs = await invoke<LogEntry[]>("get_power_logs");
      setEntries(Array.isArray(logs) ? logs : []);
      setSelectedKey(null);
      setScanned(true);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = query
      ? entries.filter((entry) => [
          entry.message,
          entry.level,
          entry.id,
          entry.provider,
          entry.recordId,
          entry.computer,
          entry.userId,
          entry.processId,
          entry.task,
        ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query)))
      : entries;
    const multiplier = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (key === "id") return (a.id - b.id) * multiplier;
      if (key === "level") return a.level.localeCompare(b.level) * multiplier;
      return (parsePowerTime(a.timeCreated).getTime() - parsePowerTime(b.timeCreated).getTime()) * multiplier;
    });
  }, [dir, entries, key, search]);

  const selected = useMemo(
    () => entries.find((entry) => `${entry.recordId ?? entry.timeCreated}:${entry.id}` === selectedKey) ?? null,
    [entries, selectedKey],
  );

  const toggleSort = (nextKey: Key) => {
    if (nextKey === key) setDir((current) => current === "asc" ? "desc" : "asc");
    else {
      setKey(nextKey);
      setDir(nextKey === "timeCreated" ? "desc" : "asc");
    }
  };

  const copyCommand = async (entry: LogEntry) => {
    const text = entry.message?.trim() || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const field = document.createElement("textarea");
      field.value = text;
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    setCopied(true);
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const sortGlyph = (column: Key) => key === column ? (dir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="app">
      <header className="topbar">
        <img className="hero-logo" src="/hero.png" alt="PowerLog" draggable={false} />
        <div className="controls">
          <label className="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search all event data…" aria-label="Search event log" />
          </label>
          <button className="btn btn-primary" onClick={load} disabled={loading} title="Read the complete PowerShell Operational log">
            <svg className={loading ? "spin" : ""} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
            {loading ? "Scanning…" : scanned ? "Refresh" : "Scan log"}
          </button>
        </div>
      </header>

      <div className={`statusbar${error ? " is-error" : ""}`}>
        {loading ? "Reading the complete PowerShell Operational event log…" : error ? error : scanned ? `${rows.length.toLocaleString()} of ${entries.length.toLocaleString()} events · Select an event to inspect it` : "The log has not been scanned yet — click Scan log to continue."}
      </div>

      {!scanned && !loading ? (
        <main className="scan-cta">
          <img src="/hero.png" alt="PowerLog" draggable={false} />
          <h1>PowerShell activity, clearly documented.</h1>
          <p>Read the complete <code>Microsoft-Windows-PowerShell/Operational</code> log, including script blocks and their full recorded command text.</p>
          <button className="btn btn-primary btn-large" onClick={load}>Scan PowerShell log</button>
        </main>
      ) : loading && entries.length === 0 ? <main className="empty">Scanning the event log…</main> : (
        <main className="workspace">
          <section className="table-wrap" aria-label="PowerShell events">
            {scanned && entries.length === 0 ? <div className="empty">No entries were found in the PowerShell Operational log.</div> : null}
            {scanned && entries.length > 0 && rows.length === 0 ? <div className="empty">No events match your search.</div> : null}
            {rows.length > 0 ? <table className="log-table">
              <thead><tr>
                <th className="col-time" onClick={() => toggleSort("timeCreated")}>Time{sortGlyph("timeCreated")}</th>
                <th className="col-level" onClick={() => toggleSort("level")}>Level{sortGlyph("level")}</th>
                <th className="col-id" onClick={() => toggleSort("id")}>Event ID{sortGlyph("id")}</th>
                <th>Recorded command / message</th>
              </tr></thead>
              <tbody>{rows.map((entry) => {
                const entryKey = `${entry.recordId ?? entry.timeCreated}:${entry.id}`;
                const tone = levelTone(entry.level);
                return <tr key={entryKey} className={`tone-${tone}${selectedKey === entryKey ? " selected" : ""}`} onClick={() => setSelectedKey(entryKey)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedKey(entryKey); }} tabIndex={0} aria-label={`Open event ${entry.id}`}>
                  <td className="col-time mono">{formatTime(entry.timeCreated)}</td>
                  <td className="col-level"><span className={`badge badge-${tone}`}>{entry.level || "Verbose"}</span></td>
                  <td className="col-id mono">{entry.id}</td>
                  <td className="col-msg mono">{entry.message?.trim() || "—"}</td>
                </tr>;
              })}</tbody>
            </table> : null}
          </section>

          <aside className="inspector" aria-label="Event details">
            {selected ? <>
              <div className="inspector-heading"><div><p className="eyebrow">{eventKind(selected)}</p><h2>Event {selected.id}</h2></div><button className="icon-button" onClick={() => setSelectedKey(null)} aria-label="Close event details">×</button></div>
              <dl className="metadata">
                <div><dt>Time</dt><dd>{formatTime(selected.timeCreated)}</dd></div>
                <div><dt>Record ID</dt><dd className="mono">{selected.recordId ?? "—"}</dd></div>
                <div><dt>Computer</dt><dd>{selected.computer || "—"}</dd></div>
                <div><dt>Provider</dt><dd>{selected.provider || "—"}</dd></div>
                <div><dt>Process / Thread</dt><dd className="mono">{selected.processId ?? "—"} / {selected.threadId ?? "—"}</dd></div>
                <div><dt>User SID</dt><dd className="mono">{selected.userId || "—"}</dd></div>
              </dl>
              <div className="command-header"><div><p className="eyebrow">Full recorded content</p><h3>Command / message</h3></div><button className="btn copy-detail" onClick={() => copyCommand(selected)} disabled={!selected.message}><CopyIcon />{copied ? "Copied" : "Copy"}</button></div>
              <pre className="command-content">{selected.message?.trim() || "No message was supplied for this event."}</pre>
            </> : <div className="inspector-empty"><div className="inspect-mark">⌘</div><h2>Event details</h2><p>Select any row to view the complete recorded command, timestamp, process, user and log metadata.</p></div>}
          </aside>
        </main>
      )}
    </div>
  );
}

export default App;
