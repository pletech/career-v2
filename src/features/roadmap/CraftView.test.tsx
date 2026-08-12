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
  // 知識を含む STEP1 カテゴリ。c1 に混ぜると既存の件数アサーションが全部ずれるので別に置く
  { categoryId: 'c3', stage: 1, labelJa: '現場理解・体制', includes: [], sortOrder: 2 },
];

const actions: Action[] = [
  { actionId: 'a1', categoryId: 'c1', statement: '手順書どおりに作業できる', sortOrder: 1, kind: 'practice' },
  { actionId: 'a2', categoryId: 'c1', statement: '作業証跡を残せる', sortOrder: 2, kind: 'practice' },
  { actionId: 'b1', categoryId: 'c2', statement: '初動対応を実施できる', sortOrder: 1, kind: 'practice' },
  // 知識バッジと内訳の検証用に1件だけ knowledge を混ぜる
  { actionId: 'b2', categoryId: 'c2', statement: '対応手順の全体像を説明できる', sortOrder: 2, kind: 'knowledge' },
  // STEP1 (目安=assisted) の知識。知識は段階に関わらず 1人称だけで描くので、
  // 数える側も 1人称でないと押しても動かない
  { actionId: 'k1', categoryId: 'c3', statement: '体制図を説明できる', sortOrder: 1, kind: 'knowledge' },
  { actionId: 'k2', categoryId: 'c3', statement: '朝会に参加できる', sortOrder: 2, kind: 'practice' },
];

const certs: Cert[] = [];

const routes = [{ key: 'infrastructure/サーバー', track: 'infrastructure' as const, subtrack: 'サーバー' }];

const setup = (
  opts: {
    actionChecks?: Record<string, boolean>;
    actionSoloChecks?: Record<string, boolean>;
    onImport?: (file: File) => Promise<{ ok: boolean; message: string }>;
    focusRequest?: { stage: number; categoryId: string } | null;
  } = {},
) => {
  const onToggleAction = vi.fn();
  const onExport = vi.fn();
  const onImport = opts.onImport ?? vi.fn(async () => ({ ok: true, message: '読み込みました' }));
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
      onExport={onExport}
      onImport={onImport}
      focusRequest={opts.focusRequest ?? null}
      lang="ja"
    />,
  );
  return { onToggleAction, onExport, onImport };
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

/**
 * カードの見出し (件数バッジがある行)。
 *
 * 件数を `getByText('1/2')` でカード全体から探すと、**知識/実務の内訳行**にも
 * 同じ数字が出るため複数マッチで落ちる。見出しに絞ってから探す。
 */
const cardHeader = (stage: number, label: string): HTMLElement =>
  cardOf(stage, label).firstElementChild as HTMLElement;

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
    // 分母は **固有のみ**。引き継ぎは比率に入れず前提条件として効く (AC-12.39)
    expect(within(cardHeader(2, '初動対応の実施')).getByText('1/2')).toBeTruthy();
  });

  it('STEP2 は assisted だけのチェックを数えない — これが動かなかったバグ', () => {
    setup({ actionChecks: { b1: true, b2: true } });
    openStage(2);
    expect(within(cardHeader(2, '初動対応の実施')).getByText('0/2')).toBeTruthy();
  });

  it('STEP1 は assisted のチェックを数える', () => {
    setup({ actionChecks: { a1: true } });
    expect(within(cardHeader(1, '手順書・定型作業')).getByText('1/2')).toBeTruthy();
  });

  // 同じ「書き込む先と数える先のずれ」を知識で踏んだ (2026-08-06)。
  // 知識は段階の目安に関わらず 1人称の1つだけを描くのに、集計は段階の目安
  // (STEP1 = assisted) で数えていたため、押しても外しても 0/1 のまま動かなかった。
  it('STEP1 の知識は 1人称 の1つだけを出す', () => {
    setup();
    expect(boxFor('体制図を説明できる', '1人称')).toBeTruthy();
    expect(
      screen.queryByRole('checkbox', { name: /体制図を説明できる — サポートありで対応できる/ }),
    ).toBeNull();
    // 同じカードの実務は2つのまま
    expect(boxFor('朝会に参加できる', 'サポートあり')).toBeTruthy();
  });

  it('STEP1 の知識は solo のチェックを数える — 押しても数字が動かなかったバグ', () => {
    setup({ actionSoloChecks: { k1: true } });
    const card = cardOf(1, '現場理解・体制');
    expect(within(card).getByText('知識 1/1')).toBeTruthy();
    expect(within(cardHeader(1, '現場理解・体制')).getByText('1/2')).toBeTruthy();
  });

  it('STEP1 の知識は assisted のチェックを数えない (描いていない水準)', () => {
    setup({ actionChecks: { k1: true } });
    const card = cardOf(1, '現場理解・体制');
    expect(within(card).getByText('知識 0/1')).toBeTruthy();
    expect(within(cardHeader(1, '現場理解・体制')).getByText('0/2')).toBeTruthy();
  });

  it('STEP1 の実務は従来どおり assisted で数える (知識と混ざっていない)', () => {
    setup({ actionChecks: { k2: true } });
    const card = cardOf(1, '現場理解・体制');
    expect(within(card).getByText('実務 1/1')).toBeTruthy();
    expect(within(card).getByText('知識 0/1')).toBeTruthy();
  });
});

