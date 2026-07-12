/**
 * Career Path Data Model
 *
 * This schema is designed to be:
 * - Easily serializable to/from JSON (for Google Sheets / CSV import)
 * - Extensible: new fields can be added without breaking existing code
 * - Self-documenting with TypeScript types
 *
 * TODO: When connecting to Google Sheets/CSV:
 * - Parse CSV rows into CareerNode[] using a mapping function
 * - Edges can be derived from a separate sheet or adjacency columns
 * - Use `id` as the primary key for lookups
 */

// ---------------------------------------------------------------------------
// Track & Path enums
// ---------------------------------------------------------------------------

/** Top-level career domain / track */
export type Track = 'development' | 'infrastructure' | 'it-support';

/** Path type within a track */
export type PathType = 'specialist' | 'manager' | 'common';

/** Career stage (maps to 段階) — 1 through 6 */
export type Stage = 1 | 2 | 3 | 4 | 5 | 6;

/** Edge types for graph connections */
export type EdgeType = 'normal' | 'optional' | 'cross-track';

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const TRACK_LABELS: Record<Track, string> = {
  development: '開発',
  infrastructure: 'インフラ',
  'it-support': 'ITサポート',
};

export const PATH_TYPE_LABELS: Record<PathType, string> = {
  specialist: 'Specialist',
  manager: 'Manager',
  common: '共通',
};

export const STAGE_LABELS: Record<Stage, string> = {
  1: '段階1',
  2: '段階2',
  3: '段階3',
  4: '段階4',
  5: '段階5',
  6: '段階6',
};

// ---------------------------------------------------------------------------
// Node model
// ---------------------------------------------------------------------------

export interface CareerNode {
  /** Unique identifier — use format like "dev-sp-1", "infra-mg-3" */
  id: string;

  /** Top-level track */
  track: Track;

  /**
   * Optional sub-track within a track.
   * E.g., "Web", "業務系・基幹", "モバイル" for development;
   *       "ヘルプデスク", "情シス支援", "PMO支援" for IT support
   */
  subtrack?: string;

  /** Career stage 1-6 (段階) */
  stage: Stage;

  /** Whether this is a specialist, manager, or common path node */
  pathType: PathType;

  /** Full Japanese role title */
  titleJa: string;

  /** Short label for graph node display */
  shortLabel: string;

  /** Main role/overview content shown in the detail panel's 概要 section */
  role: string;

  /**
   * @deprecated Use `role` instead.
   * Kept temporarily for backward compatibility while sheet/content migration completes.
   */
  summary?: string;

  /** Required skills list */
  requiredSkills: string[];

  /** Required experience list */
  requiredExperience: string[];

  /** Recommended certifications */
  recommendedCerts: string[];

  /** Tools, environments, languages */
  toolsEnvironmentsLanguages: string[];

  /** Conditions to advance to next stage */
  nextStepConditions: string[];

  /** Freeform tags for filtering/searching */
  tags: string[];

  /**
   * IDs of nodes this role can coexist with (兼任可能).
   * Used to show that specialist + manager paths aren't exclusive.
   */
  canCoexistWith?: string[];

  /**
   * IDs of related nodes for cross-reference.
   * Shown as clickable links in the detail panel.
   */
  relatedNodeIds?: string[];

  /**
   * Position hint for React Flow layout.
   * { x, y } in pixels. Can be auto-calculated too.
   */
  position: { x: number; y: number };

  /**
   * Optional style key for custom visual variants.
   * E.g., "highlight", "deprecated", "provisional"
   */
  styleKey?: string;

  /**
   * Optional note about branching / coexistence / provisional status.
   * Rendered in the detail panel under 兼任/分岐メモ.
   */
  branchNote?: string;

  // ----- Future extensibility fields (uncomment when needed) -----
  // /** Per-employee proficiency status */
  // proficiencyStatus?: '未着手' | '学習中' | '実務経験あり' | '面談済';
  // /** Employee-specific: is this the current node? */
  // isCurrent?: boolean;
  // /** Employee-specific: is this the target node? */
  // isTarget?: boolean;
}

// ---------------------------------------------------------------------------
// Edge model
// ---------------------------------------------------------------------------

export interface CareerEdge {
  /** Source node id */
  source: string;

  /** Target node id */
  target: string;

  /** Edge visual type */
  type: EdgeType;

  /** Optional label on the edge */
  label?: string;
}

// ---------------------------------------------------------------------------
// Full dataset type
// ---------------------------------------------------------------------------

export interface CareerDataSet {
  nodes: CareerNode[];
  edges: CareerEdge[];
}
