# Improvement Implementation

Last updated: May 4, 2026

## Current Status

Improvement is a working Electron + React + TypeScript desktop prototype for adult technical learners. The React renderer owns the persistent app shell, while web content is constrained to the right-side browser rectangle through Electron `WebContentsView`.

The app currently includes a persistent multi-tab browser with improved New Tab page (now featuring a prominent Import PDF button), an internal New Tab learning page, Grok/xAI mentor integration with Phase 1 SQLite FTS5 retrieval, webpage text capture via "Send to AI", modular manual transcript capture for YouTube, HPAcademy, and Udemy, local SQLite-backed captured resource storage, project-centered resource linking, persisted knowledge gaps, a project-focused three-panel layout, and a polished center Learning Workspace with saved notes, knowledge-gap recommendations, unified resource review, Pomodoro timer, learning-cell prompt starters, mentor chat, copyable AI responses, and a visualizer placeholder.

## Completed Features

- Electron + React + TypeScript project scaffold using `electron-vite`.
- Desktop shell with dual-mode left sidebar, center Learning Workspace, and right-side multi-tab browser (no top bar; primary navigation and mode toggles live in the left panel and browser column).
- Dual-mode left sidebar: Projects mode shows a project/resource tree, while Schedule mode shows local day time blocks that can be assigned to projects.
- Multi-tab browser backed by one `WebContentsView` per tab.
- Tab persistence in Electron's `userData` folder, including URL, title, tab order, and last active tab restore.
- Internal New Tab page at `improvement://new-tab` with search and technical learning resource links.
- New-window interception so `target="_blank"` and `window.open()` open as internal app tabs.
- Webpage text selection capture with floating "Send to AI" button.
- Manual YouTube transcript capture via a browser toolbar "Capture Transcript" button that appears on YouTube watch pages, using a normal desktop Chrome user agent for embedded tabs, broadened transcript-panel selectors, a short wait for YouTube's dynamic rendering, and a visible-text fallback for timestamped transcript lines.
- Manual HPAcademy transcript capture via the same browser toolbar button on HPAcademy video-like pages, reading from the visible transcript window.
- Manual Udemy transcript capture via the same browser toolbar button on Udemy course/lecture pages (udemy.com, members.udemy.com), with renderer toolbar detection aligned to the Udemy extractor, visible transcript panel selectors (data-purpose="transcript-panel", .transcript-panel, etc.), and fallback message if panel not open.
- Modular transcript extractor architecture under `src/main/transcript/`, with a shared `TranscriptExtractor` base class, provider-specific YouTube, HPAcademy, and Udemy extractors (in subfolders)script panel selectors (data-purpose="transcript-panel", .transcript-panel, etc.), and fallback message if panel not open.
- Modular transcript extractor architecture under `src/main/transcript/`, with a shared `TranscriptExtractor` base class, provider-specific YouTube, HPAcademy, and Udemy extractors (in subfolders), and a registry/factory for selecting the right extractor by URL.
- Unified `CapturedResource` model for transcripts, PDFs, articles, textbooks, notes, and future resource types.
- SQLite-backed `ResourceRepository` under `src/main/resources/`, stored at Electron `userData/resources.db`, with save, lookup, list, search, delete, and type-filter methods.
- SQLite FTS5 virtual table for resource `title` and `content`, kept in sync with triggers and exposed through global and resource-id-scoped relevant-resource search.
- SQLite-backed `ProjectRepository` under `src/main/projects/`, stored in the same `resources.db`, with project CRUD and resource linking/unlinking.
- Project-Centered Learning UI: left sidebar project/resource tree with "New Project" button and form (moved from center), center Learning Workspace with streamlined resources/mentor/Pomodoro (no top Projects box or workspace header), All Resources view, per-project linked-resource view, link/unlink controls, project delete (optional associated resources), and resource delete buttons in lists (with optional on-disk file deletion for PDFs).
- Learning Workspace streamlined in primary center panel (transcript notices, resources, Pomodoro timer, mentor chat) with project context driven by left sidebar selection.
- Multi-tab browser moved to the right panel while retaining tabs, address bar, navigation, transcript capture, PDF import on New Tab, and the Electron `WebContentsView` bounds flow.
- April 28 layout fix: the shell now uses explicit `react-resizable-panels` ordering of left sidebar, center Learning Workspace, and right Browser panel. The complete browser implementation renders only in the right panel, and the `browserFrameRef` / `ResizeObserver` / `setBrowserBounds` flow is attached to the right-panel browser frame so the active `WebContentsView` fills and resizes with that container.
- **Browser clipping fix (April 28)**: `react-resizable-panels` `PanelResizeHandle`s (visible ~6-10px wide, 2 handles) caused total defaultSize sum (22+38+40=100) to overflow the container, clipping the right browser pane. Reduced to 21/37/37 (95% total) to leave buffer for handles; `.browser-frame` explicitly uses `box-sizing: border-box`, `width/height: 100%`, `min-*`: 0, `overflow: hidden`. `onLayoutChange` triggers `scheduleBrowserBoundsUpdate` on drags. Browser now displays full-width sites; resizing remains smooth.
- Empty selected projects now show captured resources as link candidates until project resources exist, preserving the project resource-linking workflow after project creation.
- Transcript captures and PDF imports can be linked to the active project so newly captured learning material lands in the right context immediately.
- Native SQLite rebuild scripts for `better-sqlite3`, with Electron launches rebuilding against Electron's Node ABI and tests rebuilding against the local Node ABI.
- PDF imports copy selected files into Electron `userData/pdfs/`, extract text into `CapturedResource` records, store the local file path in metadata, and open the actual PDF in a new browser tab through Electron's native PDF viewer.
- Import PDF button moved from the Learning Workspace's resource-import-card to a prominent, styled button on the New Tab page (`improvement://new-tab`) in the right-side browser panel. Updated browser preload with contextBridge exposure for `window.improvement.importPdfResource()`, added inline HTML/JS/CSS for the button and success handling. Removed old button, wrapper function, and state from renderer/App.tsx to eliminate duplicates. Linking to the active project continues to work via the shared import flow.
- New Tab PDF import script is generated from a pure helper and kept as browser-safe JavaScript, with regression coverage ensuring the button calls the preload-exposed `window.improvement.importPdfResource()` bridge.
- Browser-side PDF imports now link to the active project through a main-process active project context, then emit a resource-imported event so the renderer refreshes project/resource lists without requiring restart.
- Transcript captures are now saved as `CapturedResource` rows with `type = "transcript"` and provider metadata.
- Transcript success/unavailable notices, a unified captured resource library, cleaned transcript reading view with optional timestamps, copy/delete controls, and one-click "Send to Grok" actions in the learning workspace.
- xAI/Grok streaming chat integration through the Electron main process.
- Phase 1 RAG for freeform Grok questions: the main process searches active-project resources first with FTS5, fills remaining context from the broader local library, adds top relevant excerpts to the prompt, asks Grok to cite local sources when useful, and shows the renderer whether it is searching or using matching resources.
- Phase 3 Knowledge Gap MVP: the main process can analyze a selected project, linked resources, project/session notes, source mix, uncovered project terms, and repeated mentor-question topics to produce knowledge-gap recommendations; generated gaps are persisted in SQLite with `open`, `in_progress`, `resolved`, and `dismissed` statuses; the center Learning Workspace shows active gaps in a "Recommended next" panel with Work on this, Ask Grok, Mark resolved, and Dismiss controls.
- Freeform mentor prompts now include active project metadata, project/session notes, and detected knowledge-gap recommendations alongside retrieved local resources.
- API key handling through `XAI_API_KEY` or a temporary in-memory key entered in the sidebar.
- Follow-up mentor conversation panel in the center Learning Workspace.
- Session notes area with local save support.
- Learning-cell prompt starters: Explain, Visualize, Practice, and Quiz.
- Styled Visualizer placeholder for future diagrams and generated learning aids.
- Vitest + Testing Library setup for renderer workflow tests.
- Tests covering tab interactions, "Send to AI" capture routing, note saving, learning-cell prompt starters, and formatted/copyable mentor responses.
- Tests covering tab per, HPAcademy, and Uerialization, file read/write, active-tab restoration data, and corrupted/missing state handling.
- Tests covering YouTube, HPAcademy, and Udemy extractor URL detection, transcript registry selection, manual transcript extraction script generation, transcript capture UI, one-click Grok sending, and unavailable transcript messaging.
- Electron dev launcher that removes `ELECTRON_RUN_AS_NODE` before running `electron-vite`.

