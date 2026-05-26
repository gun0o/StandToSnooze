import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';

export default function HomeScreen() {
  const [time, setTime] = useState(new Date());
  const [alarmTime, setAlarmTime] = useState('5:31:00 PM');
  const [alarmFiring, setAlarmFiring] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      setTime(now);

    if (now.toLocaleTimeString() === alarmTime) {
      setAlarmFiring(true);
    }

    }, 1000);

    return () => clearInterval(interval);

  }, []);

    // camera permissions
  if (!permission) return <Text style={{color: 'red'}}>Allow StandToSnooze to access camera.</Text>

  if (!permission.granted) return <Text style={{color: 'red'}}>Please allow StandToSnooze to access camera in order to use application.</Text>

  return (
    <View style={styles.container}>
      {alarmFiring && <CameraView style={styles.camera} facing={facing} />}
      <Text style={styles.clock}>
        {time.toLocaleTimeString()}
      </Text>

      <Text style={styles.clock}>
        {alarmTime}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  clock: {
    fontSize: 48,
    color: '#fff',
  },
  camera: {
    flex: 1,
  },
});