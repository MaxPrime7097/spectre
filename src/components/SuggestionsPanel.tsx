import React, { useState } from 'react';
import { SpectreAnalysis } from '../services/geminiService';
import { AlertCircle, AlertTriangle, Lightbulb, Info, CheckCircle2, Loader2, Activity, Clock, Check, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface TimelineEvent {
  time: string;
  issue: string;
  data?: SpectreAnalysis;
}

interface SuggestionsPanelProps {
  suggestions: SpectreAnalysis[];
  isAnalyzing: boolean;
  timeline: TimelineEvent[];
}

export const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({ suggestions, isAnalyzing, timeline }) => {
  const [applyingFix, setApplyingFix] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-500 border-red-500/20 bg-red-500/5';
      case 'medium': return 'text-amber-500 border-amber-500/20 bg-amber-500/5';
      case 'low': return 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5';
      default: return 'text-blue-500 border-blue-500/20 bg-blue-500/5';
    }
  };

  const handleApplyFix = async (suggestion: SpectreAnalysis) => {
    if (!suggestion.patch || !suggestion.file_path) return;
    
    setApplyingFix(suggestion.issue);
    try {
      const response = await fetch('/api/apply-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_path: suggestion.file_path,
          patch: suggestion.patch
        })
      });
      
      if (response.ok) {
        console.log('[SPECTRE] Fix applied successfully');
      }
    } catch (error) {
      console.error('[SPECTRE] Failed to apply fix:', error);
    } finally {
      setApplyingFix(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] border-l border-[#1a1a1a] w-80 md:w-96 overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-[#1a1a1a] flex items-center justify-between bg-[#111]/50 backdrop-blur-md">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <motion.div 
            animate={isAnalyzing ? { scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
            className={`w-1.5 h-1.5 rounded-full ${isAnalyzing ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-gray-700'}`} 
          />
          Autonomous Agent
        </h2>
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
            >
              <Loader2 size={12} className="animate-spin text-emerald-500" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Active Suggestions */}
        <div className="p-4 space-y-6">
          <h3 className="text-[9px] font-mono uppercase text-gray-600 tracking-widest mb-2 flex items-center gap-2">
            <Activity size={10} /> Active Intelligence
          </h3>
          
          <AnimatePresence mode="wait">
            {suggestions.length === 0 && !isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center py-12 text-center space-y-4 opacity-30"
              >
                <CheckCircle2 size={40} className="text-emerald-500/50" strokeWidth={1} />
                <p className="font-mono text-[11px] text-gray-400 uppercase tracking-widest">Environment Secure</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {suggestions.map((s, i) => (
                <motion.div
                  key={`${s.issue}-${i}`}
                  layout
                  initial={{ opacity: 0, x: 20, y: 10 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, x: -20 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="p-4 rounded-lg bg-[#141414] border border-[#1f1f1f] hover:border-emerald-500/20 transition-colors group relative overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className={`px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-widest ${getSeverityColor(s.severity)}`}>
                      {s.severity}
                    </div>
                    <div className="flex items-center gap-2">
                      {s.file_path && (
                        <div className="text-[8px] font-mono text-emerald-500/80 uppercase tracking-tighter bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.5 rounded">
                          {s.file_path.split('/').pop()}
                        </div>
                      )}
                      <div className="text-[8px] font-mono text-gray-600 uppercase tracking-tighter bg-white/5 px-1.5 py-0.5 rounded">
                        {s.language}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 relative z-10">
                    <div>
                      <h3 className="text-[10px] font-mono uppercase text-gray-600 mb-1">Issue</h3>
                      <p className="text-xs font-bold text-gray-200 leading-tight">{s.issue}</p>
                    </div>

                    {s.file_path && (
                      <div className="flex items-center gap-2 text-[9px] text-gray-500 font-mono italic truncate">
                        <span className="opacity-50">Path:</span>
                        <span className="text-gray-400">{s.file_path}</span>
                      </div>
                    )}

                    <div>
                      <h3 className="text-[10px] font-mono uppercase text-gray-600 mb-1">Explanation</h3>
                      <p className="text-[11px] text-gray-400 leading-relaxed italic">{s.explanation}</p>
                    </div>
                  </div>
                  
                  {s.patch && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 pt-4 border-t border-[#1f1f1f] relative z-10"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] font-mono uppercase text-gray-600 tracking-tighter">Autonomous Patch</span>
                      </div>
                      <pre className="text-[9px] font-mono bg-black/60 p-3 rounded border border-white/5 text-emerald-400/90 overflow-x-auto mb-3 whitespace-pre scrollbar-hide">
                        {s.patch}
                      </pre>
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleApplyFix(s)}
                        disabled={applyingFix === s.issue}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/20 rounded text-[10px] font-bold uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/10"
                      >
                        {applyingFix === s.issue ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Zap size={12} />
                        )}
                        Apply Autonomous Fix
                      </motion.button>
                    </motion.div>
                  )}
                  
                  <div className={`absolute top-0 right-0 w-24 h-24 blur-3xl opacity-5 rounded-full -mr-12 -mt-12 transition-colors duration-500 ${
                    s.severity === 'high' ? 'bg-red-500' : 
                    s.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Debug Timeline */}
        <div className="mt-8 p-4 border-t border-[#1a1a1a] bg-[#0a0a0a]/50">
          <h3 className="text-[9px] font-mono uppercase text-gray-600 tracking-widest mb-4 flex items-center gap-2">
            <Clock size={10} /> Debug Timeline
          </h3>
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {timeline.length === 0 && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] text-gray-700 italic"
                >
                  No events recorded yet...
                </motion.p>
              )}
              {timeline.slice().reverse().map((event, i) => (
                <motion.div 
                  key={`${event.time}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => event.data && setSelectedEvent(event)}
                  className={`flex gap-3 relative p-2 rounded-md transition-colors ${event.data ? 'cursor-pointer hover:bg-white/5' : ''}`}
                >
                  {i !== timeline.length - 1 && (
                    <div className="absolute left-[13px] top-4 bottom-[-20px] w-px bg-[#1a1a1a]" />
                  )}
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 z-10 ${
                    event.data?.severity === 'high' ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 
                    event.data?.severity === 'medium' ? 'bg-amber-500' : 
                    event.data?.severity === 'low' ? 'bg-emerald-500' : 'bg-[#1a1a1a]'
                  }`} />
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-mono text-gray-600">{event.time}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{event.issue}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      <AnimatePresence>
        {selectedEvent && selectedEvent.data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#050505]/95 backdrop-blur-sm p-6 flex flex-col"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-mono uppercase text-gray-500 tracking-widest">Event Archive</h3>
              <button 
                onClick={() => setSelectedEvent(null)}
                className="text-[10px] font-mono uppercase text-gray-400 hover:text-white transition-colors"
              >
                [ Close ]
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-2">
              <div className="space-y-2">
                <div className={`inline-block px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-widest ${getSeverityColor(selectedEvent.data.severity)}`}>
                  {selectedEvent.data.severity}
                </div>
                <h2 className="text-sm font-bold text-white leading-tight">{selectedEvent.data.issue}</h2>
                <p className="text-[9px] font-mono text-gray-500 uppercase tracking-tighter">{selectedEvent.time}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-[9px] font-mono uppercase text-gray-600 mb-2 tracking-widest">Technical Brief</h4>
                  <p className="text-[11px] text-gray-400 leading-relaxed italic bg-white/5 p-3 rounded border border-white/5">
                    {selectedEvent.data.explanation}
                  </p>
                </div>

                <div>
                  <h4 className="text-[9px] font-mono uppercase text-gray-600 mb-2 tracking-widest">Resolution Path</h4>
                  <p className="text-[11px] text-emerald-500/80 leading-relaxed font-mono">
                    {selectedEvent.data.suggestion}
                  </p>
                </div>

                {selectedEvent.data.file_path && (
                  <div>
                    <h4 className="text-[9px] font-mono uppercase text-gray-600 mb-1 tracking-widest">Target Resource</h4>
                    <p className="text-[10px] text-gray-400 font-mono truncate">{selectedEvent.data.file_path}</p>
                  </div>
                )}

                {selectedEvent.data.patch && (
                  <div>
                    <h4 className="text-[9px] font-mono uppercase text-gray-600 mb-2 tracking-widest">Historical Patch</h4>
                    <pre className="text-[9px] font-mono bg-black/60 p-3 rounded border border-white/5 text-emerald-400/90 overflow-x-auto whitespace-pre">
                      {selectedEvent.data.patch}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedEvent(null)}
              className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-black uppercase tracking-[0.2em] transition-all"
            >
              Return to Live Feed
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="p-3 border-t border-[#1a1a1a] bg-[#0d0d0d] flex items-center justify-between">
        <span className="text-[9px] font-mono text-gray-600 uppercase">Agent Mode: Autonomous</span>
        <span className="text-[9px] font-mono text-gray-600 uppercase">v2.1.0-stable</span>
      </div>
    </div>
  );
};
