import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  assignProjectEmployee,
  assignProjectManager,
  project,
  projectMessages,
  projectProgress,
  removeProjectEmployee,
  sendProjectMessage,
  updateProjectStatus,
} from "@/src/api/modules";
import { reviewTask, submitTaskWork, updateTaskStatus } from "@/src/api/tasks";
import { useAuth } from "@/src/providers/AuthProvider";
import { can } from "@/src/utils/permissions";

type Tab = "overview" | "tasks" | "chat" | "team";
type ProjectTask = Record<string, any>;

export default function ProjectDetail() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const canRead = can(session, "project.read");
  const query = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => project(projectId),
    enabled: canRead && Number.isInteger(projectId) && projectId > 0,
  });
  const progress = useQuery({
    queryKey: ["project", projectId, "progress"],
    queryFn: () => projectProgress(projectId),
    enabled:
      canRead &&
      Number.isInteger(projectId) &&
      projectId > 0 &&
      can(session, "project.manage"),
  });
  const messages = useQuery({
    queryKey: ["project", projectId, "messages"],
    queryFn: () => projectMessages(projectId),
    enabled: canRead && Number.isInteger(projectId) && projectId > 0,
  });
  const [tab, setTab] = useState<Tab>("overview");
  const [employeeId, setEmployeeId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [message, setMessage] = useState("");
  const [submissionTask, setSubmissionTask] = useState<ProjectTask | null>(
    null,
  );
  const [submissionLink, setSubmissionLink] = useState("");
  const [submissionNote, setSubmissionNote] = useState("");
  const managerRole = ["ADMIN", "MANAGER", "SUPER_ADMIN"].includes(
    session?.role ?? "",
  );
  const statusMutation = useMutation({
    mutationFn: (status: string) => updateProjectStatus(projectId, status),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["project", projectId] });
      void client.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) =>
      Alert.alert("Unable to update project", apiError(error)),
  });
  const teamMutation = useMutation({
    mutationFn: ({
      action,
      value,
    }: {
      action: "add" | "remove" | "manager";
      value: number;
    }) =>
      action === "add"
        ? assignProjectEmployee(projectId, value)
        : action === "remove"
          ? removeProjectEmployee(projectId, value)
          : assignProjectManager(projectId, value),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["project", projectId] });
      setEmployeeId("");
      setManagerId("");
    },
    onError: (error) =>
      Alert.alert("Unable to update project team", apiError(error)),
  });
  const taskMutation = useMutation({
    mutationFn: async ({
      taskId,
      action,
      status,
    }: {
      taskId: number;
      action: "complete" | "start";
      status?: string;
    }) => {
      if (action === "start") return updateTaskStatus(taskId, "IN_PROGRESS");
      if (status !== "SUBMITTED") await updateTaskStatus(taskId, "SUBMITTED");
      return reviewTask(taskId, "APPROVED", "Completed from project workspace");
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["project", projectId] });
      void client.invalidateQueries({
        queryKey: ["project", projectId, "progress"],
      });
    },
    onError: (error) => Alert.alert("Unable to update task", apiError(error)),
  });
  const submitMutation = useMutation({
    mutationFn: () =>
      submitTaskWork(Number(submissionTask?.id), {
        submissionLink: submissionLink.trim(),
        note: submissionNote.trim(),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["project", projectId] });
      setSubmissionTask(null);
      setSubmissionLink("");
      setSubmissionNote("");
    },
    onError: (error) => Alert.alert("Unable to submit task", apiError(error)),
  });
  const messageMutation = useMutation({
    mutationFn: () => sendProjectMessage(projectId, message.trim()),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["project", projectId, "messages"],
      });
      setMessage("");
    },
    onError: (error) => Alert.alert("Unable to send message", apiError(error)),
  });
  if (!canRead)
    return (
      <View style={styles.page}>
        <Text style={styles.error}>
          You do not have permission to view projects.
        </Text>
      </View>
    );
  if (query.isLoading)
    return (
      <View style={styles.page}>
        <Text>Loading project...</Text>
      </View>
    );
  if (query.isError || !query.data)
    return (
      <View style={styles.page}>
        <Text style={styles.error}>{apiError(query.error)}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Go back</Text>
        </Pressable>
      </View>
    );
  const current = query.data;
  const tasks = Array.isArray(current.tasks)
    ? (current.tasks as ProjectTask[])
    : [];
  const employees = Array.isArray(current.assignedEmployees)
    ? (current.assignedEmployees as ProjectTask[])
    : [];
  const teamMembers = Array.isArray(current.teamMembers)
    ? (current.teamMembers as ProjectTask[])
    : [];
  const isAssignee = (task: ProjectTask) =>
    task.assignedToUserId === session?.user.id ||
    (session?.employeeId != null && task.assignedToId === session.employeeId);
  const renderTask = (task: ProjectTask, index: number) => {
    const status = String(task.status ?? "PENDING").toUpperCase();
    const employeeCanSubmit =
      session?.role === "EMPLOYEE" &&
      isAssignee(task) &&
      ["IN_PROGRESS", "REJECTED"].includes(status);
    const managerCanComplete = managerRole && status !== "APPROVED";
    return (
      <View key={String(task.id ?? index)} style={styles.card}>
        <Text style={styles.cardTitle}>{String(task.taskName ?? "Task")}</Text>
        <Text style={styles.muted}>
          Status: {status} · Priority: {String(task.priority ?? "Not set")}
        </Text>
        {task.dueDate ? (
          <Text style={styles.muted}>
            Due: {String(task.dueDate).slice(0, 10)}
          </Text>
        ) : null}
        <Text style={styles.taskDescription}>
          {String(task.description ?? "No description provided.")}
        </Text>
        <View style={styles.inlineActions}>
          {managerCanComplete ? (
            <Pressable
              disabled={taskMutation.isPending}
              onPress={() =>
                taskMutation.mutate({
                  taskId: Number(task.id),
                  action: "complete",
                  status,
                })
              }
              style={styles.complete}
            >
              <Text style={styles.actionText}>Mark as complete</Text>
            </Pressable>
          ) : null}
          {employeeCanSubmit ? (
            <Pressable
              onPress={() => setSubmissionTask(task)}
              style={styles.submitTask}
            >
              <Text style={styles.actionText}>Submit task</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back to projects</Text>
      </Pressable>
      <Text style={styles.title}>
        {String(current.projectName ?? "Project")}
      </Text>
      <Text style={styles.muted}>
        {String(current.client ?? current.clientName ?? "Project workspace")}
      </Text>
      <View style={styles.tabs}>
        {(["overview", "tasks", "chat", "team"] as Tab[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => setTab(item)}
            style={[styles.tab, tab === item && styles.tabActive]}
          >
            <Text style={tab === item ? styles.tabTextActive : styles.tabText}>
              {item[0].toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === "overview" ? (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Project overview</Text>
            <Text style={styles.heroText}>
              {String(
                current.description ?? "No project description provided.",
              )}
            </Text>
            <View style={styles.stats}>
              <Stat
                label="Status"
                value={String(current.status ?? "Not set")}
              />
              <Stat
                label="Priority"
                value={String(current.priority ?? "Not set")}
              />
              <Stat
                label="Deadline"
                value={String(
                  current.deadline ?? current.endDate ?? "Not set",
                ).slice(0, 10)}
              />
            </View>
          </View>
          {progress.data ? (
            <View style={styles.progress}>
              <Text style={styles.cardTitle}>Delivery progress</Text>
              <Text style={styles.progressText}>
                {String(progress.data.progressPercent ?? 0)}% ·{" "}
                {String(progress.data.completedTasks ?? 0)} of{" "}
                {String(progress.data.totalTasks ?? 0)} tasks complete
              </Text>
            </View>
          ) : null}
          {managerRole ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Project status</Text>
              <View style={styles.inlineActions}>
                {[
                  "NOT_STARTED",
                  "IN_PROGRESS",
                  "BLOCKED_CANCELLED",
                  "COMPLETED",
                ].map((status) => (
                  <Pressable
                    key={status}
                    onPress={() => statusMutation.mutate(status)}
                    style={[
                      styles.statusButton,
                      current.status === status && styles.statusActive,
                    ]}
                  >
                    <Text
                      style={
                        current.status === status
                          ? styles.actionText
                          : styles.statusText
                      }
                    >
                      {status.replaceAll("_", " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
      {tab === "tasks" ? (
        <>
          <Text style={styles.sectionTitle}>Project tasks</Text>
          {tasks.length ? (
            tasks.map(renderTask)
          ) : (
            <Text style={styles.muted}>
              No tasks available in this project.
            </Text>
          )}
          {submissionTask ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Submit {String(submissionTask.taskName)}
              </Text>
              <TextInput
                value={submissionLink}
                onChangeText={setSubmissionLink}
                placeholder="Submission link (optional)"
                autoCapitalize="none"
                style={styles.input}
              />
              <TextInput
                value={submissionNote}
                onChangeText={setSubmissionNote}
                placeholder="Describe the completed work"
                multiline
                style={[styles.input, styles.multiline]}
              />
              <Pressable
                disabled={submitMutation.isPending || !submissionNote.trim()}
                onPress={() => submitMutation.mutate()}
                style={[
                  styles.submitTask,
                  !submissionNote.trim() && styles.disabled,
                ]}
              >
                <Text style={styles.actionText}>
                  {submitMutation.isPending ? "Submitting..." : "Submit task"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
      {tab === "chat" ? (
        <>
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderIcon}>
              <Text style={styles.chatHeaderIconText}>#</Text>
            </View>
            <View style={styles.chatHeaderCopy}>
              <Text style={styles.chatTitle}>Project conversation</Text>
              <Text style={styles.chatSubtitle}>
                {messages.data?.length ?? 0} messages · Keep the team aligned
              </Text>
            </View>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>
          <View style={styles.chatShell}>
            <View style={styles.chatToolbar}>
              <Text style={styles.chatToolbarText}>TEAM CHANNEL</Text>
              <Text style={styles.chatToolbarHint}>
                Updates, decisions, and handoffs
              </Text>
            </View>
            <View style={styles.messagePane}>
              {messages.isLoading ? (
                <Text style={styles.chatEmpty}>Loading conversation...</Text>
              ) : messages.isError ? (
                <Text style={styles.chatError}>{apiError(messages.error)}</Text>
              ) : messages.data?.length ? (
                messages.data.map((item) => {
                  const isMine = item.sender?.id === session?.user.id;
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.messageRow,
                        isMine && styles.messageRowMine,
                      ]}
                    >
                      <View
                        style={[styles.avatar, isMine && styles.avatarMine]}
                      >
                        <Text style={styles.avatarText}>
                          {(item.sender?.name ?? "T").slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.bubble,
                          isMine ? styles.bubbleMine : styles.bubbleTheir,
                        ]}
                      >
                        <View style={styles.bubbleMeta}>
                          <Text
                            style={[
                              styles.senderName,
                              isMine && styles.senderNameMine,
                            ]}
                          >
                            {isMine
                              ? "You"
                              : (item.sender?.name ?? "Team member")}
                          </Text>
                          <Text
                            style={[
                              styles.messageTime,
                              isMine && styles.messageTimeMine,
                            ]}
                          >
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.bubbleText,
                            isMine && styles.bubbleTextMine,
                          ]}
                        >
                          {item.content}
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.chatEmptyState}>
                  <View style={styles.emptyChatIcon}>
                    <Text style={styles.emptyChatIconText}>+</Text>
                  </View>
                  <Text style={styles.chatEmptyTitle}>
                    Start the conversation
                  </Text>
                  <Text style={styles.chatEmpty}>
                    Share an update, ask a question, or leave a handoff for the
                    project team.
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.composer}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Write an update to the project team..."
                placeholderTextColor="#94a3b8"
                multiline
                style={styles.composerInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send project message"
                disabled={messageMutation.isPending || !message.trim()}
                onPress={() => messageMutation.mutate()}
                style={[
                  styles.sendButton,
                  (!message.trim() || messageMutation.isPending) &&
                    styles.disabled,
                ]}
              >
                <Text style={styles.sendIcon}>
                  {messageMutation.isPending ? "..." : "↑"}
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}
      {tab === "team" ? (
        <>
          <Text style={styles.sectionTitle}>Project team</Text>
          {employees.map((member, index) => (
            <View key={`employee-${member.id}-${index}`} style={styles.member}>
              <View>
                <Text style={styles.cardTitle}>
                  {String(member.name ?? "Team member")}
                </Text>
                <Text style={styles.muted}>
                  {String(member.designation ?? member.email ?? "")}
                </Text>
              </View>
              {managerRole ? (
                <Pressable
                  onPress={() =>
                    teamMutation.mutate({
                      action: "remove",
                      value: Number(member.id),
                    })
                  }
                >
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {teamMembers.map((member, index) => (
            <View key={`member-${member.id}-${index}`} style={styles.member}>
              <View>
                <Text style={styles.cardTitle}>
                  {String(member.name ?? "Team member")}
                </Text>
                <Text style={styles.muted}>
                  {String(member.role ?? member.email ?? "")}
                </Text>
              </View>
            </View>
          ))}
          {managerRole ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Add to team</Text>
              <TextInput
                value={employeeId}
                onChangeText={setEmployeeId}
                placeholder="Employee ID"
                keyboardType="number-pad"
                style={styles.input}
              />
              <Pressable
                disabled={teamMutation.isPending || !employeeId}
                onPress={() =>
                  teamMutation.mutate({
                    action: "add",
                    value: Number(employeeId),
                  })
                }
                style={styles.action}
              >
                <Text style={styles.actionText}>Assign employee</Text>
              </Pressable>
              <TextInput
                value={managerId}
                onChangeText={setManagerId}
                placeholder="Manager user ID"
                keyboardType="number-pad"
                style={styles.input}
              />
              <Pressable
                disabled={teamMutation.isPending || !managerId}
                onPress={() =>
                  teamMutation.mutate({
                    action: "manager",
                    value: Number(managerId),
                  })
                }
                style={styles.action}
              >
                <Text style={styles.actionText}>Assign manager</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}
const styles = {
  page: { padding: 20, backgroundColor: "#f8fafc", flexGrow: 1 } as const,
  back: { color: "#2563eb", fontWeight: "700" } as const,
  title: {
    color: "#172033",
    fontSize: 29,
    fontWeight: "800",
    marginTop: 18,
  } as const,
  hero: {
    backgroundColor: "#172033",
    borderRadius: 18,
    padding: 20,
    marginTop: 18,
  } as const,
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800" } as const,
  heroText: { color: "#cbd5e1", lineHeight: 21, marginTop: 8 } as const,
  stats: { flexDirection: "row", gap: 8, marginTop: 18 } as const,
  stat: {
    flex: 1,
    backgroundColor: "#26334a",
    borderRadius: 10,
    padding: 10,
  } as const,
  statValue: {
    color: "#fff",
    fontWeight: "800",
    marginTop: 5,
    fontSize: 12,
  } as const,
  tabs: {
    flexDirection: "row",
    gap: 7,
    marginTop: 18,
    marginBottom: 4,
  } as const,
  tab: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  } as const,
  tabActive: { backgroundColor: "#ea580c", borderColor: "#ea580c" } as const,
  tabText: { color: "#475569", fontWeight: "700", fontSize: 12 } as const,
  tabTextActive: { color: "#fff", fontWeight: "800", fontSize: 12 } as const,
  sectionTitle: {
    color: "#172033",
    fontSize: 21,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 10,
  } as const,
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  } as const,
  cardTitle: { color: "#172033", fontWeight: "800", fontSize: 16 } as const,
  muted: { color: "#64748b", marginTop: 5 } as const,
  taskDescription: { color: "#475569", marginTop: 9, lineHeight: 20 } as const,
  progress: {
    backgroundColor: "#ecfdf5",
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
  } as const,
  progressText: { color: "#047857", marginTop: 5, fontWeight: "700" } as const,
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  } as const,
  statusButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
  } as const,
  statusActive: { backgroundColor: "#172033", borderColor: "#172033" } as const,
  statusText: { color: "#334155", fontWeight: "700", fontSize: 12 } as const,
  action: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
    marginTop: 10,
  } as const,
  complete: {
    backgroundColor: "#059669",
    borderRadius: 9,
    padding: 11,
  } as const,
  submitTask: {
    backgroundColor: "#ea580c",
    borderRadius: 9,
    padding: 11,
    alignItems: "center",
    marginTop: 10,
  } as const,
  disabled: { opacity: 0.45 } as const,
  actionText: { color: "#fff", fontWeight: "800", fontSize: 12 } as const,
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    color: "#172033",
    backgroundColor: "#fff",
  } as const,
  multiline: { minHeight: 80, textAlignVertical: "top" } as const,
  chatHeader: {
    backgroundColor: "#172033",
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
  } as const,
  chatHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ea580c",
    alignItems: "center",
    justifyContent: "center",
  } as const,
  chatHeaderIconText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  } as const,
  chatHeaderCopy: { flex: 1, marginLeft: 11 },
  chatTitle: { color: "#fff", fontSize: 16, fontWeight: "800" } as const,
  chatSubtitle: { color: "#cbd5e1", fontSize: 12, marginTop: 4 } as const,
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#26334a",
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  } as const,
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34d399",
    marginRight: 5,
  } as const,
  liveText: { color: "#a7f3d0", fontSize: 11, fontWeight: "800" } as const,
  chatShell: {
    backgroundColor: "#eef2f7",
    borderRadius: 16,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#dbe3ee",
  } as const,
  chatToolbar: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  } as const,
  chatToolbarText: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  } as const,
  chatToolbarHint: { color: "#94a3b8", fontSize: 10 },
  messagePane: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    minHeight: 300,
    maxHeight: 440,
  } as const,
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 13,
    maxWidth: "92%",
  } as const,
  messageRowMine: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  } as const,
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  } as const,
  avatarMine: { backgroundColor: "#fed7aa", marginRight: 0, marginLeft: 7 },
  avatarText: { color: "#2563eb", fontSize: 11, fontWeight: "800" } as const,
  bubble: {
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 9,
    maxWidth: "100%",
  } as const,
  bubbleTheir: {
    backgroundColor: "#f1f5f9",
    borderBottomLeftRadius: 4,
  } as const,
  bubbleMine: {
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 4,
  } as const,
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  } as const,
  senderName: { color: "#334155", fontSize: 11, fontWeight: "800" } as const,
  senderNameMine: { color: "#dbeafe" } as const,
  messageTime: { color: "#94a3b8", fontSize: 10 } as const,
  messageTimeMine: { color: "#bfdbfe" } as const,
  bubbleText: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  } as const,
  bubbleTextMine: { color: "#fff" } as const,
  chatEmptyState: {
    flex: 1,
    minHeight: 270,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25,
  } as const,
  emptyChatIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff7ed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  } as const,
  emptyChatIconText: {
    color: "#ea580c",
    fontSize: 26,
    fontWeight: "400",
  } as const,
  chatEmptyTitle: {
    color: "#172033",
    fontSize: 16,
    fontWeight: "800",
  } as const,
  chatEmpty: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
  } as const,
  chatError: {
    color: "#be123c",
    backgroundColor: "#fff1f2",
    borderRadius: 10,
    padding: 12,
    margin: 8,
  } as const,
  composer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 10,
    padding: 7,
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: "#dbe3ee",
  } as const,
  composerInput: {
    flex: 1,
    color: "#172033",
    fontSize: 14,
    paddingHorizontal: 9,
    paddingVertical: 7,
    maxHeight: 80,
  } as const,
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#172033",
    alignItems: "center",
    justifyContent: "center",
  } as const,
  sendIcon: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginTop: -2,
  } as const,
  member: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  } as const,
  remove: { color: "#be123c", fontWeight: "800" } as const,
  error: {
    color: "#be123c",
    backgroundColor: "#fff1f2",
    padding: 14,
    borderRadius: 10,
  } as const,
};
