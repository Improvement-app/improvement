# Improvement — High-Level Specification

**Version**: 0.2  
**Date**: April 26, 2026  
**Repository**: https://github.com/Improvement-app/improvement  
**Domain**: https://improvement.app  
**Status**: High-Level Spec (Ready for detailed planning)

---

## Executive Summary

**Improvement** is an AI-powered personal mentor application that helps adult learners develop **deep technical mastery** across both engineering theory and hands-on trade skills.

It supports ambitious real-world projects such as:
- Racecar design & fabrication
- Custom motorcycle building
- Restomod car building
- Engine building
- Supporting trade skills: CNC machining, welding, additive manufacturing, and fabrication

The app combines a full-featured built-in browser, an intelligent AI mentor (Grok-powered), personalized visualizations, knowledge gap analysis, and practical organization tools in one focused workspace.

**Core Philosophy**: Transform scattered web consumption and hobbyist tinkering into structured, accelerated, and deeply retained skill development for serious adult learners.

---

## Vision & Goals

**Vision**  
Become the definitive AI mentor platform for adult learners who want to master complex STEM + trade skills and actually build ambitious projects (race cars, motorcycles, engines, etc.).

**Primary Goals**
- Help users develop both theoretical understanding **and** practical fabrication skills
- Provide an AI mentor that understands the full learning journey (theory → design → fabrication)
- Make resource consumption, knowledge processing, and skill application seamless
- Support realistic adult schedules through smart organization tools (including future calendar integration)
- Enable users to go from “I want to build a race car” to “I can confidently design and fabricate one”

---

## Target Users

- Adults aged 35–60+ (often with professional or IT backgrounds)
- Self-directed learners pursuing serious technical projects
- People who want to combine engineering theory with real fabrication skills (CNC, welding, 3D printing, etc.)
- Users who need structure and accountability because they have jobs, families, and limited time

**Example Persona**: A 53-year-old IT professional who wants to design and build a competitive track-day car, needing skills in vehicle dynamics, fabrication, welding, CNC, engine tuning, and project management.

---

## Scope & Priorities

**Current Focus**: Desktop-first application (Windows, macOS, Linux)  
**Mobile**: Future phase (not in initial scope)  
**Website**: Complete redesign of improvement.app to position the product as an **AI-assisted STEM + trade skills learning mentor**

**Future Enhancements** (post-MVP)
- Calendar integration (Google, Outlook, Apple) for intelligent scheduling around real life
- Mobile companion app or PWA
- Domain-specific modules (Motorsports, Fabrication, Engine Building, etc.)

---

## Core Features

| Category                    | Feature                                                                 | Priority |
|----------------------------|--------------------------------------------------------------------------|----------|
| **Browser**                | Multi-tab built-in browser with full web capabilities                   | MVP     |
| **Content Capture**        | One-click highlight + send to AI, video timestamp capture               | MVP     |
| **AI Mentor**              | Context-aware Grok-powered chat that remembers user’s learning history  | MVP     |
| **Knowledge Processing**   | Auto-summarization, gap detection, personalized explanations            | V1      |
| **Visualizations**         | Generate charts, diagrams, 3D previews, fabrication process visuals     | V1      |
| **Learning Workspace**     | Right panel: notes, AI explanations, interactive visualizations         | MVP     |
| **Task & Schedule**        | Left panel: daily/weekly plans, smart time blocking, priorities         | V1      |
| **Progress Tracking**      | Knowledge graph, mastery levels, streak, project milestones             | V1      |
| **Resource Management**    | Saved resources, AI recommendations, personalized roadmaps              | V1      |
| **Fabrication Focus**      | Support for trade skills (CNC, welding, additive manufacturing)         | V1      |

---

## User Interface Layout (Desktop-First)

**Main Layout**

- **Center (primary area)**: Multi-tab **Browser**
  - Full web browsing with tab management
  - Floating action button / context menu for “Highlight & Send to Mentor”, “Capture Video Segment”, etc.

- **Left Sidebar (collapsible)**: **Task & Schedule Organizer**
  - Daily/weekly learning plan
  - Smart time blocks
  - Tasks linked to learning goals and projects
  - Future: Calendar integration

- **Right Sidebar (collapsible)**: **Learning Workspace & Visualizer**
  - Rich note-taking (markdown + rich text)
  - AI-generated explanations and summaries
  - Interactive visualizations and diagrams
  - “Learning cells”: Explain • Visualize • Practice • Quiz • Connect

- **Top Bar**: Logo, global search, AI Mentor access, progress overview, user profile

**Mobile (Future)**: Simplified experience with floating AI button and bottom navigation.

---

## Key User Flows

**Flow 1: Consume → Process → Act**
1. User opens technical article or video in the browser
2. Highlights key section or selects video segment
3. Clicks “Send to Improvement”
4. AI processes content in context of user’s current knowledge:
   - Explains at appropriate level
   - Generates relevant visualization
   - Suggests related concepts or next resource
   - Adds to knowledge graph and proposes tasks

**Flow 2: Gap Analysis & Roadmap**
- User asks: “What should I focus on next for racecar chassis design?”
- AI reviews learning history and identifies gaps (e.g., “Strong on suspension geometry but limited on torsional rigidity analysis and weld joint design”)
- Creates a personalized 4-week plan combining theory and shop practice

**Flow 3: Visualization on Demand**
- User: “Show me how downforce changes with ride height on a 2025 F1 car”
- App generates interactive chart + explanation tailored to user’s current knowledge level

---

## Non-Functional Requirements

- **Desktop-first**: Excellent native experience on Windows, macOS, and Linux
- **Performance**: Smooth embedded browser and fast AI responses
- **Privacy**: Local-first storage with optional encrypted cloud sync
- **Offline**: Core features (notes, previously loaded content, basic AI) work offline
- **Accessibility**: WCAG 2.2 AA compliant
- **Extensibility**: Plugin/module system for domain-specific content (Motorsports, Fabrication, Engines, etc.)

---

## Phased Roadmap

### MVP (Desktop) – Target: 8–12 weeks
- Multi-tab browser + highlighting & capture
- Basic AI chat with context from highlights/notes
- Simple note-taking panel
- Local storage + basic task list

### V1 (Desktop) – Target: +3–4 months
- Full Learning Workspace with visualizations
- Knowledge gap detection + dynamic roadmaps
- Task & schedule organizer
- Trade skills support in explanations and tasks

### Future Phases
- Calendar integration for intelligent daily/weekly scheduling
- Mobile companion app
- Complete website redesign (new landing page focused on AI learning mentor)
- Domain-specific modules (Racecar, Motorcycle, Engine Building, Fabrication)
- Advanced fabrication tools (toolpath previews, weld parameter suggestions, etc.)

---

## Website Redesign

The current landing page at improvement.app focuses on time management and productivity. It will be **completely replaced** with a new site that clearly communicates:

- AI-assisted STEM + trade skills mentor
- Real-world project outcomes (racecars, custom motorcycles, engines, restomods)
- How it helps serious adult learners develop deep technical mastery

---

## For AI Agents & Contributors

This document is the single source of truth for the **Improvement** project vision.

When working on this codebase or planning features, always refer to this spec first. All implementation decisions should align with the goals of helping adult learners master both engineering theory and hands-on fabrication skills for ambitious real-world projects.

**Key Principles**:
- Desktop-first experience
- AI mentor that remembers the user’s full learning history
- Strong support for both theory and trade skills (CNC, welding, additive manufacturing, etc.)
- Privacy-first and local-first architecture
- Focus on real project outcomes (racecar, motorcycle, engine building)

---

**End of Specification v0.2**

Last updated: April 26, 2026