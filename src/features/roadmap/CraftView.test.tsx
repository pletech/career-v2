/**
 * 業務ロードマップのチェック水準の配線テスト。
 *
 * **このファイルが存在する理由** (v2.11 / 2026-07-31):
 * STEP2・3 の単一チェックボックスが `assisted` に書き込む一方、クリア判定は `solo` を
 * 読んでいたため、**押しても達成数が動かない**バグが本番まで行った。エラーも型エラーも
 * 出ず、当時のテスト (CSV ローダーと旧 evaluate ドメインのみ) は判定ロジックに一切
 * 触れていなかった。
 *
 * したがってここで守るのは「**書き込む水準 = その段階が数える水準**」(AC-12.31) と、
 * 引き継ぎを 1人称 で問い直すこと (AC-12.25) の2点。
 * 見た目や文言ではなく、**水準の対応**を検証する。
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
// 素の element.click() では React の状態更新が flush されず、
// アコーディオンが開かないまま次の assert に進む。必ず fireEvent を使う。
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import CraftView from './CraftView';
import type { Action, Category, Cert, Role } from '../../domain/types';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// 最小データ: STEP1 (目安が補助を許す) と STEP2 (1人称) の2段だけ
// ---------------------------------------------------------------------------

const roles: Role[] = [
  {
    roleId: 'r1',
    track: 'infrastructure',
    category: 'サーバー',
    stageOrder: 1,
    pathType: 'common',
    titleJa: '運用監視補助',
    shortLabel: '運用監視補助',
    summary: '',
    status: 'published',
  },
  {
    roleId: 'r2',
    track: 'infrastructure',
    category: 'サーバー',
    stageOrder: 2,
    pathType: 'specialist',
    titleJa: '運用監視',
    shortLabel: '運用監視',
    summary: '',
    status: 'published',
  },
];

const categories: Category[] = [
  { categoryId: 'c1', stage: 1, labelJa: '手順書・定型作業', includes: [], sortOrder: 1 },
  { categoryId: 'c2', stage: 2, labelJa: '初動対応の実施', includes: ['c1'], sortOrder: 1 },
];

const actions: Action[] = [
  { actionId: 'a1', categoryId: 'c1', statement: '手順書どおりに作業できる', sortOrder: 1 },
  { actionId: 'a2', categoryId: 'c1', statement: '作業証跡を残せる', sortOrder: 2 },
  { actionId: 'b1', categoryId: 'c2', statement: '初動対応を実施できる', sortOrder: 1 },
  { actionId: 'b2', categoryId: 'c2', statement: '対応期限を確認できる', sortOrder: 2 },
];

const certs: Cert[] = [];

const routes = [{ key: 'infrastructure/サーバー', track: 'infrastructure' as const, subtrack: 'サーバー' }];

const setup = (
  opts: {
    actionChecks?: Record<string, boolean>;
    actionSoloChecks?: Record<string, boolean>;
  } = {},
) => {
  const onToggleAction = vi.fn();
  render(
    <CraftView
      routes={routes}
      activeRouteKey={routes[0].key}
      onRouteChange={() => {}}
      roles={roles}
      categories={categories}
      actions={actions}
      certs={certs}
      actionChecks={opts.actionChecks ?? {}}
      actionSoloChecks={opts.actionSoloChecks ?? {}}
      onToggleAction={onToggleAction}
      lang="ja"
    />,
  );
  return { onToggleAction };
};

/** その段階のカードを開く (既定で開いているのは最下段だけ) */
const openStage = (stage: number) => {
  const header = screen
    .getAllByRole('button')
    .find((b) => b.textContent?.includes(`STEP ${stage}`) && b.textContent?.includes('チェックリストを開く'));
  if (!header) throw new Error(`STEP ${stage} の見出しが見つからない`);
  fireEvent.click(header);
};

/**
 * カテゴリカードを取る。**必ず段階で絞る** —
 * 上位段階のカードは引き継ぎ行に下位カテゴリ名を含むので、名前だけで探すと
 * STEP2 のカードが STEP1 のカードとして取れてしまう (最初に書いて踏んだ)。
 */
const cardOf = (stage: number, label: string): HTMLElement => {
  const section = Array.from(document.querySelectorAll('section')).find((el) =>
    Array.from(el.querySelectorAll('span')).some((s) => s.textContent?.trim() === `STEP ${stage}`),
  );
  if (!section) throw new Error(`STEP ${stage} のセクションが見つからない`);
  // カテゴリカードだけが border-2 (引き継ぎ行と段階セクションは border)
  const card = Array.from(section.querySelectorAll('div.border-2')).find((el) =>
    el.textContent?.includes(label),
  );
  if (!card) throw new Error(`STEP ${stage} に「${label}」のカードが無い`);
  return card as HTMLElement;
};

