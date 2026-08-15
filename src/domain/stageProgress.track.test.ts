/**
 * 職種で絞ってから段階を取る (v2.15 / HANDOFF §4b)。
 *
 * **段階番号の意味は職種ごとに違う** — インフラ STEP1 は運用監視補助、
 * IT サポート STEP1 は別のもの。絞らずに段階で取ると STEP1 の欄に両方が並び、
 * クリア比率も合算される。
 *
 * ⚠️ この絞り込みは最初 `LadderScreen` の中に書いていた。**消しても型もテストも
 * 通ってしまい**、混ざっていることに誰も気づけない状態だった (HANDOFF §7-32)。
 * `scopeToTrack` に出したので、ここのテストが落ちるようになっている。
 */
import { describe, expect, it } from 'vitest';

import { currentStageOf, scopeToTrack, stageProgress, stagesOfTrack } from './stageProgress';
import type { Action, ActionKind, Category, Cert, CheckLevel, TrackId } from './types';

const categories: Category[] = [
  // インフラ STEP1
  { categoryId: 'i1', track: 'infrastructure', stage: 1, labelJa: '問い合わせ', includes: [], sortOrder: 1 },
  // IT サポート STEP1 — 同じ段階番号だが別の職種
  { categoryId: 's1', track: 'it-support', stage: 1, labelJa: 'PC設定', includes: [], sortOrder: 1 },
  { categoryId: 's2', track: 'it-support', stage: 2, labelJa: 'キッティング', includes: ['s1'], sortOrder: 1 },
];

const act = (id: string, categoryId: string, kind: ActionKind): Action => ({
  actionId: id, categoryId, statement: id, sortOrder: 1, kind,
});

const actions: Action[] = [
  act('ip1', 'i1', 'practice'), act('ip2', 'i1', 'practice'), act('ik1', 'i1', 'knowledge'),
  act('sp1', 's1', 'practice'), act('sk1', 's1', 'knowledge'),
  act('sp2', 's2', 'practice'),
];

const certs: Cert[] = [
  { certId: 'ic1', track: 'infrastructure', stage: 1, nameJa: 'LinuC-1', sortOrder: 1 },
  { certId: 'sc1', track: 'it-support', stage: 1, nameJa: 'MOS', sortOrder: 1 },
];

const all = { categories, actions, certs };

const levelOfStage = (s: number): CheckLevel => (s === 1 ? 'assisted' : 'solo');
const levelOfAction = (kind: ActionKind, stageLevel: CheckLevel): CheckLevel =>
  kind === 'knowledge' ? 'solo' : stageLevel;

const run = (track: TrackId, stage: number, assisted: string[] = [], solo: string[] = []) => {
  const scoped = scopeToTrack(track, all);
  return stageProgress({
    stage, categories: scoped.categories, actions: scoped.actions,
    actionChecks: Object.fromEntries(assisted.map((k) => [k, true])),
    actionSoloChecks: Object.fromEntries(solo.map((k) => [k, true])),
    levelOfStage, levelOfAction,
  });
};

describe('scopeToTrack', () => {
  it('カテゴリを職種で絞る', () => {
    expect(scopeToTrack('infrastructure', all).categories.map((c) => c.categoryId)).toEqual(['i1']);
    expect(scopeToTrack('it-support', all).categories.map((c) => c.categoryId)).toEqual(['s1', 's2']);
  });

  it('アクションは所属カテゴリで決まる — アクション自身は track を持たない', () => {
    expect(scopeToTrack('infrastructure', all).actions.map((a) => a.actionId))
      .toEqual(['ip1', 'ip2', 'ik1']);
    expect(scopeToTrack('it-support', all).actions.map((a) => a.actionId))
      .toEqual(['sp1', 'sk1', 'sp2']);
  });

  it('資格も職種で絞る — 他職種の資格を勧めない', () => {
    expect(scopeToTrack('infrastructure', all).certs.map((c) => c.certId)).toEqual(['ic1']);
    expect(scopeToTrack('it-support', all).certs.map((c) => c.certId)).toEqual(['sc1']);
  });

  it('職種が無ければ全部返す — ルート未選択の初期表示', () => {
    const scoped = scopeToTrack(null, all);
    expect(scoped.categories).toHaveLength(3);
    expect(scoped.actions).toHaveLength(6);
    expect(scoped.certs).toHaveLength(2);
  });

  it('該当が無い職種は空 — 落ちずに空で返す', () => {
    const scoped = scopeToTrack('development', all);
    expect(scoped.categories).toEqual([]);
    expect(scoped.actions).toEqual([]);
    expect(scoped.certs).toEqual([]);
  });
});

describe('stagesOfTrack', () => {
  it('絞った後のカテゴリから段階を昇順で取る', () => {
    expect(stagesOfTrack(scopeToTrack('infrastructure', all).categories)).toEqual([1]);
    expect(stagesOfTrack(scopeToTrack('it-support', all).categories)).toEqual([1, 2]);
  });

  it('重複を潰す — 同じ段階に複数カテゴリがあっても1つ', () => {
    expect(stagesOfTrack([...categories, ...categories])).toEqual([1, 2]);
  });
});

describe('職種で絞ってから段階を取る', () => {
  it('同じ STEP1 でも職種ごとに別の件数になる', () => {
    // 絞らなければ STEP1 は実務3 (ip1,ip2,sp1) / 知識2 になってしまう
    const infra = run('infrastructure', 1);
    expect(infra.practiceTotal).toBe(2);
    expect(infra.knowledgeTotal).toBe(1);

    const support = run('it-support', 1);
    expect(support.practiceTotal).toBe(1);
    expect(support.knowledgeTotal).toBe(1);
  });

  it('他職種のチェックが混ざらない', () => {
    // IT サポートの実務・知識を埋めても、インフラの達成数は動かない
    const infra = run('infrastructure', 1, ['sp1'], ['sk1']);
    expect(infra.practiceDone).toBe(0);
    expect(infra.knowledgeDone).toBe(0);
  });

  it('他職種のカテゴリが「残りの場所」に出てこない', () => {
    const infra = run('infrastructure', 1);
    expect(infra.practiceWhere.map((w) => w.categoryId)).toEqual(['i1']);
    expect(infra.knowledgeWhere.map((w) => w.categoryId)).toEqual(['i1']);
  });

  it('存在しない段階は空になる — 職種ごとに段階の数が違う', () => {
    // このフィクスチャではインフラ側に STEP2 が無い
    expect(run('infrastructure', 2).hasContent).toBe(false);
    expect(run('it-support', 2).hasContent).toBe(true);
  });

  it('「今いる段階」も職種ごとに独立して出る', () => {
    // IT サポートの STEP2 実務にだけチェックがある状態
    const at = (t: TrackId) =>
      currentStageOf(stagesOfTrack(scopeToTrack(t, all).categories), (s) => run(t, s, [], ['sp2']));

    expect(at('it-support')).toBe(2);
    // インフラ側は何も進んでいないので入口のまま
    expect(at('infrastructure')).toBe(1);
  });
});
