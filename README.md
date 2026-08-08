# PowerLog

A desktop viewer for `Microsoft-Windows-PowerShell/Operational`. **Fast Scan** loads the newest 100 events and lets you browse older pages on demand. **Full Scan** reads every event in those same small background pages with progress reporting, so large logs do not freeze the application. Select an event to inspect its recorded command/message, timestamp, event and record IDs, computer, process, thread and user context.

## Development

```bash
npm install
npm run start
```

`npm run start` now runs Tauri in development mode with Vite hot reload. Use `npm run start:release` only when you want to build and launch the standalone release executable.

## Releases

Run releases from a clean, committed worktree on an x64 Windows machine:

```bash
npm run release # yearly minor: 26.5.2 -> 26.6.0
npm run patch   # patch:        26.1.4 -> 26.1.5
```

The first release in a new calendar year starts at `YY.0.0` (for example, `26.0.0`). The workflow synchronizes the version in the Node, Tauri and Cargo manifests, builds `PowerLog-x64-<version>.exe`, creates and pushes a Git tag, and publishes the executable with generated notes to the GitHub release for `Zorblock/PowerLog`.

## Notes

PowerLog can show events recorded by the Windows PowerShell Operational log, including script-block events such as Event ID 4104. Windows can only display activity that its auditing/logging has recorded; commands run while logging is disabled cannot be reconstructed afterwards.
