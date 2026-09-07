import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  createEmployee,
  type CreateEmployeePayload,
} from "@/src/api/employees";
import { shifts } from "@/src/api/attendance";
import { useAuth } from "@/src/providers/AuthProvider";
import { useBusinessUnit } from "@/src/providers/BusinessUnitProvider";
import { can } from "@/src/utils/permissions";
import { Dropdown } from "@/src/components/Dropdown";

const departments = [
  "Sales",
  "Operations",
  "Marketing",
  "HR",
  "Finance",
  "Creative and Production",
  "IT",
  "Engineering",
];
const roles = ["EMPLOYEE", "MANAGER", "HR"] as const;

export default function AddEmployee() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { units, activeId } = useBusinessUnit();
  const shiftQuery = useQuery({
    queryKey: ["attendance", "shifts"],
    queryFn: shifts,
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [shiftId, setShiftId] = useState<number | undefined>();
  const [businessUnitId, setBusinessUnitId] = useState<number | undefined>(
    activeId ?? undefined,
  );
  const [createLogin, setCreateLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CreateEmployeePayload["role"]>("EMPLOYEE");
  const [error, setError] = useState("");
  const allowed = can(session, "employee.create", ["HR"]);
  const mutation = useMutation({
    mutationFn: (payload: CreateEmployeePayload) => createEmployee(payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["employees"] });
      Alert.alert(
        "Employee created",
        "The employee was added to your organization.",
        [{ text: "Done", onPress: () => router.replace("/(app)/employees") }],
      );
    },
    onError: (value) => setError(apiError(value)),
  });
  const submit = () => {
    setError("");
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (createLogin && !email.trim()) {
      setError("Email is required when creating a login account.");
      return;
    }
    if (createLogin && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    mutation.mutate({
      name: name.trim(),
      email: createLogin ? email.trim() : undefined,
      phoneNumber: phoneNumber.trim() || undefined,
      department: department || undefined,
      designation: designation.trim() || undefined,
      hireDate: hireDate.trim() || undefined,
      shiftId,
      businessUnitId,
      status: "ACTIVE",
      password: createLogin ? password : undefined,
      role: createLogin ? role : undefined,
    });
  };
  if (!allowed)
    return (
      <View style={{ flex: 1, padding: 20, backgroundColor: "#f8fafc" }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#172033" }}>
          Add employee
        </Text>
        <Text style={{ color: "#be123c", marginTop: 14 }}>
          You do not have permission to create employees.
        </Text>
      </View>
    );
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        backgroundColor: "#f8fafc",
        flexGrow: 1,
      }}
    >
      <Text style={{ fontSize: 28, fontWeight: "800", color: "#172033" }}>
        Add employee
      </Text>
      <Text style={{ color: "#64748b", marginTop: 5, marginBottom: 20 }}>
        Create a profile and optionally issue a login account.
      </Text>
      {error ? (
        <Text
          style={{
            backgroundColor: "#fff1f2",
            color: "#9f1239",
            padding: 13,
            borderRadius: 10,
            marginBottom: 14,
          }}
        >
          {error}
        </Text>
      ) : null}
      <Section title="Profile">
        <Field
          label="Full name *"
          value={name}
          onChangeText={setName}
          placeholder="Employee name"
        />
        <Field
          label="Phone"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="Phone number"
          keyboardType="phone-pad"
        />
        <Field
          label="Designation"
          value={designation}
          onChangeText={setDesignation}
          placeholder="Job title"
        />
        <Field
          label="Hire date"
          value={hireDate}
          onChangeText={setHireDate}
          placeholder="YYYY-MM-DD"
        />
      </Section>
      <Section title="Organization assignment">
        <Dropdown label="Department" value={department} options={departments} onChange={setDepartment} placeholder="Choose department" />
        <Dropdown label="Business unit" value={businessUnitId == null ? "" : String(businessUnitId)} options={units.map((unit) => String(unit.id))} onChange={(value) => setBusinessUnitId(Number(value))} formatOption={(value) => units.find((unit) => String(unit.id) === value)?.name ?? value} placeholder="Choose business unit" />
        <Text style={styles.label}>Shift</Text>
        {shiftQuery.isLoading ? (
          <Text style={styles.muted}>Loading active shifts...</Text>
        ) : (
          <View>
            {shiftQuery.data?.length ? <Dropdown label="Shift" value={shiftId == null ? "" : String(shiftId)} options={shiftQuery.data.map((shift) => String(shift.id))} onChange={(value) => setShiftId(Number(value))} formatOption={(value) => { const shift = shiftQuery.data?.find((item) => String(item.id) === value); return shift ? `${shift.name} (${shift.startTime}-${shift.endTime})` : value; }} placeholder="Choose shift" /> : null}
            {shiftQuery.data?.length === 0 ? (
              <Text style={styles.muted}>No active shifts available.</Text>
            ) : null}
          </View>
        )}
      </Section>
      <Section title="Login account">
        <Pressable
          onPress={() => setCreateLogin(!createLogin)}
          style={styles.toggle}
        >
          <Text style={{ color: "#172033", fontWeight: "700" }}>
            {createLogin ? "✓ " : ""}Create login account
          </Text>
          <Text style={styles.muted}>
            {createLogin ? "Enabled" : "Optional"}
          </Text>
        </Pressable>
        {createLogin ? (
          <>
            <Field
              label="Login email *"
              value={email}
              onChangeText={setEmail}
              placeholder="name@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Temporary password *"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
            />
            <Dropdown label="Role" value={role ?? ""} options={[...roles]} onChange={(value) => setRole(value as CreateEmployeePayload["role"])} />
          </>
        ) : null}
      </Section>
      <Pressable
        disabled={mutation.isPending}
        onPress={submit}
        style={{
          backgroundColor: mutation.isPending ? "#fdba74" : "#ea580c",
          padding: 16,
          borderRadius: 11,
          alignItems: "center",
          marginTop: 4,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800" }}>
          {mutation.isPending ? "Creating..." : "Create employee"}
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
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} style={styles.input} />
    </View>
  );
}
const styles = {
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
    marginTop: 12,
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
  toggle: {
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  } as const,
  muted: { color: "#64748b", fontSize: 13 } as const,
};
