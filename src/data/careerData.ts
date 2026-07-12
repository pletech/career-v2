import type { CareerNode, CareerEdge, CareerDataSet, Track } from '../types/career';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const STAGE_Y_GAP = 150;
const BASE_Y = 50;
const stageY = (stage: number) => BASE_Y + (6 - stage) * STAGE_Y_GAP;

const STAGES = [1, 2, 3, 4, 5, 6] as const;

const DEFAULT_NODE_WIDTH = 200;
const COMMON_NODE_WIDTH = 200;  // 全ノード同幅
/** 全ノード同幅のためオフセット不要 */
const COMMON_X_OFFSET = Math.round((DEFAULT_NODE_WIDTH - COMMON_NODE_WIDTH) / 2); // = 0

// Development
const DEV_WEB_SP_X = 60;
const DEV_WEB_MG_X = 280;  // Manager は非公開。構造として保持。
/** Common ノードの左端を Specialist と揃える（同幅なので中心も一致） */
const DEV_WEB_COMMON_X = DEV_WEB_SP_X + COMMON_X_OFFSET;

const DEV_MOBILE_SP_X = 480;
const DEV_MOBILE_MG_X = 700;  // Manager は非公開。構造として保持。
const DEV_MOBILE_COMMON_X = DEV_MOBILE_SP_X + COMMON_X_OFFSET;

// Infrastructure
const INFRA_SERVER_SP_X = 40;
const INFRA_SERVER_MG_X = 260;  // Manager は非公開。構造として保持。
const INFRA_SERVER_COMMON_X = INFRA_SERVER_SP_X + COMMON_X_OFFSET;

const INFRA_NETWORK_SP_X = 460;
const INFRA_NETWORK_MG_X = 680;  // Manager は非公開。構造として保持。
const INFRA_NETWORK_COMMON_X = INFRA_NETWORK_SP_X + COMMON_X_OFFSET;

// IT Support
const ITS_IT_X = 100;
const ITS_JOSIS_X = 600;
const ITS_PMO_X = 350;

// ---------------------------------------------------------------------------
// Placeholder content
// NOTE:
// - Structure / position / edges are defined here.
// - Actual visible content is overwritten from Google Sheets by node id.
// ---------------------------------------------------------------------------

const SHEET_OVERRIDE_NOTE = '※実際の内容は Google Sheets の Nodes シートで上書きされます。';

type StageMeta = {
  titleJa: string;
  shortLabel: string;
};

const DEV_COMMON_META: StageMeta = {
  titleJa: 'プログラム改修／テスト',
  shortLabel: 'プログラム改修・テスト',
};

const DEV_SP_META: Record<number, StageMeta> = {
  2: { titleJa: 'PG（プログラミング）', shortLabel: 'PG' },
  3: { titleJa: 'SE（詳細設計）', shortLabel: 'SE（詳細設計）' },
  4: { titleJa: 'SE（基本設計）', shortLabel: 'SE（基本設計）' },
  5: { titleJa: 'SE（要件定義）', shortLabel: 'SE（要件定義）' },
  6: { titleJa: 'TL（技術責任）', shortLabel: 'TL（技術責任）' },
};

const DEV_MG_META: Record<number, StageMeta> = {
  2: { titleJa: 'サブリーダー', shortLabel: 'サブリーダー' },
  3: { titleJa: 'リーダー', shortLabel: 'リーダー' },
  4: { titleJa: 'サブPL', shortLabel: 'サブPL' },
  5: { titleJa: 'PL／サブPM', shortLabel: 'PL／サブPM' },
  6: { titleJa: 'PM', shortLabel: 'PM' },
};

const INFRA_COMMON_META: StageMeta = {
  titleJa: '運用監視補助・ヘルプデスク',
  shortLabel: '運用監視補助・ヘルプデスク',
};

const INFRA_SP_META: Record<number, StageMeta> = {
  2: { titleJa: '運用監視', shortLabel: '運用監視' },
  3: { titleJa: '運用保守', shortLabel: '運用保守' },
  4: { titleJa: '構築・設定', shortLabel: '構築・設定' },
  5: { titleJa: 'システム設計', shortLabel: 'システム設計' },
  6: { titleJa: 'TL（技術責任）', shortLabel: 'TL（技術責任）' },
};

