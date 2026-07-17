/**
 * 階段ビュー (v2) データローダー (確定 #24)
 *
 * CSV (ローカルファイル or Google スプレッドシート公開 CSV) を取得し、
 * 検証つきで Role / Dependency / Ability / Evidence へ変換する。
 * 全体マップの loadCareerDataFromSheets.ts と同じ思想:
 * ヘッダー検証・参照整合性検証・日本語のエラーメッセージ。
 *
 * 変換関数 (parse*) は fetch と分離した純粋関数で、単体テスト可能。
 */

import { csvToObjects } from '../utils/csv';
import { WORK_TAG_LABELS } from '../domain/i18n';
import type {
  Ability,
  Atom,
  Category,
  Dependency,
  DepType,
  Evidence,
  EvidenceType,
  GrowthLine,
  Role,
  RoleStatus,
  Tag,
  TrackId,
  Weapon,
  WorkTagId,
} from '../domain/types';
import { LOCAL_SOURCES, SHEET_SOURCES, type LadderSourceUrls } from './ladderSources';

export interface LadderDataSet {
  roles: Role[];
  dependencies: Dependency[];
  abilities: Ability[];
  evidences: Evidence[];
  growthLines: GrowthLine[];
  // v2.7 素材→武器モデル
  tags: Tag[];
  atoms: Atom[];
  weapons: Weapon[];
  // v2.7d カテゴリモデル
  categories: Category[];
}

// ---------------------------------------------------------------------------
// 共通ヘルパー
// ---------------------------------------------------------------------------

class LadderDataError extends Error {}

function requireHeaders(rows: Record<string, string>[], required: string[], file: string): void {
  if (rows.length === 0) throw new LadderDataError(`${file}: データ行がありません。`);
  const keys = Object.keys(rows[0]);
  const missing = required.filter((h) => !keys.includes(h));
  if (missing.length > 0) {
    throw new LadderDataError(`${file}: 必要な列がありません: ${missing.join(', ')}`);
  }
}

function requireValue(row: Record<string, string>, key: string, file: string, id: string): string {
  const v = row[key];
  if (!v) throw new LadderDataError(`${file}: ${id} の「${key}」が空です。`);
  return v;
}

function toNumber(v: string, key: string, file: string, id: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new LadderDataError(`${file}: ${id} の「${key}」が数値ではありません: ${v}`);
  return n;
}

const toBool = (v: string): boolean => v.toLowerCase() === 'true' || v === '1';

const toList = (v: string): string[] =>
  v
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

const opt = (v: string): string | undefined => (v === '' ? undefined : v);

function oneOf<T extends string>(v: string, allowed: readonly T[], key: string, file: string, id: string): T {
  if (!(allowed as readonly string[]).includes(v)) {
    throw new LadderDataError(`${file}: ${id} の「${key}」が不正です: ${v} (許容: ${allowed.join('/')})`);
  }
  return v as T;
}

function requireUnique(ids: string[], file: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new LadderDataError(`${file}: ID が重複しています: ${id}`);
    seen.add(id);
  }
}

// ---------------------------------------------------------------------------
// 変換 (純粋関数)
// ---------------------------------------------------------------------------

const TRACKS: readonly TrackId[] = ['infrastructure', 'development', 'it-support'];
const PATH_TYPES = ['specialist', 'manager', 'common'] as const;
const STATUSES: readonly RoleStatus[] = ['published', 'placeholder', 'hidden'];
const DEP_TYPES: readonly DepType[] = ['role-ladder', 'cross-category', 'checkpoint-prereq'];
const EVIDENCE_TYPES: readonly EvidenceType[] = ['knowledge', 'practice', 'experience'];
const WORK_TAG_IDS = Object.keys(WORK_TAG_LABELS) as WorkTagId[];

