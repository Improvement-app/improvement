# Improvement — High-Level Specification

**Version**: 0.2  
**Date**: April 26, 2026  
**Repository**: https://github.com/Improvement-app/improvement  
**Domain**: https://improvement.app  
**Status**: High-Level Spec (Ready for detailed planning)

---

## Executive Summary

**Improvement** is an AI-powered personal mentor application and emerging **Personal Learning Operating System** that helps adult learners develop **deep technical mastery** across both engineering theory and hands-on trade skills.

It supports ambitious real-world projects such as:
- Racecar design & fabrication
- Custom motorcycle building
- Restomod car building
- Engine building
- Supporting trade skills: CNC machining, welding, additive manufacturing, and fabrication

The app combines a full-featured built-in browser, an intelligent AI mentor (Grok-powered), project-centered resource management, personalized visualizations, knowledge gap analysis, and practical organization tools in one focused workspace.

**Core Philosophy**: Transform scattered web consumption and hobbyist tinkering into structured, accelerated, and deeply retained skill development organized around meaningful projects, real outcomes, and durable capability.

---

## Vision & Goals

**Vision**  
Become the definitive project-centered AI mentor platform for adult learners who want to master complex STEM + trade skills and actually build ambitious projects (race cars, motorcycles, engines, etc.).

Improvement is evolving from a knowledge capture tool into a **Personal Learning Operating System**. Learning is organized around goal-oriented **Projects** such as courses, real-world builds, and skill deep dives. Captured resources, notes, AI conversations, goals, and knowledge gaps become part of a living project context that the AI mentor can use to guide the learner with more precision.

**Primary Goals**
- Help users develop both theoretical understanding **and** practical fabrication skills
- Provide a project-aware AI mentor that understands the full learning journey (theory → design → fabrication)
- Make resource consumption, knowledge processing, goal tracking, and skill application seamless
- Link captured resources, notes, questions, and decisions to the projects where they matter
- Track progress through course modules, learning goals, real-world tasks, and practical decisions
- Detect knowledge gaps within a project and suggest resources, exercises, visualizations, or new learning goals
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

## Project-Centered Learning Architecture

### Vision

Improvement is evolving from a simple knowledge capture tool into a **Personal Learning Operating System**. The core organizing unit is no longer just a captured resource, transcript, PDF, note, or chat. The core organizing unit is a meaningful, goal-oriented **Project**.

A project can be a formal course, a real-world build, or a skill-based deep dive. Every captured resource can be linked to one or more projects, and the AI mentor becomes aware of that project context. This lets Improvement provide more relevant explanations, track progress over time, detect recurring knowledge gaps, and help the learner connect theory to action.

In this architecture, resources are still important, but they are no longer isolated artifacts. A YouTube transcript, HPAcademy lesson transcript, Udemy PDF, workshop note, measurement calculation, or AI answer becomes part of the project it supports. The learner can ask questions inside a project and receive guidance that understands what they are building, what they have already captured, what goals they are pursuing, and what gaps have emerged.

### Core Entities

**Project** is the central container for learning. It represents a meaningful body of work, whether that work is a course, a build, or a long-running skill path.

Examples:
- **Engine Building Fundamentals** course on HPAcademy: Track progress through modules, capture transcripts, ask AI-assisted questions, generate quizzes, and request visualizations tied to each lesson.
- **Autodesk Fusion 360 (2026) – Complete Beginners Guide** on Udemy: Organize course videos, notes, exercises, design files, and practice tasks into one project.
- **Rebuild my Spec Miata Engine**: Track information, calculations, Q&A, measurements, torque specs, machining decisions, parts research, and final build decisions for a real-world engine rebuild.
- **Metallurgy Mastery**: Build a skill-based deep dive around materials, heat treatment, alloys, welding metallurgy, fatigue, and practical fabrication decisions.

**LearningGoal** is a specific, trackable objective inside a project. Goals make a project concrete and measurable. They can be created manually by the user or suggested by the AI mentor.

Example:
- Inside **Rebuild my Spec Miata Engine**, a learning goal might be: “Understand piston clearance and proper measurement techniques.”

Learning goals can eventually track status, confidence, related resources, practice tasks, quiz results, and evidence of mastery.

**KnowledgeGap** is an automatically or manually identified gap tied to a project. Gaps emerge when the learner repeatedly asks questions, struggles with a concept, skips prerequisite knowledge, or asks the AI mentor to assess readiness.

Example:
- After the learner asks several questions about torsional rigidity, chassis stiffness, and load paths, the system detects a likely gap in structural mechanics. It can suggest relevant captured resources, recommend new resources, create a new learning goal, or generate a short practice sequence.

Knowledge gaps should be treated as helpful navigation signals, not failures. They tell the learner where more structure, explanation, practice, or visualization would help.

**ResourceLink** connects a `CapturedResource` to a Project and optionally to a LearningGoal. A single resource can support multiple projects or goals.

Examples:
- A metallurgy PDF might link to both **Metallurgy Mastery** and **Rebuild my Spec Miata Engine**.
- An HPAcademy transcript might link to the **Engine Building Fundamentals** project and to a specific learning goal about ring gap, bearing clearance, or oiling systems.
- A note from a machine shop conversation might link to a real-world engine rebuild project and a goal about measurement technique.

### How It Works in Practice

**Course-based projects** organize structured learning material from platforms such as HPAcademy, Udemy, or similar providers. The learner creates or imports a project for a course, captures transcripts and PDFs, tracks module progress, asks questions in context, and uses the mentor to generate summaries, quizzes, visual explanations, and follow-up practice prompts. The app can eventually show progress by module, resource, lesson, goal, and confidence.

**Real-world build projects** organize practical work where the learner is trying to produce a real outcome. A project such as **Rebuild my Spec Miata Engine** can contain captured resources, measurements, calculations, torque specs, vendor notes, Q&A, decisions, risks, and open questions. The AI mentor can help explain tradeoffs, track decisions, surface missing prerequisites, and connect theoretical resources to practical build steps.

**Skill-based projects** organize deep capability development around a domain such as Metallurgy, Vehicle Dynamics, TIG Welding, CNC Workholding, or Suspension Geometry. These projects may not have a fixed course structure. Instead, they grow through captured resources, goals, practice exercises, self-assessments, and knowledge gaps. The AI mentor can help build a roadmap, suggest next concepts, and connect the skill to active real-world projects.

### Benefits

- **Better context for the AI mentor**: Questions can be answered in light of the project, related resources, active goals, prior decisions, and known gaps.
- **Progress tracking and motivation**: Projects give learners a visible sense of movement through courses, goals, build steps, and skills.
- **Intelligent gap detection**: Repeated questions, uncertainty, and missing prerequisites can become structured KnowledgeGaps with recommended actions.
- **Cross-resource understanding**: The learner can ask, “What do I currently know about piston clearance?” or “What have I captured about torsional rigidity?” and receive an answer synthesized across all relevant projects and resources.
- **Connection between theory and action**: Captured knowledge can be tied directly to what the learner is building, designing, fabricating, measuring, or practicing.

### Future Vision

This architecture can grow into AI-generated learning plans per project, weekly project reviews, readiness checks, cross-project insights, adaptive quizzes, shop-focused task planning, and long-term mastery maps. Over time, Improvement should help the learner understand not only what they have captured, but what they know, what they are trying to accomplish, what remains unclear, and what action would move the project forward next.

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