// Pose keypoint types and the "is the user standing" decision logic.
// Pure functions only (no React, no camera) so this file can be unit-tested
// and later fed real MediaPipe Pose Landmarker output without changes.

export type Keypoint = {
  x: number; // normalized 0..1, left -> right across the image
  y: number; // normalized 0..1, top -> bottom (y = 0 is the TOP of the image)
  score: number; // detection confidence 0..1
};

// The landmarks the standing check uses. Optional because the detector may
// fail to find any given landmark in a frame. Nose/shoulders/hips are
// required for a "standing" verdict; knees are used as an extra check only
// when they happen to be visible.
export type PoseSnapshot = {
  nose?: Keypoint;
  leftShoulder?: Keypoint;
  rightShoulder?: Keypoint;
  leftHip?: Keypoint;
  rightHip?: Keypoint;
  leftKnee?: Keypoint;
  rightKnee?: Keypoint;
};

const MIN_CONFIDENCE = 0.5;

export function isStanding(pose: PoseSnapshot): boolean {
  const { nose, leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee } = pose;

  // Rule 1: all five core landmarks detected, each with confidence above threshold.
  const points = [nose, leftShoulder, rightShoulder, leftHip, rightHip];
  for (const p of points) {
    if (!p || p.score <= MIN_CONFIDENCE) return false;
  }

  // Rule 2: upright ordering — nose above shoulders above hips.
  // Averaging left/right makes the check tolerant of slight lean.
  // "Above" means a SMALLER y, because image y grows downward.
  const shoulderY = (leftShoulder!.y + rightShoulder!.y) / 2;
  const hipY = (leftHip!.y + rightHip!.y) / 2;
  if (!(nose!.y < shoulderY && shoulderY < hipY)) return false;

  // Rule 3 (anti-cheat): sitting upright ALSO satisfies rule 2, so when the
  // knees are visible, require the thighs to be extended downward. Standing,
  // the hip-to-knee drop is roughly a torso length; seated facing the camera,
  // the thighs are foreshortened and the drop is near zero. Skipped when
  // knees aren't confidently detected (e.g., cropped out of a close-up frame).
  if (
    leftKnee && leftKnee.score > MIN_CONFIDENCE &&
    rightKnee && rightKnee.score > MIN_CONFIDENCE
  ) {
    const kneeY = (leftKnee.y + rightKnee.y) / 2;
    const torsoLength = hipY - shoulderY;
    if (kneeY - hipY < 0.5 * torsoLength) return false;
  }

  return true;
}
