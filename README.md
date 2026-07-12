# Career Path - キャリアパスモデル（育成面談用）

Responsive career-path / skill-tree visualization app for a Japanese SES company.  
Built with React + TypeScript + React Flow, and designed for HR / 育成面談 use.

## What the app does

This app visualizes career progression across three domains:

- 開発
- インフラ
- ITサポート

It supports:

- track switching
- subtrack switching
- keyword search
- path-type filtering (`Specialist` / `Manager` / `共通`)
- node detail browsing
- related / coexistable role navigation
- desktop and mobile viewing

## Current architecture

The app currently uses a **hybrid data model**.

### Google Sheets manages content

The published **Nodes** sheet is used for visible content such as:

- `titleJa`
- `shortLabel`
- `summary`
- `requiredSkills`
- `requiredExperience`
- `recommendedCerts`
- `toolsEnvironmentsLanguages`
- `nextStepConditions`
- `tags`
- `branchNote`

### Code manages structure

The following are still managed locally in `src/data/careerData.ts`:

- node existence
- track / subtrack assignment
- stage placement
- x / y positions
- coexist / related links
- all edges

In other words:

- **Google Sheets = content source**
- **`careerData.ts` = structure / layout / relationship source**

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Other scripts

```bash
npm run build
npm run preview
npm run lint
```

## Main UI behavior

### Desktop

- Header with title, active track, and subtrack selector
- Control bar with search and filter chips
- Left pane: React Flow graph
- Right pane: detail panel
- MiniMap and zoom/pan controls enabled

### Mobile

- Graph fills the screen
- Detail panel opens as a drawer
- Search / filter opens as a drawer
- Gesture tutorial modal can be shown on first visit
- MiniMap / graph controls are hidden for a cleaner mobile view

### Graph behavior

- The graph waits for its initial `fitView()` before becoming visible, to avoid first-render viewport flashing
- Some lanes are forcibly aligned to a single x-axis for cleaner vertical progression
- Desktop and mobile use slightly different initial fit behavior
- Cross-track edges are animated
- Optional edges are dashed

## Search / Filter behavior

The app state is managed by `src/hooks/useCareerPathState.ts`.

Current behavior includes:

- filter by active track
- optional filter by subtrack
- keyword search across:
  - `titleJa`
  - `shortLabel`
  - `summary`
  - `requiredSkills`
  - `tags`
  - `recommendedCerts`
  - `toolsEnvironmentsLanguages`
  - `subtrack`
- path-type filtering (`specialist`, `manager`, `common`)

Important behavior:

- when `Specialist` or `Manager` is selected, `共通` nodes are kept visible so the path does not look disconnected
- if the currently selected node becomes hidden by filtering, selection is cleared automatically

## Google Sheets data contract

### Required Nodes sheet columns

These columns must exist:

- `id`
- `titleJa`
- `shortLabel`

### Optional Nodes sheet columns

These columns are read when present:

- `summary`
- `requiredSkills`
- `requiredExperience`
- `recommendedCerts`
- `toolsEnvironmentsLanguages`
- `nextStepConditions`
- `tags`
- `branchNote`

### Columns no longer needed in the sheet

The following can be omitted from Google Sheets because they are now code-managed:

- layout / structure columns such as `track`, `subtrack`, `stage`, `pathType`, `position`, `styleKey`
- relationship columns such as `canCoexistWith`, `relatedNodeIds`

### Edge sheet status

A separate **Edges** sheet is **not used** right now.  
All edges come from `src/data/careerData.ts`.

## Sheet parsing / validation rules

`src/data/loadCareerDataFromSheets.ts` currently does the following:

- fetches the published CSV with cache-busting
- validates required headers
- parses list-like cells
- merges sheet content into local fallback nodes by `id`
- returns local fallback edges unchanged

### List parsing rules

List fields support both of these formats:

- pipe-separated values: `A|B|C`
- multi-line values from Google Sheets cells

Common bullet prefixes such as these are stripped automatically:

- `・`
- `-`
- `●`
- `◯`
- `□`
- `■`

### Sync rule between sheet and code

The `id` values in the Nodes sheet must match the local node IDs in `careerData.ts` **exactly**.

The app throws a validation error when:

- a required local node ID is missing from the sheet
- the sheet contains an unknown node ID
- required headers are missing
- required cell values such as `titleJa` / `shortLabel` are missing
- duplicate IDs exist

## File Structure

