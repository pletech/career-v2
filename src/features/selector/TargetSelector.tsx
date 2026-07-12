import React from 'react';
import { KO_UI_ENABLED, STRINGS, loc, type Lang } from '../../domain/i18n';
import type { Role } from '../../domain/types';

/**
 * 左ペイン: 区分・分類・目標役割の選択 (v2.3)
 *
 * MVP では インフラ > サーバー のみ選択可能。
 * 他の区分・分類は横展開順序 (ネットワーク → ITサポート → 開発) に備えて
 * 「準備中」として構造だけ見せる (確定 #2)。
 * 役割ボタンは1行表示 (折り返さない — 確定 #22)。
 * 表示言語トグル (日本語/한국어) を上部に置く (確定 #21)。
 */

interface Option {
  key: string;
  labelJa: string;
  labelKo: string;
  available: boolean;
}

const TRACK_OPTIONS: Option[] = [
  { key: 'infrastructure', labelJa: 'インフラ', labelKo: '인프라', available: true },
  { key: 'development', labelJa: '開発', labelKo: '개발', available: false },
  { key: 'it-support', labelJa: 'ITサポート', labelKo: 'IT지원', available: false },
];

const CATEGORY_OPTIONS: Option[] = [
  { key: 'サーバー', labelJa: 'サーバー', labelKo: '서버', available: true },
  { key: 'ネットワーク', labelJa: 'ネットワーク', labelKo: '네트워크', available: false },
];

interface TargetSelectorProps {
  roles: Role[];
  targetRoleId: string;
  lang: Lang;
  onTargetChange: (roleId: string) => void;
  onLangChange: (lang: Lang) => void;
}

const sectionTitle = 'text-[11px] font-semibold text-gray-500 tracking-wide';

const optionButtonClass = (active: boolean, available: boolean) =>
  [
    'flex w-full items-center gap-1.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
    active
      ? 'border-cyan-500 bg-cyan-50 font-semibold text-cyan-800'
      : available
        ? 'border-gray-200 bg-white text-gray-700 hover:border-cyan-300 hover:bg-cyan-50/50'
        : 'cursor-not-allowed border-dashed border-gray-200 bg-gray-50 text-gray-400',
  ].join(' ');

const TargetSelector: React.FC<TargetSelectorProps> = ({
  roles,
  targetRoleId,
  lang,
  onTargetChange,
  onLangChange,
}) => {
  const s = STRINGS[lang];
  const sortedRoles = [...roles].sort((a, b) => b.stageOrder - a.stageOrder);

  const preparingBadge = (
    <span className="ml-auto shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-500 whitespace-nowrap">
      {s.preparing}
    </span>
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      {KO_UI_ENABLED && (
        <div>
          <p className={sectionTitle}>{s.langLabel}</p>
          <div className="mt-2 inline-flex w-full rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['ja', 'ko'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => onLangChange(l)}
                className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  lang === l ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-500'
                }`}
              >
                {l === 'ja' ? '日本語' : '한국어'}
              </button>
            ))}
          </div>
          {lang === 'ko' && (
            <p className="mt-1 text-[10px] leading-relaxed text-gray-400">
              한국어 표시는 작업용입니다. 공유 시에는 日本語로 전환하세요.
            </p>
          )}
        </div>
      )}

      <div>
        <p className={sectionTitle}>{s.kubun}</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {TRACK_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              disabled={!opt.available}
              className={optionButtonClass(opt.key === 'infrastructure', opt.available)}
            >
              <span className="truncate">{lang === 'ko' ? opt.labelKo : opt.labelJa}</span>
              {!opt.available && preparingBadge}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={sectionTitle}>{s.bunrui}</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              disabled={!opt.available}
              className={optionButtonClass(opt.key === 'サーバー', opt.available)}
            >
              <span className="truncate">{lang === 'ko' ? opt.labelKo : opt.labelJa}</span>
              {!opt.available && preparingBadge}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={sectionTitle}>{s.targetRole}</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {sortedRoles.map((role) => {
            const isPlaceholder = role.status === 'placeholder';
            const active = role.roleId === targetRoleId;
            return (
              <button
                key={role.roleId}
                type="button"
                onClick={() => onTargetChange(role.roleId)}
                className={optionButtonClass(active, true)}
                title={loc(lang, role.titleJa, role.titleKo)}
              >
                <span className="shrink-0 text-[10px] font-semibold text-gray-400 whitespace-nowrap">
                  {s.stagePrefix}
                  {role.stageOrder}
                </span>
                <span className="min-w-0 truncate">
                  {loc(lang, role.shortLabel, role.shortLabelKo)}
                </span>
                {isPlaceholder && (
                  <span className="ml-auto shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 whitespace-nowrap">
                    {s.preparing}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-gray-400">{s.preparingNote}</p>
      </div>
    </div>
  );
};

export default TargetSelector;
