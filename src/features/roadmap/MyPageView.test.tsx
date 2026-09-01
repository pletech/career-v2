/**
 * マイページ。**読む画面**なので、守るのは「正しく読めるか」。
 *
 * 集計そのものは domain/stageProgress.test.ts が持つ。ここで見るのは
 *   - 今どこにいるかを出せているか
 *   - 3つの条件が出ているか (実務70% / この段階の知識100% / 次の段階の知識100%)
 *   - 「残り」を押すと業務ロードマップへ送り出すか
 * の3点。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import MyPageView from './MyPageView';
import type { Action, Category, Cert, Role } from '../../domain/types';

afterEach(cleanup);

const roles: Role[] = [
  { roleId: 'r1', track: 'infrastructure', category: 'サーバー', stageOrder: 1,
    pathType: 'common', titleJa: '運用監視補助', shortLabel: '運用監視補助', summary: '', status: 'published' },
  { roleId: 'r2', track: 'infrastructure', category: 'サーバー', stageOrder: 2,
    pathType: 'specialist', titleJa: '運用監視', shortLabel: '運用監視',
    summary: '手順に沿って一次対応とエスカレーションを行う役割', status: 'published' },
];

const categories: Category[] = [
  { categoryId: 'c1', track: 'infrastructure', subtrack: 'サーバー', stage: 1, labelJa: '手順書・定型作業', includes: [], sortOrder: 1 },
  { categoryId: 'c1b', track: 'infrastructure', subtrack: 'サーバー', stage: 1, labelJa: '現場理解・体制', includes: [], sortOrder: 2 },
  { categoryId: 'c2', track: 'infrastructure', subtrack: 'サーバー', stage: 2, labelJa: '初動対応の実施', includes: ['c1', 'c1b'], sortOrder: 1 },
];

// STEP1: 実務3 (p1,p2,p3) / 知識2 (k1,k2)   STEP2: 実務2 / 知識1 (k3)
const actions: Action[] = [
  { actionId: 'p1', categoryIds: ['c1'], statement: '作業できる', sortOrder: 1, kind: 'practice' },
  { actionId: 'p2', categoryIds: ['c1'], statement: '記録できる', sortOrder: 2, kind: 'practice' },
  { actionId: 'k1', categoryIds: ['c1'], statement: '流れを説明できる', sortOrder: 3, kind: 'knowledge' },
  { actionId: 'p3', categoryIds: ['c1b'], statement: '朝会に出られる', sortOrder: 1, kind: 'practice' },
  { actionId: 'k2', categoryIds: ['c1b'], statement: '体制を説明できる', sortOrder: 2, kind: 'knowledge' },
  { actionId: 'p4', categoryIds: ['c2'], statement: '初動できる', sortOrder: 1, kind: 'practice' },
  { actionId: 'p5', categoryIds: ['c2'], statement: '記録を残せる', sortOrder: 2, kind: 'practice' },
  { actionId: 'k3', categoryIds: ['c2'], statement: '手順を説明できる', sortOrder: 3, kind: 'knowledge' },
];

const certs: Cert[] = [
  { certId: 'ce1', track: 'infrastructure', subtrack: 'サーバー', stage: 1, nameJa: 'ITパスポート試験', note: 'IT全般の基礎', sortOrder: 1 },
  { certId: 'ce2', track: 'infrastructure', subtrack: 'サーバー', stage: 1, nameJa: '基本情報技術者試験', sortOrder: 2 },
  { certId: 'ce9', track: 'infrastructure', subtrack: 'サーバー', stage: 2, nameJa: 'LPIC-1', sortOrder: 1 },
];

const setup = (assisted: string[] = [], solo: string[] = []) => {
  const onJump = vi.fn();
  render(
    <MyPageView
      routeLabel="インフラ / サーバー"
      roles={roles}
      categories={categories}
      actions={actions}
      certs={certs}
      actionChecks={Object.fromEntries(assisted.map((k) => [k, true]))}
      actionSoloChecks={Object.fromEntries(solo.map((k) => [k, true]))}
      onJump={onJump}
    />,
  );
  return { onJump };
};

/**
 * 最上部の帯 (「今なにを目標にすればよいか」)。
 * 帯と下の詳細で同じ文言が出るので、**必ずどちらかに絞ってから**探す。
 */
