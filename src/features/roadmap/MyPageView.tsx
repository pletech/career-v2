/**
 * マイページ — 「今どこにいて、次に何をすればよいか」を1画面で出す (2026-08-07)。
 *
 * **なぜ別画面なのか**: 業務ロードマップは 11 カテゴリ × 全項目が開いたままで
 * 8 画面ぶんある。そこに段階サマリーを足したら「情報が多すぎる」となった。
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
  const stages = [...new Set(categories.map((c) => c.stage))].sort((a, b) => a - b);
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

  const current = currentStageOf(stages, progressOf);
  if (current === null) {
    return (
      <div className="p-4 text-[12px] text-gray-500">
        {ko ? '표시할 단계가 없습니다.' : '表示できる段階がありません。'}
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

  const condition = (label: string, done: number, total: number, target: number, met: boolean) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11.5px] text-gray-700">{label}</span>
        <span className="shrink-0 text-[11px] font-bold tabular-nums text-gray-800">
          {done}/{total}
          <span className={`ml-1.5 ${met ? 'text-emerald-600' : 'text-amber-700'}`}>
            {met
              ? ko ? '달성' : '達成'
              : ko ? `앞으로 ${Math.max(0, Math.ceil(total * target) - done)}` : `あと${Math.max(0, Math.ceil(total * target) - done)}件`}
          </span>
        </span>
      </div>
      {bar(done, total, target, met)}
    </div>
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

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3 md:px-5">
      {/*
        広い画面では2列。1列のままだと PC で縦に伸びるだけで、
        「一目で分かる」という目的から遠ざかる。
        左 = 現在地と目標 (読む順)、右 = 次の行動と積み上げ。
      */}
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 md:max-w-5xl">
        <p className="text-[11px] text-gray-500">{routeLabel}</p>
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-3">

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

        {/* ① この段階の目標 */}
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[12px] font-bold text-gray-800">
            {ko ? '이 단계의 목표' : 'この段階の目標'}
            <span className="ml-1.5 font-normal text-gray-500">
              STEP{current} {nameOf(current)}
            </span>
          </p>
          {condition(
            ko ? '실무 경험 70%' : '実務経験 70%',
            cur.practiceDone, cur.practiceTotal, CLEAR, cur.practiceMet,
          )}
          {!cur.practiceMet &&
            where(
              ko ? '남은 실무 (어느 것을 채워도 됩니다)' : '残りの実務（どれを埋めても構いません）',
              cur.practiceWhere, current,
            )}
        </div>

        {/* ② 次の段階へ挑戦できる条件 */}
        <div
          className={`flex flex-col gap-2.5 rounded-xl border p-3 ${
            ready ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200 bg-white'
          }`}
        >
          <p className="text-[12px] font-bold text-gray-800">
            {nextStage === null
              ? ko ? '다음 단계에 도전할 수 있는 조건' : '次の段階へ挑戦できる条件'
              : ko
                ? `다음 단계(STEP${nextStage} ${nameOf(nextStage)})에 도전할 수 있는 조건`
                : `次の段階（STEP${nextStage} ${nameOf(nextStage)}）へ挑戦できる条件`}
          </p>
          {condition(
            ko ? '이 단계의 실무 70%' : 'この段階の実務 70%',
            cur.practiceDone, cur.practiceTotal, CLEAR, cur.practiceMet,
          )}
          {condition(
            ko ? '이 단계의 지식 100%' : 'この段階の知識 100%',
            cur.knowledgeDone, cur.knowledgeTotal, 1, cur.knowledgeMet,
          )}
          {next && nextStage !== null ? (
            condition(
              ko ? `STEP${nextStage}의 지식 100%` : `STEP${nextStage} の知識 100%`,
              next.knowledgeDone, next.knowledgeTotal, 1, next.knowledgeMet,
            )
          ) : (
            // 0件を100%と数えると「準備中の段階をクリアした」ことになる
            <p className="rounded bg-gray-50 px-2 py-1.5 text-[11px] leading-relaxed text-gray-500">
              {plannedNext
                ? ko
                  ? `STEP${current + 1}（${loc(lang, plannedNext.shortLabel, plannedNext.shortLabelKo)}）의 항목은 준비 중입니다.`
                  : `STEP${current + 1}（${loc(lang, plannedNext.shortLabel, plannedNext.shortLabelKo)}）の項目は準備中です。`
                : ko ? '다음 단계는 아직 준비 중입니다.' : '次の段階はまだ準備中です。'}
            </p>
          )}

          {ready && (
            <p className="rounded bg-emerald-100 px-2 py-1.5 text-[11px] font-bold leading-relaxed text-emerald-800">
              {ko
                ? '조건을 모두 충족했습니다. 상사와의 면담에서 다음 단계를 상담해 보세요.'
                : '条件がそろいました。上長との面談で次の段階を相談してみてください。'}
            </p>
          )}
        </div>

        </div>
        <div className="flex flex-col gap-3">

        {/* 次にやること — 「勉強で埋まる分」を先に出す */}
        {!ready && (
          <div className="flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
            <p className="text-[12px] font-bold text-indigo-900">
              {ko ? '다음에 할 것' : '次にやること'}
            </p>
            {!cur.knowledgeMet || (next && !next.knowledgeMet) ? (
              <p className="text-[11px] leading-relaxed text-indigo-800">
                {ko
                  ? '지식 항목은 지금 안건 그대로 자기 학습이나 자격 취득으로 채울 수 있습니다.'
                  : '知識の項目は、今の案件のままでも自己学習や資格取得で埋められます。'}
              </p>
            ) : (
              <p className="text-[11px] leading-relaxed text-indigo-800">
                {ko
                  ? '지식은 다 채웠습니다. 남은 것은 안건에서 경험해야 채워집니다 — 면담에서 상담해 보세요.'
                  : '知識は埋め切りました。残りは案件で経験しないと埋まりません。面談で相談してみてください。'}
              </p>
            )}
            {where(
              ko ? '이 단계의 남은 지식 (전부 필요)' : 'この段階の残りの知識（すべて必要）',
              cur.knowledgeWhere, current,
            )}
            {next && nextStage !== null &&
              where(
                ko ? `STEP${nextStage}의 남은 지식` : `STEP${nextStage} の残りの知識`,
                next.knowledgeWhere, nextStage,
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
