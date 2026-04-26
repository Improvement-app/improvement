# Improvement Implementation

Last updated: April 26, 2026

## Current Status

Improvement is a working Electron + React + TypeScript desktop prototype for adult technical learners. The React renderer owns the persistent app shell, while web content is constrained to the center browser rectangle through Electron `WebContentsView`.

The app currently includes a multi-tab browser, an internal New Tab learning page, Grok/xAI mentor integration, webpage text capture via "Send to AI", collapsible task and learning sidebars, and a polished right-side learning workspace with saved notes, learning-cell prompt starters, mentor chat, copyable AI responses, and a visualizer placeholder.

## Completed Features

- Electron + React + TypeScript project scaffold using `electron-vite`.
- Desktop shell with top bar, integrated browser tab strip, left Tasks & Schedule sidebar, center browser view, and right Learning Workspace sidebar.
- Multi-tab browser backed by one `WebContentsView` per tab.
- Internal New Tab page at `improvement://new-tab` with search and technical learning resource links.
- New-window interception so `target="_blank"` and `window.open()` open as internal app tabs.
- Webpage text selection capture with floating "Send to AI" button.
- xAI/Grok streaming chat integration through the Electron main process.
- API key handling through `XAI_API_KEY` or a temporary in-memory key entered in the sidebar.
- Follow-up mentor conversation panel in the right sidebar.
- Session notes area with local save support.
- Learning-cell prompt starters: Explain, Visualize, Practice, and Quiz.
- Styled Visualizer placeholder for future diagrams and generated learning aids.
- Vitest + Testing Library setup for renderer workflow tests.
- Tests covering tab interactions, "Send to AI" capture routing, note saving, learning-cell prompt starters, and formatted/copyable mentor responses.
- Electron dev launcher that removes `ELECTRON_RUN_AS_NODE` before running `electron-vite`.

## Current Limitations

- Notes are saved in renderer `localStorage` only.
- Mentor conversation history is in-memory only and resets when the app closes.
- Temporary xAI API keys are kept only in main-process memory for the current session.
- New Tab search currently uses Google directly.
- The Visualizer is a styled placeholder and does not yet generate diagrams.
- Webpage capture depends on preload injection and may not work inside some iframes or heavily restricted pages.
- No packaged installer or auto-update flow exists yet.

## Testing Status

Vitest and Testing Library are configured as the standard test stack.

Current test coverage includes:
- Browser tab rendering and tab management API calls.
- Webpage selection capture routing into the Grok mentor panel.
- Session notes saving to local storage.
- Learning-cell prompt starter behavior.
- Formatted mentor responses and copy-to-clipboard behavior.

Tests are now required for new features when appropriate, especially renderer workflows, IPC-facing behavior, capture flows, and mentor workspace changes.

## Next Priorities

- Persist notes, captures, and mentor sessions in a local-first database.
- Add richer markdown rendering for notes and mentor responses.
- Add real visualizer generation and saved learning artifacts.
- Add browser session persistence across app restarts.
- Add task/schedule editing and local persistence.
- Add broader test coverage for main-process tab management, New Tab page generation, and preload capture behavior.
- Prepare packaging for macOS, Windows, and Linux.

## Development Rules

- Always read `IMPLEMENTATION.md` and `docs/SPEC.md` before starting work.
- Update `IMPLEMENTATION.md` after every successful implementation.
- Add tests for new features when appropriate.
- Commit and push after every completed feature.