describe('知識100% / 実務70% (AC-12.37 — 2026-08-05)', () => {
  // c2 = 固有2件 (b1 実務 / b2 知識) + 引き継ぎ c1。
  // c1 を 1人称 まで満たして前提を外しておく。
  const c1Cleared = { a1: true, a2: true };

  it('実務が7割に達しても、知識が残っていればクリアにならない', () => {
    setup({
      actionChecks: c1Cleared,
      actionSoloChecks: { ...c1Cleared, b1: true }, // 実務 1/1 = 100%、知識 0/1
    });
    openStage(2);
    const header = cardHeader(2, '初動対応の実施');
    expect(header.textContent).not.toContain('クリア');
  });

  it('その状態では「あと何件」ではなく、知識が足りないと言う', () => {
    setup({
      actionChecks: c1Cleared,
      actionSoloChecks: { ...c1Cleared, b1: true },
    });
    openStage(2);
    // 数字だけ出すと「実務は満たしたのに何故?」= バグに見える (2026-08-05 指摘)
    expect(cardHeader(2, '初動対応の実施').textContent).toContain('知識をあと1件');
  });

  it('知識を100%にするとクリアになる', () => {
    setup({
      actionChecks: c1Cleared,
      actionSoloChecks: { ...c1Cleared, b1: true, b2: true },
    });
    openStage(2);
    expect(cardHeader(2, '初動対応の実施').textContent).toContain('クリア');
  });

  it('知識だけ満たしても、実務が7割に届かなければクリアにならない', () => {
    setup({
      actionChecks: c1Cleared,
      actionSoloChecks: { ...c1Cleared, b2: true }, // 知識 1/1、実務 0/1
    });
    openStage(2);
    const header = cardHeader(2, '初動対応の実施');
    // 「クリアまであと1」も 'クリア' を含むので、達成バッジは件数付きで見る
    expect(header.textContent).not.toMatch(/\d+\/\d+ クリア/);
    // 足りないのは実務なので、知識のメッセージは出さない
    expect(header.textContent).not.toContain('知識をあと');
  });

  // AC-12.40: 知識を埋め切った先で「あと1」とだけ出すと、何をすれば減るのか分からない。
  // 勉強では埋まらない分だけが残った状態なので、そう言い切る
  it('知識を埋め切って実務だけ残ったら、案件での経験が要ると言う', () => {
    setup({
      actionChecks: c1Cleared,
      actionSoloChecks: { ...c1Cleared, b2: true }, // 知識 1/1、実務 0/1
    });
    openStage(2);
    const header = cardHeader(2, '初動対応の実施');
    expect(header.textContent).toContain('実務をあと1件');
    expect(header.textContent).not.toContain('クリアまであと');
    expect(within(header).getByTitle(/案件で経験しないと埋まりません/)).toBeTruthy();
  });

  it('知識が残っている間は実務のメッセージを出さない (どちらか一方だけ)', () => {
    setup({
      actionChecks: c1Cleared,
      actionSoloChecks: { ...c1Cleared, b1: true }, // 実務 1/1、知識 0/1
    });
    openStage(2);
    const header = cardHeader(2, '初動対応の実施');
    expect(header.textContent).toContain('知識をあと1件');
    expect(header.textContent).not.toContain('実務をあと');
  });
});