export function parseRoles(csvText: string): Role[] {
  const rows = csvToObjects(csvText);
  requireHeaders(rows, ['roleId', 'track', 'category', 'stageOrder', 'pathType', 'titleJa', 'shortLabel', 'status'], 'roles.csv');
  const roles = rows.map((r) => {
    const roleId = requireValue(r, 'roleId', 'roles.csv', r.roleId || '(空)');
    return {
      roleId,
      track: oneOf(r.track, TRACKS, 'track', 'roles.csv', roleId),
      category: requireValue(r, 'category', 'roles.csv', roleId),
      stageOrder: toNumber(r.stageOrder, 'stageOrder', 'roles.csv', roleId),
      pathType: oneOf(r.pathType, PATH_TYPES, 'pathType', 'roles.csv', roleId),
      titleJa: requireValue(r, 'titleJa', 'roles.csv', roleId),
      shortLabel: requireValue(r, 'shortLabel', 'roles.csv', roleId),
      summary: r.summary ?? '',
      status: oneOf(r.status, STATUSES, 'status', 'roles.csv', roleId),
      shortGoal: opt(r.shortGoal ?? ''),
      titleKo: opt(r.titleKo ?? ''),
      shortLabelKo: opt(r.shortLabelKo ?? ''),
      summaryKo: opt(r.summaryKo ?? ''),
      shortGoalKo: opt(r.shortGoalKo ?? ''),
    } satisfies Role;
  });
  requireUnique(roles.map((r) => r.roleId), 'roles.csv');
  return roles;
}

export function parseDependencies(csvText: string): Dependency[] {
  const rows = csvToObjects(csvText);
  requireHeaders(rows, ['dependencyId', 'fromId', 'toId', 'depType'], 'dependencies.csv');
  const deps = rows.map((r) => {
    const dependencyId = requireValue(r, 'dependencyId', 'dependencies.csv', r.dependencyId || '(空)');
    return {
      dependencyId,
      fromId: requireValue(r, 'fromId', 'dependencies.csv', dependencyId),
      toId: requireValue(r, 'toId', 'dependencies.csv', dependencyId),
      depType: oneOf(r.depType, DEP_TYPES, 'depType', 'dependencies.csv', dependencyId),
      gateRule: opt(r.gateRule ?? ''),
      note: opt(r.note ?? ''),
    } satisfies Dependency;
  });
  requireUnique(deps.map((d) => d.dependencyId), 'dependencies.csv');
  return deps;
}

export function parseAbilities(csvText: string): Ability[] {
  const rows = csvToObjects(csvText);
  requireHeaders(rows, ['abilityId', 'roleId', 'statement', 'weight', 'isCommon', 'sortOrder'], 'abilities.csv');
  const abilities = rows.map((r) => {
    const abilityId = requireValue(r, 'abilityId', 'abilities.csv', r.abilityId || '(空)');
    return {
      abilityId,
      roleId: requireValue(r, 'roleId', 'abilities.csv', abilityId),
      statement: requireValue(r, 'statement', 'abilities.csv', abilityId),
      roleStatement: r.roleStatement ?? '',
      toolsReference: toList(r.toolsReference ?? ''),
      weight: toNumber(r.weight, 'weight', 'abilities.csv', abilityId),
      isCommon: toBool(r.isCommon ?? ''),
      commonGroupId: opt(r.commonGroupId ?? ''),
      sortOrder: toNumber(r.sortOrder, 'sortOrder', 'abilities.csv', abilityId),
      // v2.6: 列自体が無いシートも許容する (移行中は「ラインなし」扱い)
      growthLineId: opt(r.growthLineId ?? ''),
      // v2.6e: 次の段階の業務への継承 (パイプ区切り)。列が無ければ空
      growsInto: toList(r.growsInto ?? ''),
      statementKo: opt(r.statementKo ?? ''),
      roleStatementKo: opt(r.roleStatementKo ?? ''),
    } satisfies Ability;
  });
  requireUnique(abilities.map((a) => a.abilityId), 'abilities.csv');
  return abilities;
}