## Current Limitations

- Notes are saved in renderer `localStorage` only, though the resource model now supports future persisted notes.
- Knowledge-gap recommendations are currently generated with deterministic heuristics plus in-memory repeated-question signals; quiz signals, low-confidence answer signals, and automatic recommendations for specific existing resources are future work.
- Tab persistence stores URL/title/active status only; full browser navigation history is not persisted.
- Mentor conversation history is in-memory only and resets when the app closes.
- Resource storage currently persists captured transcripts and imported PDFs; article, textbook, broader file-upload, and note ingestion flows are future work built on the same model.
- Phase 1 RAG uses lexical FTS5 matching and excerpts rather than semantic vector embeddings.
- Temporary xAI API keys are kept only in main-process memory for the current session.
- New Tab search currently uses Google directly.
- The Visualizer is a styled placeholder and does not yet generate diagrams.
- Webpage capture depends on preload injection and may not work inside some iframes or heavily restricted pages.
- YouTube transcript capture depends on YouTube's current transcript side panel DOM and requires the user to open the YouTube "Show transcript" panel before clicking "Capture Transcript".
- HPAcademy transcript capture depends on the visible transcript window being present in the page DOM.
- No packaged installer or auto-update flow exists yet.

## Current Architecture – Project Layer

Status: **Projects + Resource Linking + Knowledge Gap MVP implemented; old progress layer removed**.

