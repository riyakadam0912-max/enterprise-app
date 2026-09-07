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
import { createLead } from "@/src/api/modules";
import { useAuth } from "@/src/providers/AuthProvider";
import { Dropdown } from "@/src/components/Dropdown";

export default function AddLead() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const allowed = ["ADMIN", "SUPER_ADMIN"].includes(session?.role ?? "");
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    source: "",
    status: "New",
    leadOwner: "",
    nextFollowUp: "",
    leadScore: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["leads"] });
      Alert.alert("Lead created", "The lead was added to CRM.", [
        { text: "Done", onPress: () => router.replace("/leads") },
      ]);
    },
    onError: (value) => setError(apiError(value)),
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = () => {
    setError("");
    if (!form.name.trim()) return setError("Lead name is required.");
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      return setError("Enter a valid email address.");
    const score = form.leadScore ? Number(form.leadScore) : undefined;
    if (score != null && (!Number.isInteger(score) || score < 0 || score > 100))
      return setError("Lead score must be between 0 and 100.");
    mutation.mutate({
      name: form.name.trim(),
      company: form.company.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      source: form.source || undefined,
      status: form.status || undefined,
      leadOwner: form.leadOwner.trim() || undefined,
      nextFollowUp: form.nextFollowUp || undefined,
      leadScore: score,
      notes: form.notes.trim() || undefined,
    });
  };
  if (!allowed)
    return (
      <View style={styles.page}>
        <Text style={styles.title}>Add lead</Text>
        <Text style={styles.error}>
          You do not have permission to create leads.
        </Text>
      </View>
    );
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back to leads</Text>
      </Pressable>
      <Text style={styles.title}>Add lead</Text>
      <Text style={styles.subtitle}>Capture the next CRM opportunity.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.section}>
        <Field
          label="Lead name *"
          value={form.name}
          onChangeText={(value) => set("name", value)}
          placeholder="Lead or company name"
        />
        <Field
          label="Company"
          value={form.company}
          onChangeText={(value) => set("company", value)}
          placeholder="Company"
        />
        <Field
          label="Email"
          value={form.email}
          onChangeText={(value) => set("email", value)}
          placeholder="name@example.com"
          keyboardType="email-address"
        />
        <Field
          label="Phone"
          value={form.phone}
          onChangeText={(value) => set("phone", value)}
          placeholder="Phone number"
          keyboardType="phone-pad"
        />
        <Dropdown label="Source" value={form.source} options={["Website", "Referral", "Event", "Social media", "Advertisement", "Other"]} onChange={(value) => set("source", value)} placeholder="Choose lead source" />
        <Dropdown label="Status" value={form.status} options={["New", "Contacted", "Qualified", "Unqualified", "Converted"]} onChange={(value) => set("status", value)} />
        <Field
          label="Lead owner"
          value={form.leadOwner}
          onChangeText={(value) => set("leadOwner", value)}
          placeholder="Owner name"
        />
        <Field
          label="Next follow-up"
          value={form.nextFollowUp}
          onChangeText={(value) => set("nextFollowUp", value)}
          placeholder="YYYY-MM-DD"
        />
        <Field
          label="Lead score"
          value={form.leadScore}
          onChangeText={(value) => set("leadScore", value)}
          placeholder="0-100"
          keyboardType="number-pad"
        />
        <Field
          label="Notes"
          value={form.notes}
          onChangeText={(value) => set("notes", value)}
          placeholder="Lead context and next steps"
          multiline
        />
      </View>
      <Pressable
        disabled={mutation.isPending}
        onPress={submit}
        style={styles.submit}
      >
        <Text style={styles.submitText}>
          {mutation.isPending ? "Saving..." : "Create lead"}
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
          props.multiline && { minHeight: 90, textAlignVertical: "top" },
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
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  } as const,
  label: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  } as const,
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
