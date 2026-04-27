"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getPomodoroConfig,
  getPomodoroState,
  savePomodoroState,
  savePomodoroConfig,
  resetPomodoroState,
} from "@/lib/storage";
import type { PomodoroPhase, PomodoroConfig, PomodoroState } from "@/lib/types";
import { Button } from "@/components/ui/Button";

const PHASE_LABELS: Record<PomodoroPhase, string> = {
  work: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

const PHASE_COLORS: Record<PomodoroPhase, string> = {
  work: "text-[--accent]",
  shortBreak: "text-green-500",
  longBreak: "text-blue-500",
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getPhaseDuration(phase: PomodoroPhase, config: PomodoroConfig): number {
  switch (phase) {
    case "work":
      return config.workDuration * 60;
    case "shortBreak":
      return config.shortBreakDuration * 60;
    case "longBreak":
      return config.longBreakDuration * 60;
  }
}

export function PomodoroTimer() {
  const [config, setConfig] = useState<PomodoroConfig>(() => getPomodoroConfig());
  const [state, setState] = useState<PomodoroState>(() => getPomodoroState());
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state to localStorage whenever it changes
  useEffect(() => {
    savePomodoroState(state);
  }, [state]);

  useEffect(() => {
    savePomodoroConfig(config);
  }, [config]);

  // Timer tick
  useEffect(() => {
    if (!state.isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.timeRemaining <= 1) {
          // Time's up - move to next phase
          return advancePhase(prev, config);
        }
        return { ...prev, timeRemaining: prev.timeRemaining - 1 };
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isRunning, config]);

  const advancePhase = useCallback(
    (currentState: PomodoroState, currentConfig: PomodoroConfig): PomodoroState => {
      let nextPhase: PomodoroPhase;
      let nextSession: number;
      let sessionsCompleted = currentConfig.sessionsCompleted;

      if (currentState.phase === "work") {
        sessionsCompleted += 1;
        // Check if it's time for a long break
        if (sessionsCompleted % currentConfig.longBreakInterval === 0) {
          nextPhase = "longBreak";
          nextSession = currentState.currentSession + 1;
        } else {
          nextPhase = "shortBreak";
          nextSession = currentState.currentSession + 1;
        }
        // Save updated sessions count
        const updatedConfig = { ...currentConfig, sessionsCompleted };
        savePomodoroConfig(updatedConfig);
        setConfig(updatedConfig);
      } else {
        // Break is over, back to work
        nextPhase = "work";
        nextSession = currentState.currentSession;
      }

      const duration = getPhaseDuration(nextPhase, currentConfig);
      const autoStart =
        nextPhase === "work"
          ? currentConfig.autoStartPomodoros
          : currentConfig.autoStartBreaks;

      // Play notification sound
      if (currentConfig.soundEnabled && mounted) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.frequency.value = 800;
          gain.gain.value = 0.3;
          osc.start();
          setTimeout(() => {
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
            setTimeout(() => audioCtx.close(), 500);
          }, 200);
        } catch {
          // Audio not supported, silently fail
        }
      }

      const newState: PomodoroState = {
        phase: nextPhase,
        timeRemaining: duration,
        isRunning: autoStart,
        currentSession: nextSession,
      };
      savePomodoroState(newState);
      return newState;
    },
    [mounted]
  );

  function toggleTimer() {
    setState((prev) => ({ ...prev, isRunning: !prev.isRunning }));
  }

  function handleReset() {
    const fresh = resetPomodoroState(config);
    setState(fresh);
  }

  function skipPhase() {
    setState((prev) => advancePhase(prev, config));
  }

  if (!mounted) {
    return (
      <div className="border border-[--border] bg-[--surface] p-4">
        <div className="h-4 w-24 bg-[--border] animate-pulse mb-3 mx-auto" />
        <div className="h-10 w-32 bg-[--border] animate-pulse mb-3 mx-auto" />
        <div className="h-8 w-48 bg-[--border] animate-pulse mx-auto" />
      </div>
    );
  }

  const progress =
    getPhaseDuration(state.phase, config) > 0
      ? ((getPhaseDuration(state.phase, config) - state.timeRemaining) /
          getPhaseDuration(state.phase, config)) *
        100
      : 0;

  return (
    <div className="border border-[--border] bg-[--surface] p-4">
      <div className="text-center">
        {/* Phase label */}
        <div className={`font-mono text-xs font-medium mb-1 ${PHASE_COLORS[state.phase]}`}>
          {PHASE_LABELS[state.phase]}
          {state.phase === "work" && state.currentSession > 0 && (
            <span className="text-[--text-muted] ml-1">
              #{state.currentSession + 1}
            </span>
          )}
        </div>

        {/* Timer display */}
        <div className="font-display font-bold text-4xl text-[--text] tabular-nums mb-3">
          {formatTime(state.timeRemaining)}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-[--border] mb-4 rounded-none overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ease-linear ${
              state.phase === "work"
                ? "bg-[--accent]"
                : state.phase === "longBreak"
                ? "bg-blue-500"
                : "bg-green-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant={state.isRunning ? "secondary" : "primary"}
            size="sm"
            onClick={toggleTimer}
            aria-label={state.isRunning ? "Pause timer" : "Start timer"}
          >
            {state.isRunning ? "❚❚ Pause" : "▶ Start"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            aria-label="Reset timer"
          >
            ↺
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={skipPhase}
            aria-label="Skip to next phase"
          >
            Skip →
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Timer settings"
          >
            ⚙
          </Button>
        </div>
      </div>

      {/* Inline settings */}
      {showSettings && (
        <div className="mt-4 pt-4 border-t border-[--border] space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-mono text-xs text-[--text-muted] mb-1">
                Focus (min)
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={config.workDuration}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setConfig((prev) => ({ ...prev, workDuration: val }));
                }}
                className="w-full border border-[--border] bg-[--bg] px-2 py-1 text-sm text-[--text] font-mono"
                aria-label="Work duration in minutes"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[--text-muted] mb-1">
                Short Break
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={config.shortBreakDuration}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setConfig((prev) => ({ ...prev, shortBreakDuration: val }));
                }}
                className="w-full border border-[--border] bg-[--bg] px-2 py-1 text-sm text-[--text] font-mono"
                aria-label="Short break duration in minutes"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-[--text-muted] mb-1">
                Long Break
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={config.longBreakDuration}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setConfig((prev) => ({ ...prev, longBreakDuration: val }));
                }}
                className="w-full border border-[--border] bg-[--bg] px-2 py-1 text-sm text-[--text] font-mono"
                aria-label="Long break duration in minutes"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs text-[--text-muted] mb-1">
                Long break every
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={config.longBreakInterval}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setConfig((prev) => ({ ...prev, longBreakInterval: val }));
                }}
                className="w-full border border-[--border] bg-[--bg] px-2 py-1 text-sm text-[--text] font-mono"
                aria-label="Number of sessions before long break"
              />
            </div>
            <div className="flex flex-col justify-end">
              <span className="font-mono text-xs text-[--text-muted] mb-1">
                Sessions: {config.sessionsCompleted}
              </span>
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="font-mono text-xs text-[--text-muted] mb-1">
              Auto-start
            </legend>
            <label className="flex items-center gap-2 text-sm text-[--text] cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoStartBreaks}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, autoStartBreaks: e.target.checked }))
                }
                className="accent-[--accent]"
              />
              Breaks
            </label>
            <label className="flex items-center gap-2 text-sm text-[--text] cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoStartPomodoros}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, autoStartPomodoros: e.target.checked }))
                }
                className="accent-[--accent]"
              />
              Pomodoros
            </label>
            <label className="flex items-center gap-2 text-sm text-[--text] cursor-pointer">
              <input
                type="checkbox"
                checked={config.soundEnabled}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, soundEnabled: e.target.checked }))
                }
                className="accent-[--accent]"
              />
              Sound
            </label>
          </fieldset>
        </div>
      )}
    </div>
  );
}
