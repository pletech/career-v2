/**
 * マイページ — 「今どこにいて、次に何をすればよいか」を1画面で出す (2026-08-07)。
 *
 * **なぜ別画面なのか**: 分けた理由は**カテゴリや項目の多さではない**。
 * 最初に開く画面の4割が「見ても見なくてもよい」情報で埋まっていて、
 * **本当に見るべきものが後ろに追いやられていた**から、役割で画面を分けた。
 * 件数を減らすための分割ではないので、**カテゴリを増やすこと自体はここの理由にならない**
 * (2026-08-14 に、この主張を「項目が多いから分けた」と誤って引用して訂正を受けた)。
 *
 * カードを畳む案は却下 — 階層が深くなるうえ、畳んだ項目は
 * 「その項目が無い」と読まれる (2026-07-30 に実際に指摘を受けている)。
 *
 * なので**読む画面と書く画面を分けた**。ここは読むだけ。
 * チェックは業務ロードマップで行い、ここからはその場所へ送り出す。
 */
import React from 'react';

import type { Action, ActionCheckMap, Category, Cert, Role } from '../../domain/types';
import type { Lang } from '../../domain/i18n';
import { loc } from '../../domain/i18n';
import {
  CLEAR,
  currentStageOf,
  nextGoalOf,
  readyForNext,
  stageProgress,
  type StageProgress,
} from '../../domain/stageProgress';
import { levelOfAction, levelOfStage } from './CraftView';

interface MyPageViewProps {
  routeLabel: string;
  roles: Role[];
  categories: Category[];
  actions: Action[];
  certs: Cert[];
  actionChecks: ActionCheckMap;
  actionSoloChecks: ActionCheckMap;
  /** 業務ロードマップの該当カテゴリへ送り出す */
  onJump: (stage: number, categoryId: string) => void;
  /** 取得済みの資格。**判定には使わない** — 記録できるだけ */
  certChecks: ActionCheckMap;
  onToggleCert: (certId: string) => void;
  lang: Lang;
}

