import type { PoseSnapshot } from '@/lib/pose';

export type PoseDetectionStatus = 'unavailable' | 'loading' | 'ready' | 'error';

export type PoseDetection = {
  pose: PoseSnapshot | null; // null = no live detection available
  status: PoseDetectionStatus;
};

// Native (iOS/Android) stub. Real on-device detection is Step 3 and needs a
// development build; until then the UI falls back to the dev simulate button.
// The web version of this hook (use-pose-detection.web.ts) does real detection.
export function usePoseDetection(_active: boolean): PoseDetection {
  return { pose: null, status: 'unavailable' };
}