const INFRA_MG_META: Record<number, StageMeta> = {
  2: { titleJa: 'サブリーダー', shortLabel: 'サブリーダー' },
  3: { titleJa: 'リーダー', shortLabel: 'リーダー' },
  4: { titleJa: 'サブPM', shortLabel: 'サブPM' },
  5: { titleJa: 'PM', shortLabel: 'PM' },
  6: { titleJa: 'PM／インフラマネージャ', shortLabel: 'PM／インフラMgr' },
};

const ITS_IT_META: Record<number, StageMeta> = {
  1: { titleJa: 'キッティング・ヘルプデスク（オペレーター）', shortLabel: 'キッティング／HD' },
  2: { titleJa: 'ジュニアオペレーター', shortLabel: 'Jr.オペレーター' },
  3: { titleJa: 'サブリーダー', shortLabel: 'サブリーダー' },
  4: { titleJa: 'リーダー', shortLabel: 'リーダー' },
  5: { titleJa: 'SV（スーパーバイザー）', shortLabel: 'SV' },
  6: { titleJa: 'センター長／マネージャー', shortLabel: 'センター長' },
};

const ITS_JOSIS_META: Record<number, StageMeta> = {
  1: { titleJa: '情シス補助（アシスタント）', shortLabel: '情シス補助' },
  2: { titleJa: '社内SE／情シスサポート', shortLabel: '情シスサポート' },
  3: { titleJa: '社内SE／情シス要員', shortLabel: '情シス要員' },
  4: { titleJa: '情シス担当／IT担当', shortLabel: '情シス担当' },
  5: { titleJa: '情シスリーダー', shortLabel: '情シスリーダー' },
  6: { titleJa: '情シスマネージャ', shortLabel: '情シスMgr' },
};

const ITS_PMO_META: Record<number, StageMeta> = {
  1: { titleJa: 'PMO事務', shortLabel: 'PMO事務' },
  2: { titleJa: 'PMO補佐', shortLabel: 'PMO補佐' },
  3: { titleJa: 'PMOアシスタント', shortLabel: 'PMOアシスタント' },
  4: { titleJa: 'PMO担当', shortLabel: 'PMO担当' },
  5: { titleJa: 'PMOリーダー', shortLabel: 'PMOリーダー' },
  6: { titleJa: 'PMOマネージャ', shortLabel: 'PMO Mgr' },
};

// ---------------------------------------------------------------------------
// Node builders
// ---------------------------------------------------------------------------

function createNode(args: {
  id: string;
  track: Track;
  subtrack: string;
  stage: (typeof STAGES)[number];
  pathType: 'specialist' | 'manager' | 'common';
  x: number;
  meta: StageMeta;
  relatedNodeIds?: string[];
  branchNote?: string;
}): CareerNode {
  return {
    id: args.id,
    track: args.track,
    subtrack: args.subtrack,
    stage: args.stage,
    pathType: args.pathType,
    titleJa: args.meta.titleJa,
    shortLabel: args.meta.shortLabel,
    role: SHEET_OVERRIDE_NOTE,
    summary: SHEET_OVERRIDE_NOTE,
    requiredSkills: [],
    requiredExperience: [],
    recommendedCerts: [],
    toolsEnvironmentsLanguages: [],
    nextStepConditions: [],
    tags: [],
    relatedNodeIds: args.relatedNodeIds,
    branchNote: args.branchNote,
    position: { x: args.x, y: stageY(args.stage) },
  };
}

function buildDualPathTrack(args: {
  track: Track;
  subtrack: string;
  idPrefix: string;
  specialistX: number;
  managerX: number;
  commonX: number;
  commonMeta: StageMeta;
  specialistMeta: Record<number, StageMeta>;
  managerMeta: Record<number, StageMeta>;
}): CareerNode[] {
  const nodes: CareerNode[] = [];

  nodes.push(
    createNode({
      id: `${args.idPrefix}-common-1`,
      track: args.track,
      subtrack: args.subtrack,
      stage: 1,
      pathType: 'common',
      x: args.commonX,
      meta: args.commonMeta,
    })
  );

  for (const stage of [2, 3, 4, 5, 6] as const) {
    nodes.push(
      createNode({
        id: `${args.idPrefix}-sp-${stage}`,
        track: args.track,
        subtrack: args.subtrack,
        stage,
        pathType: 'specialist',
        x: args.specialistX,
        meta: args.specialistMeta[stage],
      })
    );

    nodes.push(
      createNode({
        id: `${args.idPrefix}-mg-${stage}`,
        track: args.track,
        subtrack: args.subtrack,
        stage,
        pathType: 'manager',
        x: args.managerX,
        meta: args.managerMeta[stage],
      })
    );
  }

  return nodes;
}

function buildSingleLaneTrack(args: {
  track: Track;
  subtrack: string;
  idPrefix: string;
  x: number;
  meta: Record<number, StageMeta>;
  pathType?: 'specialist' | 'manager' | 'common';
}): CareerNode[] {
  const nodes: CareerNode[] = [];

  for (const stage of STAGES) {
    const relatedNodeIds =
      args.idPrefix === 'its-helpdesk-mg' && stage === 1
        ? ['infra-server-common-1', 'infra-network-common-1']
        : args.idPrefix === 'its-admin-mg' && stage === 1
          ? ['its-helpdesk-mg-1']
          : undefined;

    nodes.push(
      createNode({
        id: `${args.idPrefix}-${stage}`,
        track: args.track,
        subtrack: args.subtrack,
        stage,
        pathType: args.pathType ?? 'manager',
        x: args.x,
        meta: args.meta[stage],
        relatedNodeIds,
      })
    );
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

const developmentNodes: CareerNode[] = [
  ...buildDualPathTrack({
    track: 'development',
    subtrack: 'Webアプリケーション',
    idPrefix: 'dev-web',
    specialistX: DEV_WEB_SP_X,
    managerX: DEV_WEB_MG_X,
    commonX: DEV_WEB_COMMON_X,
    commonMeta: DEV_COMMON_META,
    specialistMeta: DEV_SP_META,
    managerMeta: DEV_MG_META,
  }),
  ...buildDualPathTrack({
    track: 'development',
    subtrack: 'モバイルアプリ',
    idPrefix: 'dev-mobile',
    specialistX: DEV_MOBILE_SP_X,
    managerX: DEV_MOBILE_MG_X,
    commonX: DEV_MOBILE_COMMON_X,
    commonMeta: DEV_COMMON_META,
    specialistMeta: DEV_SP_META,
    managerMeta: DEV_MG_META,
  }),
];

const infrastructureNodes: CareerNode[] = [
  ...buildDualPathTrack({
    track: 'infrastructure',
    subtrack: 'サーバー',
    idPrefix: 'infra-server',
    specialistX: INFRA_SERVER_SP_X,
    managerX: INFRA_SERVER_MG_X,
    commonX: INFRA_SERVER_COMMON_X,
    commonMeta: INFRA_COMMON_META,
    specialistMeta: INFRA_SP_META,
    managerMeta: INFRA_MG_META,
  }),
  ...buildDualPathTrack({
    track: 'infrastructure',
    subtrack: 'ネットワーク',
    idPrefix: 'infra-network',
    specialistX: INFRA_NETWORK_SP_X,
    managerX: INFRA_NETWORK_MG_X,
    commonX: INFRA_NETWORK_COMMON_X,
    commonMeta: INFRA_COMMON_META,
    specialistMeta: INFRA_SP_META,
    managerMeta: INFRA_MG_META,
  }),
];

const itSupportNodes: CareerNode[] = [
  ...buildSingleLaneTrack({
    track: 'it-support',
    subtrack: 'ヘルプデスク系',
    idPrefix: 'its-helpdesk-mg',
    x: ITS_IT_X,
    meta: ITS_IT_META,
    pathType: 'manager',
  }),
  ...buildSingleLaneTrack({
    track: 'it-support',
    subtrack: '事務系',
    idPrefix: 'its-admin-mg',
    x: ITS_JOSIS_X,
    meta: ITS_JOSIS_META,
    pathType: 'manager',
  }),
  ...buildSingleLaneTrack({
    track: 'it-support',
    subtrack: 'PMO支援',
    idPrefix: 'its-pmo-cm',
    x: ITS_PMO_X,
    meta: ITS_PMO_META,
    pathType: 'manager',
  }),
];

export const allNodes: CareerNode[] = [
  ...developmentNodes,
  ...infrastructureNodes,
  ...itSupportNodes,
];

// ---------------------------------------------------------------------------
// Edge builders
// ---------------------------------------------------------------------------

function buildDualPathProgressionEdges(prefix: string): CareerEdge[] {
  const edges: CareerEdge[] = [
    { source: `${prefix}-common-1`, target: `${prefix}-sp-2`, type: 'normal' },
    { source: `${prefix}-common-1`, target: `${prefix}-mg-2`, type: 'normal' },
  ];

  for (let stage = 2; stage < 6; stage += 1) {
    edges.push(
      {
        source: `${prefix}-sp-${stage}`,
        target: `${prefix}-sp-${stage + 1}`,
        type: 'normal',
      },
      {
        source: `${prefix}-mg-${stage}`,
        target: `${prefix}-mg-${stage + 1}`,
        type: 'normal',
      }
    );
  }

  return edges;
}

function buildSingleLaneProgressionEdges(prefix: string): CareerEdge[] {
  const edges: CareerEdge[] = [];

  for (let stage = 1; stage < 6; stage += 1) {
    edges.push({
      source: `${prefix}-${stage}`,
      target: `${prefix}-${stage + 1}`,
      type: 'normal',
    });
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Raw progression edges
// ---------------------------------------------------------------------------

const rawAllEdges: CareerEdge[] = [
  ...buildDualPathProgressionEdges('dev-web'),
  ...buildDualPathProgressionEdges('dev-mobile'),
  ...buildDualPathProgressionEdges('infra-server'),
  ...buildDualPathProgressionEdges('infra-network'),
  ...buildSingleLaneProgressionEdges('its-helpdesk-mg'),
  ...buildSingleLaneProgressionEdges('its-admin-mg'),
  ...buildSingleLaneProgressionEdges('its-pmo-cm'),
];

// ---------------------------------------------------------------------------
// Auto-generate coexistence edges for same stage in same subtrack
// ---------------------------------------------------------------------------

const coexistenceEdges: CareerEdge[] = [];
const byTrackStageSubtrack = new Map<string, { specialistId?: string; managerId?: string }>();

allNodes.forEach((node) => {
  if (!node.subtrack) return;
  const key = `${node.track}::${node.subtrack}::${node.stage}`;
  const bucket = byTrackStageSubtrack.get(key) ?? {};

  if (node.pathType === 'specialist') bucket.specialistId = node.id;
  if (node.pathType === 'manager') bucket.managerId = node.id;

  byTrackStageSubtrack.set(key, bucket);
});

byTrackStageSubtrack.forEach((bucket) => {
  if (!bucket.specialistId || !bucket.managerId) return;
  coexistenceEdges.push({
    source: bucket.specialistId,
    target: bucket.managerId,
    type: 'optional',
    label: '兼任可',
  });
});

export const allEdges: CareerEdge[] = [
  ...rawAllEdges,
  ...coexistenceEdges,
];

export const fullDataSet: CareerDataSet = {
  nodes: allNodes,
  edges: allEdges,
};

export function getNodesByTrack(track: Track): CareerNode[] {
  return allNodes.filter((n) => n.track === track);
}

export function getEdgesForNodes(nodeIds: Set<string>): CareerEdge[] {
  return allEdges.filter((e) => nodeIds.has(e.source) || nodeIds.has(e.target));
}

export function getNodeById(id: string): CareerNode | undefined {
  return allNodes.find((n) => n.id === id);
}
