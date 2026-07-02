# StandToSnooze — Project Spec & Claude Code Guide

## What This App Does

StandToSnooze is a mobile alarm clock that requires the user to stand up and be detected on camera before they can snooze. The goal is to prevent lazy snoozing by adding a physical forcing function.

**Core flow:**
1. User sets an alarm time
2. Alarm fires → camera opens automatically
3. Pose detection runs on the camera feed
4. If the user is detected standing upright for 3+ seconds → snooze is unlocked
5. Dismiss is always available without standing (just snooze requires it)

---

## Important: How to Work With Me

I am learning to code. I am not an experienced JS/React developer.

**Do not write code for me unprompted.** Instead:
- Explain concepts when I ask
- Review code I write and tell me what's wrong
- Answer specific questions about syntax or logic
- Point me to the right docs or APIs when I'm stuck
- If I ask you to write something, write it — but explain every line

The goal is that I understand everything in this codebase. If I don't understand something, I'll ask.

---

## Tech Stack

- **React Native** with **Expo** (SDK 56)
- **TypeScript** (`.tsx` files)
- **expo-camera** for camera access
- **MediaPipe Pose Landmarker** for pose detection (integrated on web via CDN; on-device is pending)
- **@react-native-async-storage/async-storage** for persisting alarm settings (integrated)
- **expo-audio** for alarm sound (integrated — note: expo-av is deprecated and removed from SDK 56)
- **expo-notifications** for background alarm delivery (integrated)
- **@react-native-community/datetimepicker** for native time picking (integrated)

---

## Project Structure

```
src/
  app/
    index.tsx        ← Main screen (clock, alarm, firing/snooze flow) — PRIMARY FILE
    _layout.tsx      ← Navigation layout wrapper
    explore.tsx      ← Ignore this, default Expo file
  components/
    time-wheel-picker.tsx  ← iPhone-style hour/minute/AM-PM wheel (used on web)
    (everything else is default Expo, ignore)
  hooks/
    use-stand-gate.ts          ← 3-second continuous-standing timer gate
    use-pose-detection.web.ts  ← real MediaPipe detection in the browser
    use-pose-detection.ts      ← native stub (returns 'unavailable' until Step 3 native)
  lib/
    pose.ts                  ← pure "is standing" decision logic (no React — testable)
    alarm-storage.ts         ← AsyncStorage save/load
    alarm-notifications.ts   ← schedules the background alarm notification (+ .web.ts no-op)
  constants/         ← Theme constants
assets/sounds/alarm.wav  ← generated 25s beep (script-generated, iOS notification sound)
```

Platform-split convention: Metro picks `foo.web.ts` over `foo.ts` when bundling for web. Used for pose detection and notifications.

---

## Current State (as of July 2026)

The app is feature-complete on web. `src/app/index.tsx` implements: ticking clock,
alarm set via wheel picker (web) or native spinner picker, hour/minute Date
comparison with a once-per-minute fire guard, camera + live MediaPipe pose
detection when firing (web), green/red border feedback, 3-second stand gate that
unlocks snooze (5 min), always-available dismiss, AsyncStorage persistence, looping
alarm sound via expo-audio, and daily-repeating scheduled notifications so the
alarm fires when the app is backgrounded. Camera permission is requested when an
alarm is set; notification permission when one is enabled.

On native, pose detection is a stub — the firing screen shows a "Simulate standing
(dev)" button instead. Real on-device detection (VisionCamera + TFLite) is planned
for after the first successful iOS development build.

Do NOT treat this file's history as the source of truth for code — read the actual
source files listed in Project Structure above.

---

## What I Have Learned So Far

- `useState` — stores values that trigger re-renders when changed
- `useEffect` — runs code on component mount; `[]` dependency array means run once
- `setInterval` inside useEffect for recurring logic (clock tick)
- Stale closure bug — use `new Date()` inside the interval callback, not the `time` state variable
- Conditional rendering with `&&`
- Early returns for permission guard clauses
- `useCameraPermissions` hook from expo-camera
- `CameraView` component with `facing` prop

---

## Roadmap

### Done
- ~~Step 1 — Alarm time picker~~ (custom wheel on web, `display="spinner"` native)
- ~~Step 3 — Pose detection~~ (web only; `lib/pose.ts` logic + knee anti-cheat rule)
- ~~Step 4 — Snooze gate~~ (`hooks/use-stand-gate.ts`, 3s countdown)
- ~~Step 5 — Alarm persistence~~ (`lib/alarm-storage.ts`)
- ~~Background alarm firing~~ (`lib/alarm-notifications.ts`, daily scheduled notification)
- ~~Alarm sound~~ (expo-audio + generated `assets/sounds/alarm.wav`)

### Step 2 — Development Build on iPhone (user is doing this)
- EAS Build from Windows: `eas login` → `eas build:configure` → `eas device:create`
  → `eas build --platform ios --profile development`
- Requires an Apple Developer account ($99/yr) for device installs from Windows
- `expo-dev-client` is already installed; config plugins are set in app.json
- On device, test: alarm fires from locked phone with sound; camera opens; dismiss works

### Step 3b — On-Device Pose Detection (AFTER first green iOS build)
- Plan: `react-native-vision-camera` (frame processors) + `react-native-fast-tflite`
  (MoveNet or MediaPipe pose model) + resize plugin
- Only the pose SOURCE changes — `lib/pose.ts` and the stand gate stay as-is;
  replace the stub in `hooks/use-pose-detection.ts`
- Deliberately deferred: don't stack three untested native modules onto the
  first-ever build

### Step 6 — Polish
- Configurable snooze duration (currently hardcoded `SNOOZE_MINUTES = 5`)
- Multiple alarms (also fixes: snoozing currently shifts the daily repeat time)
- Weekday/weekend scheduling
- Clean UI (not a dev prototype)
- Nicer alarm sound than the generated beep

---

## Key Concepts to Explain If I Ask

- **Closure / stale state** — why `time` inside setInterval is always the initial value
- **Re-renders** — when does React re-draw the screen
- **Props** — how to pass data between components
- **Async/await** — for AsyncStorage and any async operations
- **TypeScript types** — I'm using `.tsx` files, explain types when I hit them
- **Date objects** — how to compare times properly without string matching

---

## Notes on My Background

- I have strong C/C++ and embedded systems experience (OS kernel, FPGA SoC, firmware internship)
- I understand memory, pointers, interrupts, and hardware — use these analogies when explaining JS concepts
- I am weak on JS syntax and React patterns — explain these clearly
- I prefer to understand why things work, not just copy-paste solutions
- Do not baby me on logic — I can reason through problems, I just need syntax/API guidance