const MyPageView: React.FC<MyPageViewProps> = ({
  routeLabel, roles, categories, actions, certs,
  actionChecks, actionSoloChecks, onJump, certChecks, onToggleCert, lang,
}) => {
  const ko = lang === 'ko';
  /**
   * 段階の一覧。**アクションが1件も無い段階は外す** (2026-08-14)。
   *
   * カテゴリを先に入れてアクションを後から書く作業順だと、空の段階が
   * 「知識100%・実務100%で達成」として出てしまう (0/0 はどちらも満たすため)。
   * ここで外せば、1件も無い区分は `current === null` の準備中画面に落ちる。
   */
  const allStages = [...new Set(categories.map((c) => c.stage))].sort((a, b) => a - b);
  const progressOf = (stage: number): StageProgress =>
    stageProgress({
      stage, categories, actions, actionChecks, actionSoloChecks, levelOfStage, levelOfAction,
    });

  const labelOf = (categoryId: string) => {
    const c = categories.find((x) => x.categoryId === categoryId);
    return c ? loc(lang, c.labelJa, c.labelKo) : categoryId;
  };
  const roleOf = (stage: number) => roles.find((r) => r.stageOrder === stage && r.status !== 'hidden');
  const nameOf = (stage: number) => {
    const r = roleOf(stage);
    return r ? loc(lang, r.shortLabel, r.shortLabelKo) : '';
  };

  const stages = allStages.filter((s) => progressOf(s).hasContent);

  const current = currentStageOf(stages, progressOf);
  /*
    業務カテゴリがまだ無い区分 (役割だけ入っている状態)。
    「表示できる段階がありません」だけでは**故障に見える** —
    IT サポートの役割を入れた 2026-08-14 に実際にそう見えた。
    準備中であることと、どこを見れば分かるかまで言う。
  */
  if (current === null) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center">
          <p className="text-[12.5px] font-bold text-gray-600">
            {ko ? '이 구분의 체크리스트는 준비 중입니다' : 'この区分のチェックリストは準備中です'}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
            {routeLabel
              ? ko
                ? `${routeLabel} 는 단계와 역할이 정해져 있고, 체크 항목을 순차적으로 추가할 예정입니다.`
                : `${routeLabel} は段階と役割が決まっており、チェック項目を順次追加していきます。`
              : ko
                ? '체크 항목을 순차적으로 추가할 예정입니다.'
                : 'チェック項目を順次追加していきます。'}
          </p>
          <p className="mt-1.5 text-[10.5px] leading-relaxed text-gray-400">
            {ko
              ? '단계별 역할은 「전체 맵」에서 볼 수 있습니다.'
              : '段階ごとの役割は「全体マップ」で確認できます。'}
          </p>
        </div>
      </div>
    );
  }

  const cur = progressOf(current);
  const nextStage = stages.find((s) => s > current) ?? null;
  const next = nextStage === null ? null : progressOf(nextStage);
  /** roles には居るが項目がまだ無い段階 (STEP4 は 8〜9月に追加予定) */
  const plannedNext = roles.find((r) => r.stageOrder === current + 1 && r.status !== 'hidden');

  // -----------------------------------------------------------------------
  const bar = (done: number, total: number, target: number, met: boolean) => (
    <span className="relative block h-2 w-full rounded-full bg-gray-200">
      <span
        className={`block h-full rounded-full ${met ? 'bg-emerald-500' : 'bg-cyan-400'}`}
        style={{ width: `${total === 0 ? 0 : Math.min(100, Math.round((done / total) * 100))}%` }}
      />
      {target < 1 && (
        <span
          className="absolute top-0 h-full w-px bg-gray-500/70"
          style={{ left: `${target * 100}%` }}
        />
      )}
    </span>
  );

  /** 残りがどこにあるか。押すと業務ロードマップの該当カテゴリへ */
  const where = (
    title: string, rows: { categoryId: string; count: number }[], stage: number,
  ) =>
    rows.length === 0 ? null : (
      <div className="flex flex-col gap-1">
        <p className="text-[10.5px] font-semibold text-gray-500">{title}</p>
        <div className="flex flex-wrap gap-1">
          {rows.map((r) => (
            <button
              key={`${stage}-${r.categoryId}`}
              type="button"
              onClick={() => onJump(stage, r.categoryId)}
              className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-[11px] text-gray-700 hover:border-cyan-400 hover:bg-cyan-50 hover:text-cyan-800"
            >
              {labelOf(r.categoryId)} {r.count}
              <span aria-hidden> →</span>
            </button>
          ))}
        </div>
      </div>
    );

  const ready = readyForNext(cur, next);
  const phase = nextGoalOf(cur, next);

  // -----------------------------------------------------------------------
  // 「今なにを目標にすればよいか」を **1つだけ** 出す帯 (2026-08-07 사용자 지시)。
  //
  // 3つの条件を並べても、どれから手を付けるのか分からない。関門を3つに区切り、
  // **今いる段の目標だけ**を開いて出す。色が変わること自体が「越えた」合図になる。
  // -----------------------------------------------------------------------
  const TONE = {
    goal: { box: 'border-amber-300 bg-amber-50', chip: 'bg-amber-500' },
    'next-study': { box: 'border-indigo-300 bg-indigo-50', chip: 'bg-indigo-600' },
    ready: { box: 'border-emerald-400 bg-emerald-50', chip: 'bg-emerald-600' },
    'next-absent': { box: 'border-gray-300 bg-gray-50', chip: 'bg-gray-500' },
  }[phase];

  /** 帯の中の1行。現在地は開き、それ以外は畳んで薄く出す (道のりが見えるように) */
  const step = (
    n: number, active: boolean, done: boolean, title: string, body?: React.ReactNode,
  ) => (
    <div className={`flex gap-2 ${active ? '' : 'opacity-45'}`}>
      <span
        className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
          done ? 'bg-emerald-600' : active ? TONE.chip : 'bg-gray-400'
        }`}
        aria-hidden
      >
        {done ? '\u2713' : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[12px] leading-snug ${active ? 'font-bold text-gray-800' : 'text-gray-600'}`}>
          {title}
        </p>
        {active && body}
      </div>
    </div>
  );

  /**
   * 帯の中の目標 1本。**進捗はここが持つ** (数字とバー)。
   *
   * 残りがどこにあるか (チップ) は下の「次にやること」が持つ。
   * 両方でチップを出すと同じものを2度読ませることになる (2026-08-07 지적)。
   */
  const goalLine = (label: string, done: number, total: number, target: number, met: boolean) => (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
        <span className="text-gray-700">{label}</span>
        <span className="shrink-0 tabular-nums">
          <span className="font-bold text-gray-800">{done}/{total}</span>
          <span className={`ml-1.5 font-bold ${met ? 'text-emerald-600' : 'text-amber-700'}`}>
            {met
              ? ko ? '달성' : '達成'
              : ko
                ? `앞으로 ${Math.max(0, Math.ceil(total * target) - done)}`
                : `あと${Math.max(0, Math.ceil(total * target) - done)}件`}
          </span>
        </span>
      </div>
      {bar(done, total, target, met)}
    </div>
  );

  /** 詳細への誘導。帯で残りを列挙しない代わりに、どこを見ればよいかだけ言う */
  const seeBelow = (
    <p className="mt-1 text-[10px] text-gray-500">
      {ko ? '↓ 남은 항목은 아래 「다음에 할 것」에 있습니다' : '↓ 残っている項目は下の「次にやること」にあります'}
    </p>
  );

  const nextRoleSummary = nextStage === null ? null : roleOf(nextStage)?.summary;
  /** 「次にやること」に並べるものが1件も無い状態 */
  const nothingLeft =
    cur.knowledgeWhere.length === 0
    && (!cur.knowledgeMet || cur.practiceWhere.length === 0)
    && (next === null || next.knowledgeWhere.length === 0);

  const banner = (
    <div className={`flex flex-col gap-2.5 rounded-xl border-2 p-3 ${TONE.box}`}>
      {step(
        1,
        phase === 'goal',
        phase !== 'goal',
        ko
          ? `STEP${current} ${nameOf(current)} \u2014 이 단계의 목표`
          : `STEP${current} ${nameOf(current)} \u2014 この段階の目標`,
        <div className="mt-1.5 flex flex-col gap-1">
          {goalLine(ko ? '지식 100%' : '知識 100%',
            cur.knowledgeDone, cur.knowledgeTotal, 1, cur.knowledgeMet)}
          {goalLine(ko ? '실무 70%' : '実務 70%',
            cur.practiceDone, cur.practiceTotal, CLEAR, cur.practiceMet)}
          {seeBelow}
        </div>,
      )}

      {step(
        2,
        phase === 'next-study' || phase === 'next-absent',
        phase === 'ready',
        ko ? '다음 단계에 도전할 수 있습니다' : '次の段階に挑戦できます',
        phase === 'next-absent' ? (
          <p className="mt-1 text-[11px] leading-relaxed text-gray-600">
            {plannedNext
              ? ko
                ? `STEP${current + 1}（${loc(lang, plannedNext.shortLabel, plannedNext.shortLabelKo)}）의 항목은 준비 중입니다.`
                : `STEP${current + 1}（${loc(lang, plannedNext.shortLabel, plannedNext.shortLabelKo)}）の項目は準備中です。`
              : ko ? '다음 단계는 아직 준비 중입니다.' : '次の段階はまだ準備中です。'}
          </p>
        ) : next && nextStage !== null ? (
          <div className="mt-1.5 flex flex-col gap-1">
            {goalLine(
              ko ? `다음 목표: STEP${nextStage} 지식 100%` : `次の目標: STEP${nextStage} の知識 100%`,
              next.knowledgeDone, next.knowledgeTotal, 1, next.knowledgeMet,
            )}
            {nextRoleSummary && (
              <p className="text-[10.5px] leading-relaxed text-gray-600">
                <span className="font-bold">STEP{nextStage} {nameOf(nextStage)}</span>
                {' \u2014 '}{nextRoleSummary}
              </p>
            )}
            {seeBelow}
          </div>
        ) : undefined,
      )}

      {step(
        3,
        phase === 'ready',
        false,
        nextStage === null
          ? ko ? '다음 단계의 안건에 도전할 수 있습니다' : '次の段階の案件に挑戦できます'
          : ko ? `STEP${nextStage}의 안건에 도전할 수 있습니다` : `STEP${nextStage} の案件に挑戦できます`,
        <div className="mt-1.5 flex flex-col gap-1.5">
          <p className="text-[11.5px] font-bold text-gray-800">
            {ko ? '다음에 할 것' : '次にやること'}
          </p>
          <ol className="flex list-decimal flex-col gap-1 pl-4 text-[11px] leading-relaxed text-gray-700">
            <li>{ko ? '상사에게 면담을 신청한다' : '上長に面談を申し込む'}</li>
            <li>
              {ko
                ? '면담에서는 이 화면을 함께 보며, 다음 단계에서 무엇을 경험할지 정한다'
                : '面談ではこの画面を一緒に見て、次の段階で何を経験するかを決める'}
            </li>
            <li>
              {ko
                ? '「무엇이 부족한가」가 아니라 「다음에 무엇을 경험할까」를 정하는 자리입니다'
                : '「何が足りないか」ではなく「次に何を経験するか」を決める場です'}
            </li>
          </ol>
          <p className="text-[10px] leading-relaxed text-gray-500">
            {ko
              ? '※ 이 화면은 판정이 아닙니다. 정식 검토는 면담에서 진행합니다.'
              : '※ この画面は判定ではありません。正式な検討は面談で行います。'}
          </p>
        </div>,
      )}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3 md:px-5">
      {/*
        広い画面では2列。1列のままだと PC で縦に伸びるだけで、
        「一目で分かる」という目的から遠ざかる。
        左 = 現在地と目標 (読む順)、右 = 次の行動と積み上げ。
      */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 md:max-w-5xl">
        <p className="text-[11px] text-gray-500">{routeLabel}</p>
        {banner}
        <p className="px-1 pt-1 text-[10.5px] font-bold text-gray-400">
          {ko ? '자세한 내용' : '詳しい内容'}
        </p>
        {/*
          **列に手で振り分けない。** 以前は左右に固定で分けていたが、
          カードを2枚外した瞬間に 左150px / 右746px になった。
          枚数が変わっても崩れないよう、カードを流し込む形にする。
          (`columns` は要素を分割しないので、カードが列をまたいで切れることはない)
        */}
        <div className="gap-3 md:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">

        {/* 今どこにいるか — 段階の並びの中で現在地を示す */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] font-bold text-gray-500">
            {ko ? '지금 있는 단계' : '今の段階'}
          </p>
          <div className="flex flex-col gap-1">
            {stages.map((s) => {
              const p = progressOf(s);
              const isCur = s === current;
              const done = readyForNext(p, stages.find((x) => x > s) === undefined
                ? null : progressOf(stages.find((x) => x > s) as number));
              return (
                <div
                  key={s}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                    isCur ? 'bg-cyan-50 ring-1 ring-cyan-300' : ''
                  }`}
                >
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      isCur ? 'bg-cyan-600 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    STEP {s}
                  </span>
                  <span className={`flex-1 text-[11.5px] ${isCur ? 'font-bold text-gray-800' : 'text-gray-500'}`}>
                    {nameOf(s)}
                  </span>
                  {isCur && (
                    <span className="text-[10.5px] font-bold text-cyan-700">
                      {ko ? '← 지금 여기' : '← 今ここ'}
                    </span>
                  )}
                  {!isCur && done && (
                    <span className="text-[10.5px] font-bold text-emerald-600" aria-hidden>
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 次にやること — 「勉強で埋まる分」を先に出す */}
        {!ready && (
          <div className="flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
            <p className="text-[12px] font-bold text-indigo-900">
              {ko ? '다음에 할 것' : '次にやること'}
            </p>
            {/*
              説明文は置かない。**残りがどこにあるかだけ**を出す。
              「勉強で埋まる / 案件が要る」の区別は 知識・実務 という見出しが既に言っており、
              文章を足すと帯と同じことを繰り返して読みにくくなる (2026-08-07 지적)。
            */}
            {where(
              ko ? '이 단계의 남은 지식 (전부 필요)' : 'この段階の残りの知識（すべて必要）',
              cur.knowledgeWhere, current,
            )}
            {/* 知識を埋め切った先で実務だけが残る。ここが残りの唯一の置き場なので出す */}
            {cur.knowledgeMet &&
              where(
                ko ? '이 단계의 남은 실무 (어느 것이든 괜찮습니다)'
                   : 'この段階の残りの実務（どれを埋めても構いません）',
                cur.practiceWhere, current,
              )}
            {next && nextStage !== null &&
              where(
                ko ? `STEP${nextStage}의 남은 지식` : `STEP${nextStage} の残りの知識`,
                next.knowledgeWhere, nextStage,
              )}
            {/*
              残りが1件も無いのに見出しだけが残ると**壊れているように見える** (2026-08-07 지적)。
              その段階まで埋め切って次の段階の項目がまだ無い、という状態なのでそう言う。
            */}
            {nothingLeft && (
              <p className="text-[11px] leading-relaxed text-indigo-800">
                {plannedNext
                  ? ko
                    ? `이 단계는 다 채웠습니다. STEP${current + 1}（${loc(lang, plannedNext.shortLabel, plannedNext.shortLabelKo)}）의 항목은 준비 중이며, 추가되면 여기에 다음에 할 것이 표시됩니다.`
                    : `この段階は埋め切りました。STEP${current + 1}（${loc(lang, plannedNext.shortLabel, plannedNext.shortLabelKo)}）の項目は準備中です。追加され次第、ここに次にやることが出ます。`
                  : ko
                    ? '이 단계는 다 채웠습니다. 다음 단계는 준비 중이며, 추가되면 여기에 다음에 할 것이 표시됩니다.'
                    : 'この段階は埋め切りました。次の段階はまだ準備中です。追加され次第、ここに次にやることが出ます。'}
              </p>
            )}
          </div>
        )}

        {/* これまでの積み上げ — 下の段階が消えたように見えないよう全部出す */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] font-bold text-gray-500">
            {ko ? '지금까지의 누적' : 'これまでの積み上げ'}
          </p>
          <div className="flex flex-col gap-1.5">
            {stages.map((s) => {
              const p = progressOf(s);
              return (
                <div key={s} className="flex items-center gap-2 text-[11px]">
                  <span className="w-12 shrink-0 font-bold text-gray-500">STEP {s}</span>
                  <span className="flex-1 truncate text-gray-600">{nameOf(s)}</span>
                  <span className={`w-24 shrink-0 text-right tabular-nums ${p.knowledgeMet ? 'text-emerald-600' : 'text-gray-600'}`}>
                    {ko ? '지식' : '知識'} {p.knowledgeDone}/{p.knowledgeTotal}
                  </span>
                  <span className={`w-28 shrink-0 text-right tabular-nums ${p.practiceMet ? 'text-emerald-600' : 'text-gray-600'}`}>
                    {ko ? '실무' : '実務'} {p.practiceDone}/{p.practiceTotal}（{p.practicePct}%）
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/*
          資格は**参考であって判定要件ではない**。持っているものを記録できるだけで、
          チェックしても達成率にも「次へ挑戦できる条件」にも影響しない。
          そう書いておかないと「資格を取らないと上がれない」制度に読める。
        */}
        {certs.filter((c) => c.stage === current).length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-[11px] font-bold text-gray-500">
              🎓 {ko ? '이 단계의 추천 자격증' : 'この段階の推奨資格'}
            </p>
            <p className="text-[10px] leading-relaxed text-gray-400">
              {ko
                ? '참고 정보입니다. 체크해도 달성률이나 다음 단계 조건에는 영향을 주지 않습니다.'
                : '参考情報です。チェックしても達成率や次の段階の条件には影響しません。'}
            </p>
            <div className="flex flex-col gap-0.5">
              {certs
                .filter((c) => c.stage === current)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((c) => (
                  <label
                    key={c.certId}
                    className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={certChecks[c.certId] === true}
                      onChange={() => onToggleCert(c.certId)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-indigo-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] leading-snug text-gray-700">
                        {loc(lang, c.nameJa, c.nameKo)}
                      </span>
                      {(c.note || c.noteKo) && (
                        <span className="block text-[10px] leading-snug text-gray-400">
                          {loc(lang, c.note ?? '', c.noteKo)}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
            </div>
          </div>
        )}

        </div>

        <p className="px-1 pb-2 text-[10px] leading-relaxed text-gray-400">
          {ko
            ? '이 판정은 승격·평가를 자동으로 결정하는 것이 아닙니다. 상사와의 면담에서 육성 상담을 위한 참고 정보입니다.'
            : 'この判定は昇格・評価を自動的に決定するものではありません。上長との面談における育成相談の参考情報です。'}
        </p>
      </div>
    </div>
  );
};

export default MyPageView;
