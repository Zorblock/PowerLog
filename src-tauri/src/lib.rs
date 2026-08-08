// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};
use std::process::Command;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Hides the console window of the spawned `powershell.exe` so no terminal
/// briefly flashes when a scan runs.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// A single entry from the PowerShell Operational event log.
#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    pub time_created: String,
    pub id: u32,
    pub level: String,
    pub message: Option<String>,
}

/// Raw row as returned by the PowerShell JSON pipeline.
#[derive(Debug, Deserialize)]
struct RawEntry {
    #[serde(rename = "TimeCreated", default)]
    time_created: String,
    #[serde(rename = "Id", default)]
    id: u32,
    #[serde(rename = "Level", default)]
    level: u32,
    #[serde(rename = "Message", default)]
    message: Option<String>,
}

impl From<RawEntry> for LogEntry {
    fn from(r: RawEntry) -> Self {
        LogEntry {
            time_created: r.time_created,
            id: r.id,
            level: level_name(r.level).to_string(),
            message: r.message,
        }
    }
}

/// The event log `Level` numeric value is language-independent; map it to a
/// fixed English label so the UI stays English on every system locale
/// (`LevelDisplayName` would be localized, e.g. "Warnung" on German Windows).
fn level_name(level: u32) -> &'static str {
    match level {
        0 => "Undefined",
        1 => "Critical",
        2 => "Error",
        3 => "Warning",
        4 => "Information",
        5 => "Verbose",
        _ => "Unknown",
    }
}

#[tauri::command]
fn get_power_logs() -> Result<Vec<LogEntry>, String> {
    // Writes UTF-8 to the captured stdout/pipeline so we always get clean
    // Unicode text back, regardless of the system code page.
    const SCRIPT: &str = r#"
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$logName = 'Microsoft-Windows-PowerShell/Operational'
$evts = Get-WinEvent -LogName $logName -MaxEvents 200 -ErrorAction SilentlyContinue
if ($null -eq $evts) { $evts = @() }
$evts | Select-Object TimeCreated, Id, Level, Message |
    ConvertTo-Json -Depth 5
"#;

    let mut cmd = Command::new("powershell.exe");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        SCRIPT,
    ]);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| format!("Failed to start PowerShell: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("PowerShell exited with error: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let trimmed = stdout.trim();

    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let value: serde_json::Value =
        serde_json::from_str(trimmed).map_err(|e| format!("Failed to parse log JSON: {e}"))?;

    let raw_entries = match value {
        serde_json::Value::Array(arr) => arr,
        serde_json::Value::Object(_) => vec![value],
        _ => Vec::new(),
    };

    let raws: Vec<RawEntry> = serde_json::from_value(serde_json::Value::Array(raw_entries))
        .map_err(|e| format!("Failed to decode log entries: {e}"))?;

    Ok(raws.into_iter().map(Into::into).collect())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_power_logs])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}