import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Scheduled local notifications make the alarm fire even when the app is
// backgrounded, the phone is locked, or the app was killed. The OS delivers
// the notification at the scheduled time; tapping it opens the app, which
// then runs the normal camera/stand-to-snooze flow.
//
// This is the native implementation; alarm-notifications.web.ts is a no-op
// because browsers can't schedule OS-level alarms.

// While the app is in the FOREGROUND our own in-app alarm (sound + camera
// screen) handles everything, so incoming notifications are silenced to
// avoid a double alarm.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Android routes notification sound/priority through a "channel" created once.
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('alarm', {
    name: 'Alarm',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'alarm.wav',
    vibrationPattern: [0, 500, 250, 500],
  });
}

// Reconcile the OS schedule with the current alarm settings. Called whenever
// the alarm changes: always clear the old schedule, then re-create it if the
// alarm is enabled. (The app owns a single alarm, so cancel-all is safe.)
export async function syncAlarmNotification(alarmTime: Date, enabled: boolean): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;

  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) {
    const requested = await Notifications.requestPermissionsAsync();
    if (!requested.granted) return; // user said no; in-app alarm still works
  }

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'WAKE UP!',
      body: 'Open StandToSnooze and stand up to snooze.',
      sound: 'alarm.wav',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY, // repeats every day
      hour: alarmTime.getHours(),
      minute: alarmTime.getMinutes(),
      channelId: 'alarm',
    },
  });
}

// When the user opens the app by tapping the alarm notification, jump
// straight into the firing (stand-to-snooze) screen.
export function useAlarmNotificationResponse(onRespond: () => void) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (response) onRespond();
    // onRespond is intentionally not a dependency: it's a fresh function every
    // render, and we only want to react to a NEW notification tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);
}
