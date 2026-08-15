import React, { useMemo, useState } from 'react';
import { STRINGS, loc, type Lang } from '../../domain/i18n';
import type {
  Action,
  ActionCheckMap,
  ActionKind,
  Category,
  Cert,
  CheckLevel,
  Role,
  TrackId,
} from '../../domain/types';
import { TRACK_LABELS } from '../../types/career';
import MoveNotice from './MoveNotice';
import { currentStageOf, stageProgress } from '../../domain/stageProgress';

/**
 * 業務ロードマップ v2.7d — 段階別カテゴリ + 包含モデル (アサリさん面談 2026-07-14)
 *
 * - 段階を開くと、その段階「固有」のカテゴリ群が出る (段階ごとに別集合)。
 * - 上位段階のカテゴリは、下位段階のカテゴリを丸ごと包含 (includes) し、
 *   さらにその段階固有のアクション (できると言える項目) を持つ。
 * - 包含された下位カテゴリは 1行に畳んで (ロールアップ) 表示し、
 *   「何個中何個」を示す。達成率が閾値 (70%) 以上なら「クリア」、未満なら不足が一目で分かる。
 * - チェックの単位はアクション。カテゴリの達成率 = (達成した下位カテゴリ数 + チェック済みアクション数) / 総項目数。
 * - 一度に開く段階は1つ (アコーディオン)。既定は最下段 (STEP1)。
 */

const CLEAR = 0.7; // クリア閾値 (7割)

/**
 * 上位段階が下位カテゴリを引き継ぐときに求めるチェック水準 (v2.9)。
 *
 * 下位段階の目安は「補助・確認してくれる人がいればできる」止まりなので、
 * 下位のクリアは「ひとりでできる」を意味しない。上位が引き継ぐときは 1 人称で問い直す。
 * v2.8 では包含関係ごとに確認用アクションを 18 件置いていたが、
 * **項目ごとに 2 段のチェックを持たせる方式に置き換えた** (大場さん提案 2026-07-30)。
 * 項目単位で「どこまで 1 人称でできるか」が見え、行も増えない。
 */
const INHERITED_LEVEL: CheckLevel = 'solo';

/**
 * その項目を **どの水準で描き、どの水準で数えるか**。
 *
 * 知識は「サポートありで説明できる」に意味が無いので、段階の目安に関わらず 1人称だけを
 * 出す (2026-08-05 指摘)。**数える側もこれに従わせる**のがこの関数の役目。
 *
 * ⚠️ 描画と集計でここが分かれると「押しても数字が動かない」になる。同じ取り違えを
 * 2 回踏んだ (STEP2・3 の実務 / STEP1 の知識) ので、水準の決定はこの 1 箇所に集約する。
 * `stat()` と `actionRow()` の両方から必ず呼ぶこと。
 */
export const levelOfAction = (kind: Action['kind'], stageLevel: CheckLevel): CheckLevel =>
  kind === 'knowledge' ? 'solo' : stageLevel;

/**
 * 段階ごとの「どの水準でチェックするか」の目安 (v2.9 — 2水準化に合わせて改訂)。
 *
 * 未経験者が大半のため、全項目を 1人称で求めるとチェックが長期間つかず目安として機能しない
 * という指摘 (2026-07-29) への対応で、最下段は「サポートあり」でも付けてよいことにした。
 * v2.9 でチェックを 2水準に分けたので、**文言も「サポートあり」「1人称」に統一する**
 * (`補助` `ひとりで` と混在させると、凡例やチェックボックスの表示と別の言葉になる)。
 *
 * `allowsAssist` が付いた段階だけ「サポートあり／1人称」の2つを表示し、
 * 自分のクリア判定は「サポートあり」で行う。**上位段階は常に 1人称 で問い直す**ので、
 * ここで 1人称 を記録しておく意味がある — その理由を目安の中で伝える。
 *
 * ※ どの段階を2水準にするかは `allowsAssist` だけで決まる。文言もここだけ直せばよい。
 */
const STAGE_AUTONOMY: Record<number, { ja: string; ko: string; allowsAssist?: true }> = {
  1: {
    allowsAssist: true,
    ja: 'この段階は「サポートあり」でできればチェックして構いません。あわせて「1人称」でできるかも記録します（上の段階はこちらを見ます）。',
    ko: '이 단계는 "지원 있음"으로 가능하면 체크해도 괜찮습니다. 함께 "1인칭"으로 가능한지도 기록합니다(상위 단계는 이쪽을 봅니다).',
  },
  2: {
    ja: 'この段階のチェックは「1人称」（手順書があれば、ひとりで対応できる）が目安です。',
    ko: '이 단계의 체크는 "1인칭"(절차서가 있으면 혼자 대응 가능)이 기준입니다.',
  },
  3: {
    ja: 'この段階は「1人称」に加え、「改善や対策を提案できる」ことが目安です。',
    ko: '이 단계는 "1인칭"에 더해 "개선·대책을 제안할 수 있음"이 기준입니다.',
  },
};

/** 業務ロードマップの対象範囲。区分 (track) × 分類 (subtrack) の組 */
/** その段階が自分のクリアを判定する水準。目安が補助を許す段階だけ assisted */
export const levelOfStage = (stage: number): CheckLevel =>
  STAGE_AUTONOMY[stage]?.allowsAssist ? 'assisted' : 'solo';

export interface RoadmapRoute {
  key: string;
  track: TrackId;
  subtrack: string;
}

interface CraftViewProps {
  /** 選択できるルート。**データから導かれる** (UI にハードコードしない) */
  routes: RoadmapRoute[];
  activeRouteKey: string | null;
  onRouteChange: (key: string) => void;
  roles: Role[];
  categories: Category[];
  actions: Action[];
  certs: Cert[];
  /** 「補助・確認してくれる人がいればできる」水準 */
  actionChecks: ActionCheckMap;
  /** 「ひとりでできる」水準 (v2.9) */
  actionSoloChecks: ActionCheckMap;
  onToggleAction: (actionId: string, level: CheckLevel) => void;
  /** チェック状態をファイルに書き出す。サーバー保存が無いので**これが唯一の退避手段** */
  onExport: () => void;
  /** 書き出したファイルを読み戻す。成否メッセージを返す */
  onImport: (file: File) => Promise<{ ok: boolean; message: string }>;
  /** 引っ越し告知の帯を出すか (まだ書き出していない / 書き出し後に増えている) */
  needsExport: boolean;
  /** マイページから「ここへ行け」と指定されたカテゴリ。処理したら onFocusHandled を呼ぶ */
  focusRequest?: { stage: number; categoryId: string } | null;
  onFocusHandled?: () => void;
  lang: Lang;
}