const banner = (): HTMLElement => {
  const el = document.querySelector('div.border-2');
  if (!el) throw new Error('帯が無い');
  return el as HTMLElement;
};

/** 帯の中の3行。畳んでいる行も含む */
const bannerSteps = () =>
  Array.from(banner().children).map((c) => (c as HTMLElement).textContent ?? '');

/** 下の詳細側のカード。帯の外から探す */
const block = (title: RegExp): HTMLElement => {
  const p = Array.from(document.querySelectorAll('p'))
    .filter((el) => !banner().contains(el))
    .find((el) => title.test(el.textContent ?? ''));
  if (!p) throw new Error(`「${title}」のブロックが無い`);
  return p.parentElement as HTMLElement;
};

describe('今どこにいるか', () => {
  it('何もしていなければ最下段が「今ここ」', () => {
    setup();
    expect(block(/今の段階/).textContent).toContain('今ここ');
    expect(bannerSteps()[0]).toContain('STEP1');
  });

  /**
   * 「今いる段階」は**実務のチェックがある いちばん上の段階**。
   * 目標を満たしただけでは繰り上がらない — 実務は案件に入らないと埋まらないので、
   * 案件が変わるまでは今の段階に留まるのが実態に合う。
   */
  it('目標を満たしても、次の段階の実務が無いうちは繰り上がらない', () => {
    setup(['p1', 'p2', 'p3'], ['k1', 'k2', 'k3']);
    expect(bannerSteps()[0]).toContain('STEP1');
  });

  it('次の段階の実務にチェックが入ると、そこへ移る', () => {
    setup(['p1'], ['p4']);   // STEP2 の実務を1件
    expect(bannerSteps()[0]).toContain('STEP2');
  });
});

describe('目標と条件', () => {
  it('目標は知識100% と 実務70% の両方', () => {
    setup();
    const s1 = bannerSteps()[0];
    expect(s1).toContain('知識 100%');
    expect(s1).toContain('実務 70%');
  });

  it('段階をまたいで足す — ロードマップのカードには出てこない数', () => {
    setup();
    // STEP1 の実務は c1 の2件 + c1b の1件
    expect(bannerSteps()[0]).toContain('0/3');
  });

  it('次の段階の項目が無ければ「準備中」と言う', () => {
    // STEP2 の実務を入れて現在地を STEP2 にする。その先 (STEP3) は無い
    setup(['p1', 'p2', 'p3'], ['k1', 'k2', 'k3', 'p4', 'p5']);
    expect(bannerSteps()[1]).toMatch(/準備中/);
  });

  /**
   * 帯と詳細で同じものを2度出さない (2026-08-07 지적)。
   * 帯 = 進捗 (数字とバー) / 詳細「次にやること」= 残りがどこにあるか (チップ)。
   */
  it('残りのチップは「次にやること」だけに出す', () => {
    setup();
    expect(within(banner()).queryAllByRole('button')).toHaveLength(0);
    expect(within(block(/次にやること/)).getAllByRole('button').length).toBeGreaterThan(0);
  });

  // 「勉強で埋まる / 案件が要る」は 知識・実務 の見出しが既に言っている。
  // 文章で足すと帯と同じことの繰り返しになるので置かない
  it('詳細に説明文を並べない — 残りの場所だけを出す', () => {
    setup();
    const el = block(/次にやること/);
    expect(el.textContent).not.toContain('自己学習や資格取得で埋められます');
    expect(el.textContent).not.toContain('受験費用の補助');
    expect(el.textContent).toContain('この段階の残りの知識');
  });
});

