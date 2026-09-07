import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Check, ChevronDown } from '@/src/components/icons';

type DropdownProps = {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  formatOption?: (value: string) => string;
};

export function Dropdown({ label, value, options, onChange, placeholder = 'Choose an option', formatOption = formatValue }: DropdownProps) {
  const [open, setOpen] = useState(false);
  return <View style={{ marginTop: 14 }}>
    <Text style={{ color: '#475569', fontSize: 13, fontWeight: '700', marginBottom: 6 }}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={{ borderWidth: 1, borderColor: value ? '#fdba74' : '#cbd5e1', borderRadius: 12, padding: 14, backgroundColor: value ? '#fffaf5' : '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: value ? '#172033' : '#94a3b8', fontWeight: value ? '700' : '500', flex: 1 }}>{value ? formatOption(value) : placeholder}</Text><ChevronDown color="#ea580c" size={18} /></Pressable>
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}><Pressable onPress={() => setOpen(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#17203399' }}><Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 30 }}><View style={{ width: 38, height: 4, borderRadius: 4, backgroundColor: '#cbd5e1', alignSelf: 'center', marginBottom: 20 }} /><Text style={{ color: '#172033', fontSize: 21, fontWeight: '800' }}>{label}</Text><Text style={{ color: '#64748b', marginTop: 5, marginBottom: 14 }}>Choose one option to continue.</Text>{options.map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: option === value }} onPress={() => { onChange(option); setOpen(false); }} style={{ paddingVertical: 15, paddingHorizontal: 14, borderRadius: 14, backgroundColor: option === value ? '#fff7ed' : '#fff', marginBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: option === value ? '#c2410c' : '#334155', fontWeight: option === value ? '800' : '600', flex: 1 }}>{formatOption(option)}</Text>{option === value ? <Check color="#ea580c" size={19} /> : null}</Pressable>)}</Pressable></Pressable></Modal>
  </View>;
}

function formatValue(value: string) { return value.replaceAll('_', ' '); }