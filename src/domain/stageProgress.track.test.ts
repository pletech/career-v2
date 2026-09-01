/**
 * ルート (職種 × 分類) で絞ってから段階を取る (v2.16 / HANDOFF §4b)。
 *
 * **段階番号の意味はルートごとに違う** — インフラ STEP1 は運用監視補助、
 * IT サポート STEP1 は別のもの。絞らずに段階で取ると STEP1 の欄に両方が並び、
 * クリア比率も合算される。
 *
 * ⚠️ **職種だけでは足りない** (2026-08-15)。ヘルプデスク系も事務系も `it-support` なので、
 * `track` だけで絞ると事務のカテゴリがヘルプデスクの画面に並ぶ。実際に事務のカテゴリを
 * 1件足しただけで STEP1 に 14 枚目のカードとして出た。ルートキーが `track/subtrack`
 * である以上、絞り込みも両方で行う。
 *
 * ⚠️ この絞り込みは最初 `LadderScreen` の中に書いていた。**消しても型もテストも
 * 通ってしまい**、混ざっていることに誰も気づけない状態だった (HANDOFF §7-32)。
 * `scopeToRoute` に出したので、ここのテストが落ちるようになっている。
 */
import { describe, expect, it } from 'vitest';

import { currentStageOf, scopeToRoute, stageProgress, stagesOfTrack } from './stageProgress';
import type { Action, ActionKind, Category, Cert, CheckLevel, TrackId } from './types';

type Route = { track: TrackId; subtrack: string };

const INFRA: Route = { track: 'infrastructure', subtrack: 'サーバー' };
const HELPDESK: Route = { track: 'it-support', subtrack: 'ヘルプデスク系' };
const ADMIN: Route = { track: 'it-support', subtrack: '事務系' };

const cat = (categoryId: string, r: Route, stage: number, labelJa: string, includes: string[] = []): Category =>
  ({ categoryId, track: r.track, subtrack: r.subtrack, stage, labelJa, includes, sortOrder: 1 });

const categories: Category[] = [
  // インフラ STEP1
  cat('i1', INFRA, 1, '問い合わせ'),
  // IT サポート / ヘルプデスク系 — 同じ段階番号だが別のルート
  cat('h1', HELPDESK, 1, 'PC設定'),
  cat('h2', HELPDESK, 2, 'キッティング', ['h1']),
  // IT サポート / 事務系 — **職種は同じ**。ここが分類で割れていないと混ざる
  cat('a1', ADMIN, 1, '申請の受付'),
];

const act = (id: string, categoryId: string, kind: ActionKind): Action => ({
  actionId: id, categoryIds: [categoryId], statement: id, sortOrder: 1, kind,
});

const actions: Action[] = [
  act('ip1', 'i1', 'practice'), act('ip2', 'i1', 'practice'), act('ik1', 'i1', 'knowledge'),
  act('hp1', 'h1', 'practice'), act('hk1', 'h1', 'knowledge'),
  act('hp2', 'h2', 'practice'),
  act('ap1', 'a1', 'practice'), act('ak1', 'a1', 'knowledge'),
];

const certs: Cert[] = [
  { certId: 'ic1', track: INFRA.track, subtrack: INFRA.subtrack, stage: 1, nameJa: 'LinuC-1', sortOrder: 1 },
  { certId: 'hc1', track: HELPDESK.track, subtrack: HELPDESK.subtrack, stage: 1, nameJa: 'MS-900', sortOrder: 1 },
  { certId: 'ac1', track: ADMIN.track, subtrack: ADMIN.subtrack, stage: 1, nameJa: 'MOS', sortOrder: 1 },
];

const all = { categories, actions, certs };

const levelOfStage = (s: number): CheckLevel => (s === 1 ? 'assisted' : 'solo');
const levelOfAction = (kind: ActionKind, stageLevel: CheckLevel): CheckLevel =>
  kind === 'knowledge' ? 'solo' : stageLevel;