```text
src/
├── components/
│   ├── CareerNode.tsx
│   ├── ControlBar.tsx
│   ├── DetailPanel.tsx
│   ├── LoadingSkeleton.tsx
│   ├── MobileDetailDrawer.tsx
│   ├── MobileFilterDrawer.tsx
│   ├── MobileGestureTutorial.tsx
│   ├── SkillTreeGraph.tsx
│   ├── StageLaneOverlay.tsx
│   ├── SubtrackTabs.tsx
│   └── TrackTabs.tsx
├── data/
│   ├── careerData.ts
│   ├── loadCareerDataFromSheets.ts
│   └── sheetSources.ts
├── hooks/
│   └── useCareerPathState.ts
├── types/
│   └── career.ts
├── utils/
│   └── csv.ts
├── App.tsx
├── index.css
└── main.tsx
```

## Screen layout

### Desktop

```text
┌───────────────────────────────────────────────────────────────┐
│ Header: Title + Track Tabs + Subtrack Tabs                   │
├───────────────────────────────────────────────────────────────┤
│ Control Bar: Search | Filters                                │
├───────────────────────────────────────┬───────────────────────┤
│                                       │                       │
│ Skill Tree Graph                      │ Detail Panel          │
│ - React Flow canvas                   │ - selected node info  │
│ - Stage 1~6 overlay                   │ - skills              │
│ - MiniMap                             │ - experience          │
│ - Controls                            │ - certs / tools       │
│                                       │ - related links       │
└───────────────────────────────────────┴───────────────────────┘
```

### Mobile

```text
┌──────────────────────────────────────────────┐
│ Header: Title + Track Tabs + Subtrack Tabs   │
├──────────────────────────────────────────────┤
│ Full-screen Graph                            │
│                                              │
│ [Search / Filter Drawer]                     │
│ [Detail Drawer]                              │
│ [Gesture Tutorial Modal]                     │
└──────────────────────────────────────────────┘
```

## Data model

See `src/types/career.ts` for the full TypeScript schema.

Key fields:

| Field | Description |
|---|---|
| `id` | Unique identifier |
| `track` | Top-level domain (`開発` / `インフラ` / `ITサポート`) |
| `subtrack` | Optional subdivision inside a track |
| `stage` | Career level 1-6 |
| `pathType` | `specialist` / `manager` / `common` |
| `titleJa` | Full Japanese role title |
| `shortLabel` | Short graph label |
| `requiredSkills[]` | Required skills |
| `requiredExperience[]` | Required experience |
| `recommendedCerts[]` | Recommended certifications |
| `toolsEnvironmentsLanguages[]` | Tools / languages / platforms |
| `nextStepConditions[]` | Advancement conditions |
| `tags[]` | Search / filter tags |
| `canCoexistWith[]` | Coexistable role IDs |
| `relatedNodeIds[]` | Cross-reference node IDs |
| `position` | `{ x, y }` layout position |
| `branchNote` | Optional branching / coexistence memo |

## How to edit data

### 1. Edit visible content in Google Sheets

Use the published **Nodes** sheet when changing:

- `titleJa`
- `shortLabel`
- `summary`
- `requiredSkills`
- `requiredExperience`
- `recommendedCerts`
- `toolsEnvironmentsLanguages`
- `nextStepConditions`
- `tags`
- `branchNote`

### 2. Edit structure / layout in code

Open `src/data/careerData.ts` when changing:

- node existence
- track / subtrack structure
- stage placement
- x / y positions
- coexist / related links
- edges

### 3. Update the published sheet URL

Open `src/data/sheetSources.ts` when the published Google Sheets URL changes.

## Visual conventions

| Element | Style |
|---|---|
| 開発 nodes | Blue-accented |
| インフラ nodes | Cyan / teal-accented |
| ITサポート nodes | Violet-accented |
| Specialist | Solid-border style |
| Manager | Dashed-border style |
| Common | Neutral shared style |
| Selected node | Strong highlight |
| Connected neighbors | Highlight ring |
| Optional edges | Dashed gray |
| Cross-track edges | Animated amber |

## Future extensibility

The current code structure leaves room for these additions:

1. Per-person proficiency overlay
2. Employee-specific current / target node overlay
3. Full sheet-driven structure (including positions / edges)
4. Expanded search synonyms
5. Subtrack collapse / expand behavior
6. Additional mobile UX refinement

## Tech Stack

- React 19
- TypeScript
- Vite 7
- Tailwind CSS 4
- `@xyflow/react` (React Flow)
