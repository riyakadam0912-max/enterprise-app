import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { ModuleListScreen } from "@/src/components/ModuleListScreen";
import { unwrap, api } from "@/src/api/client";
import { formatHoursDuration } from "@/src/utils/time-format";

async function timesheetReport() {
  const payload = unwrap<unknown>((await api.get("/timesheets/report")).data);
  return payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data: unknown[] }).data)
    ? (payload as { data: Record<string, unknown>[] }).data.map((item) => ({
        ...item,
        status:
          item.status === "PENDING"
            ? "Draft"
            : typeof item.status === "string"
              ? item.status.charAt(0) + item.status.slice(1).toLowerCase()
              : item.status,
        employeeName:
          item.employee &&
          typeof item.employee === "object" &&
          "name" in item.employee
            ? item.employee.name
            : "",
        duration: formatHoursDuration(
          typeof item.hours === "number" ? item.hours : 0,
        ),
        sourceLabel:
          item.source === "TASK_TIMER"
            ? "Task timer"
            : item.source === "IMPORT"
              ? "Import"
              : item.source === "MANUAL"
                ? "Manual entry"
                : "Legacy entry",
      }))
    : [];
}

const statusStyle: Record<string, { backgroundColor: string; color: string }> =
  {
    Draft: { backgroundColor: "#f1f5f9", color: "#475569" },
    Submitted: { backgroundColor: "#fffbeb", color: "#a16207" },
    Approved: { backgroundColor: "#f0fdfa", color: "#0f766e" },
    Rejected: { backgroundColor: "#fff1f2", color: "#be123c" },
  };

export default function Timesheets() {
  return (
    <ModuleListScreen
      title="Timesheets"
      subtitle="Work logs and review status"
      queryKey={["timesheets"]}
      load={timesheetReport}
      searchKeys={["task", "project", "employeeName"]}
      filters={[
        {
          key: "status",
          label: "Status",
          options: ["Draft", "Submitted", "Approved", "Rejected"],
        },
      ]}
      headerAction={
        <Link href="/(app)/timesheets/add" asChild>
          <Pressable
            accessibilityRole="button"
            style={{
              backgroundColor: "#172033",
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 11,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              + New entry
            </Text>
          </Pressable>
        </Link>
      }
      renderItem={(item) => {
        const status = String(item.status ?? "Draft");
        const pill = statusStyle[status] ?? statusStyle.Draft;
        const employee = String(item.employeeName ?? "");
        const sourceLabel = String(item.sourceLabel ?? "Manual entry");
        return (
          <Link
            href={{
              pathname: "/timesheet/[id]",
              params: { id: String(item.id) },
            }}
            asChild
          >
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.entry,
                pressed && styles.entryPressed,
              ]}
            >
              <View style={styles.entryTop}>
                <View style={styles.entryTitleWrap}>
                  <Text numberOfLines={1} style={styles.task}>
                    {String(item.task ?? "Work log")}
                  </Text>
                  <Text numberOfLines={1} style={styles.project}>
                    {String(item.project ?? "No project")}
                    {employee ? ` · ${employee}` : ""}
                  </Text>
                </View>
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: pill.backgroundColor },
                  ]}
                >
                  <Text style={[styles.pillText, { color: pill.color }]}>
                    {status}
                  </Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{String(item.date ?? "")}</Text>
                <Text style={styles.meta}>·</Text>
                <Text style={styles.duration}>
                  {String(item.duration ?? "0:00")}
                </Text>
                <Text style={styles.meta}>·</Text>
                <Text style={styles.meta}>{sourceLabel}</Text>
              </View>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}

const styles = {
  entry: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 16,
    marginBottom: 10,
  } as const,
  entryPressed: { opacity: 0.78 } as const,
  entryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  } as const,
  entryTitleWrap: { flex: 1 } as const,
  task: { color: "#172033", fontSize: 15, fontWeight: "700" } as const,
  project: { color: "#64748b", fontSize: 12, marginTop: 5 } as const,
  pill: { borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5 } as const,
  pillText: { fontSize: 11, fontWeight: "700" } as const,
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  } as const,
  meta: { color: "#94a3b8", fontSize: 11 } as const,
  duration: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  } as const,
};