const run = (route: Route, stage: number, assisted: string[] = [], solo: string[] = []) => {
  const scoped = scopeToRoute(route, all);
  return stageProgress({
    stage, categories: scoped.categories, actions: scoped.actions,
    actionChecks: Object.fromEntries(assisted.map((k) => [k, true])),
    actionSoloChecks: Object.fromEntries(solo.map((k) => [k, true])),
    levelOfStage, levelOfAction,
  });
};

describe('scopeToRoute', () => {
  it('カテゴリをルートで絞る', () => {
    expect(scopeToRoute(INFRA, all).categories.map((c) => c.categoryId)).toEqual(['i1']);
    expect(scopeToRoute(HELPDESK, all).categories.map((c) => c.categoryId)).toEqual(['h1', 'h2']);
  });

  it('**同じ職種の別分類が混ざらない** — track だけでは足りない', () => {
    // ここが本題。track だけで絞ると ['h1','h2','a1'] になる
    expect(scopeToRoute(HELPDESK, all).categories.map((c) => c.categoryId)).not.toContain('a1');
    expect(scopeToRoute(ADMIN, all).categories.map((c) => c.categoryId)).toEqual(['a1']);
  });

  it('アクションは所属カテゴリで決まる — アクション自身はルートを持たない', () => {
    expect(scopeToRoute(HELPDESK, all).actions.map((a) => a.actionId))
      .toEqual(['hp1', 'hk1', 'hp2']);
    expect(scopeToRoute(ADMIN, all).actions.map((a) => a.actionId)).toEqual(['ap1', 'ak1']);
  });

  it('資格もルートで絞る — 別分類の資格を勧めない', () => {
    expect(scopeToRoute(HELPDESK, all).certs.map((c) => c.certId)).toEqual(['hc1']);
    expect(scopeToRoute(ADMIN, all).certs.map((c) => c.certId)).toEqual(['ac1']);
  });

  it('ルートが無ければ全部返す — 未選択の初期表示', () => {
    const scoped = scopeToRoute(null, all);
    expect(scoped.categories).toHaveLength(4);
    expect(scoped.actions).toHaveLength(8);
    expect(scoped.certs).toHaveLength(3);
  });

  it('該当が無いルートは空 — 落ちずに空で返す', () => {
    const scoped = scopeToRoute({ track: 'development', subtrack: 'Webアプリケーション' }, all);
    expect(scoped.categories).toEqual([]);
    expect(scoped.actions).toEqual([]);
    expect(scoped.certs).toEqual([]);
  });
});

describe('stagesOfTrack', () => {
  it('絞った後のカテゴリから段階を昇順で取る', () => {
    expect(stagesOfTrack(scopeToRoute(INFRA, all).categories)).toEqual([1]);
    expect(stagesOfTrack(scopeToRoute(HELPDESK, all).categories)).toEqual([1, 2]);
  });

  it('重複を潰す — 同じ段階に複数カテゴリがあっても1つ', () => {
    expect(stagesOfTrack([...categories, ...categories])).toEqual([1, 2]);
  });
});

