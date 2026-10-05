import { useState } from 'react';
import { createElement } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

const NativeTextInput = TextInput as React.ComponentType<any>;

function toLocalInputValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function TaskDeadlinePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  const initialDate = value ? new Date(value) : new Date();
  const deadlineLabel = value
    ? new Date(value).toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'No deadline set';

  function handlePickerChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === 'dismissed') {
      setMode(null);
      return;
    }
    if (selectedDate) onChange(selectedDate.toISOString());
    if (Platform.OS === 'android') setMode(null);
  }

  if (Platform.OS === 'web') {
    return createElement(NativeTextInput, {
      accessibilityLabel: 'Task deadline date and time',
      type: 'datetime-local',
      value: value ? toLocalInputValue(value) : '',
      onChangeText: (inputValue: string) => {
        const date = inputValue ? new Date(inputValue) : null;
        onChange(date && !Number.isNaN(date.getTime()) ? date.toISOString() : '');
      },
      style: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 10,
        padding: 13,
        color: '#172033',
        backgroundColor: '#fff',
      },
    });
  }

  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: '#475569', fontSize: 13, fontWeight: '700', marginBottom: 6 }}>
        Deadline date and time
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['date', 'time'] as const).map((pickerMode) => (
          <Pressable
            key={pickerMode}
            onPress={() => setMode(pickerMode)}
            style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 9, padding: 12, backgroundColor: '#fff' }}
          >
            <Text style={{ color: '#334155', fontWeight: '700' }}>
              Choose {pickerMode}
            </Text>
          </Pressable>
        ))}
        {value ? (
          <Pressable onPress={() => onChange('')} style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
            <Text style={{ color: '#64748b', fontWeight: '700' }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ color: '#64748b', marginTop: 10 }}>{deadlineLabel}</Text>
      {mode ? (
        <DateTimePicker
          value={Number.isNaN(initialDate.getTime()) ? new Date() : initialDate}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handlePickerChange}
        />
      ) : null}
    </View>
  );
}
