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

/**
 * 業務カテゴリ (区分)。v2.7d〜: 段階ごとに独立した集合を持つ (アサリさんモデル)。
 * 上位段階のカテゴリは、下位段階のカテゴリを丸ごと包含 (includes) し、
 * さらにその段階固有の原子を持つ。カテゴリ名は段階間で偶然一致しうるが、
 * 原則として異なる (同一カテゴリが段階を貫通するわけではない)。
 */
export interface Category {
  categoryId: string;
  /**
   * このカテゴリが属する職種 (v2.15)。
   *
   * **段階番号の意味は職種ごとに違う** (インフラ STEP1=運用監視補助 / 開発 STEP1=テスト)。
   * だから「職種で絞ってから段階を取る」順序でなければ STEP1 の意味が混ざる。
   * これが無いまま IT サポートのカテゴリを足すと、STEP1 の欄にインフラと
   * IT サポートが並び、クリア比率も合算されてしまう (HANDOFF §4b)。
   *
   */
  track: TrackId;
  /**
   * 分類 (v2.16)。`roles.csv` の `category` と同じ語彙 (`サーバー` / `ヘルプデスク系` / `事務系`)。
   *
   * **職種だけでは足りない。** ヘルプデスク系も事務系も `it-support` なので、
   * `track` だけで絞ると事務のカテゴリがヘルプデスクの画面に並ぶ。
   * 事務のカテゴリを1件足しただけで STEP1 に 14 枚目のカードとして出た (2026-08-15 実証)。
   * ルートキーが `track/subtrack` である以上、**絞り込みも両方**で行う。
   *
   * v2.15 時点では「サブトラックは入れない — 第1版ではサーバー/ネットワークを共通扱いなので、
   * データに存在しない区別を刻むことになる」としていた。その判断はインフラの中では今も正しく、
   * インフラ 24 カテゴリは全て `サーバー` のままである。変わったのは**別の職種が
   * 分類を2つ持って現れた**こと。
   */
  subtrack: string;
  /** このカテゴリが属する段階 (stageOrder) */
  stage: number;
  labelJa: string;
  /** 丸ごと包含する下位カテゴリの categoryId 一覧 (ロールアップ表示・達成率で1項目扱い) */
  includes: string[];
  sortOrder: number;
  labelKo?: string;
}

/**
 * 推奨資格 (v2.7n)。「その段階から次の段階へ進むための」参考として段階に紐づく。
 * 判定要件ではなく参考情報 (ツールと同じ扱い — 非断定原則)。段階1件に複数可。
 */
export interface Cert {
  certId: string;
  /**
   * この資格を推奨する職種 (v2.15)。
   * 段階だけで紐づけていたので、IT サポートに LPIC-1 (サーバー向け) が出てしまう。
   */
  track: TrackId;
  /**
   * 分類 (v2.16)。`roles.csv` の `category` と同じ語彙 (`サーバー` / `ヘルプデスク系` …)。
   * **職種だけでは足りない** — ヘルプデスク系も事務系も `it-support` なので、
   * ここが無いと同じ職種の別分類が同じ画面に混ざる。
   */
  subtrack: string;
  /** この資格を推奨する段階 (この段階から次段階へ進むための参考) */
  stage: number;
  nameJa: string;
  sortOrder: number;
  /** 補足 (何の資格か・レベル感など。任意) */
  note?: string;
  nameKo?: string;
  noteKo?: string;
}

/**
 * 項目の満たし方 (v2.13 — 関口さん 2026-08-05)。
 *
 * `knowledge` = **その業務を扱う案件に配属されなくても**、資格取得や自己学習で満たせる
 * `practice`   = その業務を実際に担当しないと満たせない
 *
 * 判定はこの一点だけで行う。「知識か技能か」ではない —
 * 自分のPCで練習できる操作は `knowledge` に入る。
 * 目的は「今の場所でまだやれることが残っているか」を本人が判断できるようにすること。
 */
export type ActionKind = 'knowledge' | 'practice';

/**
 * アクション（行動項目）。1文1概念・再利用可能な最小単位。チェックの単位はこのアクション。
 * 「最初に登場するカテゴリ」に所属し、そのカテゴリの段階が登場段階になる。
 */
export interface Action {
  actionId: string;
  /**
   * 属するカテゴリ (v2.16。`|` 区切りで複数)。
   *
   * **本質が同じなら同じ文章を2つ書かない。** IT 基礎知識や現場理解は
   * ヘルプデスク系でも事務系でも同じ能力なので、1行を両方に載せる。
   * `actionId` は保存キーなので **片方でチェックすればもう片方も付く** —
   * それが正しい: DNS を説明できる人はどちらの分類にいても説明できる。
   *
   * ⚠️ 逆に、**役割が違えば業務も違う**。「記録」も「引き継ぎ」も
   * ヘルプデスクと事務では読む相手も判断も違うので、**共有しない**。
   * 共有してよいのは文章が一字一句同じにできるものだけ (2026-08-15)。
   */
  categoryIds: string[];
  statement: string;
  sortOrder: number;
  /** 自己学習で満たせるか (v2.13)。段階ごとの「知識100% / 実務70%」判定に使う */
  kind: ActionKind;
  statementKo?: string;
}

/** @deprecated v2.7d でカテゴリモデルへ移行。旧タグ (残置・未使用) */
export interface Tag {
  tagId: string;
  labelJa: string;
  sortOrder: number;
  labelKo?: string;
}

/**
 * 武器 (上位能力)。下位のアクション 複数の組み合わせ (多:1) で成立する。
 * 構成アクションの文言はそのままの原文で表示される (文言一致 — AC-12.4)。
 * @deprecated v2.7e でカテゴリ包含モデルへ移行。旧モデル (残置・未使用)
 */
export interface Weapon {
  weaponId: string;
  roleId: string;
  /** 表示上の主タグ (この列のセルに置かれる) */
  tagId: string;
  statement: string;
  /** 構成アクションの actionId 一覧。差分アクション (firstStage = この武器の段階) を含む */
  composedOf: string[];
  sortOrder: number;
  statementKo?: string;
}

/** actionId -> チェック済みか (アクション単位のチェック — v2.7) */
export type ActionCheckMap = Record<string, boolean>;

/**
 * チェックの水準 (v2.9)。
 * `assisted` = 補助・確認してくれる人がいればできる / `solo` = ひとりでできる。
 * 下位段階の目安は assisted 止まりなので、上位段階が引き継ぐときは solo で問い直す。
 */
export type CheckLevel = 'assisted' | 'solo';

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
