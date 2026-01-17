import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface LogViewerProps {
  logs: LogEntry[];
  onClear: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ logs, onClear }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 custom-scrollbar">
        {logs.length === 0 && (
          <div className="h-full flex items-center justify-center text-slate-300 italic select-none">
            Processing logs will appear here...
          </div>
        )}
        {logs.map((log, idx) => (
          <div key={idx} className={`flex items-start gap-2 break-words animate-in fade-in slide-in-from-left-1 duration-200
            ${log.type === 'error' ? 'text-red-600 bg-red-50 p-1 rounded' : ''}
            ${log.type === 'success' ? 'text-green-600 font-medium' : ''}
            ${log.type === 'warning' ? 'text-amber-600' : ''}
            ${log.type === 'info' ? 'text-slate-600' : ''}
          `}>
            <span className="text-slate-400 text-[10px] whitespace-nowrap mt-0.5 select-none font-sans">
              {log.timestamp}
            </span>
            <span className="leading-tight">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogViewer;