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
import { createLedgerEntry } from "@/src/api/ledger";

export default function AddLedgerEntry() {
  const router = useRouter();
  const client = useQueryClient();
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    debit: "",
    credit: "",
    account: "",
    reference: "",
  });
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createLedgerEntry({
        date: form.date || undefined,
        description: form.description.trim() || undefined,
        debit: form.debit ? Number(form.debit) : undefined,
        credit: form.credit ? Number(form.credit) : undefined,
        account: form.account.trim() || undefined,
        reference: form.reference.trim() || undefined,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["ledger"] });
      Alert.alert("Ledger entry created", "The accounting entry was saved.", [
        { text: "Done", onPress: () => router.replace("/(app)/ledger") },
      ]);
    },
    onError: (value) => setError(apiError(value)),
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    setError("");
    const debit = form.debit ? Number(form.debit) : 0;
    const credit = form.credit ? Number(form.credit) : 0;
    if (!form.description.trim()) return setError("Description is required.");
    if (!form.account.trim()) return setError("Account is required.");
    if (
      ![debit, credit].every(Number.isFinite) ||
      debit < 0 ||
      credit < 0 ||
      (debit === 0 && credit === 0)
    )
      return setError("Enter a valid debit or credit amount.");
    mutation.mutate();
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back to ledger</Text>
      </Pressable>
      <Text style={styles.title}>Create ledger entry</Text>
      <Text style={styles.subtitle}>
        Record an accounting movement in your authorized organization.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.card}>
        <Field
          label="Date"
          value={form.date}
          onChangeText={(value) => set("date", value)}
          placeholder="YYYY-MM-DD"
        />
        <Field
          label="Description *"
          value={form.description}
          onChangeText={(value) => set("description", value)}
          placeholder="Entry description"
        />
        <Field
          label="Account *"
          value={form.account}
          onChangeText={(value) => set("account", value)}
          placeholder="Account name or code"
        />
        <Field
          label="Debit"
          value={form.debit}
          onChangeText={(value) => set("debit", value)}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Field
          label="Credit"
          value={form.credit}
          onChangeText={(value) => set("credit", value)}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Field
          label="Reference"
          value={form.reference}
          onChangeText={(value) => set("reference", value)}
          placeholder="Invoice, payment, or note"
        />
      </View>
      <Pressable
        disabled={mutation.isPending}
        onPress={submit}
        style={styles.submit}
      >
        <Text style={styles.submitText}>
          {mutation.isPending ? "Saving..." : "Create entry"}
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
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  } as const,
  label: { color: "#475569", fontWeight: "700", marginBottom: 6 } as const,
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 13,
    color: "#172033",
  } as const,
  error: {
    color: "#9f1239",
    backgroundColor: "#fff1f2",
    padding: 13,
    borderRadius: 10,
    marginBottom: 14,
  } as const,
  submit: {
    backgroundColor: "#ea580c",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  } as const,
  submitText: { color: "#fff", fontWeight: "800" } as const,
};