export function parseEvidences(csvText: string): Evidence[] {
  const rows = csvToObjects(csvText);
  requireHeaders(rows, ['evidenceId', 'abilityId', 'statement', 'evidenceType', 'workTags', 'sortOrder'], 'evidences.csv');
  const evidences = rows.map((r) => {
    const evidenceId = requireValue(r, 'evidenceId', 'evidences.csv', r.evidenceId || '(空)');
    const workTags = toList(r.workTags ?? '').map((t) =>
      oneOf(t, WORK_TAG_IDS, 'workTags', 'evidences.csv', evidenceId),
    );
    return {
      evidenceId,
      abilityId: requireValue(r, 'abilityId', 'evidences.csv', evidenceId),
      statement: requireValue(r, 'statement', 'evidences.csv', evidenceId),
      evidenceType: oneOf(r.evidenceType, EVIDENCE_TYPES, 'evidenceType', 'evidences.csv', evidenceId),
      workTags,
      selfCheckTip: opt(r.selfCheckTip ?? ''),
      sortOrder: toNumber(r.sortOrder, 'sortOrder', 'evidences.csv', evidenceId),
      statementKo: opt(r.statementKo ?? ''),
      selfCheckTipKo: opt(r.selfCheckTipKo ?? ''),
    } satisfies Evidence;
  });
  requireUnique(evidences.map((e) => e.evidenceId), 'evidences.csv');
  return evidences;
}

/** growth-lines (v2.6): 業務ロードマップの成長ライン定義 */
export function parseGrowthLines(csvText: string): GrowthLine[] {
  const rows = csvToObjects(csvText);
  requireHeaders(rows, ['lineId', 'labelJa', 'sortOrder'], 'growth-lines.csv');
  const lines = rows.map((r) => {
    const lineId = requireValue(r, 'lineId', 'growth-lines.csv', r.lineId || '(空)');
    return {
      lineId,
      labelJa: requireValue(r, 'labelJa', 'growth-lines.csv', lineId),
      sortOrder: toNumber(r.sortOrder, 'sortOrder', 'growth-lines.csv', lineId),
      labelKo: opt(r.labelKo ?? ''),
    } satisfies GrowthLine;
  });
  requireUnique(lines.map((l) => l.lineId), 'growth-lines.csv');
  return lines;
}

/** tags (v2.7): 業務の区分 */
export function parseTags(csvText: string): Tag[] {
  const rows = csvToObjects(csvText);
  requireHeaders(rows, ['tagId', 'labelJa', 'sortOrder'], 'tags.csv');
  const tags = rows.map((r) => {
    const tagId = requireValue(r, 'tagId', 'tags.csv', r.tagId || '(空)');
    return {
      tagId,
      labelJa: requireValue(r, 'labelJa', 'tags.csv', tagId),
      sortOrder: toNumber(r.sortOrder, 'sortOrder', 'tags.csv', tagId),
      labelKo: opt(r.labelKo ?? ''),
    } satisfies Tag;
  });
  requireUnique(tags.map((t) => t.tagId), 'tags.csv');
  return tags;
}

/** atoms (v2.7d): 原子能力 (素材)。カテゴリに所属 */
export function parseAtoms(csvText: string): Atom[] {
  const rows = csvToObjects(csvText);
  requireHeaders(rows, ['atomId', 'categoryId', 'statement', 'sortOrder'], 'atoms.csv');
  const atoms = rows.map((r) => {
    const atomId = requireValue(r, 'atomId', 'atoms.csv', r.atomId || '(空)');
    return {
      atomId,
      categoryId: requireValue(r, 'categoryId', 'atoms.csv', atomId),
      statement: requireValue(r, 'statement', 'atoms.csv', atomId),
      sortOrder: toNumber(r.sortOrder, 'sortOrder', 'atoms.csv', atomId),
      statementKo: opt(r.statementKo ?? ''),
    } satisfies Atom;
  });
  requireUnique(atoms.map((a) => a.atomId), 'atoms.csv');
  return atoms;
}