/** 上位カードの中の引き継ぎ行 (1行ロールアップ) */
const rollupRow = (label: string): HTMLElement => {
  const row = screen
    .getAllByRole('button')
    .find((b) => b.textContent?.includes(label) && b.textContent?.includes('STEP '));
  if (!row) throw new Error(`引き継ぎ行が見つからない: ${label}`);
  return row;
};

const boxFor = (statement: string, level: 'サポートあり' | '1人称') =>
  screen.getByRole('checkbox', { name: new RegExp(`${statement} — ${level}で対応できる`) });

// ---------------------------------------------------------------------------

describe('チェック水準の配線 (AC-12.31)', () => {
  it('目安が補助を許す段階 (STEP1) は サポートあり と 1人称 の2つを出す', () => {
    setup();
    expect(boxFor('手順書どおりに作業できる', 'サポートあり')).toBeTruthy();
    expect(boxFor('手順書どおりに作業できる', '1人称')).toBeTruthy();
  });

  it('目安が 1人称 の段階 (STEP2) は 1人称 の1つだけを出す', () => {
    setup();
    openStage(2);
    expect(boxFor('初動対応を実施できる', '1人称')).toBeTruthy();
    expect(
      screen.queryByRole('checkbox', { name: /初動対応を実施できる — サポートありで対応できる/ }),
    ).toBeNull();
  });

  it('STEP2 のチェックは solo として通知される (assisted に書くと数が動かなくなる)', () => {
    const { onToggleAction } = setup();
    openStage(2);
    fireEvent.click(boxFor('初動対応を実施できる', '1人称'));
    expect(onToggleAction).toHaveBeenCalledWith('b1', 'solo');
  });

  it('STEP1 の2つはそれぞれの水準で通知される', () => {
    const { onToggleAction } = setup();
    fireEvent.click(boxFor('手順書どおりに作業できる', 'サポートあり'));
    expect(onToggleAction).toHaveBeenCalledWith('a1', 'assisted');
    fireEvent.click(boxFor('手順書どおりに作業できる', '1人称'));
    expect(onToggleAction).toHaveBeenCalledWith('a1', 'solo');
  });
});

describe('達成数が水準に対応している (v2.11 の回帰テスト)', () => {
  it('STEP2 は solo のチェックを数える', () => {
    setup({ actionSoloChecks: { b1: true } });
    openStage(2);
    // 分母 = 固有2 + 引き継ぎ1 = 3
    expect(within(cardOf(2, '初動対応の実施')).getByText('1/3')).toBeTruthy();
  });

  it('STEP2 は assisted だけのチェックを数えない — これが動かなかったバグ', () => {
    setup({ actionChecks: { b1: true, b2: true } });
    openStage(2);
    expect(within(cardOf(2, '初動対応の実施')).getByText('0/3')).toBeTruthy();
  });

  it('STEP1 は assisted のチェックを数える', () => {
    setup({ actionChecks: { a1: true } });
    expect(within(cardOf(1, '手順書・定型作業')).getByText('1/2')).toBeTruthy();
  });
});

describe('引き継ぎは 1人称 で問い直す (AC-12.25 / 12.32)', () => {
  it('STEP1 で サポートあり だけ満たすと、STEP1 はクリアでも STEP2 の引き継ぎは 0 のまま', () => {
    setup({ actionChecks: { a1: true, a2: true } });
    // クリアしたカードの見出しは「2/2 クリア」(要素が分かれるので textContent で見る)
    expect(cardOf(1, '手順書・定型作業').textContent).toContain('2/2 クリア');

    openStage(2);
    expect(rollupRow('手順書・定型作業').textContent).toContain('0/2');
  });

  it('自分の段階でクリア済みの引き継ぎ行は、数ではなく 1人称で再確認 と言う', () => {
    setup({ actionChecks: { a1: true, a2: true } });
    openStage(2);
    const row = rollupRow('手順書・定型作業');
    expect(row.textContent).toContain('1人称で再確認');
    expect(row.textContent).not.toContain('クリアまであと');
  });

  it('1人称 まで満たせば引き継ぎもクリアになる', () => {
    setup({
      actionChecks: { a1: true, a2: true },
      actionSoloChecks: { a1: true, a2: true },
    });
    openStage(2);
    const row = rollupRow('手順書・定型作業');
    expect(row.textContent).toContain('2/2');
    expect(row.textContent).toContain('クリア');
    expect(row.textContent).not.toContain('1人称で再確認');
  });
});
