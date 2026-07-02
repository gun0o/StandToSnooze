import { useEffect, useRef, useState } from 'react';
import type { PoseLandmarker as PoseLandmarkerInstance } from '@mediapipe/tasks-vision';

import type { PoseSnapshot } from '@/lib/pose';
import type { PoseDetection, PoseDetectionStatus } from './use-pose-detection';

// Web implementation: runs MediaPipe Pose Landmarker in the browser against
// the <video> element that expo-camera's CameraView renders on web.
//
// The library, its WASM runtime, and the model file are all fetched over the
// network the first time the alarm fires, so pose detection needs internet.
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// Metro (Expo's bundler) chokes on MediaPipe's internal dynamic import()s, so
// the library is loaded from the CDN at runtime instead of being bundled.
// `new Function` hides the import() call from the bundler; the npm package is
// still installed, but only its TypeScript types are used at compile time.
const loadTasksVision = new Function('url', 'return import(url)') as (
  url: string,
) => Promise<typeof import('@mediapipe/tasks-vision')>;

// Indices into MediaPipe's 33-landmark pose output.
const NOSE = 0;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_KNEE = 25;
const RIGHT_KNEE = 26;

// How often to push a new pose into React state. The detector runs every
// animation frame (~30-60/s), but re-rendering that often is wasteful —
// 5 updates/second is plenty for a red/green border.
const STATE_UPDATE_MS = 200;

type Landmark = { x: number; y: number; visibility?: number };

function toKeypoint(lm: Landmark) {
  // MediaPipe already gives normalized 0..1 coords with y growing downward —
  // exactly what isStanding() expects. visibility is its confidence score.
  return { x: lm.x, y: lm.y, score: lm.visibility ?? 1 };
}

export type { PoseDetection, PoseDetectionStatus };

export function usePoseDetection(active: boolean): PoseDetection {
  const [pose, setPose] = useState<PoseSnapshot | null>(null);
  const [status, setStatus] = useState<PoseDetectionStatus>('loading');
  const lastStateUpdate = useRef(0);

  useEffect(() => {
    if (!active) {
      setPose(null);
      return;
    }

    // Everything below can outlive this effect (async loads, animation
    // frames), so `cancelled` lets stale work know it should stop.
    let cancelled = false;
    let rafId = 0;
    let landmarker: PoseLandmarkerInstance | null = null;

    (async () => {
      try {
        setStatus('loading');
        const { FilesetResolver, PoseLandmarker } = await loadTasksVision(
          `${CDN_BASE}/vision_bundle.mjs`,
        );
        const vision = await FilesetResolver.forVisionTasks(`${CDN_BASE}/wasm`);
        const options = {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' as const },
          runningMode: 'VIDEO' as const,
          numPoses: 1,
        };
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, options);
        } catch {
          // Some browsers can't do GPU inference; retry on CPU.
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            ...options,
            baseOptions: { ...options.baseOptions, delegate: 'CPU' as const },
          });
        }
        if (cancelled) {
          landmarker.close();
          return;
        }
        setStatus('ready');

        const loop = () => {
          if (cancelled) return;
          // expo-camera's web CameraView renders a <video>; grab it from the DOM.
          const video = document.querySelector('video');
          if (video && video.readyState >= 2) {
            const result = landmarker!.detectForVideo(video, performance.now());
            const now = performance.now();
            if (now - lastStateUpdate.current >= STATE_UPDATE_MS) {
              lastStateUpdate.current = now;
              const lm = result.landmarks[0] as Landmark[] | undefined;
              // Empty result = nobody in frame; {} makes isStanding() false.
              setPose(
                lm
                  ? {
                      nose: toKeypoint(lm[NOSE]),
                      leftShoulder: toKeypoint(lm[LEFT_SHOULDER]),
                      rightShoulder: toKeypoint(lm[RIGHT_SHOULDER]),
                      leftHip: toKeypoint(lm[LEFT_HIP]),
                      rightHip: toKeypoint(lm[RIGHT_HIP]),
                      leftKnee: toKeypoint(lm[LEFT_KNEE]),
                      rightKnee: toKeypoint(lm[RIGHT_KNEE]),
                    }
                  : {},
              );
            }
          }
          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
      } catch (err) {
        console.error('Pose detection failed to initialize:', err);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      landmarker?.close();
    };
  }, [active]);

  return { pose, status };
}