/** categories (v2.7d): 段階別カテゴリ + 下位カテゴリ包含 */
export function parseCategories(csvText: string): Category[] {
  const rows = csvToObjects(csvText);
  requireHeaders(rows, ['categoryId', 'stage', 'labelJa', 'sortOrder'], 'categories.csv');
  const categories = rows.map((r) => {
    const categoryId = requireValue(r, 'categoryId', 'categories.csv', r.categoryId || '(空)');
    return {
      categoryId,
      stage: toNumber(r.stage, 'stage', 'categories.csv', categoryId),
      labelJa: requireValue(r, 'labelJa', 'categories.csv', categoryId),
      includes: toList(r.includes ?? ''),
      sortOrder: toNumber(r.sortOrder, 'sortOrder', 'categories.csv', categoryId),
      labelKo: opt(r.labelKo ?? ''),
    } satisfies Category;
  });
  requireUnique(categories.map((c) => c.categoryId), 'categories.csv');
  return categories;
}

/** weapons (v2.7): 上位能力 = 素材の組み合わせ */
export function parseWeapons(csvText: string): Weapon[] {
  const rows = csvToObjects(csvText);
  requireHeaders(rows, ['weaponId', 'roleId', 'tagId', 'statement', 'composedOf', 'sortOrder'], 'weapons.csv');
  const weapons = rows.map((r) => {
    const weaponId = requireValue(r, 'weaponId', 'weapons.csv', r.weaponId || '(空)');
    return {
      weaponId,
      roleId: requireValue(r, 'roleId', 'weapons.csv', weaponId),
      tagId: requireValue(r, 'tagId', 'weapons.csv', weaponId),
      statement: requireValue(r, 'statement', 'weapons.csv', weaponId),
      composedOf: toList(r.composedOf ?? ''),
      sortOrder: toNumber(r.sortOrder, 'sortOrder', 'weapons.csv', weaponId),
      statementKo: opt(r.statementKo ?? ''),
    } satisfies Weapon;
  });
  requireUnique(weapons.map((w) => w.weaponId), 'weapons.csv');
  return weapons;
}

