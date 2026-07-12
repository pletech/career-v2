import React from 'react';
import type { CareerNode } from '../types/career';
import {
  TRACK_LABELS,
  STAGE_LABELS,
  PATH_TYPE_LABELS,
  type Stage,
} from '../types/career';

interface DetailPanelProps {
  node: CareerNode | null;
  isLocked?: boolean;
  onNodeClick: (nodeId: string) => void;
  getNodeById: (nodeId: string) => CareerNode | undefined;
}

interface ParsedGroup {
  title: string;
  items: string[];
}

interface ParsedSection {
  title: string; // can be empty for fallback section
  items: string[];
  groups: ParsedGroup[];
}

interface ParsedStructuredText {
  sections: ParsedSection[];
}

const SECTION_MARKER_RE = /^[【〖](.+)[】〗]$/; // 【...】 or 〖...〗
const SUBHEADER_RE = /^[A-Z]\.\s+/;            // A. / B. / C. ...
// NOTE: "※" は消さない（原文表示したい）ので prefix から除外
const BULLET_PREFIX_RE = /^[\s・●•▪◦◉◆◇*\-－ー]+/;

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
  accentClass?: string;
}> = ({ title, children, accentClass = 'bg-gray-300' }) => (
  <div className="mb-5">
    <div className="flex items-center gap-2 mb-2">
      <span className={`inline-block w-1.5 h-4 rounded-full ${accentClass}`} />
      <h4 className="text-sm font-bold text-gray-800 tracking-wide">{title}</h4>
    </div>
    <div className="bg-white/60 rounded-lg border border-gray-100 p-3">
      {children}
    </div>
  </div>
);

/** Bullet list (for normal sentences) */
const BulletList: React.FC<{ items: string[] }> = ({ items }) => {
  if (!items.length) return <span className="text-xs text-gray-300">-</span>;
  return (
    <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed">{item}</li>
      ))}
    </ul>
  );
};

/** Subsection list: distinct visual from bullets */
const SubsectionList: React.FC<{ items: string[] }> = ({ items }) => {
  if (!items.length) return <span className="text-xs text-gray-300">-</span>;
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div
          key={i}
          className="text-xs text-gray-700 leading-relaxed pl-3 border-l-2 border-gray-200 bg-gray-50/50 rounded-sm py-1 pr-2"
        >
          {item}
        </div>
      ))}
    </div>
  );
};

function normalizeLine(line: string): string {
  return line.replace(BULLET_PREFIX_RE, '').trim();
}

function preprocessText(text: string, stripLeadingHeadings?: string[]): string {
  const rawLines = (text ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim());

  while (rawLines.length && !rawLines[0]) rawLines.shift();

  if (stripLeadingHeadings?.length && rawLines.length) {
    while (rawLines.length && stripLeadingHeadings.includes(rawLines[0])) {
      rawLines.shift();
      while (rawLines.length && !rawLines[0]) rawLines.shift();
    }
  }

  return rawLines.join('\n');
}

function parseStructuredText(
  text: string,
  options?: { stripLeadingHeadings?: string[] }
): ParsedStructuredText | null {
  const preprocessed = preprocessText(text, options?.stripLeadingHeadings);

  const lines = preprocessed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  let currentSection: ParsedSection | null = null;
  let currentGroup: ParsedGroup | null = null;
  const sections: ParsedSection[] = [];
  let hasMarkerOrSubheader = false;

  const ensureSection = (): ParsedSection => {
    if (currentSection) return currentSection;
    const fallbackSection: ParsedSection = { title: '', items: [], groups: [] };
    sections.push(fallbackSection);
    currentSection = fallbackSection;
    return fallbackSection;
  };

  for (const rawLine of lines) {
    const candidate = normalizeLine(rawLine);

    const markerMatch = candidate.match(SECTION_MARKER_RE);
    if (markerMatch) {
      hasMarkerOrSubheader = true;
      const section: ParsedSection = {
        title: markerMatch[1].trim(),
        items: [],
        groups: [],
      };
      sections.push(section);
      currentSection = section;
      currentGroup = null;
      continue;
    }

    if (SUBHEADER_RE.test(candidate)) {
      hasMarkerOrSubheader = true;
      const section = ensureSection();
      const group: ParsedGroup = {
        title: candidate,
        items: [],
      };
      section.groups.push(group);
      currentGroup = group;
      continue;
    }

    if (!candidate) continue;

    if (currentGroup) {
      currentGroup.items.push(candidate);
    } else {
      ensureSection().items.push(candidate);
    }
  }

  if (!hasMarkerOrSubheader) return null;
  return { sections };
}

