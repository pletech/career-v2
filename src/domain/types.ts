/**
 * v2.3 domain model: 階段型キャリアパス・育成面談ツール
 *
 * 企画書: docs/career-path-v2-plan.md §0-B/§0-C / docs/career-path-v2.2-revision-proposal.md
 *
 * 階層: 役割(Role) → 能力項目(Ability) → 根拠チェックリスト(Evidence)
 * - チェックの単位は Evidence の ✓/未チェックのみ。
 * - 能力の4状態は根拠チェックから自動派生し、直接選択する UI は存在しない (確定 #13)。
 * - 必須/任意の区分は廃止し、根拠には業務種類タグを付ける (確定 #18)。
 * - 上長の「面談で確認した」トグルは根拠チェックと独立して付けられる (確定 #19)。
 * - コンテンツは日本語が正本。*Ko フィールドは作業用の韓国語表示 (確定 #21)。
 *
 * 表示用の固定文言・タグ表示名は domain/i18n.ts が持つ。
 * 旧 CareerNode モデル (types/career.ts) は全体マップ用に温存。
 */

// ---------------------------------------------------------------------------
// roles: 役割マスター
// ---------------------------------------------------------------------------

export type TrackId = 'infrastructure' | 'development' | 'it-support';

export type RoleStatus = 'published' | 'placeholder' | 'hidden';

export interface Role {
  roleId: string;
  track: TrackId;
  category: string;
  stageOrder: number;
  pathType: 'specialist' | 'manager' | 'common';
  titleJa: string;
  shortLabel: string;
  summary: string;
  status: RoleStatus;
  shortGoal?: string;
  // 韓国語表示 (作業用 — 正本は日本語)
  titleKo?: string;
  shortLabelKo?: string;
  summaryKo?: string;
  shortGoalKo?: string;
}

// ---------------------------------------------------------------------------
// abilities: 能力項目
// ---------------------------------------------------------------------------

export interface Ability {
  /** roleId + 連番 (例: "infra-server-sp-2-a1") */
  abilityId: string;
  roleId: string;
  /**
   * 能力の1文。表現規則 (v2.2 改定案 §2):
   * - 1文1概念 (行動を「、」で並列しない)
   * - 特定の製品・サービス名を含めない (ツールは toolsReference のみ)
   */
  statement: string;
  /** 元の役割文 (文脈表示用, 表「役割」列由来) */
  roleStatement: string;
  /** 参考ツール・技術例。判定要件ではなく会話の手がかり */
  toolsReference: string[];
  /** 重み 1〜3 (初期値は全項目1) */
  weight: number;
  /**
   * 同区分・同段階で分類間共通か (表シートの青文字由来)。
   * レビュー・横展開時の重複管理用の内部メタデータであり、UI には表示しない
   * (青文字は元々レビュー閲覧用の目印で、利用者向けの概念ではない — 確定 #20)。
   * 達成状態の自動共有はしない (確定 #7)。
   */
  isCommon: boolean;
  commonGroupId?: string;
  /** 段内の表示順 */
  sortOrder: number;
  /**
   * 業務ロードマップの成長ライン (v2.6 — 確定 #26)。
   * growth-lines の lineId を参照する。空 = 未配属 (「ラインなし」行に表示)。
   */
  growthLineId?: string;
  /**
   * この能力の「次の段階の業務」(v2.6e — スキルツリーの矢印)。
   * 真の継承関係がある能力のみ人がキュレーションして設定する。
   * 後続が無い能力 (例: アカウント対応) は空 — 無理につながない。
   */
  growsInto?: string[];
  // 韓国語表示 (作業用)
  statementKo?: string;
  roleStatementKo?: string;
}

// ---------------------------------------------------------------------------
// growth-lines: 業務ロードマップの成長ライン (v2.6)
// ---------------------------------------------------------------------------

/**
 * 業務ロードマップ (行=ライン, 列=段階) の行定義。
 * ラインは担当区間内で途切れない (階段の連続性 > MECE — 企画書 §0-D.3)。
 */
export interface GrowthLine {
  lineId: string;
  labelJa: string;
  sortOrder: number;
  // 韓国語表示 (作業用)
  labelKo?: string;
}

// ---------------------------------------------------------------------------
// evidences: 根拠チェックリスト
// ---------------------------------------------------------------------------