/** 参照整合性の検証 (ability→role, evidence→ability, dependency→role, ability→growthLine) */
export function validateReferences(data: LadderDataSet): void {
  const roleIds = new Set(data.roles.map((r) => r.roleId));
  const abilityIds = new Set(data.abilities.map((a) => a.abilityId));
  const lineIds = new Set(data.growthLines.map((l) => l.lineId));
  for (const a of data.abilities) {
    if (!roleIds.has(a.roleId)) {
      throw new LadderDataError(`abilities.csv: ${a.abilityId} の roleId が roles.csv に存在しません: ${a.roleId}`);
    }
    // growthLineId は空を許容 (「ラインなし」行)。値がある場合のみ検証する (AC-11.2)
    if (a.growthLineId && !lineIds.has(a.growthLineId)) {
      throw new LadderDataError(
        `abilities.csv: ${a.abilityId} の growthLineId が growth-lines.csv に存在しません: ${a.growthLineId}`,
      );
    }
    // growsInto の参照整合性 (v2.6e)
    for (const to of a.growsInto ?? []) {
      if (!abilityIds.has(to)) {
        throw new LadderDataError(
          `abilities.csv: ${a.abilityId} の growsInto が存在しない能力を参照しています: ${to}`,
        );
      }
    }
  }
  for (const e of data.evidences) {
    if (!abilityIds.has(e.abilityId)) {
      throw new LadderDataError(`evidences.csv: ${e.evidenceId} の abilityId が abilities.csv に存在しません: ${e.abilityId}`);
    }
  }
  for (const d of data.dependencies) {
    if (d.depType === 'role-ladder' && (!roleIds.has(d.fromId) || !roleIds.has(d.toId))) {
      throw new LadderDataError(`dependencies.csv: ${d.dependencyId} が参照する roleId が存在しません。`);
    }
  }
  // v2.7d: atom→category, category.includes→category
  const atomIds = new Set(data.atoms.map((a) => a.atomId));
  const categoryIds = new Set(data.categories.map((c) => c.categoryId));
  for (const a of data.atoms) {
    if (!categoryIds.has(a.categoryId)) {
      throw new LadderDataError(
        `atoms.csv: ${a.atomId} の categoryId が categories.csv に存在しません: ${a.categoryId}`,
      );
    }
  }
  for (const c of data.categories) {
    for (const inc of c.includes) {
      if (!categoryIds.has(inc)) {
        throw new LadderDataError(
          `categories.csv: ${c.categoryId} の includes が存在しないカテゴリを参照しています: ${inc}`,
        );
      }
    }
  }
  // weapons (残置・任意): 参照があれば検証
  for (const w of data.weapons) {
    for (const atomId of w.composedOf) {
      if (!atomIds.has(atomId)) {
        throw new LadderDataError(
          `weapons.csv: ${w.weaponId} の composedOf が存在しない素材を参照しています: ${atomId}`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 取得
// ---------------------------------------------------------------------------

async function fetchText(url: string): Promise<string> {
  const bust = url.includes('?') ? `${url}&_ts=${Date.now()}` : `${url}?_ts=${Date.now()}`;
  const res = await fetch(bust, { cache: 'no-store' });
  if (!res.ok) throw new LadderDataError(`データの取得に失敗しました (${res.status}): ${url}`);
  const text = await res.text();
  // 未公開シートはログイン用 HTML を 200 で返すことがある。CSV でなければ弾く。
  if (text.trimStart().startsWith('<')) {
    throw new LadderDataError(`CSVではなくHTMLが返されました（シートが未公開の可能性）: ${url}`);
  }
  return text;
}

async function loadFrom(src: LadderSourceUrls): Promise<LadderDataSet> {
  // growth-lines / tags / atoms / weapons はソースに URL が無ければローカル CSV を読む
  // (シートにタブを作るまでの移行措置 — ladderSources.ts の TODO 参照)
  const or = (url: string, local: string): string => url || local;
  const [
    rolesText,
    depsText,
    abilitiesText,
    evidencesText,
    growthLinesText,
    tagsText,
    atomsText,
    weaponsText,
    categoriesText,
  ] = await Promise.all([
    fetchText(src.rolesCsvUrl),
    fetchText(src.dependenciesCsvUrl),
    fetchText(src.abilitiesCsvUrl),
    fetchText(src.evidencesCsvUrl),
    fetchText(or(src.growthLinesCsvUrl, LOCAL_SOURCES.growthLinesCsvUrl)),
    fetchText(or(src.tagsCsvUrl, LOCAL_SOURCES.tagsCsvUrl)),
    fetchText(or(src.atomsCsvUrl, LOCAL_SOURCES.atomsCsvUrl)),
    fetchText(or(src.weaponsCsvUrl, LOCAL_SOURCES.weaponsCsvUrl)),
    fetchText(or(src.categoriesCsvUrl, LOCAL_SOURCES.categoriesCsvUrl)),
  ]);
  const data: LadderDataSet = {
    roles: parseRoles(rolesText),
    dependencies: parseDependencies(depsText),
    abilities: parseAbilities(abilitiesText),
    evidences: parseEvidences(evidencesText),
    growthLines: parseGrowthLines(growthLinesText),
    tags: parseTags(tagsText),
    atoms: parseAtoms(atomsText),
    weapons: parseWeapons(weaponsText),
    categories: parseCategories(categoriesText),
  };
  validateReferences(data);
  return data;
}

/**
 * Google スプレッドシートを優先し、取得・検証に失敗したら
 * 同梱のローカル CSV へフォールバックする。
 * どちらのソースを使ったかを source で返す。
 */
export async function loadLadderData(): Promise<LadderDataSet & { source: 'sheet' | 'local' }> {
  try {
    const data = await loadFrom(SHEET_SOURCES);
    return { ...data, source: 'sheet' };
  } catch (sheetErr) {
    if (import.meta.env.DEV) {
      console.info('[ladder] シート取得に失敗したためローカルCSVを使用します:', sheetErr);
    }
    const data = await loadFrom(LOCAL_SOURCES);
    return { ...data, source: 'local' };
  }
}