describe('残りの場所', () => {
  it('知識が残っているうちは知識の残りを出す', () => {
    setup(['p1']);
    const el = block(/次にやること/);
    expect(el.textContent).toContain('この段階の残りの知識');
    // 知識が残っている間は実務の残りを並べない (先にやることが2つになる)
    expect(el.textContent).not.toContain('この段階の残りの実務');
  });

  it('知識を埋め切ったら実務の残りを出す', () => {
    setup([], ['k1', 'k2']);
    expect(block(/次にやること/).textContent).toContain('この段階の残りの実務');
  });

  it('押すと業務ロードマップの該当カテゴリへ送り出す', () => {
    const { onJump } = setup();
    const chip = within(block(/次にやること/)).getByRole('button', { name: /手順書・定型作業 1/ });
    fireEvent.click(chip);
    expect(onJump).toHaveBeenCalledWith(1, 'c1');
  });

  it('次の段階の知識も、その段階を指して送り出す', () => {
    const { onJump } = setup();
    fireEvent.click(
      within(block(/次にやること/)).getByRole('button', { name: /初動対応の実施 1/ }),
    );
    expect(onJump).toHaveBeenCalledWith(2, 'c2');
  });
});

describe('これまでの積み上げ', () => {
  it('全段階を出す — 下の段階が消えたように見せない', () => {
    setup(['p1', 'p2', 'p3'], ['k1', 'k2']);
    const el = block(/これまでの積み上げ/);
    expect(el.textContent).toContain('STEP 1');
    expect(el.textContent).toContain('STEP 2');
    expect(el.textContent).toContain('知識 2/2');
  });
});

/**
 * 資格は**参考であって判定要件ではない**。
 *
 * **チェックは持たない** (2026-08-14)。2026-08-12 に入れて2日で戻した —
 * 資格には有効期限があり、☑ を持つと期限切れの資格に印が残るため。
 * ここで固定するのは「チェックボックスが黙って戻ってこないこと」。
 */
