# Improvement

**AI-Powered Personal Mentor for Deep Technical Mastery**

Improvement helps serious adult learners develop advanced skills in STEM fields and hands-on trades — with the ultimate goal of building real projects like race cars, custom motorcycles, restomods, and engines.

It combines a powerful built-in browser, an intelligent AI mentor, personalized visualizations, knowledge gap analysis, and practical organization tools in one focused workspace.

---

## What is Improvement?

Improvement is a desktop-first application designed for motivated learners who want to go beyond passive watching and reading. It turns web content into structured knowledge and actionable skills.

**Core Idea**: An AI mentor that remembers everything you’ve learned and guides you through theory + fabrication with personalized explanations, visualizations, and learning plans.

**Target Skills**:
- Mechanical Engineering (vehicle dynamics, aerodynamics, powertrains, etc.)
- Trade Skills (CNC machining, welding, additive manufacturing, fabrication)
- Real-world projects (racecar design & build, custom motorcycles, engine building, restomods)

---

## Vision

To become the go-to AI mentor platform for adult learners who want to master complex technical skills and actually build ambitious projects.

We believe that with the right guidance, structure, and tools, anyone can develop professional-level capabilities in engineering and fabrication — even while balancing a full-time job and life.

---

## Key Features

- **Built-in Multi-Tab Browser** with New Tab page (including prominent Import PDF button), transcript capture for YouTube/HPAcademy, and native PDF viewing
- **AI Mentor (Grok/xAI)** with active-project-first RAG over local captured resources, active project metadata/notes/gaps in prompts, streaming responses, learning-cell prompt starters (Explain/Visualize/Practice/Quiz), and follow-up chat
- **Project-Centered Learning**: Left sidebar project/resource tree with New Project flow; center Learning Workspace with linked resources, notes, Pomodoro timer, mentor, and project context
- **Smart Capture & Resources**: Text selection "Send to AI", PDF import/save/extract/link/delete (optional file removal), unified resource library with SQLite FTS5 search and per-item delete buttons
- **Learning Workspace**: Streamlined center panel with transcript notices, resource review (with delete), session notes (localStorage), knowledge-gap recommendations, learning-cell prompt starters, and visualizer placeholder
- **Schedule Mode**: Left sidebar for time blocking (in progress)
- **Persistence**: Tab state, resources, projects, and project-resource links in SQLite + userData

## Current Status

A fully functional desktop prototype with project-centered UI, multi-tab browser (right panel), streamlined center Learning Workspace, left sidebar project/resource tree with delete buttons, resource library with per-item delete (optional file cleanup for PDFs), PDF/transcript capture, Grok mentor with active-project-first local RAG, on-demand knowledge-gap recommendations, SQLite backend, comprehensive tests, and polished Electron integration. See `IMPLEMENTATION.md` for detailed completed features, limitations, and next priorities.

High-level spec in `docs/SPEC.md`. Runs on macOS (Electron + React + TS + Vite + Vitest).

---

## Documentation

- **[IMPLEMENTATION.md](IMPLEMENTATION.md)**: Current architecture, completed features, limitations, testing status, and dev rules (updated after every change).
- **[docs/SPEC.md](docs/SPEC.md)**: High-level vision, project-centered architecture, user personas, and roadmap (single source of truth for product direction).

Read both before contributing.

This is the single source of truth for the Improvement project.

---

## Getting Started

Install dependencies and run the desktop app:

```bash
pnpm install
pnpm dev
```

The current prototype starts with the internal New Tab page, supports multiple tabs, and keeps the React application as the main window shell while web pages load only in the right browser area.

To enable Grok mentor responses, set your xAI API key before launching:

```bash
export XAI_API_KEY="xai-your-api-key"
pnpm dev
```

If `XAI_API_KEY` is not set, the right sidebar will show a temporary API key field. That key is passed to the Electron main process and kept in memory only for the current app session.

Run the test suite:

```bash
pnpm test
```

---

## Contributing

We welcome contributions from anyone interested in building better tools for adult technical education.

If you’d like to get involved, please:
1. Read the [SPEC.md](docs/SPEC.md)
2. Open an issue or discussion
3. Join the conversation

---

## Contact & Links

- **Website**: [improvement.app](https://improvement.app) *(redesign in progress)*
- **Repository**: [github.com/Improvement-app/improvement](https://github.com/Improvement-app/improvement)
- **Spec**: [docs/SPEC.md](docs/SPEC.md)

---

**Improvement** — Helping you turn curiosity into capability.

---

*Last updated: May 4, 2026*
