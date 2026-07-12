import React from 'react';

const PillRow: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="flex items-center gap-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="h-6 w-16 rounded-full bg-gray-200" />
    ))}
  </div>
);

const LoadingSkeleton: React.FC = () => {
  return (
    <div className="h-full w-full animate-pulse">
      <div className="hidden h-full md:flex overflow-hidden">
        <div className="flex-[2] min-w-0 border-r border-gray-200 bg-white p-3">
          <div className="mb-3">
            <PillRow count={4} />
          </div>
          <div className="h-[calc(100%-2.25rem)] w-full rounded-xl bg-gray-100" />
        </div>

        <div className="flex-[1] min-w-[320px] max-w-[420px] bg-white border-l border-gray-100 p-4">
          <div className="h-2 w-20 rounded bg-gray-200 mb-4" />
          <div className="h-6 w-2/3 rounded bg-gray-200 mb-3" />
          <div className="flex gap-2 mb-5">
            <div className="h-5 w-16 rounded bg-gray-200" />
            <div className="h-5 w-14 rounded bg-gray-200" />
            <div className="h-5 w-20 rounded bg-gray-200" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-3 rounded bg-gray-200" />
            ))}
          </div>
        </div>
      </div>

      <div className="h-full md:hidden bg-white p-3 space-y-3">
        <PillRow count={3} />
        <div className="h-[calc(100%-2.25rem)] rounded-xl bg-gray-100" />
      </div>
    </div>
  );
};

export default LoadingSkeleton;
