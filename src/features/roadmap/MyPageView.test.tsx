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
import { cleanup, fireEvent, render, within } from '@testing-library/react';

import MyPageView from './MyPageView';
import type { Action, Category, Cert, Role } from '../../domain/types';

afterEach(cleanup);

const roles: Role[] = [
  { roleId: 'r1', track: 'infrastructure', category: 'サーバー', stageOrder: 1,
    pathType: 'common', titleJa: '運用監視補助', shortLabel: '運用監視補助', summary: '', status: 'published' },
  { roleId: 'r2', track: 'infrastructure', category: 'サーバー', stageOrder: 2,
    pathType: 'specialist', titleJa: '運用監視', shortLabel: '運用監視', summary: '', status: 'published' },
];

const categories: Category[] = [
  { categoryId: 'c1', stage: 1, labelJa: '手順書・定型作業', includes: [], sortOrder: 1 },
  { categoryId: 'c1b', stage: 1, labelJa: '現場理解・体制', includes: [], sortOrder: 2 },
  { categoryId: 'c2', stage: 2, labelJa: '初動対応の実施', includes: ['c1', 'c1b'], sortOrder: 1 },
];

// STEP1: 実務3 (p1,p2,p3) / 知識2 (k1,k2)   STEP2: 実務2 / 知識1 (k3)
const actions: Action[] = [
  { actionId: 'p1', categoryId: 'c1', statement: '作業できる', sortOrder: 1, kind: 'practice' },
  { actionId: 'p2', categoryId: 'c1', statement: '記録できる', sortOrder: 2, kind: 'practice' },
  { actionId: 'k1', categoryId: 'c1', statement: '流れを説明できる', sortOrder: 3, kind: 'knowledge' },
  { actionId: 'p3', categoryId: 'c1b', statement: '朝会に出られる', sortOrder: 1, kind: 'practice' },
  { actionId: 'k2', categoryId: 'c1b', statement: '体制を説明できる', sortOrder: 2, kind: 'knowledge' },
  { actionId: 'p4', categoryId: 'c2', statement: '初動できる', sortOrder: 1, kind: 'practice' },
  { actionId: 'p5', categoryId: 'c2', statement: '記録を残せる', sortOrder: 2, kind: 'practice' },
  { actionId: 'k3', categoryId: 'c2', statement: '手順を説明できる', sortOrder: 3, kind: 'knowledge' },
];

const certs: Cert[] = [
  { certId: 'ce1', stage: 1, nameJa: 'ITパスポート試験', note: 'IT全般の基礎', sortOrder: 1 },
  { certId: 'ce2', stage: 1, nameJa: '基本情報技術者試験', sortOrder: 2 },
  { certId: 'ce9', stage: 2, nameJa: 'LPIC-1', sortOrder: 1 },
];

const setup = (assisted: string[] = [], solo: string[] = [], certsChecked: string[] = []) => {
  const onJump = vi.fn();
  const onToggleCert = vi.fn();
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
      certChecks={Object.fromEntries(certsChecked.map((k) => [k, true]))}
      onToggleCert={onToggleCert}
      lang="ja"
    />,
  );
  return { onJump, onToggleCert };
};

/** 「この段階の目標」「…へ挑戦できる条件」などのカード */
const block = (title: RegExp): HTMLElement => {
  const p = Array.from(document.querySelectorAll('p')).find((el) => title.test(el.textContent ?? ''));
  if (!p) throw new Error(`「${title}」のブロックが無い`);
  return p.parentElement as HTMLElement;
};

describe('今どこにいるか', () => {
  it('何もしていなければ最下段が「今ここ」', () => {
    setup();
    expect(block(/今の段階/).textContent).toContain('今ここ');
    expect(block(/この段階の目標/).textContent).toContain('STEP1');
  });

  it('条件を満たすと次の段階へ移る', () => {
    // STEP1 の実務3件 + 知識2件 + STEP2 の知識1件
    setup(['p1', 'p2', 'p3'], ['k1', 'k2', 'k3']);
    expect(block(/この段階の目標/).textContent).toContain('STEP2');
  });
});

describe('目標と条件', () => {
  it('目標は実務70%だけを出す', () => {
    setup();
    const el = block(/この段階の目標/);
    expect(el.textContent).toContain('実務経験 70%');
    // 知識100% は「次へ挑戦できる条件」側。目標に混ぜない
    expect(el.textContent).not.toContain('知識 100%');
  });

  it('挑戦できる条件は3つ出す', () => {
    setup();
    const el = block(/へ挑戦できる条件/);
    expect(el.textContent).toContain('この段階の実務 70%');
    expect(el.textContent).toContain('この段階の知識 100%');
    expect(el.textContent).toContain('STEP2 の知識 100%');
  });

  it('段階をまたいで足す — カードには出てこない数', () => {
    setup();
    // STEP1 の実務は c1 の2件 + c1b の1件
    expect(block(/この段階の目標/).textContent).toContain('0/3');
  });

  it('全部そろうと、面談で相談するよう促す', () => {
    setup(['p1', 'p2', 'p3'], ['k1', 'k2', 'k3']);
    // STEP2 が現在地になり、その先 (STEP3) は無いので「準備中」
    expect(block(/へ挑戦できる条件/).textContent).toMatch(/準備中/);
  });
});

describe('残りの場所', () => {
  it('実務と知識を分けて出す', () => {
    setup(['p1']);
    expect(block(/この段階の目標/).textContent).toContain('残りの実務');
    expect(block(/次にやること/).textContent).toContain('残りの知識');
  });

  it('押すと業務ロードマップの該当カテゴリへ送り出す', () => {
    const { onJump } = setup();
    const chip = within(block(/この段階の目標/)).getByRole('button', { name: /手順書・定型作業 2/ });
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

  it('知識が残っている間は「勉強で埋められる」と言う', () => {
    setup();
    expect(block(/次にやること/).textContent).toContain('自己学習や資格取得で埋められます');
  });

  it('知識を埋め切ったら「案件で経験しないと埋まらない」と言う', () => {
    setup([], ['k1', 'k2', 'k3']);
    expect(block(/次にやること/).textContent).toContain('案件で経験しないと埋まりません');
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
 * チェックできるが、達成率にも「次へ挑戦できる条件」にも影響してはいけない。
 */
describe('推奨資格', () => {
  it('その段階の資格だけを出す', () => {
    setup();
    const el = block(/この段階の推奨資格/);
    expect(el.textContent).toContain('ITパスポート試験');
    expect(el.textContent).toContain('基本情報技術者試験');
    expect(el.textContent).not.toContain('LPIC-1');   // STEP2 の資格
  });

  it('チェックできる', () => {
    const { onToggleCert } = setup();
    fireEvent.click(within(block(/この段階の推奨資格/)).getByRole('checkbox', { name: /ITパスポート/ }));
    expect(onToggleCert).toHaveBeenCalledWith('ce1');
  });

  it('判定要件ではないと明記する', () => {
    setup();
    expect(block(/この段階の推奨資格/).textContent)
      .toContain('チェックしても達成率や次の段階の条件には影響しません');
  });

  it('資格をチェックしても達成率は動かない', () => {
    setup([], [], ['ce1', 'ce2']);
    // STEP1 の実務は 0/3 のまま
    expect(block(/この段階の目標/).textContent).toContain('0/3');
    expect(block(/へ挑戦できる条件/).textContent).toContain('0/2');   // 知識 0/2
  });
});
