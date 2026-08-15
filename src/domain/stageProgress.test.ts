import { describe, expect, it } from 'vitest';

import { currentStageOf, nextGoalOf, readyForNext, stageGoalMet, stageProgress, type StageProgress } from './stageProgress';
import type { Action, Category, CheckLevel, ActionKind } from './types';

const categories: Category[] = [
  { categoryId: 'c1', track: 'infrastructure', stage: 1, labelJa: '手順書', includes: [], sortOrder: 1 },
  { categoryId: 'c1b', track: 'infrastructure', stage: 1, labelJa: '現場理解', includes: [], sortOrder: 2 },
  // 上位は下位を includes する。**足してはいけない**のがこの構造
  { categoryId: 'c2', track: 'infrastructure', stage: 2, labelJa: '初動対応', includes: ['c1', 'c1b'], sortOrder: 1 },
];

const act = (id: string, cat: string, kind: ActionKind): Action => ({
  actionId: id, categoryId: cat, statement: id, sortOrder: 1, kind,
});

// STEP1: 知識2 (k1,k2) / 実務3 (p1,p2,p3)   STEP2: 知識1 (k3) / 実務2 (p4,p5)
const actions: Action[] = [
  act('p1', 'c1', 'practice'), act('p2', 'c1', 'practice'), act('k1', 'c1', 'knowledge'),
  act('p3', 'c1b', 'practice'), act('k2', 'c1b', 'knowledge'),
  act('p4', 'c2', 'practice'), act('p5', 'c2', 'practice'), act('k3', 'c2', 'knowledge'),
];

// STEP1 は補助あり、STEP2 以上は 1人称。知識は段階に関わらず 1人称
const levelOfStage = (s: number): CheckLevel => (s === 1 ? 'assisted' : 'solo');
const levelOfAction = (kind: ActionKind, stageLevel: CheckLevel): CheckLevel =>
  kind === 'knowledge' ? 'solo' : stageLevel;

const run = (stage: number, assisted: string[] = [], solo: string[] = []) =>
  stageProgress({
    stage, categories, actions,
    actionChecks: Object.fromEntries(assisted.map((k) => [k, true])),
    actionSoloChecks: Object.fromEntries(solo.map((k) => [k, true])),
    levelOfStage, levelOfAction,
  });

describe('stageProgress', () => {
  it('段階の固有カテゴリをまたいで足す', () => {
    const s = run(1);
    // c1 の実務2 + c1b の実務1
    expect(s.practiceTotal).toBe(3);
    expect(s.knowledgeTotal).toBe(2);
  });

  it('引き継ぎカテゴリを二重に数えない', () => {
    // c2 は c1・c1b を includes するが、それらは STEP1 の所属
    const s = run(2);
    expect(s.practiceTotal).toBe(2);
    expect(s.knowledgeTotal).toBe(1);
  });

  it('実務は段階の水準で、知識は常に 1人称で数える', () => {
    // STEP1 の実務は assisted で数える。知識を assisted に書いても数えない
    expect(run(1, ['p1', 'k1']).practiceDone).toBe(1);
    expect(run(1, ['p1', 'k1']).knowledgeDone).toBe(0);
    expect(run(1, [], ['k1']).knowledgeDone).toBe(1);
  });

  it('実務は7割、知識は全部で達成になる', () => {
    // 実務3件 → 7割は ceil(2.1) = 3件。端数で 100% になるのは想定どおり
    expect(run(1, ['p1', 'p2']).practiceMet).toBe(false);
    expect(run(1, ['p1', 'p2', 'p3']).practiceMet).toBe(true);
    expect(run(1, [], ['k1']).knowledgeMet).toBe(false);
    expect(run(1, [], ['k1', 'k2']).knowledgeMet).toBe(true);
  });

  it('残りをカテゴリ別に返す', () => {
    const s = run(1, ['p1']);
    expect(s.practiceWhere).toEqual([{ categoryId: 'c1', count: 1 }, { categoryId: 'c1b', count: 1 }]);
    expect(s.knowledgeWhere).toEqual([{ categoryId: 'c1', count: 1 }, { categoryId: 'c1b', count: 1 }]);
  });

  it('項目が無い段階は hasContent が false', () => {
    expect(run(9).hasContent).toBe(false);
  });
});

describe('readyForNext', () => {
  const done1 = run(1, ['p1', 'p2', 'p3'], ['k1', 'k2']);

  it('現段階だけ満たしても、次の段階の知識が残っていれば false', () => {
    expect(readyForNext(done1, run(2))).toBe(false);
  });

  it('次の段階の知識まで満たすと true', () => {
    expect(readyForNext(done1, run(2, [], ['k3']))).toBe(true);
  });

  it('次の段階の項目がまだ無いとき、満たしたことにしない', () => {
    // 0件を100%と数えると「準備中の段階をクリアした」ことになる
    expect(readyForNext(done1, null)).toBe(false);
  });

  it('現段階の知識が残っていれば false', () => {
    expect(readyForNext(run(1, ['p1', 'p2', 'p3'], ['k1']), run(2, [], ['k3']))).toBe(false);
  });
});

