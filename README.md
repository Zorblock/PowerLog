# PowerLog

**PowerLog** is a lightweight desktop viewer for the Windows PowerShell event log. It shows you at a glance what PowerShell has been running that is on your machine — much clearer than digging through the Windows Event Viewer yourself.

## What can PowerLog do?

- **Scan** – This button loads the newest entries from the PowerShell event log. One click is all it takes.
- **Clean overview table** – Each entry shows the timestamp, level, event ID and the full text of the command or recorded ScriptBlock.
- **Color coding** – Blue means Information, Orange/Yellow means Warning, Red means Error. Important messages stand out immediately.
- **Live search** – The search bar filters all entries in real time by text, event ID or level.
- **Copy** – A Copy button on every entry point puts the command text straight onto your clipboard, e.g. for documentation or further investigation.
- **Refresh** – Reload the newest entries at any time.

## What is it useful for?

PowerShell records many entries in its operational log in the background, including executed **script blocks** (event ID 4104). With PowerLog you can:

- see which PowerShell scripts have recently run on your machine,
- find suspicious or otherwise noteworthy commands,
- spot warnings and errors quickly,
- copy individual commands from the log and investigate them further.

PowerLog is a practical companion for understanding PowerShell activity on your own system.

## How to get started

1. Download the portable `PowerLog.exe` file.
2. **Double-click** `PowerLog.exe` – that is all you need to do. Nothing is installed.
3. Click **Scan** and the newest entries are loaded.

PowerLog runs straight from any folder and leaves no traces on your system.

## Requirements

- Windows 10 or 11
- PowerShell event logging enabled (on by default on most systems)
- WebView2 runtime (preinstalled on virtually every Windows 10/11 machine)

## Notes

- PowerLog shows the **newest 200 events** per scan; use **Refresh** to load more current entries.
- PowerLog is a **read-only viewer** and does not alter anything on your system.
- It can only display events that Windows has actually recorded. If logging was disabled at some point, that activity cannot be reconstructed afterwards.
- The PowerLog user interface is in **English**.