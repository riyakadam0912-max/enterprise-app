import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { api, apiError, unwrap } from "@/src/api/client";
import { createTask } from "@/src/api/tasks";
import { Dropdown } from "@/src/components/Dropdown";
import { TaskDeadlinePicker } from "@/src/components/TaskDeadlinePicker";
import { useAuth } from "@/src/providers/AuthProvider";

export default function AddTask() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const [form, setForm] = useState({
    taskName: "",
    description: "",
    dueDate: "",
    priority: "MEDIUM",
    status: "PENDING",
    driveLink: "",
    notes: "",
    taskType: "GENERAL",
    shootClientName: "",
    shootLocation: "",
    shootDate: "",
    shootReportingTime: "",
    shootEstimatedHours: "",
    shootCrewUserIds: [] as string[],
  });
  const [assignableUsers, setAssignableUsers] = useState<
    { id: number; name: string; role: string }[]
  >([]);
  const [crewError, setCrewError] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["tasks"] });
      Alert.alert("Task created", "The task was added to your workspace.", [
        { text: "Done", onPress: () => router.replace("/(app)/tasks") },
      ]);
    },
    onError: (value) => setError(apiError(value)),
  });
  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  useEffect(() => {
    if (form.taskType !== "SHOOT") return;
    if (
      !["ADMIN", "SUPER_ADMIN", "HR", "MANAGER"].includes(session?.role ?? "")
    ) {
      setAssignableUsers([]);
      setCrewError("Your role cannot assign shoot crew members.");
      return;
    }
    let active = true;
    void api
      .get("/users/assignable")
      .then((response) => {
        if (!active) return;
        setAssignableUsers(
          unwrap<{ id: number; name: string; role: string }[]>(response.data),
        );
        setCrewError("");
      })
      .catch((value) => {
        if (!active) return;
        setAssignableUsers([]);
        setCrewError(apiError(value));
      });
    return () => {
      active = false;
    };
  }, [form.taskType, session?.role]);
  const submit = () => {
    setError("");
    if (!form.taskName.trim()) {
      setError("Task name is required.");
      return;
    }
    const shootDuration = Number.parseFloat(form.shootEstimatedHours);
    if (
      form.taskType === "SHOOT" &&
      (!form.shootClientName.trim() ||
        !form.shootLocation.trim() ||
        !form.shootDate ||
        !form.shootReportingTime ||
        !Number.isFinite(shootDuration) ||
        shootDuration <= 0 ||
        !form.shootCrewUserIds.length)
    ) {
      setError("Complete the shoot details and add at least one crew member.");
      return;
    }
    mutation.mutate({
      taskName: form.taskName.trim(),
      taskType: form.taskType === "SHOOT" ? "SHOOT" : "GENERAL",
      ...(form.taskType === "SHOOT" && {
        shootClientName: form.shootClientName.trim(),
        shootLocation: form.shootLocation.trim(),
        shootDate: form.shootDate,
        shootReportingTime: form.shootReportingTime,
        shootEstimatedHours: shootDuration,
        shootCrewUserIds: form.shootCrewUserIds.map(Number),
      }),
      description: form.description.trim() || null,
      dueDate: form.dueDate || null,
      priority: form.priority,
      status: form.status,
      driveLink: form.driveLink.trim() || null,
      notes: form.notes.trim() || null,
    });
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back to tasks</Text>
      </Pressable>
      <Text style={styles.title}>Add task</Text>
      <Text style={styles.subtitle}>
        Create a task in your authorized workspace.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Section title="Task details">
        <Options
          label="Task type"
          value={form.taskType}
          values={["GENERAL", "SHOOT"]}
          formatOption={(value) =>
            value === "SHOOT" ? "Shoot" : "Standard task"
          }
          onChange={(value) => set("taskType", value)}
        />
        <Field
          label="Task name *"
          value={form.taskName}
          onChangeText={(value) => set("taskName", value)}
          placeholder="Enter task name"
        />
        <Field
          label="Description"
          value={form.description}
          onChangeText={(value) => set("description", value)}
          placeholder="What needs to be done?"
          multiline
        />
        <TaskDeadlinePicker
          value={form.dueDate}
          onChange={(value) => set("dueDate", value)}
        />
      </Section>
      {form.taskType === "SHOOT" && (
        <Section title="Shoot details">
          <Text style={styles.shootNote}>
            Crew attendance is credited on the shoot date without clock-in or
            clock-out.
          </Text>
          <Field
            label="Client name *"
            value={form.shootClientName}
            onChangeText={(value) => set("shootClientName", value)}
            placeholder="Client or brand"
          />
          <Field
            label="Shoot location *"
            value={form.shootLocation}
            onChangeText={(value) => set("shootLocation", value)}
            placeholder="Studio, venue, or address"
          />
          <Field
            label="Shoot date * (YYYY-MM-DD)"
            value={form.shootDate}
            onChangeText={(value) => set("shootDate", value)}
            placeholder="2026-10-17"
          />
          <Field
            label="Reporting time * (24-hour)"
            value={form.shootReportingTime}
            onChangeText={(value) => set("shootReportingTime", value)}
            placeholder="09:30"
          />
          <Field
            label="Estimated duration * (hours)"
            value={form.shootEstimatedHours}
            onChangeText={(value) => set("shootEstimatedHours", value)}
            placeholder="8"
            keyboardType="decimal-pad"
          />
          {crewError ? <Text style={styles.error}>{crewError}</Text> : null}
          <Text style={styles.label}>Shoot crew *</Text>
          {assignableUsers.map((user) => {
            const selected = form.shootCrewUserIds.includes(String(user.id));
            return (
              <Pressable
                key={user.id}
                onPress={() =>
                  setForm((current) => ({
                    ...current,
                    shootCrewUserIds: selected
                      ? current.shootCrewUserIds.filter(
                          (id) => id !== String(user.id),
                        )
                      : [...current.shootCrewUserIds, String(user.id)],
                  }))
                }
                style={[
                  styles.crewMember,
                  selected && styles.crewMemberSelected,
                ]}
              >
                <Text
                  style={selected ? styles.crewCheckSelected : styles.crewCheck}
                >
                  {selected ? "✓" : ""}
                </Text>
                <Text style={styles.crewName}>{user.name}</Text>
                <Text style={styles.crewRole}>
                  {user.role.replaceAll("_", " ")}
                </Text>
              </Pressable>
            );
          })}
          <Text style={styles.shootNote}>
            {form.shootCrewUserIds.length} crew member
            {form.shootCrewUserIds.length === 1 ? "" : "s"} selected
          </Text>
        </Section>
      )}
      <Section title="Planning">
        <Options
          label="Priority"
          value={form.priority}
          values={["LOW", "MEDIUM", "HIGH"]}
          onChange={(value) => set("priority", value)}
        />
        <Options
          label="Status"
          value={form.status}
          values={["PENDING", "IN_PROGRESS"]}
          onChange={(value) => set("status", value)}
        />
        <Field
          label="Google Drive link"
          value={form.driveLink}
          onChangeText={(value) => set("driveLink", value)}
          placeholder="https://drive.google.com/..."
          keyboardType="url"
        />
        <Field
          label="Notes"
          value={form.notes}
          onChangeText={(value) => set("notes", value)}
          placeholder="Additional notes"
          multiline
        />
      </Section>
      <Pressable
        disabled={mutation.isPending}
        onPress={submit}
        style={styles.submit}
      >
        <Text style={styles.submitText}>
          {mutation.isPending ? "Saving..." : "Create task"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
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
function Options({
  label,
  value,
  values,
  onChange,
  formatOption,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
  formatOption?: (value: string) => string;
}) {
  return (
    <Dropdown
      label={label}
      value={value}
      options={values}
      onChange={onChange}
      formatOption={formatOption}
    />
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
    backgroundColor: "#fff1f2",
    color: "#9f1239",
    padding: 13,
    borderRadius: 10,
    marginBottom: 14,
  } as const,
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  } as const,
  sectionTitle: { color: "#172033", fontSize: 18, fontWeight: "800" } as const,
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
    backgroundColor: "#fff",
  } as const,
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 } as const,
  option: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 10,
  } as const,
  optionSelected: {
    backgroundColor: "#172033",
    borderColor: "#172033",
  } as const,
  submit: {
    backgroundColor: "#ea580c",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  } as const,
  submitText: { color: "#fff", fontWeight: "800" } as const,
  deadlineButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    padding: 12,
    backgroundColor: "#fff",
  } as const,
  deadlineActions: { flexDirection: "row", gap: 8, marginTop: 10 } as const,
  deadlineButtonText: { color: "#334155", fontWeight: "700" } as const,
  deadlineText: { color: "#64748b", marginTop: 10 } as const,
  shootNote: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 10,
  } as const,
  crewMember: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 11,
    marginTop: 8,
  } as const,
  crewMemberSelected: {
    borderColor: "#fdba74",
    backgroundColor: "#fff7ed",
  } as const,
  crewCheck: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 5,
    textAlign: "center",
    color: "#fff",
  } as const,
  crewCheckSelected: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#ea580c",
    borderRadius: 5,
    textAlign: "center",
    color: "#fff",
    backgroundColor: "#ea580c",
  } as const,
  crewName: { flex: 1, color: "#334155", fontWeight: "600" } as const,
  crewRole: { color: "#94a3b8", fontSize: 11 } as const,
};
