import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAudioPlayer } from 'expo-audio';

import TimeWheelPicker from '@/components/time-wheel-picker';
import { isStanding, PoseSnapshot } from '@/lib/pose';
import { useStandGate } from '@/hooks/use-stand-gate';
import { usePoseDetection } from '@/hooks/use-pose-detection';
import { loadAlarm, saveAlarm } from '@/lib/alarm-storage';
import { syncAlarmNotification, useAlarmNotificationResponse } from '@/lib/alarm-notifications';

const SNOOZE_MINUTES = 5;
const STAND_REQUIRED_MS = 3000;

// Fallback poses for platforms without live detection yet. On web,
// usePoseDetection feeds real MediaPipe keypoints instead; on iOS/Android
// that still requires a development build (Step 3), so the dev button
// swaps between these two.
const FAKE_STANDING_POSE: PoseSnapshot = {
  nose: { x: 0.5, y: 0.15, score: 0.9 },
  leftShoulder: { x: 0.42, y: 0.3, score: 0.9 },
  rightShoulder: { x: 0.58, y: 0.3, score: 0.9 },
  leftHip: { x: 0.45, y: 0.55, score: 0.9 },
  rightHip: { x: 0.55, y: 0.55, score: 0.9 },
  leftKnee: { x: 0.45, y: 0.78, score: 0.9 },
  rightKnee: { x: 0.55, y: 0.78, score: 0.9 },
};
const FAKE_ABSENT_POSE: PoseSnapshot = {}; // nobody detected in frame

