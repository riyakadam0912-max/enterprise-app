import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { Check, ChevronDown } from '@/src/components/icons';
import { useBusinessUnit } from '@/src/providers/BusinessUnitProvider';
export function BusinessUnitPicker() {
	const { units, activeId, canSelectAll, select, loading } = useBusinessUnit();
	const [open, setOpen] = useState(false);
	const [selectingId, setSelectingId] = useState<number | null | undefined>();
	if (units.length < 2 && !canSelectAll) return null;
	const label = units.find((unit) => unit.id === activeId)?.name ?? 'All Business Units';
	const choose = async (id: number | null) => {
		setSelectingId(id);
		try {
			await select(id);
			setOpen(false);
		} finally {
			setSelectingId(undefined);
		}
	};

	return <>
		<Pressable accessibilityRole="button" accessibilityLabel="Choose business unit" accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 15, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
			<View style={{ flex: 1 }}><Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }}>ACTIVE UNIT</Text><Text style={{ color: '#172033', fontWeight: '800', fontSize: 15, marginTop: 4 }}>{loading ? 'Loading units...' : label}</Text></View>
			<View style={{ backgroundColor: '#fff7ed', borderRadius: 12, padding: 8 }}><ChevronDown color="#ea580c" size={18} /></View>
		</Pressable>
		<Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
			<Pressable onPress={() => setOpen(false)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#17203399' }}>
				<Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 30 }}>
					<View style={{ width: 38, height: 4, borderRadius: 4, backgroundColor: '#cbd5e1', alignSelf: 'center', marginBottom: 20 }} />
					<Text style={{ color: '#172033', fontSize: 21, fontWeight: '800' }}>Switch workspace unit</Text>
					<Text style={{ color: '#64748b', marginTop: 5, marginBottom: 14 }}>Choose which business unit powers your dashboard.</Text>
					{canSelectAll ? <Option label="All Business Units" active={activeId === null} busy={selectingId === null} onPress={() => choose(null)} /> : null}
					{units.map((unit) => <Option key={unit.id} label={`${unit.name} (${unit.code})`} active={activeId === unit.id} busy={selectingId === unit.id} onPress={() => choose(unit.id)} />)}
				</Pressable>
			</Pressable>
		</Modal>
	</>;
}
function Option({ label, active, busy, onPress }: { label: string; active: boolean; busy: boolean; onPress: () => void }) { return <Pressable accessibilityRole="button" accessibilityState={{ selected: active, busy }} disabled={busy} onPress={onPress} style={{ paddingVertical: 15, paddingHorizontal: 14, borderRadius: 14, backgroundColor: active ? '#fff7ed' : '#fff', marginBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: busy ? 0.65 : 1 }}><Text style={{ color: active ? '#c2410c' : '#334155', fontWeight: active ? '800' : '600', flex: 1 }}>{label}</Text>{busy ? <ActivityIndicator color="#ea580c" size="small" /> : active ? <Check color="#ea580c" size={19} /> : null}</Pressable>; }
