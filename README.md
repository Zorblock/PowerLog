# PowerLog

A desktop viewer for `Microsoft-Windows-PowerShell/Operational`. Events are loaded in responsive 100-record pages, so large logs do not freeze the application. Select an event to inspect its recorded command/message, timestamp, event and record IDs, computer, process, thread and user context.

## Development

```bash
npm install
npm run start
```

`npm run start` now runs Tauri in development mode with Vite hot reload. Use `npm run start:release` only when you want to build and launch the standalone release executable.

## Notes

PowerLog can show events recorded by the Windows PowerShell Operational log, including script-block events such as Event ID 4104. Windows can only display activity that its auditing/logging has recorded; commands run while logging is disabled cannot be reconstructed afterwards.
