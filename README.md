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

## Key Features (Planned)

- **Built-in Multi-Tab Browser** — Consume articles, videos, and technical resources directly in the app
- **AI Mentor (Grok-powered)** — Context-aware guidance that knows your learning history
- **Smart Capture** — Highlight text or video segments and send them to the AI for processing
- **Learning Workspace** — Notes, AI explanations, and interactive visualizations in one place
- **Task & Schedule Organizer** — Smart daily/weekly plans that respect your real life
- **Knowledge Graph & Gap Analysis** — See what you know and what’s missing
- **Visualizations** — Auto-generated diagrams, charts, and fabrication previews
- **Future**: Calendar integration, mobile support, domain-specific modules

---

## Current Status

- High-level specification complete (`docs/SPEC.md`)
- Electron + React + TypeScript desktop shell created
- Multi-tab browser prototype uses `WebContentsView` inside the center content rectangle
- Mobile support planned for later
- Website (improvement.app) will be completely redesigned

---

## Documentation

For a complete understanding of the project vision, features, user flows, and roadmap, please read:

→ **[docs/SPEC.md](docs/SPEC.md)**

This is the single source of truth for the Improvement project.

---

## Getting Started

Install dependencies and run the desktop app:

```bash
pnpm install
pnpm dev
```

The current prototype starts with Wikipedia, supports multiple tabs, and keeps the React application as the main window shell while web pages load only in the center browser area.

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

*Last updated: April 26, 2026*