/**
 * 引っ越しのお知らせ (2026-08-15〜。**移行が終わったらこのファイルごと消す**)。
 *
 * チェックは localStorage にしか無く、localStorage は**オリジン単位**なので、
 * アドレスが変われば今までのチェックは新しい方に出てこない。
 * 書き出さないまま切り替わると戻せない — だから告知が要る。
 *
 * ⚠️ **お知らせを配るだけでは足りない。** 読むのは携帯で、やる作業はPCの上にある。
 * 失うものがある人 = このツールを実際に開く人なので、**画面の中で言うのが一番届く。**
 *
 * 二段構えにしてある。役割が違うので、どちらか一方では足りない：
 *
 * | | いつ | 何のため |
 * |---|---|---|
 * | ダイアログ | **一度だけ** | 「引っ越す」という事実を最初に確実に伝える |
 * | 帯 | 書き出すまでずっと | 忘れさせない。ボタンはここに置く |
 *
 * ダイアログを毎回出さないのは、**読まずに閉じるのが習慣になる**から。
 * そうなると帯より早く無視される。それにこれは**面談で上長と一緒に見る道具**なので、
 * 開くたびに割り込むと面談そのものを止めてしまう。
 *
 * 帯に閉じるボタンは**わざと付けていない。** 閉じて忘れられたら意味が無い。
 * 代わりに**書き出せば自動的に消える** (needsExport が false になる) —
 * 消す唯一の方法が「やること」になっている。
 */
import { useCallback, useEffect, useState } from 'react';
import type { Lang } from '../../domain/i18n';

/** 締切 (2026-08-21 金)。ずらすときは**ここだけ**直す — お知らせの日付と必ず合わせること */
const DEADLINE = { ja: '8月21日（金）', ko: '8월 21일(금)' } as const;

/**
 * この告知を出すホスト。**引っ越し元でしか出さない。**
 *
 * 引っ越し先でも出ると「書き出せ」と言い続けることになり、
 * もう移った人にとっては意味の無い警告が残り続ける。
 * localhost を入れてあるのは、出す前にこちらで見た目を確かめるため。
 */
const SHOW_ON_HOSTS = ['pletech.github.io', 'localhost', '127.0.0.1'];

/**
 * ダイアログを見たかどうか。**チェックではない**ので、消えても失うものは無い
 * (もう一度出るだけ)。帯の方は消えないので、取りこぼしにはならない。
 */
const SEEN_KEY = 'career-ladder-move-notice-seen:v1';

function loadSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

interface MoveNoticeProps {
  /** まだ書き出していない、または書き出したあとにチェックが増えている */
  needsExport: boolean;
  onExport: () => void;
  lang: Lang;
}

function MoveNotice({ needsExport, onExport, lang }: MoveNoticeProps) {
  const [seen, setSeen] = useState(loadSeen);

  const dismiss = useCallback(() => {
    setSeen(true);
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // 見せ方の控えなので、残せなくても実害は無い (もう一度出るだけ)
    }
  }, []);

  /**
   * 出すのは **失うものがある人だけ**。1件もチェックが無い人に警告を出しても
   * 景色になるだけで、本当に必要な人への効き目まで落ちる。
   * (あとからチェックを始めた人には、その時点で出る)
   */
  const show = needsExport && SHOW_ON_HOSTS.includes(window.location.hostname);
  const showDialog = show && !seen;

  useEffect(() => {
    if (!showDialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDialog, dismiss]);

  if (!show) return null;

  const ko = lang === 'ko';

  return (
    <>
      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={dismiss}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-notice-title"
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="move-notice-title" className="text-[15px] font-bold text-gray-900">
              {ko ? '이 도구는 이사합니다' : 'このツールは引っ越します'}
            </h2>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-gray-700">
              {ko ? (
                <>
                  <b>{DEADLINE.ko}까지</b> 체크 내용을 파일로 저장해 주세요.
                </>
              ) : (
                <>
                  <b>{DEADLINE.ja}までに</b>、チェック内容をファイルに保存してください。
                </>
              )}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-gray-600">
              {ko
                ? '체크는 이 브라우저 안에만 있습니다. 주소가 바뀌면 새 주소에는 나오지 않습니다(나중에 되돌릴 수 없습니다).'
                : 'チェックはこのブラウザの中にあります。アドレスが変わると、新しいアドレスには出てきません（あとから戻せません）。'}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  onExport();
                  dismiss();
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-amber-600"
              >
                <span aria-hidden>⬇</span>
                {ko ? '지금 저장하기' : '今すぐ書き出す'}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-[13px] font-medium text-gray-600 hover:bg-gray-50"
              >
                {ko ? '나중에' : 'あとで'}
              </button>
            </div>
            <p className="mt-3 text-[11px] text-gray-500">
              {ko
                ? '※ 「나중에」를 눌러도 화면 위의 띠는 남습니다.'
                : '※「あとで」を押しても、画面上の帯は残ります。'}
            </p>
          </div>
        </div>
      )}

      <div
        role="alert"
        className="shrink-0 border-b border-amber-200 border-l-4 border-l-amber-500 bg-amber-50 px-3 py-2.5 md:px-5"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="min-w-0">
            <p className="text-[12.5px] font-bold text-amber-900">
              {ko
                ? '이 도구는 이사합니다 — 체크를 파일로 저장해 주세요'
                : 'このツールは引っ越します — チェックをファイルに保存してください'}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900/80">
              {ko ? (
                <>
                  {DEADLINE.ko}까지 오른쪽 버튼을 눌러 저장해 주세요. 저장하지 않으면
                  <b> 새 주소에서 지금까지의 체크가 나오지 않습니다</b>(나중에 되돌릴 수 없습니다).
                </>
              ) : (
                <>
                  {DEADLINE.ja}までに、右のボタンで保存をお願いします。保存しないと
                  <b>新しいアドレスでは今までのチェックが出てきません</b>（あとから戻せません）。
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-amber-500 px-3 py-2 text-[12px] font-bold text-white hover:bg-amber-600 md:self-auto"
          >
            <span aria-hidden>⬇</span>
            {ko ? '지금 저장하기' : '今すぐ書き出す'}
          </button>
        </div>
      </div>
    </>
  );
}

export default MoveNotice;