Improvement is moving toward a project-centered learning model where captured resources, knowledge gaps, notes, and AI conversations can be organized around meaningful projects. The current `CapturedResource` and SQLite resource system remains the foundation, with the project layer connecting resources to user-defined learning projects.

Next implementation priority: **Expand knowledge-gap detection signals and recommendations**.

### Implemented Database Schema

**`projects`**

Purpose: Stores the central project containers that organize learning.

Implemented fields:
- `id TEXT PRIMARY KEY`
- `title TEXT NOT NULL`
- `description TEXT`
- `type TEXT NOT NULL` — allowed values: `course`, `build`, `skill`, `general`
- `status TEXT NOT NULL` — allowed values: `active`, `paused`, `completed`, `archived`
- `created_at TEXT NOT NULL`
- `target_date TEXT`
- `notes TEXT`

Examples:
- **Engine Building Fundamentals** from HPAcademy
- **Autodesk Fusion 360 (2026) – Complete Beginners Guide** from Udemy
- **Rebuild my Spec Miata Engine** as a real-world build project
- **Metallurgy Mastery** as a skill-focused project

**`knowledge_gaps`**

Status: Phase 3 MVP implemented with SQLite persistence and status workflow.

Purpose: Stores manually or automatically identified gaps tied to a project.

Implemented fields:
- `id TEXT PRIMARY KEY`
- `project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE`
- `title TEXT NOT NULL`
- `description TEXT`
- `recommendation TEXT NOT NULL`
- `status TEXT NOT NULL` — examples: `open`, `in_progress`, `resolved`, `dismissed`
- `severity INTEGER DEFAULT 0`
- `detected_by TEXT NOT NULL` — examples: `user`, `ai`, `quiz`, `repeated-question`
- `evidence_json TEXT NOT NULL DEFAULT '[]'` — references to messages, resources, quizzes, or repeated patterns
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `metadata_json TEXT NOT NULL DEFAULT '{}'`

Example:
- The learner repeatedly asks about torsional rigidity, stiffness, and load paths. The system creates a gap around structural mechanics and suggests resources or practice exercises.

**`resource_links`**

Purpose: Connects a `CapturedResource` to a Project.

