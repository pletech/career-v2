import React from 'react';
import { type Track, TRACK_LABELS } from '../types/career';

interface TrackTabsProps {
  activeTrack: Track;
  onTrackChange: (track: Track) => void;
}

const TRACKS: Track[] = ['development', 'infrastructure', 'it-support'];

const TRACK_COLORS: Record<Track, { active: string; hover: string; ring: string }> = {
  development: {
    active: 'bg-blue-500 text-white',
    hover: 'hover:bg-blue-50 hover:text-blue-700',
    ring: 'ring-blue-400',
  },
  infrastructure: {
    active: 'bg-cyan-500 text-white',
    hover: 'hover:bg-cyan-50 hover:text-cyan-700',
    ring: 'ring-cyan-400',
  },
  'it-support': {
    active: 'bg-violet-500 text-white',
    hover: 'hover:bg-violet-50 hover:text-violet-700',
    ring: 'ring-violet-400',
  },
};

const TrackTabs: React.FC<TrackTabsProps> = ({ activeTrack, onTrackChange }) => {
  return (
    <div className="w-full overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-max gap-0.5 bg-gray-100 p-0.5 md:gap-1 md:p-1 rounded-lg">
        {TRACKS.map((track) => {
          const isActive = track === activeTrack;
          const colors = TRACK_COLORS[track];
          return (
            <button
              key={track}
              onClick={() => onTrackChange(track)}
              className={`
                whitespace-nowrap px-2 py-1 text-[11px] md:px-5 md:py-2 md:text-sm rounded-md font-semibold transition-all duration-150
                focus:outline-none focus:ring-2 ${colors.ring}
                ${isActive ? colors.active + ' shadow-sm' : 'text-gray-600 ' + colors.hover}
              `}
            >
              {TRACK_LABELS[track]}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TrackTabs;
