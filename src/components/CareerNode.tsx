import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { STAGE_LABELS, PATH_TYPE_LABELS, type Stage, type PathType, type Track } from '../types/career';

/** Data passed to each custom React Flow node */
export interface CareerNodeData {
  nodeId: string;
  shortLabel: string;
  titleJa: string;
  stage: Stage;
  pathType: PathType;
  track: Track;
  subtrack?: string;
  styleKey?: string;
  isSelected: boolean;
  isConnected: boolean;
  isLocked: boolean;
  [key: string]: unknown;
}

/**
 * Custom React Flow node for career path tiles.
 * Renders a compact card showing stage, label, and path type.
 */
const CareerNodeComponent: React.FC<NodeProps> = ({ data }) => {
  const {
    nodeId,
    shortLabel,
    stage,
    pathType,
    track,
    subtrack,
    styleKey,
    isSelected,
    isConnected,
    isLocked,
  } = data as unknown as CareerNodeData;

  const classes = [
    'career-node',
    `track-${track}`,
    `path-${pathType}`,
    `stage-${stage}`,
    isLocked ? 'locked' : '',
    isSelected ? 'selected' : '',
    isConnected ? 'connected' : '',
    styleKey ? `style-${styleKey}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} data-node-id={nodeId}>
      <Handle id="target-top" type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-300 !border-0" />
      <Handle id="target-bottom" type="target" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-300 !border-0" />
      <Handle id="target-left" type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-300 !border-0" />
      <Handle id="target-right" type="target" position={Position.Right} className="!w-2 !h-2 !bg-gray-300 !border-0" />

      <div className="flex items-center gap-1 mb-1">
        <span className="stage-badge">{STAGE_LABELS[stage as Stage]}</span>

        {pathType === 'common' ? (
          <>
            <span className="path-badge">{PATH_TYPE_LABELS.specialist}</span>
          </>
        ) : (
          <span className="path-badge">{PATH_TYPE_LABELS[pathType as PathType]}</span>
        )}

        {isLocked && (
          <span className="lock-icon" aria-label="公開予定">🔒</span>
        )}
      </div>

      <div className="node-title font-semibold text-gray-800 leading-tight text-[13px]">
        {shortLabel}
      </div>

      {subtrack && (
        <div className="node-subtrack text-[10px] text-gray-400 mt-1 truncate">
          {subtrack}
        </div>
      )}

      <Handle id="source-top" type="source" position={Position.Top} className="!w-2 !h-2 !bg-gray-300 !border-0" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-300 !border-0" />
      <Handle id="source-left" type="source" position={Position.Left} className="!w-2 !h-2 !bg-gray-300 !border-0" />
      <Handle id="source-right" type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-300 !border-0" />
    </div>
  );
};

export default memo(CareerNodeComponent);