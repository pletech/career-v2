import type { CareerDataSet, CareerNode } from '../types/career';
import { SHEET_SOURCES } from './sheetSources';
import { csvToObjects, parseCsv } from '../utils/csv';
import { allEdges as fallbackEdges, allNodes as fallbackNodes } from './careerData';

const REQUIRED_HEADERS = ['id', 'titleJa', 'shortLabel'] as const;
const HTML_RESPONSE_RE = /^\s*<(?:!doctype html|html|head|body)\b/i;

class SheetDataError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super([message, ...details].join('\n'));
    this.name = 'SheetDataError';
    this.details = details;
  }
}

function formatIssues(issues: string[], limit = 20): string[] {
  if (issues.length <= limit) return issues;
  const omitted = issues.length - limit;
  return [...issues.slice(0, limit), `…and ${omitted} more issue(s).`];
}

/**
 * Split a cell value into a string list.
 *
 * Supports both:
 * - "a|b|c" (pipe)
 * - multi-line values (Google Sheets cells with line breaks)
 *
 * Also removes common bullet prefixes (・, -, ●, etc.).
 */
function splitList(v: string): string[] {
  const s = (v ?? '').replace(/\r\n/g, '\n').trim();
  if (!s) return [];

  const out: string[] = [];
  const lines = s.split('\n');

  for (const rawLine of lines) {
    const line = (rawLine ?? '').trim();
    if (!line) continue;

    const parts = line.split('|');
    for (let part of parts) {
      part = (part ?? '').trim();
      if (!part) continue;
      part = part.replace(/^[・\-*\u2022●◯□■]+\s*/u, '');
      if (!part) continue;
      out.push(part);
    }
  }

  return out;
}

function withCacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}t=${Date.now()}`;
}

async function fetchSheetCsv(url: string, sheetLabel: string): Promise<string> {
  let response: Response;

  try {
    response = await fetch(withCacheBust(url), { cache: 'no-store' });
  } catch (error) {
    throw new SheetDataError(
      `Failed to fetch ${sheetLabel}. Please check your network and the Google Sheets publish settings.`,
      [error instanceof Error ? error.message : String(error)]
    );
  }

  if (!response.ok) {
    throw new SheetDataError(
      `Failed to fetch ${sheetLabel}. HTTP ${response.status} ${response.statusText}`
    );
  }

  const text = await response.text();

  if (!text.trim()) {
    throw new SheetDataError(`${sheetLabel} returned an empty response.`);
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (HTML_RESPONSE_RE.test(text)) {
    throw new SheetDataError(
      `${sheetLabel} returned HTML instead of CSV. The sheet may not be published correctly.`
    );
  }

  const looksLikeCsv = contentType.includes('csv') || text.includes(',') || text.includes('\n');
  if (!looksLikeCsv) {
    throw new SheetDataError(
      `${sheetLabel} did not look like CSV data. Received content-type: ${contentType || '(unknown)'}`
    );
  }

  return text;
}

function validateRequiredHeaders(
  csvText: string,
  requiredHeaders: readonly string[],
  sheetLabel: string
): Record<string, string>[] {
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    throw new SheetDataError(`${sheetLabel} is empty.`);
  }

  const actualHeaders = rows[0].map((h) => h.trim());
  const missingHeaders = requiredHeaders.filter((header) => !actualHeaders.includes(header));

  if (missingHeaders.length > 0) {
    throw new SheetDataError(
      `${sheetLabel} is missing required column(s): ${missingHeaders.join(', ')}`,
      [`Available columns: ${actualHeaders.join(', ') || '(none)'}`]
    );
  }

  return csvToObjects(csvText);
}

type SheetContentRow = {
  id: string;
  titleJa: string;
  shortLabel: string;
  role: string;
  requiredSkills: string[];
  requiredExperience: string[];
  recommendedCerts: string[];
  toolsEnvironmentsLanguages: string[];
  nextStepConditions: string[];
  tags: string[];
  branchNote?: string;
};

function parseContentRows(rows: Record<string, string>[]): SheetContentRow[] {
  const issues: string[] = [];
  const parsed: SheetContentRow[] = [];
  const seenIds = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const prefix = `Nodes row ${rowNumber}`;

    const hasAnyValue = Object.values(row).some((value) => (value ?? '').trim() !== '');
    if (!hasAnyValue) return;

    const id = (row.id ?? '').trim();
    if (!id) {
      issues.push(`${prefix}: id is required.`);
      return;
    }

    if (seenIds.has(id)) {
      issues.push(`${prefix}: duplicate id "${id}".`);
      return;
    }

    const titleJa = (row.titleJa ?? '').trim();
    const shortLabel = (row.shortLabel ?? '').trim();

    if (!titleJa || !shortLabel) {
      // titleJa または shortLabel が空の行はスキップ（非公開ノードの空行を許容）
      return;
    }

    seenIds.add(id);

    const role = (row.role ?? row.summary ?? '').trim();

    parsed.push({
      id,
      titleJa,
      shortLabel,
      role,
      requiredSkills: splitList(row.requiredSkills),
      requiredExperience: splitList(row.requiredExperience),
      recommendedCerts: splitList(row.recommendedCerts),
      toolsEnvironmentsLanguages: splitList(row.toolsEnvironmentsLanguages),
      nextStepConditions: splitList(row.nextStepConditions),
      tags: splitList(row.tags),
      branchNote: (row.branchNote ?? '').trim() || undefined,
    });
  });

  if (parsed.length === 0) {
    issues.push('Nodes sheet did not contain any valid content rows.');
  }

  if (issues.length > 0) {
    throw new SheetDataError('Nodes sheet validation failed.', formatIssues(issues));
  }

  return parsed;
}

function mergeSheetContentIntoFallback(contentRows: SheetContentRow[]): CareerNode[] {
  const issues: string[] = [];
  const contentById = new Map(contentRows.map((row) => [row.id, row]));
  const fallbackIds = new Set(fallbackNodes.map((node) => node.id));

  // シートに存在するIDがfallbackに無い場合のみエラー（未知のIDはデータ不整合）
  for (const row of contentRows) {
    if (!fallbackIds.has(row.id)) {
      issues.push(`Nodes sheet contains unknown node id "${row.id}".`);
    }
  }

  // fallbackにあるがシートに無い場合はfallbackをそのまま使用（非公開ノードの空行を許容）

  if (issues.length > 0) {
    throw new SheetDataError(
      'Nodes sheet and local node definition are out of sync.',
      formatIssues(issues)
    );
  }

  return fallbackNodes.map((fallbackNode) => {
    const content = contentById.get(fallbackNode.id);
    if (!content) return fallbackNode;

    return {
      ...fallbackNode,
      titleJa: content.titleJa,
      shortLabel: content.shortLabel,
      role: content.role || fallbackNode.role || fallbackNode.summary || '',
      summary: content.role || fallbackNode.summary,
      requiredSkills: content.requiredSkills,
      requiredExperience: content.requiredExperience,
      recommendedCerts: content.recommendedCerts,
      toolsEnvironmentsLanguages: content.toolsEnvironmentsLanguages,
      nextStepConditions: content.nextStepConditions,
      tags: content.tags,
      branchNote: content.branchNote,
    };
  });
}

export async function loadCareerDataFromSheets(): Promise<CareerDataSet> {
  // Nodes sheet currently overrides content only.
  // Structural data (positions, relations, and edges) stays in careerData.ts.
  const nodesCsv = await fetchSheetCsv(SHEET_SOURCES.nodesCsvUrl, 'Nodes sheet');
  const nodeRows = validateRequiredHeaders(nodesCsv, REQUIRED_HEADERS, 'Nodes sheet');
  const contentRows = parseContentRows(nodeRows);
  const mergedNodes = mergeSheetContentIntoFallback(contentRows);

  return {
    nodes: mergedNodes,
    edges: fallbackEdges,
  };
}
