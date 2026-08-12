/**
 * 段階単位の進捗集計 (2026-08-07)。
 *
 * カテゴリ単位の判定は「どこに残っているか」しか答えない。
 * 「次の段階へ行けるか」を知るには段階として足す必要がある。
 *
 * **ビューから切り離してある。** マイページと業務ロードマップの両方がこの値を使うが、
 * 同じ値を2か所で導くと必ずずれる — 直近で3回踏んだ
 * (実務の水準ずれ / 知識の水準ずれ / エクスポートの取りこぼし)。計算はここだけ。
 */
import type { Action, ActionCheckMap, ActionKind, Category, CheckLevel } from './types';

/** クリア閾値 (実務7割)。知識は 100% なので閾値を持たない */
export const CLEAR = 0.7;

export interface StageProgress {
  stage: number;
  knowledgeDone: number;
  knowledgeTotal: number;
  practiceDone: number;
  practiceTotal: number;
  /** 実務の達成率(%)。7割の基準線と同じ土俵で読ませるための表示用 */
  practicePct: number;
  knowledgeMet: boolean;
  practiceMet: boolean;
  /** 知識は全部必要 */
  knowledgeNeed: number;
  /** 実務は7割に届くまで。**どれを埋めてもよい** */
  practiceNeed: number;
  /** 未チェックが残っているカテゴリ。ラベルは呼び出し側で解決する (言語を持ち込まない) */
  knowledgeWhere: { categoryId: string; count: number }[];
  practiceWhere: { categoryId: string; count: number }[];
  hasContent: boolean;
}

export interface StageProgressInput {
  stage: number;
  categories: Category[];
  actions: Action[];
  actionChecks: ActionCheckMap;
  actionSoloChecks: ActionCheckMap;
  /** その段階が判定に使う水準 (最下段だけ assisted 等) */
  levelOfStage: (stage: number) => CheckLevel;
  /** 項目ごとの水準。知識は段階に関わらず 1人称 */
  levelOfAction: (kind: ActionKind, stageLevel: CheckLevel) => CheckLevel;
}

/**
 * **その段階の固有カテゴリだけ**を合算する。
 * 引き継ぎカテゴリは下の段階に属するので、足すと二重計上になる
 * (同じ理由でカテゴリの比率からも外してある — AC-12.39)。
 */
export function stageProgress(input: StageProgressInput): StageProgress {
  const { stage, categories, actions, actionChecks, actionSoloChecks } = input;
  const level = input.levelOfStage(stage);
  const marks = (l: CheckLevel) => (l === 'solo' ? actionSoloChecks : actionChecks);
  const done = (a: Action) => marks(input.levelOfAction(a.kind, level))[a.actionId] === true;

  const ids = categories.filter((c) => c.stage === stage).map((c) => c.categoryId);
  const rows = ids.map((categoryId) => {
    const own = actions.filter((a) => a.categoryId === categoryId);
    const of = (kind: ActionKind) => own.filter((a) => a.kind === kind);
    return {
      categoryId,
      knowledgeTotal: of('knowledge').length,
      practiceTotal: of('practice').length,
      knowledgeLeft: of('knowledge').filter((a) => !done(a)).length,
      practiceLeft: of('practice').filter((a) => !done(a)).length,
    };
  });

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const knowledgeTotal = sum((r) => r.knowledgeTotal);
  const practiceTotal = sum((r) => r.practiceTotal);
  const knowledgeDone = knowledgeTotal - sum((r) => r.knowledgeLeft);
  const practiceDone = practiceTotal - sum((r) => r.practiceLeft);
  const where = (key: 'knowledgeLeft' | 'practiceLeft') =>
    rows.filter((r) => r[key] > 0).map((r) => ({ categoryId: r.categoryId, count: r[key] }));

  return {
    stage,
    knowledgeDone,
    knowledgeTotal,
    practiceDone,
    practiceTotal,
    practicePct: practiceTotal === 0 ? 100 : Math.round((practiceDone / practiceTotal) * 100),
    knowledgeMet: knowledgeDone === knowledgeTotal,
    practiceMet: practiceTotal === 0 || practiceDone >= Math.ceil(practiceTotal * CLEAR),
    knowledgeNeed: knowledgeTotal - knowledgeDone,
    practiceNeed: Math.max(0, Math.ceil(practiceTotal * CLEAR) - practiceDone),
    knowledgeWhere: where('knowledgeLeft'),
    practiceWhere: where('practiceLeft'),
    hasContent: knowledgeTotal + practiceTotal > 0,
  };
}

/**
 * 次の段階へ挑戦してよいと判断できる地点 (2026-08-07 사용자 정의)。
 *
 *   現段階の実務 70% ＋ 現段階の知識 100% ＋ 次の段階の知識 100%
 *
 * 次の段階の項目がまだ無いとき (`next` が null) は、その条件を**満たしたことにしない**。
 * 0件を 100% と数えると「準備中の段階を全部クリアした」ことになってしまう。
 */
export function readyForNext(cur: StageProgress, next: StageProgress | null): boolean {
  return cur.practiceMet && cur.knowledgeMet && next !== null && next.knowledgeMet;
}

/**
 * 「今どこにいるか」。ログインが無いので本人に選ばせず、チェックから推定する。
 *
 * まだ次へ行ける状態になっていない**いちばん下の段階**。全部満たしていれば最上段。
 */
export function currentStageOf(
  stages: number[],
  progressOf: (stage: number) => StageProgress,
): number | null {
  const asc = [...stages].sort((a, b) => a - b);
  for (const s of asc) {
    const next = asc.find((x) => x > s);
    if (!readyForNext(progressOf(s), next === undefined ? null : progressOf(next))) return s;
  }
  return asc.length > 0 ? asc[asc.length - 1] : null;
}
