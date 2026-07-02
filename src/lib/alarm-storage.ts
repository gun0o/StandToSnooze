import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage only stores strings, so the alarm is saved as JSON.
// Only hour/minute are stored (not a full Date) because an alarm is a
// time-of-day, not a moment in history.
const STORAGE_KEY = 'standtosnooze.alarm';

export type SavedAlarm = {
  hour: number; // 0-23
  minute: number; // 0-59
  enabled: boolean;
};

export async function saveAlarm(alarm: SavedAlarm): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(alarm));
}

export async function loadAlarm(): Promise<SavedAlarm | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedAlarm) : null;
  } catch {
    // Missing or corrupted data — treat as "no alarm saved" rather than crash.
    return null;
  }
}
