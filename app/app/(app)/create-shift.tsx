import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiError } from "@/src/api/client";
import { createShift } from "@/src/api/attendance";
import { useAuth } from "@/src/providers/AuthProvider";
import { Dropdown } from "@/src/components/Dropdown";

const types = ["FIXED", "FLEXIBLE", "ROTATIONAL"] as const;
export default function CreateShift() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const allowed = ["HR", "ADMIN", "SUPER_ADMIN"].includes(session?.role ?? "");
  const [form, setForm] = useState({
    name: "",
    type: "FIXED" as (typeof types)[number],
    startTime: "",
    endTime: "",
    requiredHours: "8",
    minPresentHours: "5",
    gracePeriodMinutes: "15",
  });
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: createShift,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["attendance", "shifts"] });
      Alert.alert("Shift created", "The shift is available for assignment.", [
        { text: "Done", onPress: () => router.replace("/attendance") },
      ]);
    },
    onError: (value) => setError(apiError(value)),
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    setError("");
    const requiredHours = Number(form.requiredHours);
    const minPresentHours = Number(form.minPresentHours);
    const gracePeriodMinutes = Number(form.gracePeriodMinutes);
    if (!form.name.trim()) return setError("Shift name is required.");
    if (
      !Number.isFinite(requiredHours) ||
      requiredHours <= 0 ||
      !Number.isFinite(minPresentHours) ||
      minPresentHours < 0 ||
      !Number.isFinite(gracePeriodMinutes) ||
      gracePeriodMinutes < 0
    )
      return setError("Enter valid shift values.");
    mutation.mutate({
      name: form.name.trim(),
      type: form.type,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      requiredHours,
      minPresentHours,
      gracePeriodMinutes,
    });
  };
  if (!allowed)
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Create shift</Text>
        <Text style={styles.error}>
          You do not have permission to manage shifts.
        </Text>
      </View>
    );
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back to attendance</Text>
      </Pressable>
      <Text style={styles.title}>Create shift</Text>
      <Text style={styles.subtitle}>
        Add a shift for attendance assignment.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.section}>
        <Field
          label="Shift name *"
          value={form.name}
          onChangeText={(value) => set("name", value)}
          placeholder="Regular day shift"
        />
        <Dropdown label="Shift type" value={form.type} options={[...types]} onChange={(value) => set("type", value)} />
        <Field
          label="Start time"
          value={form.startTime}
          onChangeText={(value) => set("startTime", value)}
          placeholder="09:00"
        />
        <Field
          label="End time"
          value={form.endTime}
          onChangeText={(value) => set("endTime", value)}
          placeholder="18:00"
        />
        <Field
          label="Required hours"
          value={form.requiredHours}
          onChangeText={(value) => set("requiredHours", value)}
          keyboardType="decimal-pad"
          placeholder="8"
        />
        <Field
          label="Minimum present hours"
          value={form.minPresentHours}
          onChangeText={(value) => set("minPresentHours", value)}
          keyboardType="decimal-pad"
          placeholder="5"
        />
        <Field
          label="Grace period (minutes)"
          value={form.gracePeriodMinutes}
          onChangeText={(value) => set("gracePeriodMinutes", value)}
          keyboardType="number-pad"
          placeholder="15"
        />
      </View>
      <Pressable
        disabled={mutation.isPending}
        onPress={submit}
        style={styles.submit}
      >
        <Text style={styles.submitText}>
          {mutation.isPending ? "Saving..." : "Create shift"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} style={styles.input} />
    </View>
  );
}
const styles = {
  page: { padding: 20, backgroundColor: "#f8fafc", flexGrow: 1 } as const,
  back: { color: "#2563eb", fontWeight: "700" } as const,
  title: {
    color: "#172033",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 18,
  } as const,
  subtitle: { color: "#64748b", marginTop: 5, marginBottom: 18 } as const,
  error: {
    color: "#9f1239",
    backgroundColor: "#fff1f2",
    padding: 13,
    borderRadius: 10,
    marginTop: 14,
  } as const,
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginTop: 18,
    marginBottom: 14,
  } as const,
  label: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
  } as const,
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 13,
    color: "#172033",
  } as const,
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as const,
  option: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    padding: 10,
  } as const,
  selected: { backgroundColor: "#172033", borderColor: "#172033" } as const,
  submit: {
    backgroundColor: "#ea580c",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  } as const,
  submitText: { color: "#fff", fontWeight: "800" } as const,
};