describe('ルートで絞ってから段階を取る', () => {
  it('同じ STEP1 でもルートごとに別の件数になる', () => {
    // 絞らなければ STEP1 は実務4 (ip1,ip2,hp1,ap1) / 知識3 になってしまう
    expect(run(INFRA, 1).practiceTotal).toBe(2);
    expect(run(HELPDESK, 1).practiceTotal).toBe(1);
    expect(run(ADMIN, 1).practiceTotal).toBe(1);
  });

  it('他ルートのチェックが混ざらない', () => {
    // ヘルプデスクと事務を埋めても、インフラの達成数は動かない
    const infra = run(INFRA, 1, ['hp1', 'ap1'], ['hk1', 'ak1']);
    expect(infra.practiceDone).toBe(0);
    expect(infra.knowledgeDone).toBe(0);
  });

  it('同じ職種どうしでも混ざらない', () => {
    // 事務を全部埋めても、ヘルプデスクは 0 のまま
    const hd = run(HELPDESK, 1, ['ap1'], ['ak1']);
    expect(hd.practiceDone).toBe(0);
    expect(hd.knowledgeDone).toBe(0);
  });

  it('他ルートのカテゴリが「残りの場所」に出てこない', () => {
    const hd = run(HELPDESK, 1);
    expect(hd.practiceWhere.map((w) => w.categoryId)).toEqual(['h1']);
    expect(hd.knowledgeWhere.map((w) => w.categoryId)).toEqual(['h1']);
  });

  it('存在しない段階は空になる — ルートごとに段階の数が違う', () => {
    expect(run(INFRA, 2).hasContent).toBe(false);
    expect(run(HELPDESK, 2).hasContent).toBe(true);
    expect(run(ADMIN, 2).hasContent).toBe(false);
  });

  it('「今いる段階」もルートごとに独立して出る', () => {
    // ヘルプデスクの STEP2 実務にだけチェックがある状態
    const at = (r: Route) =>
      currentStageOf(stagesOfTrack(scopeToRoute(r, all).categories), (s) => run(r, s, [], ['hp2']));

    expect(at(HELPDESK)).toBe(2);
    // 他ルートは何も進んでいないので入口のまま
    expect(at(INFRA)).toBe(1);
    expect(at(ADMIN)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 分類をまたぐ共有 (v2.16 / 2026-08-15)
// ---------------------------------------------------------------------------
// **本質が同じなら同じ文章を2つ書かない。** IT 基礎知識はヘルプデスク系でも
// 事務系でも同じ能力なので、1行を両方のカテゴリに載せる。
// `actionId` は保存キーなので、片方でチェックすればもう片方にも付く — それが正しい。
//
// ⚠️ 共有してよいのは**一字一句同じにできるもの**だけ。「記録」も「引き継ぎ」も
// 役割が違えば読む相手も判断も違うので共有しない。

const sharedCats: Category[] = [
  cat('h-itbasics', HELPDESK, 1, 'IT基礎知識'),
  cat('a-itbasics', ADMIN, 1, 'IT基礎知識'),
];

/** 1行が両方のカテゴリに属する */
const sharedActions: Action[] = [
  { actionId: 'its-itbasics-01', categoryIds: ['h-itbasics', 'a-itbasics'],
    statement: 'ネットワークの基本用語を説明できる', sortOrder: 1, kind: 'knowledge' },
];

const sharedAll = { categories: sharedCats, actions: sharedActions, certs: [] };

const runShared = (route: Route, solo: string[] = []) => {
  const scoped = scopeToRoute(route, sharedAll);
  return stageProgress({
    stage: 1, categories: scoped.categories, actions: scoped.actions,
    actionChecks: {}, actionSoloChecks: Object.fromEntries(solo.map((k) => [k, true])),
    levelOfStage, levelOfAction,
  });
};

describe('分類をまたぐ共有', () => {
  it('どちらのルートにも出る', () => {
    expect(scopeToRoute(HELPDESK, sharedAll).actions.map((a) => a.actionId))
      .toEqual(['its-itbasics-01']);
    expect(scopeToRoute(ADMIN, sharedAll).actions.map((a) => a.actionId))
      .toEqual(['its-itbasics-01']);
  });

  it('どちらでも1件として数える — 二重計上しない', () => {
    expect(runShared(HELPDESK).knowledgeTotal).toBe(1);
    expect(runShared(ADMIN).knowledgeTotal).toBe(1);
  });

  it('片方でチェックすれば両方に付く — 保存キーが同じだから', () => {
    expect(runShared(HELPDESK, ['its-itbasics-01']).knowledgeDone).toBe(1);
    expect(runShared(ADMIN, ['its-itbasics-01']).knowledgeDone).toBe(1);
  });

  it('共有していない行は片方にしか出ない', () => {
    const mixed = {
      categories: sharedCats,
      actions: [
        ...sharedActions,
        { actionId: 'h-only-01', categoryIds: ['h-itbasics'],
          statement: 'ヘルプデスクだけの項目', sortOrder: 2, kind: 'knowledge' as ActionKind },
      ],
      certs: [],
    };
    expect(scopeToRoute(HELPDESK, mixed).actions).toHaveLength(2);
    expect(scopeToRoute(ADMIN, mixed).actions).toHaveLength(1);
  });
});
