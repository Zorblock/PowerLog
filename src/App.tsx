import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowDown, faArrowUp, faCopy, faMagnifyingGlass, faRotateRight } from "@fortawesome/free-solid-svg-icons";
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

interface LogPage {
  entries: LogEntry[];
  hasMore: boolean;
  nextBeforeRecordId: number | null;
}

type Key = "timeCreated" | "id" | "level";
type Dir = "asc" | "desc";

const accents = [
  { name: "White", color: "#ffffff", strong: "#e5e5e5", ink: "#0a0a0a" },
  { name: "Blue", color: "#3b82f6", strong: "#2563eb", ink: "#ffffff" },
  { name: "Violet", color: "#8b5cf6", strong: "#7c3aed", ink: "#ffffff" },
  { name: "Emerald", color: "#10b981", strong: "#059669", ink: "#062e24" },
  { name: "Rose", color: "#f43f5e", strong: "#e11d48", ink: "#ffffff" },
] as const;

type Accent = (typeof accents)[number];

function parsePowerTime(value: string): Date {
  const legacy = /^\/Date\((-?\d+)\)\/$/.exec(value);
  return legacy ? new Date(Number(legacy[1])) : new Date(value);
}

function formatTime(value: string): string {
  const date = parsePowerTime(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
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

function App() {
  const [pages, setPages] = useState<LogPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [key, setKey] = useState<Key>("timeCreated");
  const [dir, setDir] = useState<Dir>("desc");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fullScanActive, setFullScanActive] = useState(false);
  const [fullScanComplete, setFullScanComplete] = useState(false);
  const [fullProgress, setFullProgress] = useState({ pages: 0, events: 0 });
  const [accent, setAccent] = useState<Accent>(accents[0]);
  const copyTimer = useRef<number | null>(null);
  const scanToken = useRef(0);

  const currentPage = pages[pageIndex];
  const entries = currentPage?.entries ?? [];

  const fetchPage = useCallback(async (beforeRecordId: number | null) => {
    const page = await invoke<LogPage>("get_power_log_page", { beforeRecordId });
    if (!Array.isArray(page.entries)) throw new Error("The event log returned an invalid page.");
    return page;
  }, []);

  const loadPage = useCallback(async (beforeRecordId: number | null, index: number, reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPage(beforeRecordId);
      setPages((current) => {
        if (reset) return [page];
        const next = current.slice(0, index);
        next[index] = page;
        return next;
      });
      setPageIndex(index);
      setSelectedKey(null);
      setScanned(true);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const scan = useCallback(() => {
    scanToken.current += 1;
    setFullScanActive(false);
    setFullScanComplete(false);
    setFullProgress({ pages: 0, events: 0 });
    void loadPage(null, 0, true);
  }, [loadPage]);

  const fullScan = useCallback(async () => {
    const token = scanToken.current + 1;
    scanToken.current = token;
    setLoading(true);
    setError(null);
    setFullScanActive(true);
    setFullScanComplete(false);
    setFullProgress({ pages: 0, events: 0 });
    setPages([]);
    setPageIndex(0);
    setSelectedKey(null);

    let beforeRecordId: number | null = null;
    let pageIndex = 0;
    let eventCount = 0;
    try {
      while (true) {
        const page = await fetchPage(beforeRecordId);
        if (scanToken.current !== token) return;
        eventCount += page.entries.length;
        const loadedIndex = pageIndex;
        setPages((current) => loadedIndex === 0 ? [page] : [...current, page]);
        setScanned(true);
        setFullProgress({ pages: loadedIndex + 1, events: eventCount });
        if (!page.hasMore) break;
        beforeRecordId = page.nextBeforeRecordId;
        pageIndex = loadedIndex + 1;
      }
      setFullScanComplete(true);
    } catch (cause) {
      if (scanToken.current === token) setError(String(cause));
    } finally {
      if (scanToken.current === token) {
        setLoading(false);
        setFullScanActive(false);
      }
    }
  }, [fetchPage]);

  const cancelFullScan = () => {
    scanToken.current += 1;
    setLoading(false);
    setFullScanActive(false);
  };

  const previousPage = () => {
    if (pageIndex === 0) return;
    setPageIndex(pageIndex - 1);
    setSelectedKey(null);
  };

  const nextPage = () => {
    if (!currentPage?.hasMore || loading) return;
    const nextIndex = pageIndex + 1;
    if (pages[nextIndex]) {
      setPageIndex(nextIndex);
      setSelectedKey(null);
    } else {
      void loadPage(currentPage.nextBeforeRecordId, nextIndex);
    }
  };

  const rows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = query ? entries.filter((entry) => [entry.message, entry.level, entry.id, entry.provider, entry.recordId, entry.computer, entry.userId, entry.processId, entry.task].some((value) => String(value ?? "").toLocaleLowerCase().includes(query))) : entries;
    const multiplier = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (key === "id") return (a.id - b.id) * multiplier;
      if (key === "level") return a.level.localeCompare(b.level) * multiplier;
      return (parsePowerTime(a.timeCreated).getTime() - parsePowerTime(b.timeCreated).getTime()) * multiplier;
    });
  }, [dir, entries, key, search]);

  const selected = useMemo(() => entries.find((entry) => `${entry.recordId ?? entry.timeCreated}:${entry.id}` === selectedKey) ?? null, [entries, selectedKey]);

  const toggleSort = (nextKey: Key) => {
    if (nextKey === key) setDir((current) => current === "asc" ? "desc" : "asc");
    else { setKey(nextKey); setDir(nextKey === "timeCreated" ? "desc" : "asc"); }
  };

  const copyCommand = async (entry: LogEntry) => {
    const text = entry.message?.trim() || "";
    if (!text) return;
    try { await navigator.clipboard.writeText(text); }
    catch {
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

  const sortIcon = (column: Key) => key === column ? <FontAwesomeIcon className="sort-icon" icon={dir === "asc" ? faArrowUp : faArrowDown} aria-hidden="true" /> : null;

  const accentStyle = {
    "--accent": accent.color,
    "--accent-strong": accent.strong,
    "--accent-ink": accent.ink,
  } as CSSProperties;

  const accentPicker = (compact = false) => <div className={`accent-picker${compact ? " compact" : ""}`} role="group" aria-label="Accent color">
    {!compact ? <span>Accent color</span> : null}
    <div className="accent-options">{accents.map((option) => <button key={option.name} type="button" className={`accent-dot${accent.name === option.name ? " active" : ""}`} style={{ backgroundColor: option.color }} onClick={() => setAccent(option)} aria-label={`Use ${option.name} accent`} title={option.name} />)}</div>
  </div>;

  return <div className="app" style={accentStyle}>
    <header className="topbar">
      <img className="hero-logo" src="/hero.png" alt="PowerLog" draggable={false} />
      <label className="search">
        <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search this page" aria-label="Search event log" />
      </label>
      <div className="controls">
        {accentPicker(true)}
        {fullScanActive ? <button className="btn" onClick={cancelFullScan}>Stop full scan</button> : <button className="btn" onClick={() => void fullScan()} disabled={loading} title="Load every recorded PowerShell event in the background">Full scan</button>}
        <button className="btn btn-primary" onClick={scan} disabled={loading} title="Read the newest PowerShell events">
          <FontAwesomeIcon className={loading ? "spin" : ""} icon={faRotateRight} aria-hidden="true" />
          {loading && !fullScanActive ? "Loading..." : scanned ? "Fast scan" : "Fast scan"}
        </button>
      </div>
    </header>

    <div className={`statusbar${error ? " is-error" : ""}`}>
      {fullScanActive ? `Full scan in progress: ${fullProgress.events.toLocaleString()} events across ${fullProgress.pages} pages. The app remains usable.` : error ? error : fullScanComplete ? `Full scan complete: ${fullProgress.events.toLocaleString()} events across ${fullProgress.pages} pages.` : loading ? "Loading a small event page in the background..." : scanned ? `Page ${pageIndex + 1} - ${rows.length} of ${entries.length} events. Select an event to inspect it.` : "Choose a scan mode to continue."}
    </div>

    {!scanned && !loading ? <main className="scan-cta">
      <img src="/hero.png" alt="PowerLog" draggable={false} />
      <h1>PowerShell activity, clearly documented.</h1>
      <p>Choose how PowerLog should read <code>Microsoft-Windows-PowerShell/Operational</code>. Both modes keep the window responsive and include script blocks with their recorded command text.</p>
      <div className="scan-actions">
        <button className="scan-choice scan-choice-primary" onClick={scan}><span>Fast Scan</span><small>Loads the newest 100 events immediately. Browse older events page by page.</small></button>
        <button className="scan-choice" onClick={() => void fullScan()}><span>Full Scan</span><small>Loads every available event in the background. It can take longer on large logs.</small></button>
      </div>
    </main> : loading && entries.length === 0 ? <main className="empty">Loading the first event page...</main> : <main className="workspace">
      <section className="table-wrap" aria-label="PowerShell events">
        {scanned && entries.length === 0 ? <div className="empty">No entries were found in the PowerShell Operational log.</div> : null}
        {scanned && entries.length > 0 && rows.length === 0 ? <div className="empty">No events match your search on this page.</div> : null}
        {rows.length > 0 ? <table className="log-table"><thead><tr>
          <th className="col-time" onClick={() => toggleSort("timeCreated")} aria-sort={key === "timeCreated" ? (dir === "asc" ? "ascending" : "descending") : "none"}>Time{sortIcon("timeCreated")}</th>
          <th className="col-level" onClick={() => toggleSort("level")} aria-sort={key === "level" ? (dir === "asc" ? "ascending" : "descending") : "none"}>Level{sortIcon("level")}</th>
          <th className="col-id" onClick={() => toggleSort("id")} aria-sort={key === "id" ? (dir === "asc" ? "ascending" : "descending") : "none"}>Event ID{sortIcon("id")}</th>
          <th>Recorded command / message</th>
        </tr></thead><tbody>{rows.map((entry) => {
          const entryKey = `${entry.recordId ?? entry.timeCreated}:${entry.id}`;
          const tone = levelTone(entry.level);
          return <tr key={entryKey} className={`tone-${tone}${selectedKey === entryKey ? " selected" : ""}`} onClick={() => setSelectedKey(entryKey)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedKey(entryKey); }} tabIndex={0} aria-label={`Open event ${entry.id}`}>
            <td className="col-time mono">{formatTime(entry.timeCreated)}</td><td className="col-level"><span className={`badge badge-${tone}`}>{entry.level || "Verbose"}</span></td><td className="col-id mono">{entry.id}</td><td className="col-msg mono">{entry.message?.trim() || "-"}</td>
          </tr>;
        })}</tbody></table> : null}
        {scanned && entries.length > 0 ? <nav className="pager" aria-label="Event log pages">
          <button className="btn" onClick={previousPage} disabled={loading || pageIndex === 0}>Previous</button>
          <span>Page <strong>{pageIndex + 1}</strong>{currentPage?.hasMore ? " - newest first" : " - oldest loaded events"}</span>
          <button className="btn" onClick={nextPage} disabled={loading || !currentPage?.hasMore}>Next page</button>
        </nav> : null}
      </section>

      <aside className="inspector" aria-label="Event details">
        {selected ? <><div className="inspector-heading"><div><p className="eyebrow">{eventKind(selected)}</p><h2>Event {selected.id}</h2></div><button className="icon-button" onClick={() => setSelectedKey(null)} aria-label="Close event details">X</button></div>
          <dl className="metadata"><div><dt>Time</dt><dd>{formatTime(selected.timeCreated)}</dd></div><div><dt>Record ID</dt><dd className="mono">{selected.recordId ?? "-"}</dd></div><div><dt>Computer</dt><dd>{selected.computer || "-"}</dd></div><div><dt>Provider</dt><dd>{selected.provider || "-"}</dd></div><div><dt>Process / Thread</dt><dd className="mono">{selected.processId ?? "-"} / {selected.threadId ?? "-"}</dd></div><div><dt>User SID</dt><dd className="mono">{selected.userId || "-"}</dd></div></dl>
          <div className="command-header"><div><p className="eyebrow">Full recorded content</p><h3>Command / message</h3></div><button className="btn copy-detail" onClick={() => copyCommand(selected)} disabled={!selected.message}><FontAwesomeIcon icon={faCopy} aria-hidden="true" />{copied ? "Copied" : "Copy"}</button></div>
          <pre className="command-content">{selected.message?.trim() || "No message was supplied for this event."}</pre>
        </> : <div className="inspector-empty"><div className="inspect-mark">i</div><h2>Event details</h2><p>Select any row to view the complete recorded command, timestamp, process, user and log metadata.</p></div>}
      </aside>
    </main>}
  </div>;
}

export default App;
