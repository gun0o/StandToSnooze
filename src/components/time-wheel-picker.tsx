import { useEffect, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// iPhone-style time picker: three vertical wheels (hour / minute / AM-PM).
// Each wheel is a ScrollView whose rows are fixed-height; whatever row sits
// in the vertical center of the wheel is the selected value.

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 5; // odd on purpose, so exactly one row is centered
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
// Blank space above the first row and below the last one, so that the first
// and last items can also reach the center of the wheel.
const EDGE_PADDING = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1)); // '1'..'12'
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')); // '00'..'59'
const MERIDIEMS = ['AM', 'PM'];

type WheelProps = {
  items: string[];
  index: number; // currently selected row
  onIndexChange: (index: number) => void;
  width: number;
};

function Wheel({ items, index, onIndexChange, width }: WheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Captured once so the mount-effect below doesn't need `index` as a dep
  // (we only want to position the wheel on first render, not on every change).
  const initialIndex = useRef(index);

  useEffect(() => {
    // Wait one frame so the ScrollView has laid out before jumping to the row.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: initialIndex.current * ITEM_HEIGHT, animated: false });
    });
    return () => {
      if (snapTimer.current) clearTimeout(snapTimer.current);
    };
  }, []);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    // The row nearest the center is offset / rowHeight, clamped to the list.
    const nearest = Math.min(Math.max(Math.round(y / ITEM_HEIGHT), 0), items.length - 1);
    if (nearest !== index) onIndexChange(nearest);

    // snapToInterval handles settling on native, but react-native-web doesn't
    // implement it — so on web, snap manually once scrolling goes quiet.
    if (Platform.OS === 'web') {
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: nearest * ITEM_HEIGHT, animated: true });
      }, 150);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={{ height: WHEEL_HEIGHT, width }}
      contentContainerStyle={{ paddingVertical: EDGE_PADDING }}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    >
      {items.map((label, i) => (
        <Text key={label} style={[styles.item, i === index && styles.itemSelected]}>
          {label}
        </Text>
      ))}
    </ScrollView>
  );
}

type TimeWheelPickerProps = {
  initial: Date;
  onConfirm: (time: Date) => void;
  onCancel: () => void;
};

export default function TimeWheelPicker({ initial, onConfirm, onCancel }: TimeWheelPickerProps) {
  const initialHour24 = initial.getHours();
  // 24h -> 12h wheel positions: hour 0 and 12 both display as "12".
  const [hourIdx, setHourIdx] = useState((initialHour24 % 12 === 0 ? 12 : initialHour24 % 12) - 1);
  const [minuteIdx, setMinuteIdx] = useState(initial.getMinutes());
  const [meridiemIdx, setMeridiemIdx] = useState(initialHour24 >= 12 ? 1 : 0);

  const confirm = () => {
    // 12h -> 24h: "12" on the wheel is hour 0 (AM) or 12 (PM), hence the % 12.
    const hour24 = ((hourIdx + 1) % 12) + (meridiemIdx === 1 ? 12 : 0);
    const d = new Date();
    d.setHours(hour24, minuteIdx, 0, 0);
    onConfirm(d);
  };

  return (
    <View style={styles.card}>
      <View style={styles.wheels}>
        <Wheel items={HOURS} index={hourIdx} onIndexChange={setHourIdx} width={64} />
        <Wheel items={MINUTES} index={minuteIdx} onIndexChange={setMinuteIdx} width={64} />
        <Wheel items={MERIDIEMS} index={meridiemIdx} onIndexChange={setMeridiemIdx} width={64} />
        {/* Lines marking the selection row; pointerEvents="none" lets touches
            pass through to the wheels underneath. */}
        <View pointerEvents="none" style={styles.selectionBand} />
      </View>
      <View style={styles.buttons}>
        <Pressable style={styles.buttonSecondary} onPress={onCancel}>
          <Text style={styles.buttonText}>Cancel</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={confirm}>
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    padding: 16,
    gap: 16,
  },
  wheels: {
    flexDirection: 'row',
    gap: 8,
  },
  selectionBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: EDGE_PADDING,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#555',
  },
  item: {
    height: ITEM_HEIGHT,
    lineHeight: ITEM_HEIGHT,
    textAlign: 'center',
    fontSize: 20,
    color: '#777',
  },
  itemSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    backgroundColor: '#2d6cdf',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  buttonSecondary: {
    backgroundColor: '#444',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});