describe('推奨資格', () => {
  const panel = () => block(/この段階の推奨資格/);

  it('その段階の資格だけを出す', () => {
    setup();
    expect(panel().textContent).toContain('ITパスポート試験');
    expect(panel().textContent).toContain('基本情報技術者試験');
    expect(panel().textContent).not.toContain('LPIC-1');   // STEP2 の資格
  });

  it('チェックボックスを置かない — 期限切れに ☑ が残るのを防ぐため', () => {
    setup();
    expect(within(panel()).queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('取得期間・ランク・金額は出さない — 保守する数字を増やさない', () => {
    setup();
    expect(panel().textContent).not.toMatch(/ランク|円|時間/);
  });

  it('判定要件ではないと明記する', () => {
    setup();
    expect(panel().textContent).toContain('達成率や次の段階の条件には影響しません');
  });
});

/**
 * 最上部の帯 — 「今なにを目標にすればよいか」を **1つだけ** 出す (2026-08-07)。
 *
 * 3つの条件を同時に並べても、どれから手を付けるのか分からない。
 * 関門を3つに区切り、今いる段だけを開く。
 */
describe('目標の帯 (3段階)', () => {
  it('① 何もしていなければ「この段階の目標」を開き、知識と実務の両方を出す', () => {
    setup();
    const [s1, s2, s3] = bannerSteps();
    expect(s1).toContain('この段階の目標');
    expect(s1).toContain('知識 100%');
    expect(s1).toContain('実務 70%');
    // 先の段は畳んで見出しだけ
    expect(s2).toContain('次の段階に挑戦できます');
    expect(s2).not.toContain('次の目標');
    expect(s3).not.toContain('次にやること');
  });

  // 帯は状態・基準・進捗まで。残りの場所と「どう埋めるか」は下の詳細が持つ
  it('① 進捗はバーつきで帯が持ち、残りは下へ送る', () => {
    setup();
    const s1 = bannerSteps()[0];
    expect(s1).toContain('次にやること');   // 下への誘導
    expect(within(banner()).queryAllByRole('button')).toHaveLength(0);
  });

  it('② 目標を満たすと、次の目標が「次の段階の知識」に切り替わる', () => {
    setup(['p1', 'p2', 'p3'], ['k1', 'k2']);
    const [s1, s2, s3] = bannerSteps();
    expect(s2).toContain('次の目標');
    expect(s2).toContain('STEP2 の知識 100%');
    // 次の段階がどんな役割かを一行で出す (roles.csv の summary)
    expect(s2).toContain('一次対応');
    // 実務は案件に入らないと埋まらないことを言う
    expect(s1).not.toContain('知識 100%');   // ①は畳まれる
    expect(s3).not.toContain('次にやること');
  });

  it('③ 次の段階の知識まで満たすと「案件に挑戦できる」と、誰と何をするかを出す', () => {
    setup(['p1', 'p2', 'p3'], ['k1', 'k2', 'k3']);
    const s3 = bannerSteps()[2];
    expect(s3).toContain('STEP2 の案件に挑戦できます');
    expect(s3).toContain('上長に面談を申し込む');
    expect(s3).toContain('次に何を経験するか');
    expect(s3).toContain('判定ではありません');
  });

  it('次の段階の項目が無ければ、②で「準備中」と言い ③へ進めない', () => {
    // STEP2 が現在地になり、その先 (STEP3) は無い。
    // STEP2 の実務は 1人称 で数えるので solo 側に置く
    setup(['p1', 'p2', 'p3'], ['k1', 'k2', 'k3', 'p4', 'p5']);
    const [, s2, s3] = bannerSteps();
    expect(s2).toMatch(/準備中/);
    expect(s3).not.toContain('次にやること');
  });
});

/**
 * 残りが1件も無いのに見出しだけが残ると**壊れているように見える** (2026-08-07 지적)。
 * STEP3 を全部埋めた人は STEP4 が入るまでこの状態になる。
 */
describe('残りが尽きたとき', () => {
  it('「次にやること」を空にせず、次の段階が準備中だと言う', () => {
    // 全項目チェック → 現在地は最上段 (STEP2)、その先は無い
    setup(['p1', 'p2', 'p3'], ['k1', 'k2', 'k3', 'p4', 'p5']);
    const el = block(/次にやること/);
    expect(el.textContent).toContain('この段階は埋め切りました');
    expect(el.textContent).toMatch(/準備中/);
    expect(el.textContent).toContain('追加され次第');
  });

  it('残りがあるときは、その案内を出さない', () => {
    setup();
    expect(block(/次にやること/).textContent).not.toContain('埋め切りました');
  });
});

// ---------------------------------------------------------------------------
// 中身がまだ無い区分 (2026-08-14)
// ---------------------------------------------------------------------------
// 以前は「表示できる段階がありません。」の1行だけで、故障に見えた。
// また 0/0 は知識・実務ともに満たした扱いになるため、弾かないと空の段階が
// 「達成」「次の段階に挑戦できます」と言い出す。

const renderIts = (cats: Category[]) =>
  render(
    <MyPageView
      routeLabel="ITサポート / ヘルプデスク系"
      roles={[]}
      categories={cats}
      actions={[]}
      certs={[]}
      actionChecks={{}}
      actionSoloChecks={{}}
      onJump={vi.fn()}
    />,
  );

const itsCats: Category[] = [
  { categoryId: 'hd1-intake', track: 'it-support', subtrack: 'ヘルプデスク系', stage: 1, labelJa: '問い合わせの受付・整理', includes: [], sortOrder: 1 },
  { categoryId: 'hd2-assess', track: 'it-support', subtrack: 'ヘルプデスク系', stage: 2, labelJa: '二次対応の受付', includes: ['hd1-intake'], sortOrder: 1 },
];

describe('中身がまだ無い区分', () => {
  it('カテゴリが無ければ準備中の画面に落ちる', () => {
    renderIts([]);
    expect(screen.getByText(/この区分のチェックリストは準備中です/)).toBeTruthy();
  });

  it('どの区分の話か言う', () => {
    renderIts([]);
    expect(screen.getByText(/ITサポート \/ ヘルプデスク系 は段階と役割が決まっており/)).toBeTruthy();
  });

  it('どこを見れば役割が分かるか言う', () => {
    renderIts([]);
    expect(screen.getByText(/「全体マップ」で確認できます/)).toBeTruthy();
  });

  it('カテゴリはあってもアクションが0件なら準備中', () => {
    renderIts(itsCats);
    expect(screen.getByText(/この区分のチェックリストは準備中です/)).toBeTruthy();
  });

  it('「達成」も「挑戦できます」も「100%」も出さない', () => {
    renderIts(itsCats);
    expect(document.body.textContent).not.toMatch(/達成|挑戦できます|100%/);
  });

  it('帯は出さない — 目標が無いのに関門を見せない', () => {
    renderIts(itsCats);
    expect(document.querySelector('div.border-2')).toBeNull();
  });
});
