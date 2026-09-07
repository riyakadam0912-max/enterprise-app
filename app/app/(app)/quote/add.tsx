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
import { createQuote } from "@/src/api/quotes";
import { Dropdown } from "@/src/components/Dropdown";
import { useAuth } from "@/src/providers/AuthProvider";

const statuses = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
  "EXPIRED",
];
export default function AddQuote() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const [form, setForm] = useState({
    dealId: "",
    contactId: "",
    validTill: "",
    status: "DRAFT",
    itemName: "",
    quantity: "1",
    price: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createQuote({
        dealId: Number(form.dealId),
        contactId: Number(form.contactId),
        validTill: form.validTill,
        status: form.status,
        notes: form.notes.trim() || undefined,
        items: [
          {
            name: form.itemName.trim(),
            quantity: Number(form.quantity),
            price: Number(form.price),
          },
        ],
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["quotes"] });
      Alert.alert("Quote created", "The quote was added to CRM.", [
        { text: "Done", onPress: () => router.replace("/(app)/quotes") },
      ]);
    },
    onError: (value) => setError(apiError(value)),
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    setError("");
    const dealId = Number(form.dealId);
    const contactId = Number(form.contactId);
    const quantity = Number(form.quantity);
    const price = Number(form.price);
    if (!Number.isInteger(dealId) || dealId <= 0)
      return setError("Enter a valid deal ID.");
    if (!Number.isInteger(contactId) || contactId <= 0)
      return setError("Enter a valid contact ID.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.validTill))
      return setError("Use a validity date in YYYY-MM-DD format.");
    if (!form.itemName.trim()) return setError("Item name is required.");
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      !Number.isFinite(price) ||
      price < 0
    )
      return setError("Enter a valid quantity and price.");
    mutation.mutate();
  };
  if (!["ADMIN", "SUPER_ADMIN"].includes(session?.role ?? ""))
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Create quote</Text>
        <Text style={styles.error}>
          You do not have permission to create quotes.
        </Text>
      </View>
    );
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back to quotes</Text>
      </Pressable>
      <Text style={styles.title}>Create quote</Text>
      <Text style={styles.subtitle}>
        Build a quote for an existing deal and contact.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.card}>
        <Field
          label="Deal ID *"
          value={form.dealId}
          onChangeText={(value) => set("dealId", value)}
          keyboardType="number-pad"
          placeholder="Deal ID"
        />
        <Field
          label="Contact ID *"
          value={form.contactId}
          onChangeText={(value) => set("contactId", value)}
          keyboardType="number-pad"
          placeholder="Contact ID"
        />
        <Dropdown
          label="Status"
          value={form.status}
          options={statuses}
          onChange={(value) => set("status", value)}
        />
        <Field
          label="Valid until *"
          value={form.validTill}
          onChangeText={(value) => set("validTill", value)}
          placeholder="YYYY-MM-DD"
        />
        <Text style={styles.sectionTitle}>Quote item</Text>
        <Field
          label="Item name *"
          value={form.itemName}
          onChangeText={(value) => set("itemName", value)}
          placeholder="Service or product"
        />
        <Field
          label="Quantity *"
          value={form.quantity}
          onChangeText={(value) => set("quantity", value)}
          keyboardType="number-pad"
        />
        <Field
          label="Unit price *"
          value={form.price}
          onChangeText={(value) => set("price", value)}
          keyboardType="decimal-pad"
        />
        <Field
          label="Notes"
          value={form.notes}
          onChangeText={(value) => set("notes", value)}
          placeholder="Optional notes"
          multiline
        />
      </View>
      <Pressable
        disabled={mutation.isPending}
        onPress={submit}
        style={styles.submit}
      >
        <Text style={styles.submitText}>
          {mutation.isPending ? "Saving..." : "Create quote"}
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
      <TextInput
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 85, textAlignVertical: "top" },
        ]}
      />
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
  sectionTitle: {
    color: "#172033",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 20,
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
    marginTop: 14,
  } as const,
  submit: {
    backgroundColor: "#ea580c",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  } as const,
  submitText: { color: "#fff", fontWeight: "800" } as const,
};