/** “ソタイトル(セクション見出し)”として目立たせたいタイトル */
const EMPHASIZE_SUBTITLE_EXACT = new Set([
  '役割',
  '共通業務',
  '分野別業務',
  '対応ドメイン例',
  '開発分野の対象範囲',

  '共通必須',
  '尚可',

  '共通推奨',
  '分野別推奨',
]);

function isEmphasizedSubtitle(title: string): boolean {
  if (!title) return false;
  if (EMPHASIZE_SUBTITLE_EXACT.has(title)) return true;
  if (title.startsWith('選択必須（4領域中')) return true;
  if (title.startsWith('分野別推奨')) return true;
  return false;
}

/** ✅ A/B/C/D 그룹은 접어서 볼 수 있게(아코디언) */
function isCollapsibleGroupSection(title: string): boolean {
  if (!title) return false;
  if (title === '分野別業務') return true;
  if (title.startsWith('選択必須（4領域中')) return true;
  if (title.startsWith('分野別推奨')) return true;
  return false;
}

const CollapsibleGroup: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = false }) => (
  <details className="group" open={defaultOpen}>
    <summary
      className={[
        'cursor-pointer select-none',
        'inline-flex items-center gap-2',
        'text-xs font-semibold text-gray-700',
        'bg-gray-50 border border-gray-100 rounded px-2 py-1',
        'list-none [&::-webkit-details-marker]:hidden',
      ].join(' ')}
    >
      <span className="inline-block text-gray-400 transition-transform group-open:rotate-90">▸</span>
      {title}
    </summary>
    <div className="mt-2 pl-1">
      {children}
    </div>
  </details>
);

