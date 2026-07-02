# StandToSnooze

An alarm clock that makes you **stand up** before you can snooze. When the alarm fires, the camera opens and pose detection checks that you are standing upright for 3 continuous seconds — only then does the snooze button unlock. Dismissing is always allowed; being lazy is not.

## How it works

1. Set an alarm with the wheel picker.
2. At alarm time the app rings — in the foreground via an in-app alarm, and from the background/locked phone via a scheduled OS notification.
3. The camera opens and MediaPipe pose detection looks for you.
4. Standing upright (nose above shoulders above hips, knees extended when visible) for 3+ seconds unlocks snooze.
5. Snooze delays the alarm 5 minutes. Dismiss works without standing.

## Tech stack

- [Expo](https://expo.dev) SDK 56 / React Native, TypeScript, expo-router
- `expo-camera` — camera preview
- [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) — pose detection (browser build on web; on-device version planned)
- `expo-notifications` — background alarm delivery
- `expo-audio` — alarm sound
- `@react-native-async-storage/async-storage` — alarm persistence

## Running it

```bash
npm install
npm run web        # quickest way to try it (pose detection works in the browser)
```

Set an alarm a minute or two out, then when it fires, step back so your head through hips are in frame — the border turns green while you're standing.

On an iPhone, camera + notifications need a **development build** (Expo Go is not supported on SDK 56):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas device:create                                  # register your iPhone
eas build --platform ios --profile development     # cloud build, install from the link
npx expo start                                     # then open the installed app
```

## Project structure

```
src/
  app/index.tsx                    main screen: clock, alarm, firing/snooze flow
  components/time-wheel-picker.tsx iPhone-style hour/minute/AM-PM wheel (web)
  hooks/use-stand-gate.ts          3-second continuous-standing timer
  hooks/use-pose-detection.web.ts  MediaPipe detection in the browser
  hooks/use-pose-detection.ts      native stub (on-device detection planned)
  lib/pose.ts                      "is standing" decision logic (pure, testable)
  lib/alarm-storage.ts             persist alarm across restarts
  lib/alarm-notifications.ts       schedule the background alarm notification
assets/sounds/alarm.wav            generated alarm beep
```

## Status / roadmap

- [x] Alarm clock with wheel time picker
- [x] Pose detection + stand-to-snooze gate (web)
- [x] Background alarm via scheduled notifications (needs device testing)
- [x] Alarm persistence
- [ ] On-device pose detection (VisionCamera + TFLite) — after first iOS build
- [ ] Configurable snooze duration, multiple alarms, weekday scheduling
- [ ] UI polish