describe('currentStageOf', () => {
  it('何もしていなければ最下段 (入口)', () => {
    expect(currentStageOf([1, 2], (s) => run(s))).toBe(1);
  });

  it('実務のチェックがある いちばん上の段階', () => {
    // STEP2 の実務 (1人称) に1件入っている
    const p = (s: number) => run(s, ['p1'], ['p4']);
    expect(currentStageOf([1, 2], p)).toBe(2);
  });

  /**
   * ここが以前の実装のバグ。目標を満たした瞬間に次の段階へ繰り上げていたため、
   * 「次の段階に挑戦できます」「次の段階の案件に挑戦できます」が**一度も出なかった**。
   * 実務は案件に入らないと埋まらないので、案件が変わるまでは今の段階に留まる。
   */
  it('目標を満たしても、次の段階の実務が無いうちは繰り上がらない', () => {
    const p = (s: number) => run(s, ['p1', 'p2', 'p3'], ['k1', 'k2', 'k3']);
    expect(currentStageOf([1, 2], p)).toBe(1);
  });
});

describe('nextGoalOf — 3段階', () => {
  const at = (assisted: string[], solo: string[]) => {
    const cur = run(1, assisted, solo);
    const next = run(2, assisted, solo);
    return nextGoalOf(cur, next);
  };

  it('目標が残っていれば goal', () => {
    expect(at([], [])).toBe('goal');
    expect(at(['p1', 'p2', 'p3'], ['k1'])).toBe('goal');       // 知識が1件残り
  });

  it('目標を満たし、次の段階の知識が残っていれば next-study', () => {
    expect(at(['p1', 'p2', 'p3'], ['k1', 'k2'])).toBe('next-study');
  });

  it('次の段階の知識まで満たせば ready', () => {
    expect(at(['p1', 'p2', 'p3'], ['k1', 'k2', 'k3'])).toBe('ready');
  });

  it('次の段階の項目が無ければ next-absent (0件を100%と数えない)', () => {
    expect(nextGoalOf(run(1, ['p1', 'p2', 'p3'], ['k1', 'k2']), null)).toBe('next-absent');
  });
});

// ---------------------------------------------------------------------------
// 項目が 0 件の段階 (2026-08-14)
// ---------------------------------------------------------------------------
// カテゴリを先に入れてアクションを後から書く、という普通の作業順で必ず通る状態。
// 0/0 は knowledgeMet (0===0) も practiceMet (総数0) も真になるので、
// ガードが無いと**空の段階が満点で達成扱い**になる。
// `readyForNext` の注釈は元々そう書いてあったが、実装は `next !== null` しか
// 見ておらず「カテゴリはあるがアクションが無い」段階を通していた。

const emptyStage = (stage: number): StageProgress =>
  stageProgress({
    stage,
    categories: [{ categoryId: `e${stage}`, track: 'it-support', stage, labelJa: '空', includes: [], sortOrder: 1 }],
    actions: [],
    actionChecks: {},
    actionSoloChecks: {},
    levelOfStage: () => 'solo',
    levelOfAction: () => 'solo',
  });

describe('項目が 0 件の段階', () => {
  it('hasContent が偽', () => {
    expect(emptyStage(1).hasContent).toBe(false);
  });

  it('0/0 は知識・実務ともに「満たした」と出る — だからガードが要る', () => {
    const e = emptyStage(1);
    expect(e.knowledgeMet).toBe(true);
    expect(e.practiceMet).toBe(true);
  });

  it('段階の目標は達成にしない', () => {
    expect(stageGoalMet(emptyStage(1))).toBe(false);
  });

  it('次の段階が空なら「挑戦できる」にしない', () => {
    const cur = stageProgress({
      stage: 1,
      categories: [{ categoryId: 'c1', track: 'it-support', stage: 1, labelJa: 'あり', includes: [], sortOrder: 1 }],
      actions: [
        { actionId: 'k1', categoryId: 'c1', statement: 'k', sortOrder: 1, kind: 'knowledge' },
        { actionId: 'p1', categoryId: 'c1', statement: 'p', sortOrder: 2, kind: 'practice' },
      ],
      actionChecks: {},
      actionSoloChecks: { k1: true, p1: true },
      levelOfStage: () => 'solo',
      levelOfAction: () => 'solo',
    });
    expect(stageGoalMet(cur)).toBe(true);          // 今の段階は満たしている
    expect(readyForNext(cur, emptyStage(2))).toBe(false);
    expect(nextGoalOf(cur, emptyStage(2))).toBe('next-absent');
  });
});