const StructuredContent: React.FC<{
  parsed: ParsedStructuredText;
  itemMode?: 'default' | 'plain-bullets';
}> = ({ parsed, itemMode = 'default' }) => {
  return (
    <div className="space-y-3">
      {parsed.sections.map((section, sectionIndex) => {
        const emphasize = itemMode !== 'plain-bullets' && isEmphasizedSubtitle(section.title);
        const collapsibleGroups = isCollapsibleGroupSection(section.title);

        const renderItems = (items: string[]) => {
          if (!items.length) return <span className="text-xs text-gray-300">-</span>;
          if (emphasize) return <SubsectionList items={items} />;
          return <BulletList items={items} />;
        };

        return (
          <div key={`${section.title || 'section'}-${sectionIndex}`} className="space-y-2">
            {section.title && (
              <h5 className="text-xs font-bold text-gray-700 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400" />
                {section.title}
              </h5>
            )}

            {section.items.length > 0 && renderItems(section.items)}

            {section.groups.map((group, groupIndex) => {
              const body = renderItems(group.items);

              if (collapsibleGroups) {
                return (
                  <div key={`${group.title}-${groupIndex}`} className="space-y-1.5">
                    <CollapsibleGroup title={group.title} defaultOpen={false}>
                      {body}
                    </CollapsibleGroup>
                  </div>
                );
              }

              return (
                <div key={`${group.title}-${groupIndex}`} className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-100 rounded px-2 py-1">
                    {group.title}
                  </div>
                  <div className="pl-1">{body}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const DetailPanel: React.FC<DetailPanelProps> = ({ node, isLocked = false }) => {
  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="text-4xl mb-4 opacity-30">🎯</div>
        <h3 className="text-lg font-semibold text-gray-400 mb-2">ノードを選択してください</h3>
        <p className="text-xs text-gray-300 leading-relaxed max-w-[240px]">
          左のキャリアマップからノードをクリックすると、
          役職の詳細情報がここに表示されます。
        </p>
        <div className="mt-6 text-xs text-gray-200 space-y-1">
          <p>💡 マウスホイールでズーム</p>
          <p>💡 ドラッグで移動</p>
          <p>💡 タブで軸を切り替え</p>
        </div>
      </div>
    );
  }

  // ロック状態パネル（5〜6段階）
  if (isLocked) {
    const trackColorClass =
      {
        development: 'bg-blue-500',
        infrastructure: 'bg-cyan-500',
        'it-support': 'bg-violet-500',
      }[node.track];

    const trackBadgeClass =
      {
        development: 'bg-blue-100 text-blue-700',
        infrastructure: 'bg-cyan-100 text-cyan-700',
        'it-support': 'bg-violet-100 text-violet-700',
      }[node.track];

    return (
      <div className="h-full overflow-y-auto p-5 bg-gradient-to-b from-white to-gray-50">
        <div className={`${trackColorClass} h-1.5 rounded-full mb-4 opacity-30`} />

        <h2 className="text-lg font-bold text-gray-400 leading-snug mb-2">
          {node.titleJa}
        </h2>

        <div className="flex flex-wrap gap-1.5 mb-6">
          <span className={`text-xs font-medium px-2 py-0.5 rounded opacity-50 ${trackBadgeClass}`}>
            {TRACK_LABELS[node.track]}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-400 opacity-50">
            {STAGE_LABELS[node.stage as Stage]}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center text-center py-10 px-4">
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="text-sm font-semibold text-gray-500 mb-2">
            上位段階は追って公開予定です
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed max-w-[220px]">
            現在は1〜4段階を中心に公開しています。
            5段階以上の詳細は順次公開予定です。
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-[10px] text-gray-300">Node ID: {node.id}</p>
        </div>
      </div>
    );
  }

  const roleText = node.role ?? node.summary ?? '';
  const roleStructured = parseStructuredText(roleText, { stripLeadingHeadings: ['概要', '役割'] });
  const skillsStructured = parseStructuredText(node.requiredSkills.join('\n'), { stripLeadingHeadings: ['必要スキル'] });
  const experienceStructured = parseStructuredText(node.requiredExperience.join('\n'), { stripLeadingHeadings: ['必要経験'] });

  const trackColorClass =
    {
      development: 'bg-blue-500',
      infrastructure: 'bg-cyan-500',
      'it-support': 'bg-violet-500',
    }[node.track];

  const trackBadgeClass =
    {
      development: 'bg-blue-100 text-blue-700',
      infrastructure: 'bg-cyan-100 text-cyan-700',
      'it-support': 'bg-violet-100 text-violet-700',
    }[node.track];

  const pathBadgeClass =
    {
      specialist: 'bg-sky-100 text-sky-700',
      manager: 'bg-amber-100 text-amber-700',
      common: 'bg-gray-100 text-gray-600',
    }[node.pathType];

  const accent = {
    role: 'bg-gray-400',
    skill: trackColorClass,
    exp: 'bg-gray-400',
  };

  return (
    <div className="h-full overflow-y-auto p-5 bg-gradient-to-b from-white to-gray-50">
      <div className={`${trackColorClass} h-1.5 rounded-full mb-4`} />

      <h2 className="text-lg font-bold text-gray-800 leading-snug mb-2">
        {node.titleJa}
      </h2>

      <div className="flex flex-wrap gap-1.5 mb-5">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${trackBadgeClass}`}>
          {TRACK_LABELS[node.track]}
        </span>
        <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600">
          {STAGE_LABELS[node.stage as Stage]}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${pathBadgeClass}`}>
          {PATH_TYPE_LABELS[node.pathType]}
        </span>
        {node.subtrack && (
          <span className="text-xs font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-600">
            {node.subtrack}
          </span>
        )}
      </div>

      <Section title="役割" accentClass={accent.role}>
        {roleStructured ? (
          <StructuredContent parsed={roleStructured} />
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{roleText}</p>
        )}
      </Section>

      <Section title="スキル" accentClass={accent.skill}>
        {skillsStructured ? (
          <StructuredContent parsed={skillsStructured} itemMode="plain-bullets" />
        ) : (
          <BulletList items={node.requiredSkills} />
        )}
      </Section>

      <Section title="経験" accentClass={accent.exp}>
        {experienceStructured ? (
          <StructuredContent parsed={experienceStructured} />
        ) : (
          <BulletList items={node.requiredExperience} />
        )}
      </Section>

      {/*
        1차 공개판에서는 役割 / スキル / 経験만 핵심 섹션으로 노출한다.
        아래 섹션들은 제거하지 않고 비활성화만 유지한다.

      <Section title="資格" accentClass="bg-emerald-400">...</Section>
      <Section title="ツール・環境・言語" accentClass="bg-slate-400">...</Section>
      <Section title="次の段階に上がる条件" accentClass="bg-amber-400">...</Section>
      <Section title="タグ" accentClass="bg-gray-400">...</Section>
      <Section title="兼任/分岐メモ" accentClass="bg-amber-400">...</Section>
      <Section title="兼任可能な役職" accentClass="bg-amber-400">...</Section>
      <Section title="関連ノード" accentClass="bg-slate-400">...</Section>
      */}

      <div className="mt-6 pt-3 border-t border-gray-100">
        <p className="text-[10px] text-gray-300">Node ID: {node.id}</p>
      </div>
    </div>
  );
};

export default DetailPanel;
