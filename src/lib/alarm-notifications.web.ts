// Web stub: browsers can't schedule OS-level alarms, so notification
// scheduling is a no-op. On web the alarm only fires while the tab is open,
// driven by the in-app interval.

export async function syncAlarmNotification(_alarmTime: Date, _enabled: boolean): Promise<void> {
  // no-op on web
}

export function useAlarmNotificationResponse(_onRespond: () => void) {
  // no-op on web
}
