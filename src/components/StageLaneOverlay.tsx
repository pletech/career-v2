import React from 'react';
import { useViewport } from '@xyflow/react';
import type { Track } from '../types/career';

const STAGE_Y_BASE = 50;
const STAGE_Y_GAP = 150;
const STAGES = [1, 2, 3, 4, 5, 6];
const GROUP_TITLE_HALF_WIDTH = 72;

interface StageLaneOverlayProps {
  track: Track;
}

interface LaneHeader {
  label: string;
  x: number;
}

interface GroupHeader {
  label: string;
  centerX: number;
  startX: number;
  endX: number;
  lanes: LaneHeader[];
}

function getGroupHeaders(track: Track): GroupHeader[] {
  switch (track) {
    case 'development':
      return [
        {
          label: 'Webアプリケーション',
          centerX: 170,
          startX: -10,
          endX: 350,
          lanes: [
            { label: 'Specialist', x: 60 },
            { label: 'Manager', x: 280 },
          ],
        },
        {
          label: 'モバイルアプリ',
          centerX: 590,
          startX: 410,
          endX: 770,
          lanes: [
            { label: 'Specialist', x: 480 },
            { label: 'Manager', x: 700 },
          ],
        },
      ];
    case 'infrastructure':
      return [
        {
          label: 'サーバー',
          centerX: 150,
          startX: 0,
          endX: 330,
          lanes: [
            { label: 'Specialist', x: 40 },
            { label: 'Manager', x: 260 },
          ],
        },
        {
          label: 'ネットワーク',
          centerX: 570,
          startX: 390,
          endX: 750,
          lanes: [
            { label: 'Specialist', x: 460 },
            { label: 'Manager', x: 680 },
          ],
        },
      ];
    case 'it-support':
      return [
        {
          label: 'ITサポート',
          centerX: 100,
          startX: 20,
          endX: 180,
          lanes: [{ label: 'Manager', x: 100 }],
        },
        {
          label: '情シス支援',
          centerX: 350,
          startX: 270,
          endX: 430,
          lanes: [{ label: 'Manager', x: 350 }],
        },
        {
          label: 'PMO支援',
          centerX: 600,
          startX: 520,
          endX: 680,
          lanes: [{ label: 'Manager', x: 600 }],
        },
      ];
  }
}

/**
 * Renders horizontal stage-lane labels on the React Flow canvas.
 * These float as an overlay to show 段階1〜6 progression.
 */
const StageLaneOverlay: React.FC<StageLaneOverlayProps> = ({ track }) => {
  const { x, y, zoom } = useViewport();
  const groupHeaders = getGroupHeaders(track);
  const separatorXs = groupHeaders
    .slice(0, -1)
    .map((group, idx) => (group.endX + groupHeaders[idx + 1].startX) / 2);
  const topStageScreenY = STAGE_Y_BASE * zoom + y;
  const titleTop = Math.max(topStageScreenY - 52, 8);
  const laneTop = titleTop + 28;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 1 }}>
      {STAGES.map((stage) => {
        const rawY = STAGE_Y_BASE + (6 - stage) * STAGE_Y_GAP;
        const screenY = rawY * zoom + y;

        return (
          <React.Fragment key={stage}>
            <div
              className="absolute text-[11px] font-bold text-gray-300 select-none"
              style={{
                top: screenY - 8,
                left: Math.max(x + 4, 4),
              }}
            >
              段階{stage}
            </div>
            <div
              className="absolute h-px bg-gray-100"
              style={{
                top: screenY - 15,
                left: 0,
                right: 0,
              }}
            />
          </React.Fragment>
        );
      })}

      {separatorXs.map((separatorX, idx) => (
        <div
          key={`group-separator-${idx}`}
          className="absolute border-l border-dashed border-gray-200/90"
          style={{
            top: 0,
            bottom: 0,
            left: separatorX * zoom + x,
          }}
        />
      ))}

      {groupHeaders.map((group) => (
        <React.Fragment key={group.label}>
          <div
            className="absolute rounded-md border border-blue-100 bg-blue-50/75"
            style={{
              top: titleTop - 6,
              left: group.startX * zoom + x,
              width: Math.max((group.endX - group.startX) * zoom, 100),
              height: 46,
            }}
          />

          <div
            className="absolute px-3 py-1 rounded-full border border-blue-300 bg-white/95 text-[13px] font-bold text-blue-800 shadow-sm"
            style={{
              top: titleTop,
              left: group.centerX * zoom + x - GROUP_TITLE_HALF_WIDTH,
            }}
          >
            {group.label}
          </div>

          {group.lanes.map((lane) => (
            <div
              key={`${group.label}-${lane.label}`}
              className="absolute text-[10px] text-blue-700"
              style={{
                top: laneTop,
                left: lane.x * zoom + x - 28,
              }}
            >
              {lane.label}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

export default StageLaneOverlay;