/**
 * 根拠の段階感 (改定案 §2-3):
 * knowledge (読める・理解している) → practice (作業ができる) → experience (実務経験がある)
 */
export type EvidenceType = 'knowledge' | 'practice' | 'experience';

/** 業務種類タグ (確定 #18)。表示名は i18n.ts の WORK_TAG_LABELS */
export type WorkTagId =
  | 'inquiry'
  | 'reporting'
  | 'procedure'
  | 'account'
  | 'kitting'
  | 'monitoring'
  | 'incident'
  | 'escalation'
  | 'investigation'
  | 'log'
  | 'config'
  | 'maintenance'
  | 'release'
  | 'build'
  | 'middleware'
  | 'verification'
  | 'evidence-record'
  | 'design-read'
  | 'knowledge-base';

export interface Evidence {
  /** abilityId + 連番 (例: "infra-server-sp-2-a1-e2") */
  evidenceId: string;
  abilityId: string;
  /** 「~ができる」「~を理解している」「~した経験がある」の1文 */
  statement: string;
  evidenceType: EvidenceType;
  /** どの種類の業務に関する根拠か (確定 #18 — 必須/任意の代替) */
  workTags: WorkTagId[];
  /**
   * 被面談者向けのセルフチェックのポイント (任意)。
   * 面談者と被面談者が同じ画面を見て話すため、「~を聞いてみる」ではなく
   * 「~を説明できますか？」の自己確認文で書く (確定 #23)。
   */
  selfCheckTip?: string;
  /** 階段順 (易しいものから) */
  sortOrder: number;
  // 韓国語表示 (作業用)
  statementKo?: string;
  selfCheckTipKo?: string;
}

// ---------------------------------------------------------------------------
// v2.7: 素材→武器モデル (企画書 §0-E — アサリさんフィードバック)
//   タグ(区分) → 原子能力(素材, 1文1概念・全域で再利用) → 武器(上位能力 = 素材の組み合わせ)
// ---------------------------------------------------------------------------

/** 業務の区分。セルにはタグ名が表示され、開くと原子能力が展開される。段階を貫通して持続 */
export interface Tag {
  tagId: string;
  labelJa: string;
  sortOrder: number;
  labelKo?: string;
}

/**
 * 原子能力 (素材)。1文1概念・再利用可能な最小単位。
 * チェックの単位はこの原子。全現場の合集合を目指して網羅的に列挙する。
 */
export interface Atom {
  atomId: string;
  tagId: string;
  statement: string;
  /** この素材が最初に登場する段階 (stageOrder)。上位段階では差分として強調される */
  firstStage: number;
  sortOrder: number;
  statementKo?: string;
}

/**
 * 武器 (上位能力)。下位の原子能力 複数の組み合わせ (多:1) で成立する。
 * 構成素材の文言は原子の原文そのまま表示される (文言一致 — AC-12.4)。
 */
export interface Weapon {
  weaponId: string;
  roleId: string;
  /** 表示上の主タグ (この列のセルに置かれる) */
  tagId: string;
  statement: string;
  /** 構成素材の atomId 一覧。差分素材 (firstStage = この武器の段階) を含む */
  composedOf: string[];
  sortOrder: number;
  statementKo?: string;
}

/** atomId -> チェック済みか (素材単位のチェック — v2.7) */
export type AtomCheckMap = Record<string, boolean>;

// ---------------------------------------------------------------------------
// dependencies: 前提関係
// ---------------------------------------------------------------------------

export type DepType = 'role-ladder' | 'cross-category' | 'checkpoint-prereq';

export interface Dependency {
  dependencyId: string;
  fromId: string;
  toId: string;
  depType: DepType;
  gateRule?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// チェック状態 (個人データ)
// ---------------------------------------------------------------------------

/** evidenceId -> チェック済みか */
export type EvidenceCheckMap = Record<string, boolean>;

/** abilityId -> 上長が面談で確認したか (根拠チェックと独立 — 確定 #19) */
export type ManagerConfirmMap = Record<string, boolean>;

/** 能力の派生状態 (表示専用 — 選択 UI は存在しない) */
export type AbilityState = 'not-started' | 'in-progress' | 'can-do' | 'confirmed';
