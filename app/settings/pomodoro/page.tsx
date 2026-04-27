"use client";

import { PomodoroTimer } from "@/components/pomodoro/PomodoroTimer";

export default function PomodoroPage() {
  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-[--text] mb-1">
        Pomodoro Timer
      </h1>
      <p className="font-mono text-xs text-[--text-muted] mb-6">
        Focus timer with configurable work/break intervals
      </p>
      <PomodoroTimer />
      <p className="mt-4 text-xs text-[--text-muted] font-mono">
        Timer state and settings are saved to localStorage. Use the ⚙ button to
        customize durations, auto-start, and sound preferences.
      </p>
    </div>
  );
}
