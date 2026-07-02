import { useCallback, useEffect, useRef, useState } from 'react';

// Tracks how long the user has been standing CONTINUOUSLY.
// Input: a live boolean ("standing right now?").
// Output: whether snooze is unlocked, plus the countdown for the UI.
//
// Any dip back to not-standing before the required time resets the timer —
// like a watchdog that must not be kicked for 3 straight seconds.
export function useStandGate(standing: boolean, requiredMs: number = 3000) {
  const [unlocked, setUnlocked] = useState(false);
  const [remainingMs, setRemainingMs] = useState(requiredMs);

  // Timestamp when the current standing streak began. A ref, not state,
  // because changing it should NOT cause a re-render by itself.
  const standingSince = useRef<number | null>(null);

  useEffect(() => {
    if (unlocked) return; // already earned it; nothing to time

    if (!standing) {
      // Streak broken (or never started): reset the countdown.
      standingSince.current = null;
      setRemainingMs(requiredMs);
      return;
    }

    standingSince.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - (standingSince.current ?? Date.now());
      const left = requiredMs - elapsed;
      if (left <= 0) {
        setRemainingMs(0);
        setUnlocked(true); // effect re-runs and clears the interval
      } else {
        setRemainingMs(left);
      }
    }, 100); // 100ms so the on-screen countdown feels smooth

    return () => clearInterval(interval);
  }, [standing, requiredMs, unlocked]);

  // Called after a snooze is used, so the NEXT alarm requires standing again.
  const relock = useCallback(() => {
    setUnlocked(false);
    setRemainingMs(requiredMs);
    standingSince.current = null;
  }, [requiredMs]);

  return { unlocked, remainingMs, relock };
}
