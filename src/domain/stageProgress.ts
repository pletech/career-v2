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
import type { Action, ActionCheckMap, ActionKind, Category, Cert, CheckLevel, TrackId } from './types';

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
    const own = actions.filter((a) => a.categoryIds.includes(categoryId));
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
 * その段階の目標を満たしたか (2026-08-07 ユーザー再定義)。
 *
 *   この段階の 知識 100% ＋ 実務 70%
 *
 * ⚠️ 当初は「目標 = 実務 70% のみ」としていたが、**知識も目標に含める**形に変えた。
 * 「今やるべきことは1つ」と言えるほうが行動に移しやすい、という判断
 * (この関門を越えると「次の段階に挑戦できる」)。
 *
 * ⚠️ **項目が1件も無い段階は「満たした」にしない** (`hasContent`)。
 * `knowledgeMet` は 0===0 で真、`practiceMet` も 総数0 で真になるので、
 * ガードが無いと**空の段階が満点で達成扱い**になる。カテゴリだけ先に入れて
 * アクションを後から書く、という普通の作業順で必ず踏む (2026-08-14)。
 */
export function stageGoalMet(cur: StageProgress): boolean {
  return cur.hasContent && cur.knowledgeMet && cur.practiceMet;
}

/**
 * 次の段階の**案件**に挑戦してよいと判断できる地点。
 *
 *   この段階の目標 ＋ 次の段階の知識 100%
 *
 * 次の段階の項目がまだ無いときは、その条件を**満たしたことにしない**。
 * 0件を 100% と数えると「準備中の段階を全部クリアした」ことになってしまう。
 *
 * ⚠️ `next !== null` だけでは足りない。**カテゴリはあるがアクションが無い**段階は
 * null ではないのに `knowledgeMet` が真になる。`hasContent` まで見る (2026-08-14)。
 */
export function readyForNext(cur: StageProgress, next: StageProgress | null): boolean {
  return stageGoalMet(cur) && next !== null && next.hasContent && next.knowledgeMet;
}

/**
 * 「今なにを目標にすればよいか」の3段階 (2026-08-07 ユーザー指示)。
 *
 * 一度に出す目標を**1つに絞る**ための区分。同時に3つ並べると
 * どれから手を付けるのか分からない。
 *
 *   goal        … この段階の 知識100% + 実務70% を目指す
 *   next-study  … それを満たした。次の段階の実務は案件に入らないと埋まらないので、
 *                 まず**次の段階の知識**を目指す
 *   ready       … 次の段階の知識まで満たした。**次の段階の案件**に挑戦できる
 *   next-absent … 目標は満たしたが、次の段階の項目がまだ無い (STEP4 は準備中)
 */
export type NextGoal = 'goal' | 'next-study' | 'ready' | 'next-absent';

export function nextGoalOf(cur: StageProgress, next: StageProgress | null): NextGoal {
  if (!stageGoalMet(cur)) return 'goal';
  // 項目の無い段階は「次」として数えない (準備中と同じ扱い)
  if (next === null || !next.hasContent) return 'next-absent';
  return next.knowledgeMet ? 'ready' : 'next-study';
}

/**
 * 「今いる段階」= **その段階の案件に入ったことがある、いちばん上の段階**。
 * 実務のチェックが1件でも入っていることを「入った」の証拠とする。
 * 1件も無ければ最下段 (入口)。ログインが無いので本人に選ばせず、チェックから推定する。
 *
 * ⚠️ 当初は「まだ次へ行けていない、いちばん下の段階」としていた。
 * これだと**目標を満たした瞬間に次の段階へ繰り上がってしまい**、
 * 「次の段階に挑戦できます」「次の段階の案件に挑戦できます」の2状態が
 * **一度も表示されない**(`nextGoalOf` が常に 'goal' を返す)。
 *
 * 実務は案件に入らないと埋まらない。だから「実務のチェックがある = その案件を経験した」
 * であり、目標を満たしても**案件が変わるまでは今の段階に留まる**のが実態に合う。
 */
export function currentStageOf(
  stages: number[],
  progressOf: (stage: number) => StageProgress,
): number | null {
  const asc = [...stages].sort((a, b) => a - b);
  if (asc.length === 0) return null;
  const placed = asc.filter((s) => progressOf(s).practiceDone > 0);
  return placed.length > 0 ? placed[placed.length - 1] : asc[0];
}

/**
 * ルート (職種 × 分類) で絞る (v2.16 / HANDOFF §4b)。
 *
 * ⚠️ **職種だけでは足りない。** ヘルプデスク系も事務系も `it-support` なので、
 * `track` だけで絞ると事務のカテゴリがヘルプデスクの画面に並ぶ。
 * 事務のカテゴリを1件足しただけで STEP1 に 14 枚目のカードとして出た (2026-08-15 実証)。
 * ルートキーが `track/subtrack` である以上、**絞り込みも両方**で行う。
 *
 *
 * **段階番号の意味は職種ごとに違う** (インフラ STEP1=運用監視補助 / 開発 STEP1=テスト)。
 * だから「職種で絞ってから段階を取る」順序でなければならない。絞らずに段階で取ると
 * STEP1 の欄に複数職種が並び、クリア比率も合算される。
 *
 * ⚠️ **ビューの中で絞らない。** 以前これをビュー (LadderScreen) の中に書いていたが、
 * 消しても型もテストも通ってしまい、混ざっていることに気づけなかった。
 * 純粋関数にして、ここを消したらテストが落ちるようにしてある。
 *
 * アクションは自分の `track` を持たない — 所属カテゴリから決まる。
 * カテゴリの範囲は **`track` だけ**で決まる。サブトラック (サーバー/ネットワーク) は
 * 第1版で共通扱いなので、ここで分けるとデータに無い区別を刻むことになる。
 */
export function scopeToRoute(
  route: { track: TrackId; subtrack: string } | null,
  data: { categories: Category[]; actions: Action[]; certs: Cert[] },
): { categories: Category[]; actions: Action[]; certs: Cert[] } {
  if (route === null) return data;
  const onRoute = (x: { track: TrackId; subtrack: string }) =>
    x.track === route.track && x.subtrack === route.subtrack;
  const categories = data.categories.filter((c) => onRoute(c));
  const ids = new Set(categories.map((c) => c.categoryId));
  return {
    categories,
    actions: data.actions.filter((a) => a.categoryIds.some((id) => ids.has(id))),
    certs: data.certs.filter((c) => onRoute(c)),
  };
}

/** その職種に存在する段階 (昇順)。**絞ってから取る**のが要点 */
export function stagesOfTrack(categories: Category[]): number[] {
  return [...new Set(categories.map((c) => c.stage))].sort((a, b) => a - b);
}