interface CatStat {
  /** 固有アクションのチェック数 (引き継ぎは含めない) */
  done: number;
  /** 固有アクション数 (引き継ぎは含めない) */
  total: number;
  knowledgeDone: number;
  knowledgeTotal: number;
  practiceDone: number;
  practiceTotal: number;
  /** クリアまでに足りない件数 = 知識の残り + 実務が7割に届くまでの残り */
  need: number;
  cleared: boolean;
  /** 知識・実務は満たしたが、包含した下位カテゴリが未クリアで待たされている状態 */
  blockedByChild: boolean;
  /** 実務は7割に達したが、知識が100%に届いていない状態 */
  blockedByKnowledge: boolean;
  /** 知識は埋め切ったが実務が7割に届いていない = **勉強では埋まらない分だけが残った** */
  blockedByPractice: boolean;
}

const CraftView: React.FC<CraftViewProps> = ({
  routes,
  activeRouteKey,
  onRouteChange,
  roles,
  categories,
  actions,
  certs,
  actionChecks,
  actionSoloChecks,
  onToggleAction,
  onExport,
  onImport,
  needsExport,
  focusRequest,
  onFocusHandled,
  lang,
}) => {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [ioMessage, setIoMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const s = STRINGS[lang];
  const ko = lang === 'ko';

  /** ロールアップ (包含カテゴリ) のその場展開状態。キーは "親>子" (同じ子が複数の親に出るため) */
  const [expandedRollups, setExpandedRollups] = useState<Set<string>>(() => new Set());
  const toggleRollup = (key: string) =>
    setExpandedRollups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /** 2回目以降の面談用: チェック済みを隠して残りだけ見る (アサリさん FB) */
  const [onlyUnchecked, setOnlyUnchecked] = useState(false);
  /**
   * 画面上部の説明 (凡例・BETA 帯) を開いているか。**狭い幅のときだけ意味を持つ。**
   * 既定は畳む。md 以上では state に関係なく常に表示する (CSS 側で `hidden md:block`)。
   * `window.innerWidth` で初期値を決めていない — リサイズで嘘になるため。
   */
  const [introOpen, setIntroOpen] = useState(false);

  const catById = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of categories) m.set(c.categoryId, c);
    return m;
  }, [categories]);

  const actionsByCat = useMemo(() => {
    const m = new Map<string, Action[]>();
    for (const a of actions) {
      const list = m.get(a.categoryId);
      if (list) list.push(a);
      else m.set(a.categoryId, [a]);
    }
    for (const list of m.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return m;
  }, [actions]);

  const directActions = (catId: string): Action[] => actionsByCat.get(catId) ?? [];

  /**
   * カテゴリ達成統計 (再帰: 包含した下位カテゴリは「達成なら1」として数える)。
   *
   * 「クリア」は達成率 (CLEAR) 以上であることに加え、包含した下位カテゴリが
   * 全て個別にクリア済みであることを必須とする。下位が未クリアのまま、
   * この段階固有の新規項目だけを埋めて比率上クリアに達してしまうのを防ぐ
   * (アサリさん概念: 「この業務ができて初めて上の業務に進める」 — 下位を飛ばして
   * 上位だけクリアと表示することはない、2026-07-15 指摘)。
   */
  const marksOf = (level: CheckLevel): ActionCheckMap =>
    level === 'solo' ? actionSoloChecks : actionChecks;

  const stat = (catId: string, level: CheckLevel): CatStat => {
    const cat = catById.get(catId);
    if (!cat) {
      return {
        done: 0,
        total: 0,
        knowledgeDone: 0,
        knowledgeTotal: 0,
        practiceDone: 0,
        practiceTotal: 0,
        need: 0,
        cleared: false,
        blockedByChild: false,
        blockedByKnowledge: false,
        blockedByPractice: false,
      };
    }
    const own = directActions(catId);
    // 水準は項目ごとに決まる。段階の目安をそのまま全項目に当てると、
    // 1人称だけで描いている知識を assisted 側で数えてしまう
    const isDone = (a: Action) =>
      marksOf(levelOfAction(a.kind, level))[a.actionId] === true;

    const knowledge = own.filter((a) => a.kind === 'knowledge');
    const practice = own.filter((a) => a.kind === 'practice');
    const knowledgeDone = knowledge.filter(isDone).length;
    const practiceDone = practice.filter(isDone).length;

    // 引き継いだ下位カテゴリは、その段階の目安ではなく **1人称** で問い直す
    const childStats = cat.includes.map((id) => stat(id, INHERITED_LEVEL));
    const allChildrenCleared = childStats.every((s) => s.cleared);

    // 知識は 100%、実務は 7割。**引き継ぎは比率に入れず前提条件としてのみ効く**
    // (分母・分子の両方に入れると、引き継ぎが多いほど自分の項目が楽になる — §0-E.1m)
    const knowledgeMet = knowledgeDone === knowledge.length;
    const practiceMet = practice.length === 0 || practiceDone / practice.length >= CLEAR;
    const hasContent = own.length > 0 || cat.includes.length > 0;

    const needKnowledge = knowledge.length - knowledgeDone;
    const needPractice = Math.max(0, Math.ceil(practice.length * CLEAR) - practiceDone);

    return {
      done: knowledgeDone + practiceDone,
      total: own.length,
      knowledgeDone,
      knowledgeTotal: knowledge.length,
      practiceDone,
      practiceTotal: practice.length,
      need: needKnowledge + needPractice,
      cleared: hasContent && knowledgeMet && practiceMet && allChildrenCleared,
      blockedByChild: hasContent && knowledgeMet && practiceMet && !allChildrenCleared,
      // 実務は足りているのに知識が残っている状態。ここを黙って「未クリア」にすると
      // 「数は満たしたのに何故?」となり **バグに見える** (2026-08-05 指摘)
      blockedByKnowledge: hasContent && practiceMet && !knowledgeMet,
      // 知識は埋め切ったが実務が届かない = 関口さん FB の着地点。
      // ここで「あと N」とだけ出すと、**何をすれば N が減るのか**が分からない (AC-12.40)
      blockedByPractice: hasContent && knowledgeMet && !practiceMet,
    };
  };

  /**
   * 描く段階 (降順)。**アクションが1件も無い段階は外す** (2026-08-14)。
   *
   * カテゴリを先に入れてアクションを後から書くのが普通の作業順なので、
   * 途中の状態では「カテゴリはあるがアクションが0件」の段階ができる。
   * そのまま描くと 0/0 のカードが並び、**達成率100%・クリア扱い**で出てしまう
   * (`knowledgeMet` は 0===0 で真、`practiceMet` も総数0で真)。
   *
   * ここで外すと、`coveredMin/Max` も自動で追従して「収録範囲」と
   * 「STEP◯〜◯ は準備中」が正しく出る (どちらも stagesDesc から導いている)。
   */
  const stagesDesc = useMemo(() => {
    const withActions = new Set(actions.map((a) => a.categoryId));
    const stages = categories
      .filter((c) => withActions.has(c.categoryId))
      .map((c) => c.stage);
    return [...new Set(stages)].sort((a, b) => b - a);
  }, [categories, actions]);
  /** 最下段 (基礎)。この段より上のカテゴリの固有原子は「この段階で追加」= NEW 扱い */
  const minStage = useMemo(
    () => (categories.length > 0 ? Math.min(...categories.map((c) => c.stage)) : 1),
    [categories],
  );

  // -------------------------------------------------------------------------
  // このページが「何の」ロードマップかを示すための値。
  //
  // 「開いても、インフラなのか開発なのか、インフラのどの段階までなのか分からない」
  // という想定 (2026-07-31) への対応。**すべてデータから導く** —
  // 文章に手書きすると区分が増えた瞬間に嘘になる (BETA 帯の
  // 「インフラ > サーバー の STEP1〜3」が実際に手書きだった)。
  // -------------------------------------------------------------------------
  const activeRoute = routes.find((r) => r.key === activeRouteKey) ?? routes[0] ?? null;
  /** チェック項目がある段階の範囲 */
  const coveredMin = stagesDesc.length > 0 ? stagesDesc[stagesDesc.length - 1] : null;
  const coveredMax = stagesDesc.length > 0 ? stagesDesc[0] : null;
  /** 役割としては存在する段階の上限。roles.csv は STEP6 まで持つので「どこまで伸びるか」が出る */
  const ladderMax = roles.length > 0 ? Math.max(...roles.map((r) => r.stageOrder)) : coveredMax;

  /**
   * 既定で開く段階は **「今いる段階」** (2026-08-07 사용자 지시)。
   *
   * 最下段を固定で開いていたので、STEP1 をクリアして STEP2 を進めている人でも
   * 毎回 STEP1 が開き、自分の段階まで手で開き直すことになっていた。
   *
   * 判定はマイページと**同じ関数**を使う (`currentStageOf`) — 別に導くと
   * 「マイページは STEP2 と言うのにロードマップは STEP1 が開く」がすぐ起きる。
   */
  const [openStage, setOpenStage] = useState<number | null>(() => {
    const stages = [...new Set(categories.map((c) => c.stage))];
    if (stages.length === 0) return 1;
    return currentStageOf(stages, (stage) =>
      stageProgress({
        stage, categories, actions, actionChecks, actionSoloChecks, levelOfStage, levelOfAction,
      }),
    );
  });

  const catsOfStage = (stage: number): Category[] =>
    categories.filter((c) => c.stage === stage).sort((a, b) => a.sortOrder - b.sortOrder);

  const certsOfStage = (stage: number): Cert[] =>
    certs.filter((c) => c.stage === stage).sort((a, b) => a.sortOrder - b.sortOrder);

  /**
   * ⚠️ 段階に対する役割は **先に見つかった1件が勝つ**。
   *
   * 現在の `roles` は呼び出し側で track/subtrack まで絞られているが、`pathType`
   * (specialist / management) では絞られていない。同じサブトラック内に
   * `infra-server-sp-5` と `infra-server-mg-5` が並んだ瞬間、CSV の行順が早い方だけが
   * ヘッダーに出て、もう一方のレーンは**エラーも出さずに消える**。
   *
   * マネジメントレーンの役割を roles.csv に入れる前に、ルートキーを
   * track/subtrack/**pathType** の3軸に広げること (HANDOFF §4b)。
   */
  const roleOfStage = (stage: number): Role | undefined =>
    roles.find((r) => r.stageOrder === stage && r.status !== 'hidden');

  const toggle = (stage: number) => setOpenStage((cur) => (cur === stage ? null : stage));

  /**
   * 段階サマリーの「残り」から、その項目があるカテゴリまで**連れていく**。
   *
   * これが無いと「STEP3 の知識があと12件」と出しても、利用者が
   * 段階を開き直し → カテゴリを探し、を手でやることになる。
   *
   * ⚠️ **「未チェックのみ表示」には触らない。** 一度これを勝手に ON にしていたが、
   * 利用者が自分で OFF にした直後でも押すたびに戻るため、
   * 「解除できない」ように見えた (2026-08-07 指摘)。明示的な操作を上書きしない。
   */
  const [focusCat, setFocusCat] = useState<string | null>(null);

  // マイページから来た指定を受けて、その段階を開いてカードへ寄せる
  React.useEffect(() => {
    if (!focusRequest) return;
    setOpenStage(focusRequest.stage);
    setFocusCat(focusRequest.categoryId);
    onFocusHandled?.();
  }, [focusRequest, onFocusHandled]);
  React.useEffect(() => {
    if (!focusCat) return;
    // 段階を開いた直後の描画を待ってから位置を取る
    const id = window.requestAnimationFrame(() => {
      // **動いて見える**ことが手掛かりになるので smooth。
      // 静かに位置が変わるだけだと、どこへ来たのか分からない
      document.getElementById(`cat-${focusCat}`)?.scrollIntoView({
        block: 'start', behavior: 'smooth',
      });
    });
    // 着地点が分からないと「押したのに何も起きていない」に見えるので明滅させる
    // (アニメーションは 1.1s × 2回。終わってから縁を戻す)
    const clear = window.setTimeout(() => setFocusCat(null), 2400);
    return () => {
      window.cancelAnimationFrame(id);
      window.clearTimeout(clear);
    };
  }, [focusCat]);

  // ---------------------------------------------------------------------
  // 達成バッジ
  // ---------------------------------------------------------------------
  /**
   * @param pendingNote 未クリアのとき「あと何個」ではなく **何をすればよいか**を出す。
   *   数だけでは足りない場面 (下の段階でクリア済みなのに引き継ぎ先で 0 に見える等) に使う。
   */
  /**
   * 達成率バーを1本描く。**知識と実務でバーを分ける** (2026-08-07 사용자 제안)。
   *
   * 合格ラインが違う (知識 100% / 実務 70%) ので、1本にまとめると
   * 「このバーはどこまで行けば良いのか」が読めない。バーごとに基準線を持たせる。
   *
   * @param target 満たすべき割合。1 (=100%) のときは基準線を引かない — バーの端が基準だから
   */
  const progressBar = (
    label: string, done: number, total: number, target: number, cleared: boolean,
  ) => {
    const pct = total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100));
    const met = done >= Math.ceil(total * target);
    return (
      <span className="flex items-center gap-1" title={`${label} ${done}/${total}`}>
        <span className="w-5 shrink-0 text-[8px] font-bold leading-none text-gray-500">
          {label}
        </span>
        <span className="relative hidden h-1.5 flex-1 bg-gray-100 md:block">
          <span
            className={`block h-full transition-all ${
              cleared || met ? 'bg-emerald-500' : label === '知識' || label === '지식'
                ? 'bg-indigo-400' : 'bg-cyan-400'
            }`}
            style={{ width: `${pct}%` }}
          />
          {target < 1 && (
            <span
              className="absolute top-0 h-full w-px bg-gray-400/80"
              style={{ left: `${target * 100}%` }}
            />
          )}
        </span>
        <span className="w-7 shrink-0 text-right text-[8px] leading-none text-gray-400 md:w-7">
          {pct}%
        </span>
        {/* バーを畳んだぶん、狭い画面では % を右端へ寄せる */}
        <span className="flex-1 md:hidden" />
      </span>
    );
  };

  const statusBadge = (st: CatStat, size: 'sm' | 'md' = 'md', pendingNote?: string) => {
    const need = st.need;
    const pad = size === 'md' ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[10px]';
    return (
      <span className="flex items-center gap-1">
        <span className={`rounded font-bold ${pad} ${st.cleared ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
          {st.done}/{st.total}
        </span>
        {st.cleared ? (
          <span className={`rounded bg-emerald-500 font-bold text-white shadow-sm ${pad}`}>
            {ko ? '✓ 클리어' : '✓ クリア'}
          </span>
        ) : pendingNote ? (
          <span className={`rounded bg-amber-100 font-bold text-amber-700 ${pad}`}>
            {pendingNote}
          </span>
        ) : st.blockedByChild ? (
          // 何が足りないかを言う。「下位カテゴリ未クリア」では次の行動が分からない
          <span className={`rounded bg-amber-100 font-bold text-amber-700 ${pad}`}>
            下の段階を1人称で
          </span>
        ) : st.blockedByKnowledge ? (
          // 実務は足りているのにクリアにならない状態。理由を言わないとバグに見える
          <span className={`rounded bg-indigo-100 font-bold text-indigo-700 ${pad}`}>
            {ko ? `지식 앞으로 ${st.knowledgeTotal - st.knowledgeDone}` : `知識をあと${st.knowledgeTotal - st.knowledgeDone}件`}
          </span>
        ) : st.blockedByPractice ? (
          // 知識は埋め切った = **勉強では埋まらない分だけが残っている**。
          // 「案件での経験が要る」と言い切るのがこの機能の目的 (関口さん 2026-08-05)。
          // バッジは短く、理由は title に置く (長い文字列を狭い行に入れると名前が切れる)
          <span
            className={`rounded bg-amber-100 font-bold text-amber-700 ${pad}`}
            title={ko
              ? '지식은 다 채웠습니다. 남은 것은 안건에서 경험해야 채워집니다'
              : '知識は埋め切りました。残りは案件で経験しないと埋まりません'}
          >
            {ko
              ? `실무 앞으로 ${Math.max(0, Math.ceil(st.practiceTotal * CLEAR) - st.practiceDone)}`
              : `実務をあと${Math.max(0, Math.ceil(st.practiceTotal * CLEAR) - st.practiceDone)}件`}
          </span>
        ) : (
          <span className={`rounded bg-amber-100 font-bold text-amber-700 ${pad}`}>
            {ko ? `클리어까지 앞으로 ${need}` : `クリアまであと${need}`}
          </span>
        )}
      </span>
    );
  };

  // ---------------------------------------------------------------------
  // アクション1行 (チェックボックス)。「未チェックのみ」フィルタ対応
  // ---------------------------------------------------------------------
  /**
   * アクション1行。`level` は **その段階がクリア判定に使う水準** (`levelOfStage`)。
   *
   * 目安が補助を許す段階では **サポートあり / 1人称 の2つ**を出す。上位段階は引き継いだ
   * 項目を 1人称 で問い直すため、その水準をここで直接付ける
   * (大場さん提案 2026-07-30 — 上位に確認用の項目を別に置くより、項目ごとに見える)。
   *
   * ここを取り違えると **チェックしても達成数が動かない**。
   * 以前は1つ目のチェックボックスを常に `assisted` で描いていたため、
   * 目安が 1人称 の段階 (STEP2・3) では
   * 「書き込む先 = assisted / 数える先 = solo」でずれ、
   * 押しても `0/8` のままだった。水準は必ず呼び出し側から受け取る。
   */
  const actionRow = (a: Action, opts: { isNew?: boolean; level: CheckLevel }) => {
    const assisted = actionChecks[a.actionId] === true;
    const solo = actionSoloChecks[a.actionId] === true;
    /**
     * 2つ出すのは「目安が補助を許す段階」の **実務** だけ。
     *
     * 知識は「サポートありで説明できる」に意味が無い (説明できるか否かしかない) ので、
     * 段階に関わらず 1人称 の1つだけにする (2026-08-05 指摘)。
     */
    const twoLevel = levelOfAction(a.kind, opts.level) === 'assisted';
    // 「未チェックのみ」: その行で出している水準が全部埋まっていれば隠す
    if (onlyUnchecked && (twoLevel ? assisted && solo : solo)) return null;

    const tone = opts.isNew
      ? 'border-amber-200 bg-amber-50/60'
      : 'border-gray-100 bg-white';
    const box = (level: CheckLevel, checked: boolean, label: string) => (
      <label
        className="flex cursor-pointer items-center gap-1"
        title={label}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleAction(a.actionId, level)}
          className={`h-4 w-4 shrink-0 ${level === 'solo' ? 'accent-violet-600' : 'accent-cyan-600'}`}
          aria-label={`${loc(lang, a.statement, a.statementKo)} — ${label}`}
        />
      </label>
    );

    return (
      <div
        key={a.actionId}
        className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 ${tone}`}
      >
        <span className="mt-0.5 flex shrink-0 items-center gap-2">
          {twoLevel &&
            box('assisted', assisted, ko ? '지원 있음으로 대응 가능' : 'サポートありで対応できる')}
          {box('solo', solo, ko ? '1인칭으로 대응 가능' : '1人称で対応できる')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] leading-snug text-gray-800">
            {loc(lang, a.statement, a.statementKo)}
          </span>
          {opts.isNew && (
            <span className="mt-0.5 inline-block rounded bg-amber-100 px-1 py-px text-[9px] font-bold text-amber-700">
              NEW
            </span>
          )}
          {/*
            知識/実務 のバッジはここに置かない。上下2グループに分けて見出しで示している
            (actionGroups)。行ごとのバッジだと少数側にしか付かず、
            「付いていない行=実務」という規約を覚えてもらう必要があった。
          */}
        </span>
      </div>
    );
  };

  /**
   * 2段チェックの凡例 (カテゴリごとに一度)。
   *
   * 段階の「チェックの目安」帯にもまとめてあるが、**帯は読まれない**という指摘があり
   * (2026-08-05)、チェックボックスのすぐ上にも残す。ここは色と左右の対応だけで、
   * 説明文は帯に置いてある。
   */
  const levelHeader = () => (
    <p className="px-0.5 pt-0.5 text-[9px] leading-relaxed text-gray-400">
      {ko ? '왼쪽 ' : '左 '}
      <span className="font-bold text-cyan-700">{ko ? '지원 있음' : 'サポートあり'}</span>
      {' ／ '}
      {ko ? '오른쪽 ' : '右 '}
      <span className="font-bold text-violet-700">{ko ? '1인칭' : '1人称'}</span>
      {ko ? ' — 각각 대응 가능한지를 기록합니다' : ' — それぞれ対応できるかを記録します'}
    </p>
  );

  /**
   * アクションを **知識 → 実務 の順に2グループへ分けて**描く。
   *
   * 項目ごとにバッジを付ける方式をやめた理由: 実務が 229 件中 187 件あり、
   * バッジは少数側にしか付かないので「どちらでもない行」が実務という**規約を覚える**
   * 必要があった。上下に分ければ見出しがそのまま答えになる (2026-08-05 指摘)。
   * 件数も見出しが持つので、内訳行も要らなくなった。
   *
   * 知識を先に置く: 「今の案件のままで埋められるもの」から手を付けられるようにするため
   * (①知識100% → ②実務70% の順に効くのと同じ並び)。
   */
  const actionGroups = (own: Action[], level: CheckLevel, isNew: boolean) => {
    const groups: { kind: ActionKind; label: string; cls: string; items: Action[] }[] = [
      {
        kind: 'knowledge',
        label: ko ? '지식' : '知識',
        cls: 'text-indigo-700',
        items: own.filter((a) => a.kind === 'knowledge'),
      },
      {
        kind: 'practice',
        label: ko ? '실무' : '実務',
        cls: 'text-gray-600',
        items: own.filter((a) => a.kind === 'practice'),
      },
    ];
    return groups
      .filter((g) => g.items.length > 0)
      .map((g) => {
        // 見出しの達成数も `stat()` と同じ水準で数える (知識は常に 1人称)
        const groupLevel = levelOfAction(g.kind, level);
        const marks = marksOf(groupLevel);
        const done = g.items.filter((a) => marks[a.actionId] === true).length;
        // 凡例はチェックが2つ並ぶ実務グループにだけ付ける。
        // 知識は1人称の1つだけなので「左/右」の説明が要らない
        const showLevelHint = groupLevel === 'assisted';
        return (
          <div key={g.kind} className="flex flex-col gap-1">
            <p className={`mt-0.5 px-0.5 text-[9.5px] font-bold ${g.cls}`}>
              {g.label} {done}/{g.items.length}
              {/*
                **合格ラインを見出しに書く**。知識と実務で違う (100% / 70%) ことが
                ここに出ていないと、2本のバーがなぜ長さ違いで緑になるのか読めない。
                今が何%かはバー側が出すので、ここでは繰り返さない。
              */}
              <span className="ml-1 font-normal text-gray-500">
                {g.kind === 'knowledge'
                  ? (ko ? '（100%로 클리어）' : '（100%でクリア）')
                  : (ko ? '（70% 이상으로 클리어）' : '（70%以上でクリア）')}
              </span>
            </p>
            {showLevelHint && levelHeader()}
            {g.items.map((a) => actionRow(a, { isNew, level }))}
          </div>
        );
      });
  };

  // ---------------------------------------------------------------------
  // 包含カテゴリのロールアップ 1行 — 押すとその場で展開 (再帰)。段階の移動はしない
  // ---------------------------------------------------------------------
  const childRollup = (childId: string, parentKey: string): React.ReactNode => {
    const child = catById.get(childId);
    if (!child) return null;
    const cst = stat(childId, INHERITED_LEVEL);
    /**
     * その段階「自身」の判定。下の段階の目安が補助を許すので、**自分の段階では
     * クリア済みなのに引き継ぎ先では 0 から見える**ことが起きる (AC-12.25 の想定どおり)。
     * そのまま「クリアまであと4」だけ出すと、積み上げが消えたようにしか読めないので、
     * 「ここでは 1人称 で問い直している」と分かる文言に差し替える。
     */
    const clearedAtOwnStage = !cst.cleared && stat(childId, levelOfStage(child.stage)).cleared;
    const key = `${parentKey}>${childId}`;
    const expanded = expandedRollups.has(key);
    return (
      <div key={key} className="flex flex-col">
        <button
          type="button"
          onClick={() => toggleRollup(key)}
          className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-left ${
            cst.cleared ? 'border-emerald-300 bg-emerald-50' : 'border-amber-100 bg-amber-50/40'
          } hover:brightness-95`}
        >
          <span className="flex min-w-0 items-center gap-1">
            {/*
              開閉できることが分かるよう、矢印を枠付きにして「操作できる」見た目にする。
              「開く/閉じる」の語をここに入れると 26px 幅を取り、カテゴリ名が切れるため
              (実測: セキュリティ・ルール遵守 が 8px 不足) 語は見出し側に置いた。
            */}
            <span
              className="shrink-0 rounded border border-gray-300 bg-white px-0.5 text-[10px] font-bold leading-none text-gray-500"
              aria-hidden
            >
              {expanded ? '▾' : '▸'}
            </span>
            <span className="rounded bg-white/80 px-1 py-px text-[9px] font-bold text-gray-400">
              STEP {child.stage}
            </span>
            <span
              className={`truncate text-[11.5px] font-semibold ${
                cst.cleared ? 'text-emerald-800' : 'text-gray-700'
              }`}
            >
              {cst.cleared && <span aria-hidden>✓ </span>}
              {loc(lang, child.labelJa, child.labelKo)}
            </span>
          </span>
          {/*
            「STEP1クリア済 → 1人称で再確認」まで入れると 150px 取り、3列表示 (1300px) で
            カテゴリ名が5件切れた (最大14px不足)。どの段階から来たかは左の STEP バッジ、
            なぜ問い直すのかは見出しが言っているので、ここは行動だけを短く出す。
          */}
          {statusBadge(cst, 'sm', clearedAtOwnStage ? '1人称で再確認' : undefined)}
        </button>
        {expanded && (
          <div className="ml-2.5 mt-1 flex flex-col gap-1 border-l-2 border-gray-100 pl-2">
            {child.includes.map((id) => childRollup(id, key))}
            {/* 展開先でも、その段階の目安に応じて2段チェックを出す */}
            {actionGroups(directActions(childId), levelOfStage(child.stage), false)}
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // カテゴリカード (開いた段階)
  // ---------------------------------------------------------------------
  const categoryCard = (cat: Category) => {
    const st = stat(cat.categoryId, levelOfStage(cat.stage));
    const ownIsNew = cat.stage > minStage; // 上位段階の固有アクション = この段階で追加 (差分)
    // 自立確認は「この段階で追加された業務」ではなく「引き継いだ業務を支援なしでやれるか」なので、
    // NEW と混ぜず別グループにする (外部レビュー 2026-07-29)
    const own = directActions(cat.categoryId);
    // クリア判定と同じ水準でチェック行を描く。ここがずれると押しても数が動かない
    const level = levelOfStage(cat.stage);
    return (
      <div
        key={cat.categoryId}
        id={`cat-${cat.categoryId}`}
        className={`flex flex-col overflow-hidden rounded-xl border-2 bg-white ${
          focusCat === cat.categoryId
            ? 'jump-flash border-cyan-500'
            : st.cleared
              ? 'border-emerald-400'
              : 'border-gray-200'
        }`}
      >
        {/* クリアしたカテゴリはヘッダーを反転して一目で分かるように */}
        <div
          className={`flex items-start justify-between gap-2 px-3 py-2 ${
            st.cleared ? 'bg-emerald-500' : 'bg-gray-50'
          }`}
        >
          <span
            className={`text-[12.5px] font-bold leading-snug ${
              st.cleared ? 'text-white' : 'text-gray-800'
            }`}
          >
            {st.cleared && <span aria-hidden>✓ </span>}
            {loc(lang, cat.labelJa, cat.labelKo)}
          </span>
          {st.cleared ? (
            <span className="rounded bg-white/95 px-2 py-0.5 text-[11px] font-bold text-emerald-600 shadow-sm">
              {st.done}/{st.total} {ko ? '클리어' : 'クリア'}
            </span>
          ) : (
            statusBadge(st)
          )}
        </div>

        {/*
          バーは2本。**合格ラインが違うものを1本に混ぜない** —
          知識は端まで (100%)、実務は 70% の線まで行けばよい。
          1本だったころは「70% の線」が知識にも掛かって見えていた。
          持たない側は描かない (実務0件のカテゴリに 70% 線を出すと嘘になる)。
        */}
        <div className="flex flex-col gap-px px-2 py-1" aria-hidden>
          {st.knowledgeTotal > 0 &&
            progressBar(ko ? '지식' : '知識', st.knowledgeDone, st.knowledgeTotal, 1, st.cleared)}
          {st.practiceTotal > 0 &&
            progressBar(ko ? '실무' : '実務', st.practiceDone, st.practiceTotal, CLEAR, st.cleared)}
        </div>

        <div className={`flex flex-col gap-1 p-2 ${st.cleared ? 'bg-emerald-50/40' : ''}`}>
          {/*
            包含した下位カテゴリ = 1行ロールアップ (その場で展開)。

            既定で畳んでいるため、この行が「項目の入れ物」ではなく「状態表示」に見え、
            引き継いだ項目が**無いように見える**という指摘を受けた (大場さん 2026-07-30)。
            畳む方針そのものは変えない (STEP2 を開くと STEP1 の 120 項目が出てしまう) ので、
            **中身があることを見出しで明示する**。
          */}
          {cat.includes.length > 0 && (
            <p className="px-0.5 text-[9.5px] font-semibold leading-relaxed text-gray-400">
              {ko ? '아래 단계에서 인계' : '下の段階から引き継ぎ'}
              <span className="ml-1 font-normal text-gray-400">
                {ko
                  ? '（누르면 항목이 열립니다）'
                  : '— ここでは「1人称」でできるかを問い直します（押すと項目が開きます）'}
              </span>
            </p>
          )}
          {cat.includes.map((id) => childRollup(id, cat.categoryId))}

          {/* その段階固有のアクション (チェック対象)。上位段階では NEW として強調 */}
          {own.length > 0 && ownIsNew && (
            <p className="mt-1 px-0.5 text-[9.5px] font-semibold text-amber-700">
              {ko ? `이 단계에서 추가 (${own.length})` : `この段階で追加（${own.length}）`}
            </p>
          )}
          {actionGroups(own, level, ownIsNew)}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------
  // カテゴリチップ (閉じた段階)
  // ---------------------------------------------------------------------
  const categoryChip = (cat: Category) => {
    const st = stat(cat.categoryId, levelOfStage(cat.stage));
    return (
      <button
        key={cat.categoryId}
        type="button"
        onClick={() => setOpenStage(cat.stage)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-colors ${
          st.cleared
            ? 'border-emerald-500 bg-emerald-500 hover:brightness-95'
            : 'border-gray-200 bg-white hover:border-cyan-300 hover:bg-cyan-50/40'
        }`}
      >
        <span
          className={`text-[11px] font-semibold ${st.cleared ? 'text-white' : 'text-gray-700'}`}
        >
          {st.cleared && <span aria-hidden>✓ </span>}
          {loc(lang, cat.labelJa, cat.labelKo)}
        </span>
        <span
          className={`rounded px-1 py-0.5 text-[10px] font-bold ${
            st.cleared ? 'bg-white/95 text-emerald-600' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {st.done}/{st.total}
        </span>
      </button>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/*
        引っ越し告知 — **一番上**。関門の帯より上に置く。
        ここで見落とされると、その人のチェックは戻せない。
        中身はダイアログ (初回だけ) + 帯 (書き出すまで) の二段構え。
      */}
      <MoveNotice needsExport={needsExport} onExport={onExport} lang={lang} />
      {/*
        対象範囲の帯 — 「これは何のロードマップで、どこまで載っているのか」。

        ルート (区分 × 分類) は **ロードマップ自身が持つ状態**で、旧「階段ビュー」の
        目標役割には依存しない。選択肢は roles から導かれる。

        ルートが1つのときも **隠さずに固定ラベルとして出す**。
        以前は `routes.length > 1` で丸ごと非表示にしていたため、区分も収録範囲も
        BETA 帯の注意文の中にしか無く、「制約の説明」に見えて
        「このページが何か」としては読まれなかった。

        ⚠️ カテゴリはまだルートで絞り込めない (`categories.csv` に区分の軸が無い)。
        そのため **roles.csv に他区分の役割を足すと、セレクタだけが増えて
        カテゴリは変わらない**という中途半端な状態になる。他区分を入れる前に
        必ず `categories.csv`・`certs.csv` の軸を先に足すこと (HANDOFF §4b)。
      */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 pt-3 md:px-5 md:pt-4">
        {/* ルートが無い (roles が空) ときはラベルだけ残らないように出さない */}
        {routes.length > 0 && (
          <span className="text-[10px] font-semibold text-gray-400">区分</span>
        )}
        {routes.length > 1 ? (
          routes.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => onRouteChange(r.key)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                r.key === activeRouteKey
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-800'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-cyan-300'
              }`}
            >
              {TRACK_LABELS[r.track]} &gt; {r.subtrack}
            </button>
          ))
        ) : activeRoute ? (
          <span className="rounded-lg border border-cyan-500 bg-cyan-50 px-2.5 py-1 text-[11.5px] font-bold text-cyan-800">
            {TRACK_LABELS[activeRoute.track]} &gt; {activeRoute.subtrack}
          </span>
        ) : null}

        {coveredMin !== null && coveredMax !== null && (
          <>
            <span className="ml-1 text-[10px] font-semibold text-gray-400">収録範囲</span>
            <span className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-gray-700">
              STEP{coveredMin}
              {coveredMax > coveredMin && `〜${coveredMax}`}
            </span>
            {ladderMax !== null && ladderMax > coveredMax && (
              <span className="text-[10px] text-gray-400">
                {`STEP${coveredMax + 1}${ladderMax > coveredMax + 1 ? `〜${ladderMax}` : ''} は準備中`}
              </span>
            )}
          </>
        )}

        {/*
          説明の開閉 (狭い幅のみ)。モバイルでは説明文と BETA 帯だけで画面の8割が埋まり、
          肝心のチェックリストが最初の1画面に出てこない。
          畳んでも **BETA チップはボタン側に残す** — ベータであることは隠さない。
          md 以上は常に開いた状態 (AC-12.21 の「上部に表示」を満たすため、状態に関係なく出す)。
        */}
        <button
          type="button"
          onClick={() => setIntroOpen((v) => !v)}
          aria-expanded={introOpen}
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] font-semibold text-gray-500 md:hidden"
        >
          {!introOpen && (
            <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-bold text-amber-700">
              BETA
            </span>
          )}
          <span aria-hidden>{introOpen ? '▾' : '▸'}</span>
          {introOpen ? '説明を閉じる' : 'この画面の説明'}
        </button>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 px-3 pt-3 md:flex-row md:items-start md:justify-between md:gap-4 md:px-5 md:pt-4">
        <p
          className={`text-[11px] leading-relaxed text-gray-500 ${introOpen ? '' : 'hidden md:block'}`}
        >
          {s.roadmapLegend}
        </p>
        {/* 2回目以降の面談: 残っているものだけを見る (アサリさん FB) */}
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1.5">
          <input
            type="checkbox"
            checked={onlyUnchecked}
            onChange={(e) => setOnlyUnchecked(e.target.checked)}
            className="h-3.5 w-3.5 accent-cyan-600"
          />
          <span className="text-[10.5px] font-medium text-gray-600">
            {ko ? '미체크만 표시' : '未チェックのみ表示'}
          </span>
        </label>
        {/*
          チェックは localStorage にしか無い。**サーバー保存もログインも意図的に持っていない**ので、
          ブラウザのデータを消す・端末を替える・別のPCで開く、のどれでも消える。
          退避手段がここにしか無いのだから、ロードマップの画面から出せないと意味が無い
          (v2 までは全体マップ側にしか置いておらず、しかも中身にロードマップのチェックが
          入っていなかった)。
        */}
        <button
          type="button"
          onClick={onExport}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10.5px] font-medium text-gray-600 hover:border-cyan-300 hover:text-cyan-700"
          title={ko
            ? '체크 상태를 파일로 저장합니다 (이 브라우저에만 남아 있으므로 백업용)'
            : 'チェック状態をファイルに保存します（このブラウザにしか残らないため）'}
        >
          <span aria-hidden>⬇</span>
          {ko ? '내보내기' : '書き出し'}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[10.5px] font-medium text-gray-600 hover:border-cyan-300 hover:text-cyan-700"
          title={ko ? '저장해 둔 파일을 읽어옵니다' : '書き出したファイルを読み込みます'}
        >
          <span aria-hidden>⬆</span>
          {ko ? '읽어오기' : '読み込み'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';          // 同じファイルを続けて選んでも onChange が出るように
            if (!f) return;
            void onImport(f).then((r) => {
              setIoMessage({ ok: r.ok, text: r.message });
              window.setTimeout(() => setIoMessage(null), 6000);
            });
          }}
        />
      </div>
      {ioMessage && (
        <p
          role="status"
          className={`mx-3 mb-1 rounded px-2 py-1 text-[10.5px] ${
            ioMessage.ok ? 'bg-cyan-50 text-cyan-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {ioMessage.text}
        </p>
      )}


      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 md:px-5">
        {/* 適用範囲・第1版の前提 (外部レビュー FB 2026-07-29: 粗い粒度で出す理由を明記する) */}
        <div
          className={`mb-3 flex-col gap-1 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-[10px] leading-relaxed text-gray-400 ${
            introOpen ? 'flex' : 'hidden md:flex'
          }`}
        >
          <span>
            <span className="mr-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-700">
              BETA
            </span>
            {ko
              ? '베타판입니다. 반기마다 재검토하여 내용을 갱신합니다.'
              : 'ベータ版です。半期ごとに見直し、内容を更新します。'}
          </span>
          {/*
            以前ここは「インフラ > サーバー の STEP1〜3（…）」という **手書きの文章**だった。
            区分が増えたり段階を足した瞬間に嘘になるので、データから組み立てる。
          */}
          {activeRoute && coveredMin !== null && coveredMax !== null && (
            <span>
              {'現在は '}
              {TRACK_LABELS[activeRoute.track]} &gt; {activeRoute.subtrack}
              {' の STEP'}
              {coveredMin}
              {coveredMax > coveredMin && `〜${coveredMax}`}
              {(() => {
                const names = [...stagesDesc]
                  .reverse()
                  .map((st) => roleOfStage(st)?.shortLabel)
                  .filter((n): n is string => !!n);
                return names.length > 0 ? `（${names.join('・')}）` : null;
              })()}
              {'を反映。'}
              {ladderMax !== null &&
                ladderMax > coveredMax &&
                `STEP${coveredMax + 1}${ladderMax > coveredMax + 1 ? `〜${ladderMax}` : ''} は順次拡張予定。`}
            </span>
          )}
          {/*
            これは**インフラだけの事情**。区分を絞らずに出していたので、
            IT サポートを選んでも「サーバーとネットワークは…」が出ていた
            (2026-08-14 に IT サポートの役割を入れて発覚)。
            区分ごとの説明を足すなら、ここに並べるのではなく区分で分けること。
          */}
          {activeRoute?.track === 'infrastructure' && (
            <span>
              {ko
                ? '서버와 네트워크는 역할이 겹치는 부분이 많아 제1판에서는 공통 카테고리로 다룹니다(필요에 따라 향후 분할).'
                : 'サーバーとネットワークは役割が重なるため、第1版では共通のカテゴリとして扱っています（必要に応じて今後分割します）。'}
            </span>
          )}
        </div>

        {/*
          役割 (roles.csv) はあるが業務カテゴリがまだ無い区分。
          **何も出さないと故障に見える** — 空白の画面は「壊れている」と読まれる。
          IT サポートの役割を入れた時点で実際にそうなった (2026-08-14)。
          段階の範囲は roles から分かるので、そこまでは言う。
        */}
        {stagesDesc.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center">
            <p className="text-[12.5px] font-bold text-gray-600">
              {ko ? '이 구분의 체크리스트는 준비 중입니다' : 'この区分のチェックリストは準備中です'}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
              {activeRoute && ladderMax !== null
                ? ko
                  ? `${TRACK_LABELS[activeRoute.track]} > ${activeRoute.subtrack} 는 STEP1〜${ladderMax} 의 단계가 정해져 있고, 업무 카테고리와 체크 항목을 순차적으로 추가할 예정입니다.`
                  : `${TRACK_LABELS[activeRoute.track]} > ${activeRoute.subtrack} は STEP1〜${ladderMax} の段階が決まっており、業務カテゴリとチェック項目を順次追加していきます。`
                : ko
                  ? '업무 카테고리와 체크 항목을 순차적으로 추가할 예정입니다.'
                  : '業務カテゴリとチェック項目を順次追加していきます。'}
            </p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-gray-400">
              {ko
                ? '단계별 역할은 「전체 맵」에서 볼 수 있습니다.'
                : '段階ごとの役割は「全体マップ」で確認できます。'}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {stagesDesc.map((stage) => {
            const open = openStage === stage;
            const role = roleOfStage(stage);
            const cats = catsOfStage(stage);
            const stageCerts = certsOfStage(stage);
            return (
              <section key={stage} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => toggle(stage)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left ${
                    open ? 'bg-cyan-50' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800">
                      STEP {stage}
                    </span>
                    <span className="text-[12.5px] font-semibold text-gray-700">
                      {role ? loc(lang, role.shortLabel, role.shortLabelKo) : ''}
                    </span>
                  </span>
                  <span className="text-[11px] font-medium text-cyan-700">
                    {open
                      ? ko
                        ? '닫기 ▾'
                        : '閉じる ▾'
                      : ko
                        ? '체크리스트 열기 ▸'
                        : 'チェックリストを開く ▸'}
                  </span>
                </button>

                {open ? (
                  <>
                    {/* この段階でチェックしてよい「自立度」の目安 (v2.8 — 判定要件ではない) */}
                    {STAGE_AUTONOMY[stage] && (
                      <p className="border-t border-amber-100 bg-amber-50/60 px-3 py-2 text-[10.5px] leading-relaxed text-amber-900">
                        <span className="font-semibold">
                          {ko ? '체크 기준' : 'チェックの目安'}:{' '}
                        </span>
                        {loc(lang, STAGE_AUTONOMY[stage].ja, STAGE_AUTONOMY[stage].ko)}
                        {/*
                          知識/実務 の意味はここで一度だけ説明する。
                          件数とグループ分け自体はカテゴリ側の見出しが持つ (actionGroups)。
                        */}
                        <span className="ml-1">
                          <span className="font-bold text-indigo-800">{ko ? '지식' : '知識'}</span>
                          {ko
                            ? '은 지금 안건 그대로 채울 수 있는 항목, '
                            : ' は今の案件のままでも埋められる項目、'}
                          <span className="font-bold">{ko ? '실무' : '実務'}</span>
                          {ko
                            ? '는 안건에서 경험해야 채워지는 항목입니다.'
                            : ' は案件で経験しないと埋まらない項目です。'}
                        </span>
                      </p>
                    )}

                    {/* 次の段階へ進むための推奨資格 (参考 — 判定要件ではない) */}
                    {stageCerts.length > 0 && (
                      <div className="flex flex-col gap-1.5 border-t border-indigo-100 bg-indigo-50/50 px-3 py-2.5">
                        <span className="text-[10.5px] font-semibold text-indigo-800">
                          🎓{' '}
                          {ko
                            ? '다음 단계로 올라가기 위한 추천 자격증 (참고)'
                            : '次の段階へ進むための推奨資格（参考）'}
                        </span>
                        {/*
                          チェックは持たない (2026-08-14)。2026-08-12 に入れて2日で戻した —
                          資格には有効期限があるため、☑ を持つと期限切れの資格に印が
                          残る = 古くなった時点で嘘になる。しかも手当は人事が自分の記録で
                          払うので、このチェックを読む人がどこにもいない。
                          **ここは参考表示だけ。** 取得期間や手当ランクも出さない —
                          出すとその数字を保守する責任が発生する。
                        */}
                        {/* 会社の支援制度 (外部レビュー FB: 「会社は何をしてくれるのか」に答える) */}
                        <span className="text-[9.5px] leading-relaxed text-indigo-500">
                          {ko
                            ? '참고서·온라인 강좌·수험료 보조와 자격 수당 제도가 있습니다. 사내 스터디(아카데미)나 상사에게 상담할 수 있습니다.'
                            : '参考書・オンライン講座・受験費用の補助と資格手当の制度があります。社内勉強会（アカデミー）や上長に相談できます。'}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {stageCerts.map((cert) => (
                            <span
                              key={cert.certId}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2 py-1"
                              title={cert.note ? loc(lang, cert.note, cert.noteKo) : undefined}
                            >
                              <span className="text-[11px] font-semibold text-indigo-900">
                                {loc(lang, cert.nameJa, cert.nameKo)}
                              </span>
                              {cert.note && (
                                <span className="text-[9.5px] text-indigo-400">
                                  {loc(lang, cert.note, cert.noteKo)}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-2.5 border-t border-gray-100 bg-gray-50/40 p-2.5 md:grid-cols-2 xl:grid-cols-3">
                      {cats.map((c) => categoryCard(c))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-1.5 border-t border-gray-100 px-3 py-2.5">
                    {cats.map((c) => categoryChip(c))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* 非断定原則の注意文言 (確定 #3) */}
      <p className="shrink-0 border-t border-gray-100 bg-white px-3 py-2.5 text-[10px] leading-relaxed text-gray-400 md:px-5">
        {s.disclaimer}
      </p>
    </div>
  );
};

export default CraftView;
