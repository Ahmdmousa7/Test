import React from 'react';

interface Props {
  progress: number;
  label?: string;
}

const ProgressBar: React.FC<Props> = ({ progress, label }) => {
  return (
    <div className="w-full mt-4 animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-slate-700">{label || 'Processing...'}</span>
        <span className="text-sm font-medium text-slate-600">{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;