/** カードの達成率バー (知識 / 実務 で1本ずつ) */
const bars = (card: HTMLElement) =>
  Array.from(card.querySelectorAll('span[title]'))
    .filter((el) => /^(知識|実務) \d+\/\d+$/.test(el.getAttribute('title') ?? ''))
    .map((el) => ({ title: el.getAttribute('title') ?? '', text: el.textContent ?? '' }));

/** カード内の 知識/実務 グループ見出し */
const groupHead = (card: HTMLElement, kind: '知識' | '実務') =>
  Array.from(card.querySelectorAll('p')).find((el) => el.textContent?.startsWith(`${kind} `));

describe('達成率バーは知識と実務で分ける (AC-12.38 — 2026-08-07)', () => {
  // 合格ラインが違う (知識100% / 実務70%) ものを1本にまとめると、
  // そのバーがどこまで行けばよいのかが読めなくなる
  it('持っている種別のぶんだけバーを出す', () => {
    setup({ actionChecks: { a1: true } });          // c1 は実務2件 (知識なし)、1件チェック
    const b1 = bars(cardOf(1, '手順書・定型作業'));
    expect(b1.map((x) => x.title)).toEqual(['実務 1/2']);
    expect(b1[0].text).toContain('50%');

    const b3 = bars(cardOf(1, '現場理解・体制'));    // 知識1件 / 実務1件 → 2本
    expect(b3.map((x) => x.title)).toEqual(['知識 0/1', '実務 0/1']);
  });

  it('見出しには合格ラインを書く — 知識100% / 実務70%', () => {
    setup();
    expect(groupHead(cardOf(1, '現場理解・体制'), '知識')?.textContent)
      .toContain('100%でクリア');
    expect(groupHead(cardOf(1, '手順書・定型作業'), '実務')?.textContent)
      .toContain('70%以上でクリア');
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

/**
 * チェックはこの端末の localStorage にしか無い (ログインもサーバー保存も意図的に無い)。
 * **退避手段がここにしか無い**ので、ロードマップの画面から出せることを固定する。
 */
describe('チェック状態の書き出し・読み込み (2026-08-07)', () => {
  it('書き出しボタンが onExport を呼ぶ', () => {
    const { onExport } = setup();
    fireEvent.click(screen.getByRole('button', { name: /書き出し/ }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('ファイルを選ぶと onImport に渡され、結果が画面に出る', async () => {
    const onImport = vi.fn(async () => ({ ok: true, message: 'チェック状態を読み込みました（1人称 3件）。' }));
    setup({ onImport });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'checks.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onImport).toHaveBeenCalledWith(file);
    expect((await screen.findByRole('status')).textContent).toContain('1人称 3件');
  });

  it('読み込みに失敗したら、そう言う (黙って握りつぶさない)', async () => {
    const onImport = vi.fn(async () => ({ ok: false, message: '対応していない形式のファイルです。' }));
    setup({ onImport });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'a.json', { type: 'application/json' })] },
    });
    expect((await screen.findByRole('status')).textContent).toContain('対応していない形式');
  });
});

/**
 * マイページからの「ここへ行け」を受け取る (2026-08-07)。
 * 段階サマリー自体はマイページへ移した (MyPageView.test.tsx)。
 * ここで守るのは**受け取り側の配線**だけ。
 */
describe('focusRequest を受けてカードへ寄せる', () => {
  it('指定された段階を開き、そのカードへスクロールする', async () => {
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    setup({ focusRequest: { stage: 2, categoryId: 'c2' } });

    const st2 = screen.getAllByRole('button')
      .find((b) => b.textContent?.includes('STEP 2') && b.textContent?.includes('閉じる'));
    expect(st2).toBeTruthy();
    await new Promise((r) => window.requestAnimationFrame(() => r(null)));
    expect(scrolled).toContain('cat-c2');
  });

  // 勝手に ON にしていたころ、自分で OFF にしても飛ぶたびに戻るので
  // 「解除できない」ように見えた
  it('「未チェックのみ表示」を勝手に切り替えない', () => {
    Element.prototype.scrollIntoView = function () {};
    setup({ focusRequest: { stage: 2, categoryId: 'c2' } });
    expect(
      (screen.getByRole('checkbox', { name: /未チェックのみ表示/ }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('指定が無ければ既定の段階のまま', () => {
    setup();
    const st1 = screen.getAllByRole('button')
      .find((b) => b.textContent?.includes('STEP 1') && b.textContent?.includes('閉じる'));
    expect(st1).toBeTruthy();
  });
});
