# 🗺️ Voxel Kids: Creative Builder — Roadmap

> **Last updated:** 2026-03-26
> This document tracks what has been built and what remains for the full Mission 1 transformation.

---

## ✅ Completed

### API Key Security
- [x] Gemini API key moved to Google Cloud Secret Manager
- [x] Express backend proxy (server-side AI calls only)
- [x] Frontend calls `/api/*` endpoints — zero client-side key exposure
- [x] `AIChat.tsx`, `AvatarCustomizer.tsx`, `LiveConversation.tsx` refactored

### GCP Infrastructure
- [x] Project: `hive-core-vertex-bmparent`
- [x] Firestore API enabled
- [x] GCS bucket: `gs://voxel-kids-worlds`
- [x] Pub/Sub topic: `world-events`
- [x] Cloud Storage, Redis, Cloud Tasks APIs enabled
- [x] Secret Manager: `GEMINI_API_KEY` (v1 enabled)

### Shared Data Layer (`shared/`)
- [x] `schemas.ts` — Full Firestore document types (World, Chunk, District, Plot, NPC, Memory, Event, Project), action requests, world diff format
- [x] `firestoreService.ts` — CRUD for all collections, chunk-based voxel storage with GCS
- [x] `storageService.ts` — GCS upload/download, snapshots, signed URLs
- [x] `pubsubService.ts` — World event & NPC action publishing
- [x] `redisService.ts` — Thinker locks, cooldowns, plot reservations, voice NPC tracking (in-memory fallback for local dev)

### World API (`services/world-api/`)
- [x] `routes.ts` — Validated place/remove actions, NPC budget checks, plot protection, world diffs, event logging, snapshot endpoint, NPC CRUD

### NPC Orchestrator (`services/npc-orchestrator/`)
- [x] `scheduler.ts` — Priority-based thinker loop, max 5 concurrent, Redis locks, 4-layer cognition (perception → intent → action)
- [x] `toolSchemas.ts` — 15+ OpenAPI-style function declarations, role-based tool filtering
- [x] `toolExecutor.ts` — Dispatches all tool calls with hard caps (20 voxels per pattern, 30 per path)
- [x] `modelRouter.ts` — Flash-Lite / Flash / Pro tier routing

### Gateway & Deployment
- [x] `services/gateway/index.ts` — Unified Express server (Vite dev proxy + static production serving)
- [x] `Dockerfile` — Multi-stage build (build frontend → slim Node 20 runtime)
- [x] `cloudbuild.yaml` — Cloud Build → Cloud Run (scale-to-zero, Secret Manager)

### Frontend Decomposition
- [x] `src/stores/worldStore.ts` — Cubes, build-tool selections
- [x] `src/stores/npcStore.ts` — NPC state, thinking, messages
- [x] `src/stores/playerStore.ts` — Avatar, camera, water, dragged cube
- [x] `src/stores/uiStore.ts` — Map, help, customizer overlays
- [x] `src/hooks/useStore.ts` — Backward-compatible facade (all existing imports work)
- [x] `src/network/syncService.ts` — Server-backed persistence replacing localStorage

---

## 🔲 Phase 1 Remaining: Stabilize Foundation

### Firestore Realtime Sync
- [ ] Add Firestore realtime listeners in `syncService.ts` for live world diffs
- [ ] Implement optimistic local preview with server reconciliation
- [ ] Add reconnect/reconciliation logic for dropped connections

### First Cloud Run Deployment
- [ ] Create Artifact Registry repo (`voxel-kids`)
- [ ] Run `gcloud builds submit` with `cloudbuild.yaml`
- [ ] Verify game loads in the cloud
- [ ] Configure custom domain (optional)

### World API Hardening
- [ ] Implement full plot boundary checking (spatial queries)
- [ ] Implement district style validation on place actions
- [ ] Add collision detection for overlapping voxels
- [ ] Implement NPC budget reset (hourly/daily cron via Cloud Tasks)

---

## 🔲 Phase 2: Structured NPC Autonomy

> Goal: Make NPCs feel alive and useful

### NPC Role/Trait System
- [ ] Define NPC archetypes in Firestore: Gardener, Builder, Shopkeeper, Mayor, Artist
- [ ] Implement daily schedule templates (wake, work, rest cycle)
- [ ] Add trait-based behavior modifiers (curious, diligent, creative, friendly)
- [ ] Home/work plot assignment and territorial awareness

### Local Simulation (Layer A — No LLM)
- [ ] Client-side pathfinding (A* or nav mesh)
- [ ] Schedule-following state machine (wander → work → rest)
- [ ] Local reaction triggers (player nearby, event happening)
- [ ] Idle animations and ambient behaviors

### Perception Summarizer (Layer B)
- [ ] 32×32 local patch summary generation
- [ ] Include landmarks, player builds, open tasks, weather, time of day
- [ ] Compact format: never send full world to model

### Intent Planner (Layer C — Flash-Lite)
- [ ] Low-cost "what should I do next?" decision pass
- [ ] Context: perception + recent memories + allowed tools + budget
- [ ] Output: intent enum (build, decorate, socialize, repair, explore, rest)

