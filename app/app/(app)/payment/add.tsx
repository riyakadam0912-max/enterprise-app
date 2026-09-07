import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { createPayment } from "@/src/api/payments";
import { Dropdown } from "@/src/components/Dropdown";

export default function AddPayment() {
  const router = useRouter();
  const client = useQueryClient();
  const { invoiceId } = useLocalSearchParams<{ invoiceId?: string }>();
  const [form, setForm] = useState({
    invoiceId: invoiceId ?? "",
    amount: "",
    paymentMethod: "Bank Transfer",
    transactionId: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    status: "COMPLETED",
  });
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createPayment({
        invoiceId: Number(form.invoiceId),
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod.trim(),
        transactionId: form.transactionId.trim() || undefined,
        paymentDate: form.paymentDate,
        status: form.status,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["payments"] });
      void client.invalidateQueries({
        queryKey: ["invoice", Number(form.invoiceId)],
      });
      Alert.alert("Payment recorded", "The payment was added.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    },
    onError: (value) => setError(apiError(value)),
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    setError("");
    if (
      !Number.isInteger(Number(form.invoiceId)) ||
      Number(form.invoiceId) <= 0
    )
      return setError("A valid invoice ID is required.");
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0)
      return setError("Amount must be greater than zero.");
    if (
      !form.paymentMethod.trim() ||
      !/^\d{4}-\d{2}-\d{2}$/.test(form.paymentDate)
    )
      return setError("Payment method and valid date are required.");
    mutation.mutate();
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Record payment</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.card}>
        <Field
          label="Invoice ID *"
          value={form.invoiceId}
          onChangeText={(value) => set("invoiceId", value)}
          keyboardType="number-pad"
        />
        <Field
          label="Amount *"
          value={form.amount}
          onChangeText={(value) => set("amount", value)}
          keyboardType="decimal-pad"
        />
        <Dropdown label="Payment method *" value={form.paymentMethod} options={["Bank Transfer", "Cash", "Card", "Cheque", "UPI", "Other"]} onChange={(value) => set("paymentMethod", value)} />
        <Field
          label="Payment date *"
          value={form.paymentDate}
          onChangeText={(value) => set("paymentDate", value)}
          placeholder="YYYY-MM-DD"
        />
        <Field
          label="Transaction ID"
          value={form.transactionId}
          onChangeText={(value) => set("transactionId", value)}
        />
      </View>
      <Pressable
        disabled={mutation.isPending}
        onPress={submit}
        style={styles.submit}
      >
        <Text style={styles.submitText}>
          {mutation.isPending ? "Saving..." : "Record payment"}
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
    marginBottom: 18,
  } as const,
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
  submit: {
    backgroundColor: "#ea580c",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  } as const,
  submitText: { color: "#fff", fontWeight: "800" } as const,
  error: {
    color: "#9f1239",
    backgroundColor: "#fff1f2",
    padding: 13,
    borderRadius: 10,
    marginBottom: 14,
  } as const,
};