Implemented fields:
- `id TEXT PRIMARY KEY`
- `resource_id TEXT NOT NULL REFERENCES resources(id) ON DELETE CASCADE`
- `project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE`
- `linked_at TEXT NOT NULL`
- `notes TEXT`
- `relevance_score REAL NOT NULL DEFAULT 1`
- `UNIQUE(resource_id, project_id)`

Design notes:
- A single resource can link to multiple projects.
- Resource links improve RAG retrieval by letting the AI mentor search within the active project first, then broaden to the full library when useful.
- This schema is intentionally compatible with future vector embeddings and chunk-level resource links.

### Implementation Phases

**Phase 1 – Projects + Resource Linking**

Complete. The app now supports project CRUD through `ProjectRepository`, resource linking/unlinking through `resource_links`, IPC/preload APIs for project operations, center-workspace UI for creating projects, selecting project context, viewing linked resources, and linking/unlinking saved resources, and active-project-first RAG retrieval with global library fallback.

**Removed – Objective Progress Tracking**

The former objective/progress layer has been removed. Projects now own captured resources directly, and the center Learning Workspace focuses on notes, Pomodoro timing, project resources, and mentor interaction.

**Phase 3 – Knowledge Gap Detection + Recommendations**

MVP implemented. The app now detects sparse project context, missing linked resources, weak note synthesis, single-source-type coverage, project terms not represented in linked resources, unsourced note terms, and topics repeated across recent mentor questions for the active project. Generated gaps are stored in `knowledge_gaps`, preserving learner status changes across future detection runs. The renderer shows active gaps as "Recommended next" items for the selected project, and mentor prompts include the active project context plus current active gap recommendations.

Next Phase 3 work: incorporate quiz failures and low-confidence answer signals, recommend specific existing resources when possible, and turn gaps into schedule/tasks or practice exercises.

## Testing Status

Vitest and Testing Library are configured as the standard test stack.

Current test coverage includes:
- Browser tab rendering and tab management API calls.
- Tab persistence serialization and user-data file handling.
- Webpage selection capture routing into the Grok mentor panel.
- Manual YouTube and HPAcademy transcript capture UI, captured transcript review, one-click Grok sending, and unavailable-state messaging.
- Clean transcript resource rendering, timestamp toggling, and full transcript copying.
- SQLite resource repository save/load, updates, search, type filtering, and deletion (with FTS5 triggers).
- SQLite FTS5 relevant-resource search, including index synchronization on save/update/delete.
- SQLite project/repository CRUD, getLinkedResourceIds, and resource linking/unlinking.
- Renderer project/resource creation/selection/deletion UI (with confirm dialogs and optional file/resource cleanup), linking controls, and tree/list delete buttons.
- Renderer layout coverage for the left project tree, Schedule mode, and time-block assignments.
- Renderer layout coverage now asserts the sidebar, Learning Workspace, and Browser DOM order so the native `WebContentsView` bounds target remains the right panel.
- PDF filename cleanup and PDF resource browser-opening behavior.
- New Tab PDF import script generation and preload bridge invocation.
- Active-project PDF import linking and renderer refresh after browser-side imports.
- Active-project-first RAG retrieval, including scoped FTS5 resource search and global-library fallback.
- Knowledge-gap heuristic analysis, repeated-question detection, SQLite persistence/status preservation, and renderer recommendations/status controls for selected projects.
- Learning workspace knowledge-base status indicator for RAG searches.
- Session notes saving to local storage.
- Learning-cell prompt starter behavior.
- Formatted mentor responses and copy-to-clipboard behavior.

Tests are now required for new features when appropriate, especially renderer workflows, IPC-facing behavior, capture flows, and mentor workspace changes.

## Next Priorities

- Expand knowledge-gap detection with quiz failures and low-confidence mentor answers.
- Recommend specific existing resources, practice exercises, or schedule blocks for each detected gap.
- Add article, textbook, broader file-upload, and persisted note capture flows using the `CapturedResource` model.
- Persist notes and mentor sessions in the local-first database.
- Add vector embeddings and chunk-level semantic retrieval alongside FTS5.
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