### Action Compiler (Layer D — Flash)
- [ ] Convert intent into concrete function calls
- [ ] Multi-tool action sequences
- [ ] Validate all outputs against role permissions and budget

### Social Memory
- [ ] Player preference tracking (favorite blocks, play patterns)
- [ ] Gift exchange log
- [ ] Important moments (first build, milestones)
- [ ] NPC-to-NPC relationship tracking

### Simple Projects
- [ ] NPC project proposal flow (propose → approve → execute)
- [ ] Auto-approval for safe, small projects
- [ ] Project progress tracking in Firestore
- [ ] Completion events and notifications

### Acceptance Criteria
- [ ] Gardener beautifies public plots without manual intervention
- [ ] Builder repairs or extends paths
- [ ] Shopkeeper decorates owned space
- [ ] NPCs act coherently without constant model calls

---

## 🔲 Phase 3: Premium World Simulation

> Goal: Make the town feel magical

### District System
- [ ] District creation and boundary management
- [ ] Style rules per district (allowed materials, color palette, max height)
- [ ] Zoning rules (density, spacing, destructive edit restrictions)
- [ ] District beautification scoring

### Town Planner Agent (Pro tier)
- [ ] Mayor/Planner NPC uses Gemini Pro for district redesigns
- [ ] Multi-NPC coordination for collaborative projects
- [ ] Seasonal beautification campaigns

### Seasonal Events
- [ ] Time/season cycle (spring → summer → autumn → winter)
- [ ] Season-specific decorations and NPC behaviors
- [ ] Festival proposals and execution
- [ ] Weather effects on NPC decisions

### Project Runner (`services/project-runner/`)
- [ ] Cloud Tasks–driven multi-step build jobs
- [ ] Semantic plan → deterministic compilation pipeline
- [ ] Chunked world edits with progress tracking
- [ ] Recovery/resume for interrupted projects
- [ ] Rollback capability

### Deterministic Build Compiler
- [ ] Semantic plan input (purpose, footprint, style tags, material palette)
- [ ] Engine-side geometry compilation (exact placements, terrain adjustments)
- [ ] Collision-safe prop layout
- [ ] District-compliant material selection
- [ ] Adjacency-aware pathing

### Enhanced Build Tools
- [ ] Copy/paste blocks
- [ ] Undo/redo stack
- [ ] Blueprint placement system
- [ ] Scrapbook / achievement system

### Acceptance Criteria
- [ ] Town evolves in ways that feel authored
- [ ] District improvements are stylistically coherent
- [ ] Player builds influence NPC actions

---

## 🔲 Phase 4: Live Voice & Relationship Layer

> Goal: Make AI emotionally legible

### Live API Integration
- [ ] Refactor `LiveConversation.tsx` to use `voice-session` service
- [ ] Session start/stop lifecycle management
- [ ] Resumable sessions with context preservation

### Talkable NPC Selection
- [ ] Proximity-based selection (nearest high-value NPC)
- [ ] Max 1–2 voice-enabled NPCs at once (Redis-tracked)
- [ ] Priority: guide > best friend > shopkeeper > others

### Post-Conversation Memory
- [ ] Structured summarization of finished conversations
- [ ] Extract key facts, preferences, promises
- [ ] Store as typed memories (relationship scope)
- [ ] Full transcript stored only when needed

### Personality-Consistent Voice
- [ ] System instructions include NPC role, traits, and relationship history
- [ ] Tone and vocabulary matched to NPC archetype
- [ ] Memory-aware responses ("You mentioned you liked towers last time!")

### Voice-Assisted Building
- [ ] Voice commands for block placement ("Put a stone wall here")
- [ ] Voice-triggered build suggestions
- [ ] Collaborative voice building with NPC

### Acceptance Criteria
- [ ] Player can talk to a nearby NPC in realtime
- [ ] NPC remembers meaningful things from past conversations
- [ ] Voice stays scoped to a few high-value characters

---

## 📐 Architecture Reference

```
voxel-kids-creative-builder/
├── shared/                    # Shared data layer
│   ├── schemas.ts             # All Firestore document types
│   ├── firestoreService.ts    # CRUD operations
│   ├── storageService.ts      # Cloud Storage
│   ├── pubsubService.ts       # Event publishing
│   └── redisService.ts        # Locks & cooldowns
├── services/
│   ├── gateway/index.ts       # Unified Express server
│   ├── world-api/routes.ts    # Canonical world authority
│   └── npc-orchestrator/
│       ├── scheduler.ts       # Thinker loop
│       ├── toolSchemas.ts     # OpenAPI tool declarations
│       ├── toolExecutor.ts    # Tool dispatch
│       └── modelRouter.ts     # Gemini tier routing
├── src/                       # React + R3F frontend
│   ├── stores/                # Domain-specific Zustand stores
│   ├── network/               # Server sync layer
│   ├── hooks/useStore.ts      # Backward-compatible facade
│   ├── components/            # Game components
│   └── services/apiClient.ts  # Backend API calls
├── Dockerfile                 # Cloud Run container
├── cloudbuild.yaml            # CI/CD to Cloud Run
└── ROADMAP.md                 # ← You are here
```
