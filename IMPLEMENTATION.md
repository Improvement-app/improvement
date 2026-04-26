# Improvement Implementation

Last updated: April 26, 2026

## Current Status

Improvement is a working Electron + React + TypeScript desktop prototype for adult technical learners. The React renderer owns the persistent app shell, while web content is constrained to the center browser rectangle through Electron `WebContentsView`.

The app currently includes a persistent multi-tab browser, an internal New Tab learning page, Grok/xAI mentor integration, webpage text capture via "Send to AI", modular manual transcript capture for YouTube and HPAcademy, local SQLite-backed captured resource storage, collapsible task and learning sidebars, and a polished right-side learning workspace with saved notes, unified resource review, learning-cell prompt starters, mentor chat, copyable AI responses, and a visualizer placeholder.

## Completed Features

- Electron + React + TypeScript project scaffold using `electron-vite`.
- Desktop shell with top bar, integrated browser tab strip, left Tasks & Schedule sidebar, center browser view, and right Learning Workspace sidebar.
- Multi-tab browser backed by one `WebContentsView` per tab.
- Tab persistence in Electron's `userData` folder, including URL, title, tab order, and last active tab restore.
- Internal New Tab page at `improvement://new-tab` with search and technical learning resource links.
- New-window interception so `target="_blank"` and `window.open()` open as internal app tabs.
- Webpage text selection capture with floating "Send to AI" button.
- Manual YouTube transcript capture via a browser toolbar "Capture Transcript" button that appears on YouTube watch pages, using a normal desktop Chrome user agent for embedded tabs, broadened transcript-panel selectors, a short wait for YouTube's dynamic rendering, and a visible-text fallback for timestamped transcript lines.
- Manual HPAcademy transcript capture via the same browser toolbar button on HPAcademy video-like pages, reading from the visible transcript window.
- Modular transcript extractor architecture under `src/main/transcript/`, with a shared `TranscriptExtractor` base class, provider-specific YouTube and HPAcademy extractors, and a registry/factory for selecting the right extractor by URL.
- Unified `CapturedResource` model for transcripts, PDFs, articles, textbooks, notes, and future resource types.
- SQLite-backed `ResourceRepository` under `src/main/resources/`, stored at Electron `userData/resources.db`, with save, lookup, list, search, delete, and type-filter methods.
- Native SQLite rebuild scripts for `better-sqlite3`, with Electron launches rebuilding against Electron's Node ABI and tests rebuilding against the local Node ABI.
- PDF imports copy selected files into Electron `userData/pdfs/`, extract text into `CapturedResource` records, store the local file path in metadata, and open the actual PDF in a new browser tab through Electron's native PDF viewer.
- Transcript captures are now saved as `CapturedResource` rows with `type = "transcript"` and provider metadata.
- Transcript success/unavailable notices, a unified captured resource library, cleaned transcript reading view with optional timestamps, copy/delete controls, and one-click "Send to Grok" actions in the learning workspace.
- xAI/Grok streaming chat integration through the Electron main process.
- API key handling through `XAI_API_KEY` or a temporary in-memory key entered in the sidebar.
- Follow-up mentor conversation panel in the right sidebar.
- Session notes area with local save support.
- Learning-cell prompt starters: Explain, Visualize, Practice, and Quiz.
- Styled Visualizer placeholder for future diagrams and generated learning aids.
- Vitest + Testing Library setup for renderer workflow tests.
- Tests covering tab interactions, "Send to AI" capture routing, note saving, learning-cell prompt starters, and formatted/copyable mentor responses.
- Tests covering tab persistence serialization, file read/write, active-tab restoration data, and corrupted/missing state handling.
- Tests covering YouTube and HPAcademy extractor URL detection, transcript registry selection, manual transcript extraction script generation, transcript capture UI, one-click Grok sending, and unavailable transcript messaging.
- Electron dev launcher that removes `ELECTRON_RUN_AS_NODE` before running `electron-vite`.

## Current Limitations

- Notes are saved in renderer `localStorage` only, though the resource model now supports future persisted notes.
- Tab persistence stores URL/title/active status only; full browser navigation history is not persisted.
- Mentor conversation history is in-memory only and resets when the app closes.
- Resource storage currently persists captured transcripts and imported PDFs; article, textbook, broader file-upload, and note ingestion flows are future work built on the same model.
- Temporary xAI API keys are kept only in main-process memory for the current session.
- New Tab search currently uses Google directly.
- The Visualizer is a styled placeholder and does not yet generate diagrams.
- Webpage capture depends on preload injection and may not work inside some iframes or heavily restricted pages.
- YouTube transcript capture depends on YouTube's current transcript side panel DOM and requires the user to open the YouTube "Show transcript" panel before clicking "Capture Transcript".
- HPAcademy transcript capture depends on the visible transcript window being present in the page DOM.
- No packaged installer or auto-update flow exists yet.

## Testing Status

Vitest and Testing Library are configured as the standard test stack.

Current test coverage includes:
- Browser tab rendering and tab management API calls.
- Tab persistence serialization and user-data file handling.
- Webpage selection capture routing into the Grok mentor panel.
- Manual YouTube and HPAcademy transcript capture UI, captured transcript review, one-click Grok sending, and unavailable-state messaging.
- Clean transcript resource rendering, timestamp toggling, and full transcript copying.
- SQLite resource repository save/load, updates, search, type filtering, and deletion.
- PDF filename cleanup and PDF resource browser-opening behavior.
- Session notes saving to local storage.
- Learning-cell prompt starter behavior.
- Formatted mentor responses and copy-to-clipboard behavior.

Tests are now required for new features when appropriate, especially renderer workflows, IPC-facing behavior, capture flows, and mentor workspace changes.

## Next Priorities

- Add article, textbook, broader file-upload, and persisted note capture flows using the `CapturedResource` model.
- Persist notes and mentor sessions in the local-first database.
- Add richer markdown rendering for notes and mentor responses.
- Add real visualizer generation and saved learning artifacts.
- Add full browser history/session persistence across app restarts.
- Add alternate caption-source capture for YouTube videos when DOM transcript extraction is unavailable.
- Add additional transcript extractor providers for sites such as Coursera or LinkedIn Learning through the `src/main/transcript/` registry.
- Add task/schedule editing and local persistence.
- Add broader test coverage for main-process tab management, New Tab page generation, and preload capture behavior.
- Prepare packaging for macOS, Windows, and Linux.

## Development Rules

- Always read `IMPLEMENTATION.md` and `docs/SPEC.md` before starting work.
- Update `IMPLEMENTATION.md` after every successful implementation.
- Add tests for new features when appropriate.
- Commit and push after every completed feature.
