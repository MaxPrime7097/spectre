import React, { useState, useRef, useEffect } from 'react';
import { Monitor, Play, Square, Settings, Terminal, ShieldAlert, Cpu, Activity, Zap } from 'lucide-react';
import { analyzeScreen, SpectreAnalysis, speak } from './services/geminiService';
import { SuggestionsPanel, TimelineEvent } from './components/SuggestionsPanel';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const isAnalyzingRef = useRef(false);
  const [suggestions, setSuggestions] = useState<SpectreAnalysis[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uptime, setUptime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const uptimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const onVideoRef = React.useCallback((el: HTMLVideoElement | null) => {
    (videoRef as any).current = el;
    if (el && streamRef.current) {
      // Only set srcObject if it's different to avoid interrupting playback
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
      }
      
      // Only attempt to play if paused
      if (el.paused) {
        el.play().catch(err => {
          // AbortError is expected when the request is interrupted, we can ignore it
          if (err.name !== 'AbortError') {
            console.error("[SPECTRE] Video play error:", err);
          }
        });
      }
    }
  }, []);

  const stopCapture = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (uptimeIntervalRef.current) {
      clearInterval(uptimeIntervalRef.current);
      uptimeIntervalRef.current = null;
    }
    
    setIsCapturing(false);
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
  }, []);

  const captureAndAnalyze = React.useCallback(async () => {
    console.log("[SPECTRE] Loop: captureAndAnalyze check. isAnalyzing:", isAnalyzingRef.current);
    if (!videoRef.current || !canvasRef.current || isAnalyzingRef.current) {
      if (!videoRef.current) console.log("[SPECTRE] Loop: videoRef is null");
      if (!canvasRef.current) console.log("[SPECTRE] Loop: canvasRef is null");
      return;
    }

    const video = videoRef.current;
    
    // Ensure video is ready and has dimensions
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      console.log(`[SPECTRE] Loop: video not ready. readyState: ${video.readyState}, width: ${video.videoWidth}, height: ${video.videoHeight}`);
      return;
    }

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    try {
      const canvas = canvasRef.current;
      
      const scale = 0.8;
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.6);
        
        if (base64Image.length < 1000) {
          console.warn("[SPECTRE] Captured image is too small or empty.");
          return;
        }

        console.log("[SPECTRE] Sending frame for analysis...");
        const results = await analyzeScreen(base64Image);
        console.log("[SPECTRE] Analysis results:", results);
        
        if (results && results.length > 0) {
          setSuggestions(results);
          
          // Update timeline with new unique issues
          results.forEach(res => {
            setTimeline(prev => {
              const exists = prev.some(e => e.issue === res.issue);
              if (!exists) {
                return [...prev, {
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  issue: res.issue,
                  data: res
                }];
              }
              return prev;
            });
          });
        }
      } else {
        console.error("[SPECTRE] Failed to get canvas context");
      }
    } catch (err) {
      console.error("[SPECTRE] Capture/Analyze Error:", err);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, []);

  const startCapture = React.useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      setError("System Error: Your browser does not support screen capture (getDisplayMedia). Please use a modern desktop browser.");
      return;
    }
    try {
      setError(null);
      console.log("[SPECTRE] Requesting display media...");
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: false
      });
      
      console.log("[SPECTRE] Stream obtained:", stream.id);
      streamRef.current = stream;
      setIsCapturing(true);
      setUptime(0);
      
      // Start analysis loop
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        captureAndAnalyze();
      }, 5000);
      
      // Start uptime counter
      if (uptimeIntervalRef.current) clearInterval(uptimeIntervalRef.current);
      uptimeIntervalRef.current = setInterval(() => {
        setUptime(prev => prev + 1);
      }, 1000);

      stream.getVideoTracks()[0].onended = () => {
        console.log("[SPECTRE] Stream ended by user");
        stopCapture();
      };
    } catch (err: any) {
      console.error("[SPECTRE] Error starting capture:", err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setError("System Access Denied: Please click 'Initialize System' and grant screen sharing permissions to continue.");
      } else if (err.name === 'NotFoundError') {
        setError("System Error: No display source found.");
      } else {
        setError(`System Initialization Failed: ${err.message || 'Hardware unavailable or browser restriction.'}`);
      }
      setIsCapturing(false);
    }
  }, [captureAndAnalyze, stopCapture]);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  useEffect(() => {
    return () => stopCapture();
  }, []);

  return (
    <div className="flex h-screen bg-[#050505] text-gray-300 font-mono overflow-hidden selection:bg-emerald-500/30">
      {/* Main Viewport */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-14 border-b border-[#1a1a1a] bg-[#0a0a0a]/80 backdrop-blur-xl flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <motion.div 
              initial={false}
              animate={{ borderColor: isCapturing ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)' }}
              className="relative w-9 h-9 bg-emerald-500/5 border rounded-lg flex items-center justify-center transition-colors duration-500"
            >
              <Terminal size={20} className={isCapturing ? 'text-emerald-500' : 'text-gray-600'} />
              {isCapturing && (
                <motion.div 
                  layoutId="active-dot"
                  className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0a0a0a]" 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>
            <div>
              <h1 className="text-sm font-black tracking-[0.3em] text-white">S.P.E.C.T.R.E</h1>
              <div className="flex items-center gap-2 text-[9px] text-gray-500 uppercase tracking-widest">
                <motion.div
                  animate={isCapturing ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.3 }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Activity size={10} className={isCapturing ? 'text-emerald-500' : ''} />
                </motion.div>
                Proactive Evaluation Active
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-6 mr-6 border-r border-[#1a1a1a] pr-6">
              <div className="text-right">
                <p className="text-[8px] text-gray-600 uppercase tracking-tighter">Uptime</p>
                <p className="text-[11px] text-gray-400 font-bold">{formatUptime(uptime)}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] text-gray-600 uppercase tracking-tighter">AI Load</p>
                <p className="text-[11px] text-gray-400 font-bold">{isAnalyzing ? '84%' : '2%'}</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {!isCapturing ? (
                <motion.button
                  key="start"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startCapture}
                  className="group relative flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                >
                  <Play size={14} fill="currentColor" />
                  Initialize System
                </motion.button>
              ) : (
                <motion.button
                  key="stop"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={stopCapture}
                  className="flex items-center gap-2 px-6 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 rounded-md text-[11px] font-bold uppercase tracking-widest transition-all"
                >
                  <Square size={14} fill="currentColor" />
                  Terminate Session
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 relative flex items-center justify-center p-8 lg:p-12 bg-[#050505]">
          {/* Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]" />

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="absolute top-8 z-30 w-full max-w-md px-4"
              >
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex items-center gap-4 text-red-400 backdrop-blur-md shadow-2xl">
                  <ShieldAlert size={20} className="shrink-0" />
                  <p className="text-[11px] uppercase tracking-wider leading-relaxed">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div 
            layout
            className="w-full max-w-6xl aspect-video bg-[#0a0a0a] rounded-2xl border border-[#1a1a1a] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative group ring-1 ring-white/5"
          >
            <AnimatePresence mode="wait">
              {!isCapturing ? (
                <motion.div 
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-8 p-12"
                >
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border border-[#1a1a1a] flex items-center justify-center text-gray-700 group-hover:border-emerald-500/30 group-hover:text-emerald-500/30 transition-all duration-700">
                      <Monitor size={48} strokeWidth={1} />
                    </div>
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 border-t border-emerald-500/20 rounded-full"
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-white uppercase tracking-[0.4em]">Awaiting Input</h3>
                    <p className="text-[10px] text-gray-500 max-w-xs mx-auto uppercase tracking-widest leading-loose">
                      Deploy monitoring to your IDE or Terminal to begin real-time code evaluation.
                    </p>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.05, letterSpacing: "0.3em" }}
                    whileTap={{ scale: 0.95 }}
                    onClick={startCapture}
                    className="px-10 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                  >
                    Establish Link
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div 
                  key="capturing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full relative"
                >
                  <video
                    ref={onVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  
                  {/* Scanning Overlay */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <motion.div 
                      animate={{ y: ["0%", "100%", "0%"] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="w-full h-[2px] bg-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.8)] z-10"
                    />
                    <div className="absolute inset-0 bg-emerald-500/5 opacity-20" />
                    <div className="absolute inset-0 border-[20px] border-[#0a0a0a] [mask-image:linear-gradient(to_bottom,black,transparent_20%,transparent_80%,black)]" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Hidden canvas for processing */}
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Analysis Indicator */}
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute bottom-6 left-6 flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full backdrop-blur-md z-30 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                >
                  <div className="relative">
                    <Cpu size={14} className="text-emerald-500" />
                    <motion.div 
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-emerald-500 rounded-full"
                    />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Neural Processing...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </main>

        {/* Status Bar */}
        <footer className="h-10 border-t border-[#1a1a1a] bg-[#0a0a0a] flex items-center justify-between px-6 text-[9px] font-mono text-gray-600 uppercase tracking-[0.2em]">
          <div className="flex items-center gap-8">
            <span className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isCapturing ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-gray-800'}`} />
              System: {isCapturing ? 'Online' : 'Standby'}
            </span>
            <span className="flex items-center gap-2">
              <Zap size={10} className={isAnalyzing ? 'text-emerald-500' : ''} />
              AI Core: {isAnalyzing ? 'Processing' : 'Idle'}
            </span>
          </div>
          <div className="flex items-center gap-8">
            <span>Secure Link: AES-256</span>
            <span>Local Time: {new Date().toLocaleTimeString()}</span>
          </div>
        </footer>
      </div>

      {/* Sidebar */}
      <SuggestionsPanel suggestions={suggestions} isAnalyzing={isAnalyzing} timeline={timeline} />
    </div>
  );
}
