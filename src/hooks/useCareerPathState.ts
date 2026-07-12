import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CareerEdge, CareerNode, PathType, Track } from '../types/career';

const DEFAULT_SUBTRACKS: Record<Track, string[]> = {
  development: ['Webアプリケーション', 'モバイルアプリ'],
  infrastructure: ['サーバー', 'ネットワーク'],
  'it-support': ['ヘルプデスク系', '事務系'],
};

export function useCareerPathState(allNodes: CareerNode[], allEdges: CareerEdge[]) {
  const [activeTrack, setActiveTrack] = useState<Track>('development');
  const [activeSubtrack, setActiveSubtrack] = useState<string>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<PathType | 'all'>>(new Set(['all']));

  const nodeById = useMemo(() => {
    const map = new Map<string, CareerNode>();
    allNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [allNodes]);

  const getNodeById = useCallback((id: string) => nodeById.get(id), [nodeById]);

  /** 公開対象ノードのみ（Managerフィルタ・サブトラック公開ポリシー適用済み） */
  const publicNodes = useMemo(() => {
    return allNodes.filter((n) => {
      if (n.track === 'it-support') {
        // 公開対象: ヘルプデスク系・事務系のみ（PMO支援は非公開）
        return n.subtrack === 'ヘルプデスク系' || n.subtrack === '事務系';
      }
      return n.pathType !== 'manager';
    });
  }, [allNodes]);

  const availableSubtracks = useMemo(() => {
    const labels = new Set<string>();
    publicNodes.forEach((node) => {
      if (node.track !== activeTrack) return;
      if (!node.subtrack) return;
      labels.add(node.subtrack);
    });

    const fromData = Array.from(labels).sort((a, b) => a.localeCompare(b, 'ja'));
    return fromData.length > 0 ? fromData : DEFAULT_SUBTRACKS[activeTrack];
  }, [activeTrack, publicNodes]);

  const hasTrackSubtrackData = useMemo(
    () => publicNodes.some((node) => node.track === activeTrack && Boolean(node.subtrack)),
    [activeTrack, publicNodes]
  );

  const handleTrackChange = useCallback((track: Track) => {
    setActiveTrack(track);
    setActiveSubtrack('all');
    setSelectedNodeId(null);
  }, []);

  const handleSubtrackChange = useCallback((subtrack: string) => {
    setActiveSubtrack(subtrack);
    setSelectedNodeId(null);
  }, []);

  const handleFilterToggle = useCallback((filter: PathType | 'all') => {
    setActiveFilters((prev) => {
      const next = new Set(prev);

      if (filter === 'all') return new Set<PathType | 'all'>(['all']);

      next.delete('all');
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);

      if (next.size === 0) return new Set<PathType | 'all'>(['all']);
      return next;
    });
  }, []);

  const filteredNodes: CareerNode[] = useMemo(() => {
    // publicNodes（公開ポリシー適用済み）を起点にフィルタリング
    let nodes = publicNodes.filter((n) => n.track === activeTrack);

    if (activeSubtrack !== 'all' && hasTrackSubtrackData) {
      nodes = nodes.filter((n) => n.subtrack === activeSubtrack);
    }

    if (!activeFilters.has('all')) {
      const filterTypes = activeFilters as Set<PathType>;

      // Managerは常に非表示のため、specialistフィルター時も共通ノードを維持する
      nodes = nodes.filter((n) => {
        if (filterTypes.has(n.pathType)) return true;
        if (n.pathType === 'common' && filterTypes.has('specialist')) return true;
        return false;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.titleJa.toLowerCase().includes(q) ||
          n.shortLabel.toLowerCase().includes(q) ||
          (n.role ?? n.summary ?? '').toLowerCase().includes(q) ||
          n.requiredSkills.some((s) => s.toLowerCase().includes(q)) ||
          n.tags.some((t) => t.toLowerCase().includes(q)) ||
          n.recommendedCerts.some((c) => c.toLowerCase().includes(q)) ||
          n.toolsEnvironmentsLanguages.some((t) => t.toLowerCase().includes(q)) ||
          (n.subtrack && n.subtrack.toLowerCase().includes(q))
      );
    }

    return nodes;
  }, [allNodes, activeTrack, activeSubtrack, activeFilters, hasTrackSubtrackData, searchQuery]);

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  useEffect(() => {
    if (!selectedNodeId) return;
    if (!visibleNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, visibleNodeIds]);

  const filteredEdges: CareerEdge[] = useMemo(() => {
    return allEdges.filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target));
  }, [allEdges, visibleNodeIds]);

  const connectedNodeIds: Set<string> = useMemo(() => {
    if (!selectedNodeId || !visibleNodeIds.has(selectedNodeId)) return new Set();
    const connected = new Set<string>();
    allEdges.forEach((e) => {
      if (!visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)) return;
      if (e.source === selectedNodeId) connected.add(e.target);
      if (e.target === selectedNodeId) connected.add(e.source);
    });
    return connected;
  }, [allEdges, selectedNodeId, visibleNodeIds]);

  const selectedNode: CareerNode | null = useMemo(() => {
    if (!selectedNodeId || !visibleNodeIds.has(selectedNodeId)) return null;
    return getNodeById(selectedNodeId) || null;
  }, [getNodeById, selectedNodeId, visibleNodeIds]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const node = getNodeById(nodeId);
      if (node && node.track !== activeTrack) {
        setActiveTrack(node.track);
        setActiveSubtrack('all');
      }
      setSelectedNodeId(nodeId);
    },
    [activeTrack, getNodeById]
  );

  return {
    activeTrack,
    activeSubtrack,
    availableSubtracks,
    selectedNodeId,
    selectedNode,
    searchQuery,
    activeFilters,
    filteredNodes,
    filteredEdges,
    connectedNodeIds,
    handleTrackChange,
    handleSubtrackChange,
    handleNodeClick,
    setSearchQuery,
    handleFilterToggle,
    getNodeById,
  };
}