export default function HomeScreen() {
  const [now, setNow] = useState(new Date());
  const [alarmTime, setAlarmTime] = useState<Date | null>(null);
  const [alarmEnabled, setAlarmEnabled] = useState(false);
  const [alarmFiring, setAlarmFiring] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [simulateStanding, setSimulateStanding] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>('front');

  const player = useAudioPlayer(require('@/assets/sounds/alarm.wav'));

  // Guards that must persist across renders but must NOT trigger re-renders.
  const lastFiredKey = useRef<string | null>(null); // stops re-firing within the same minute
  const storageLoaded = useRef(false); // stops the save-effect clobbering storage before load finishes

  // The full detection pipeline: pose source -> isStanding -> timed gate.
  // On web the pose source is live MediaPipe; where that's unavailable
  // (native, until Step 3) the dev button provides a fake pose instead.
  const { pose: livePose, status: detectionStatus } = usePoseDetection(alarmFiring);
  const pose = livePose ?? (simulateStanding ? FAKE_STANDING_POSE : FAKE_ABSENT_POSE);
  const standing = alarmFiring && isStanding(pose);
  const { unlocked: snoozeUnlocked, remainingMs, relock } = useStandGate(standing, STAND_REQUIRED_MS);

  // Load the saved alarm once on mount.
  useEffect(() => {
    loadAlarm().then((saved) => {
      if (saved) {
        const d = new Date();
        d.setHours(saved.hour, saved.minute, 0, 0);
        setAlarmTime(d);
        setAlarmEnabled(saved.enabled);
      }
      storageLoaded.current = true;
    });
  }, []);

  // Persist and (re)schedule the OS notification whenever the alarm settings
  // change (after the initial load). The notification is what makes the alarm
  // fire when the app is backgrounded or the phone is locked.
  useEffect(() => {
    if (!storageLoaded.current || !alarmTime) return;
    saveAlarm({
      hour: alarmTime.getHours(),
      minute: alarmTime.getMinutes(),
      enabled: alarmEnabled,
    });
    syncAlarmNotification(alarmTime, alarmEnabled).catch((err) =>
      console.error('Failed to schedule alarm notification:', err),
    );
  }, [alarmTime, alarmEnabled]);

  // If the app was opened by tapping the alarm notification, go straight to
  // the firing screen — the in-app minute check may have already passed
  // while the app was closed.
  useAlarmNotificationResponse(() => setAlarmFiring(true));

  // Clock tick + alarm trigger. The dependency array rebuilds the interval
  // whenever these values change, so the closure never goes stale.
  useEffect(() => {
    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);

      if (!alarmEnabled || alarmFiring || !alarmTime) return;

      // Compare hour+minute of Date objects — no locale-dependent strings,
      // and no need to hit the exact second the alarm time passes.
      const timeMatches =
        current.getHours() === alarmTime.getHours() &&
        current.getMinutes() === alarmTime.getMinutes();
      const minuteKey = `${current.toDateString()} ${current.getHours()}:${current.getMinutes()}`;

      if (timeMatches && lastFiredKey.current !== minuteKey) {
        lastFiredKey.current = minuteKey; // fire at most once per minute per day
        setAlarmFiring(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [alarmEnabled, alarmFiring, alarmTime]);

  // Alarm sound follows the firing state.
  useEffect(() => {
    if (alarmFiring) {
      player.loop = true;
      player.seekTo(0);
      player.play();
    } else {
      player.pause();
    }
  }, [alarmFiring, player]);

  // Native picker: onValueChange fires only when a time is actually picked,
  // onDismiss when the picker is closed without choosing.
  const onPickerSelect = (selected: Date) => {
    setShowPicker(false);
    const d = new Date(selected);
    d.setSeconds(0, 0); // alarm matches on hour+minute; zero the rest
    setAlarmTime(d);
    setAlarmEnabled(true);
    // Ask for camera access now, while the user is awake and paying
    // attention — not when the alarm fires and they need it immediately.
    if (!permission?.granted) requestPermission();
  };

  const snooze = () => {
    if (!snoozeUnlocked) return; // belt-and-suspenders; button is also disabled
    const next = new Date(Date.now() + SNOOZE_MINUTES * 60_000);
    next.setSeconds(0, 0);
    setAlarmTime(next); // alarm re-fires in SNOOZE_MINUTES
    setAlarmFiring(false);
    setSimulateStanding(false);
    relock();
  };

  const dismiss = () => {
    setAlarmFiring(false);
    setSimulateStanding(false);
    relock();
    // Alarm stays enabled, so it fires again tomorrow at the same time.
  };

  // ---- Alarm firing screen ----
  if (alarmFiring) {
    const secondsLeft = Math.ceil(remainingMs / 1000);
    return (
      <View style={styles.container}>
        <Text style={styles.wakeUp}>WAKE UP!</Text>

        {/* Green border = standing detected, red = not standing (Step 3 feedback) */}
        {permission?.granted ? (
          <View style={[styles.cameraFrame, { borderColor: standing ? '#2ecc71' : '#e74c3c' }]}>
            <CameraView style={styles.camera} facing={facing} />
          </View>
        ) : (
          // No camera permission: standing can't be verified, so snooze stays
          // locked — but dismiss below still works.
          <View style={[styles.cameraFrame, styles.cameraFallback]}>
            <Text style={styles.warning}>Camera access is required to verify you are standing.</Text>
            <Pressable style={styles.button} onPress={requestPermission}>
              <Text style={styles.buttonText}>Grant camera access</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.hint}>
          {snoozeUnlocked
            ? 'Standing confirmed — snooze unlocked'
            : standing
              ? `Stand for ${secondsLeft}...`
              : detectionStatus === 'loading'
                ? 'Loading pose model...'
                : detectionStatus === 'error'
                  ? 'Pose detection failed to load — use the dev button'
                  : 'Stand up with your full upper body in frame to unlock snooze'}
        </Text>

        {/* Dev fallback for platforms without live detection (native until
            Step 3) or when the model fails to load. Hidden when real
            detection is running. */}
        {detectionStatus !== 'ready' && detectionStatus !== 'loading' && (
          <Pressable
            style={styles.buttonSecondary}
            onPress={() => setSimulateStanding((s) => !s)}
          >
            <Text style={styles.buttonText}>
              {simulateStanding ? 'Simulate sitting (dev)' : 'Simulate standing (dev)'}
            </Text>
          </Pressable>
        )}

        <View style={styles.row}>
          <Pressable
            style={[styles.button, !snoozeUnlocked && styles.buttonDisabled]}
            onPress={snooze}
            disabled={!snoozeUnlocked}
          >
            <Text style={styles.buttonText}>Snooze {SNOOZE_MINUTES} min</Text>
          </Pressable>
          <Pressable style={styles.buttonSecondary} onPress={dismiss}>
            <Text style={styles.buttonText}>Dismiss</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---- Idle clock screen ----
  return (
    <View style={styles.container}>
      <Text style={styles.clock}>{now.toLocaleTimeString()}</Text>
      <Text style={styles.alarmLabel}>
        {alarmTime
          ? `Alarm: ${alarmTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${alarmEnabled ? 'on' : 'off'})`
          : 'No alarm set'}
      </Text>

      {!showPicker && (
        <Pressable style={styles.button} onPress={() => setShowPicker(true)}>
          <Text style={styles.buttonText}>Set alarm time</Text>
        </Pressable>
      )}

      {/* Web has no native picker, so it gets the custom wheel; on iOS,
          display="spinner" is the classic iPhone wheel. */}
      {showPicker &&
        (Platform.OS === 'web' ? (
          <TimeWheelPicker
            initial={alarmTime ?? new Date()}
            onConfirm={onPickerSelect}
            onCancel={() => setShowPicker(false)}
          />
        ) : (
          <DateTimePicker
            value={alarmTime ?? new Date()}
            mode="time"
            display="spinner"
            onValueChange={(_event, date) => onPickerSelect(date)}
            onDismiss={() => setShowPicker(false)}
          />
        ))}

      {alarmTime && (
        <Pressable
          style={styles.buttonSecondary}
          onPress={() => setAlarmEnabled((e) => !e)}
        >
          <Text style={styles.buttonText}>
            {alarmEnabled ? 'Disable alarm' : 'Enable alarm'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    gap: 16,
    padding: 24,
  },
  clock: {
    fontSize: 48,
    color: '#fff',
  },
  alarmLabel: {
    fontSize: 20,
    color: '#aaa',
  },
  warning: {
    color: 'red',
    fontSize: 18,
    textAlign: 'center',
  },
  wakeUp: {
    color: 'red',
    fontSize: 36,
    fontWeight: 'bold',
  },
  cameraFrame: {
    width: '90%',
    height: 320,
    borderWidth: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraFallback: {
    borderColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  hint: {
    color: '#fff',
    fontSize: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#2d6cdf',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonSecondary: {
    backgroundColor: '#444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});
