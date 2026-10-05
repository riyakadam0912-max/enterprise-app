import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiError } from "@/src/api/client";
import { attendanceToday } from "@/src/api/attendance";
import {
  reviewTask,
  submitTaskWork,
  task,
  taskMessages,
  sendTaskMessage,
  updateTaskStatus,
  updateTaskTimer,
  type TaskTimerSession,
} from "@/src/api/tasks";
import { UserIdentity } from "@/src/components/UserIdentity";
import { useAuth } from "@/src/providers/AuthProvider";
import { can } from "@/src/utils/permissions";

type Tab = "overview" | "submissions" | "chat";
type TaskData = Record<string, any>;
export default function TaskDetail() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Number(id);
  const allowed = can(session, "task.read") || ["EMPLOYEE", "MANAGER", "HR", "ADMIN", "SUPER_ADMIN"].includes(session?.role ?? "");
  const query = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => task(taskId),
    enabled: allowed && taskId > 0,
  });
  const data = query.data as TaskData | undefined;
  const role = session?.role ?? "EMPLOYEE";
  const attendance = useQuery({
    queryKey: ["attendance-today", session?.organizationId, session?.employeeId],
    queryFn: attendanceToday,
    enabled: ["EMPLOYEE", "MANAGER", "HR", "ADMIN", "SUPER_ADMIN"].includes(role),
  });
  const [tab, setTab] = useState<Tab>("overview");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [remarks, setRemarks] = useState("");
  const [message, setMessage] = useState("");
  const chat = useQuery({
    queryKey: ["task-chat", taskId],
    queryFn: () => taskMessages(taskId),
    enabled: tab === "chat" && taskId > 0,
  });
  const status = String(data?.status ?? "PENDING").toUpperCase();
  const assigned =
    data?.assignedToUserId === session?.user.id ||
    (session?.employeeId != null && data?.assignedToId === session.employeeId);
  const employeeCanSubmit =
    role === "EMPLOYEE" &&
    assigned &&
    ["IN_PROGRESS", "REJECTED"].includes(status);
  const reviewer =
    ["ADMIN", "MANAGER", "SUPER_ADMIN"].includes(role) && status === "SUBMITTED";
  const mutation = useMutation({
    mutationFn: (kind: "start" | "submit" | "approve" | "reject") =>
      kind === "start"
        ? updateTaskStatus(taskId, "IN_PROGRESS")
        : kind === "submit"
          ? submitTaskWork(taskId, {
              submissionLink: link.trim(),
              note: note.trim(),
            })
          : reviewTask(
              taskId,
              kind === "approve" ? "APPROVED" : "REJECTED",
              remarks.trim(),
            ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["task", taskId] });
      void client.invalidateQueries({ queryKey: ["tasks"] });
      setLink("");
      setNote("");
      setRemarks("");
    },
    onError: (error) => Alert.alert("Unable to update task", apiError(error)),
  });
  const send = useMutation({
    mutationFn: () => sendTaskMessage(taskId, message.trim()),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["task-chat", taskId],
      });
      setMessage("");
    },
    onError: (error) => Alert.alert("Unable to send message", apiError(error)),
  });
  if (!allowed)
    return (
      <View style={styles.page}>
        <Text style={styles.error}>
          You do not have permission to view tasks.
        </Text>
      </View>
    );
  if (query.isLoading)
    return (
      <View style={styles.page}>
        <Text>Loading task...</Text>
      </View>
    );
  if (query.isError || !data)
    return (
      <View style={styles.page}>
        <Text style={styles.error}>{apiError(query.error)}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>Go back</Text>
        </Pressable>
      </View>
    );
  const actions = reviewer
    ? ["approve", "reject"]
    : role === "EMPLOYEE" && assigned && status === "PENDING"
      ? ["start"]
      : [];
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>Back to tasks</Text>
      </Pressable>
      <Text style={styles.title}>{String(data.taskName ?? "Task")}</Text>
      <Text style={styles.muted}>
        {data.projectRef?.projectName
          ? `Project · ${data.projectRef.projectName}`
          : "Task workspace"}
      </Text>
      <View style={styles.tabs}>
        {(["overview", "submissions", "chat"] as Tab[]).map((item) => (
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
      {tab === "overview" && (
        <>
          {["EMPLOYEE", "MANAGER", "HR", "ADMIN", "SUPER_ADMIN"].includes(role) && (
            <TaskTimerControl
              taskId={taskId}
              sessions={data.timerSessions ?? []}
              userId={session?.user.id ?? 0}
              attendanceReady={Boolean(attendance.data?.checkIn && !attendance.data.checkOut && !attendance.data.onBreak)}
              attendanceLoading={attendance.isLoading}
              onUpdated={() => {
                void client.invalidateQueries({ queryKey: ["task", taskId] });
                void client.invalidateQueries({ queryKey: ["tasks"] });
              }}
            />
          )}
          <Overview
            data={data}
            status={status}
            actions={actions}
            remarks={remarks}
            setRemarks={setRemarks}
            busy={mutation.isPending}
            act={(kind) =>
              mutation.mutate(kind as "start" | "approve" | "reject")
            }
          />
        </>
      )}
      {tab === "submissions" && (
        <Submissions
          data={data}
          enabled={employeeCanSubmit}
          link={link}
          setLink={setLink}
          note={note}
          setNote={setNote}
          busy={mutation.isPending}
          submit={() => mutation.mutate("submit")}
        />
      )}
      {tab === "chat" && (
        <Chat
          data={chat.data}
          loading={chat.isLoading}
          error={chat.error}
          sessionId={session?.user.id}
          message={message}
          setMessage={setMessage}
          busy={send.isPending}
          send={() => send.mutate()}
        />
      )}
    </ScrollView>
  );
}

function formatTimerDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function TaskTimerControl({
  taskId,
  sessions,
  userId,
  attendanceReady,
  attendanceLoading,
  onUpdated,
}: {
  taskId: number;
  sessions: TaskTimerSession[];
  userId: number;
  attendanceReady: boolean;
  attendanceLoading: boolean;
  onUpdated: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const timerMutation = useMutation({
    mutationFn: (action: "start" | "pause" | "resume" | "stop") =>
      updateTaskTimer(taskId, action),
    onSuccess: onUpdated,
    onError: (error) => Alert.alert("Unable to update timer", apiError(error)),
  });
  const ownSession = sessions.find(
    (session) => session.userId === userId && (session.status === "RUNNING" || session.status === "PAUSED"),
  );

  useEffect(() => {
    if (ownSession?.status !== "RUNNING") return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [ownSession?.status, ownSession?.startedAt]);

  const elapsed = ownSession
    ? ownSession.totalSeconds + (ownSession.status === "RUNNING" && ownSession.startedAt
      ? Math.max(0, Math.floor((now - new Date(ownSession.startedAt).getTime()) / 1000))
      : 0)
    : 0;
  const action = ownSession?.status === "RUNNING"
    ? "pause"
    : ownSession?.status === "PAUSED"
      ? "resume"
      : "start";
  const enabled = action === "pause" || attendanceReady;

  return (
    <View style={styles.timerCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>Task timer</Text>
        <Text style={styles.timerValue}>{ownSession ? formatTimerDuration(elapsed) : "Not running"}</Text>
        {ownSession?.status === "PAUSED" ? <Text style={styles.muted}>Paused</Text> : null}
        {!attendanceReady && !ownSession && !attendanceLoading ? <Text style={styles.muted}>Check in and end any break to start tracking.</Text> : null}
      </View>
      <View style={{ gap: 8 }}>
        <Pressable
          disabled={!enabled || attendanceLoading || timerMutation.isPending}
          onPress={() => timerMutation.mutate(action)}
          style={[styles.timerButton, (!enabled || attendanceLoading || timerMutation.isPending) && styles.disabled]}
        >
          <Text style={styles.actionText}>{timerMutation.isPending ? "..." : action === "start" ? "Start" : action === "pause" ? "Pause" : "Resume"}</Text>
        </Pressable>
        {ownSession ? (
          <Pressable
            disabled={timerMutation.isPending}
            onPress={() => timerMutation.mutate("stop")}
            style={[styles.timerStopButton, timerMutation.isPending && styles.disabled]}
          >
            <Text style={styles.timerStopText}>Stop and log</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Overview({
  data,
  status,
  actions,
  remarks,
  setRemarks,
  busy,
  act,
}: {
  data: TaskData;
  status: string;
  actions: string[];
  remarks: string;
  setRemarks: (v: string) => void;
  busy: boolean;
  act: (v: string) => void;
}) {
  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Task overview</Text>
        <Text style={styles.heroText}>
          {String(data.description ?? "No instructions provided.")}
        </Text>
        {data.links ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.cardTitle}>Reference links</Text>
            {String(data.links)
              .split(",")
              .map((link) => link.trim())
              .filter(Boolean)
              .map((link) => (
                <Text
                  key={link}
                  style={styles.linkText}
                  onPress={() => void Linking.openURL(link)}
                >
                  {link}
                </Text>
              ))}
          </View>
        ) : null}
        {data.driveLink ? (
          <Text
            style={styles.linkText}
            onPress={() => void Linking.openURL(String(data.driveLink))}
          >
            Google Drive
          </Text>
        ) : null}
        <View style={styles.stats}>
          <Stat label="Status" value={status.replaceAll("_", " ")} />
          <Stat label="Priority" value={String(data.priority ?? "Not set")} />
          <Stat
            label="Due"
            value={String(data.dueDate ?? "Not set").slice(0, 10)}
          />
        </View>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assignment</Text>
        <UserIdentity
          userId={Number(
            data.assignedToUser?.id ??
            data.assignedToUserId ??
            data.assignee?.id ??
            0,
          ) || undefined}
          name={String(data.assignee ?? data.assignedToUser?.name ?? "Unassigned")}
          subtitle={String(data.assignedToUser?.role ?? "Assigned worker")}
          size="md"
        />
        <Text style={styles.detail}>
          Created by: {String(data.assignedByUser?.name ?? "Not set")}
        </Text>
        {actions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Next action</Text>
            {actions.some((item) => item !== "start") && (
              <TextInput
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Review remarks (optional)"
                multiline
                style={[styles.input, styles.multiline]}
              />
            )}
            <View style={styles.actions}>
              {actions.map((item) => (
                <Pressable
                  key={item}
                  disabled={busy}
                  onPress={() => act(item)}
                  style={[
                    styles.action,
                    item === "approve" && styles.complete,
                    item === "reject" && styles.reject,
                  ]}
                >
                  <Text style={styles.actionText}>
                    {item === "start"
                      ? "Start task"
                      : item[0].toUpperCase() + item.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </>
  );
}
function Submissions({
  data,
  enabled,
  link,
  setLink,
  note,
  setNote,
  busy,
  submit,
}: {
  data: TaskData;
  enabled: boolean;
  link: string;
  setLink: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  busy: boolean;
  submit: () => void;
}) {
  return (
    <>
      <Text style={styles.sectionTitle}>Submissions</Text>
      <View style={styles.card}>
        {data.submissionLink || data.submissionNotes ? (
          <>
            <Text style={styles.label}>Latest submission</Text>
            {data.submissionLink && (
              <Text style={styles.link}>{String(data.submissionLink)}</Text>
            )}
            <Text style={styles.detail}>
              {String(data.submissionNotes ?? "No notes provided.")}
            </Text>
            {data.reviewComment && (
              <View style={styles.review}>
                <Text style={styles.label}>Reviewer feedback</Text>
                <Text style={styles.detail}>{String(data.reviewComment)}</Text>
              </View>
            )}
          </>
        ) : (
          <Empty
            title="No submission yet"
            text="Completed work and feedback will appear here."
          />
        )}
      </View>
      {enabled && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Submit completed work</Text>
          <TextInput
            value={link}
            onChangeText={setLink}
            placeholder="Submission link (optional)"
            style={styles.input}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Describe the completed work"
            multiline
            style={[styles.input, styles.multiline]}
          />
          <Pressable
            disabled={busy || !note.trim()}
            onPress={submit}
            style={[styles.submit, !note.trim() && styles.disabled]}
          >
            <Text style={styles.actionText}>
              {busy ? "Submitting..." : "Submit task"}
            </Text>
          </Pressable>
        </View>
      )}
    </>
  );
}
function Chat({
  data,
  loading,
  error,
  sessionId,
  message,
  setMessage,
  busy,
  send,
}: {
  data?: Array<any>;
  loading: boolean;
  error: unknown;
  sessionId?: number;
  message: string;
  setMessage: (v: string) => void;
  busy: boolean;
  send: () => void;
}) {
  return (
    <>
      <View style={styles.chatHeader}>
        <View style={styles.chatIcon}>
          <Text style={styles.chatIconText}>#</Text>
        </View>
        <View style={styles.chatCopy}>
          <Text style={styles.chatTitle}>Task project chat</Text>
          <Text style={styles.chatSubtitle}>Project team conversation</Text>
        </View>
        <Text style={styles.live}>LIVE</Text>
      </View>
      <View style={styles.chatShell}>
        <View style={styles.messagePane}>
          {loading ? (
            <Text style={styles.chatEmpty}>Loading conversation...</Text>
          ) : error ? (
            <Text style={styles.error}>{apiError(error)}</Text>
          ) : data?.length ? (
            data.map((item) => {
              const mine = item.sender?.id === sessionId;
              return (
                <View
                  key={item.id}
                  style={[styles.messageRow, mine && styles.mine]}
                >
                  {!mine ? (
                    <UserIdentity
                      userId={Number(item.sender?.id ?? 0) || undefined}
                      name={item.sender?.name ?? "Team member"}
                      size="sm"
                      showLabel={false}
                    />
                  ) : null}
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.bubbleMine : styles.bubbleTheir,
                    ]}
                  >
                    <Text style={[styles.sender, mine && styles.senderMine]}>
                      {mine ? "You" : (item.sender?.name ?? "Team member")}
                    </Text>
                    <Text
                      style={[styles.bubbleText, mine && styles.bubbleTextMine]}
                    >
                      {item.content}
                    </Text>
                    <Text style={[styles.time, mine && styles.timeMine]}>
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Empty
              title="No messages yet"
              text="Start the project conversation."
            />
          )}
        </View>
        <View style={styles.composer}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Write to the project team..."
            placeholderTextColor="#94a3b8"
            multiline
            style={styles.composerInput}
          />
          <Pressable
            disabled={busy || !message.trim()}
            onPress={send}
            style={[styles.send, (!message.trim() || busy) && styles.disabled]}
          >
            <Text style={styles.sendText}>{busy ? "..." : "↑"}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
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
  muted: { color: "#64748b", marginTop: 5 } as const,
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
  hero: {
    backgroundColor: "#172033",
    borderRadius: 18,
    padding: 20,
    marginTop: 18,
  } as const,
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "800" } as const,
  heroText: { color: "#cbd5e1", lineHeight: 21, marginTop: 8 } as const,
  linkText: { color: "#2563eb", marginTop: 6, textDecorationLine: "underline" } as const,
  stats: { flexDirection: "row", gap: 8, marginTop: 18 } as const,
  stat: {
    flex: 1,
    backgroundColor: "#26334a",
    borderRadius: 10,
    padding: 10,
  } as const,
  statLabel: { color: "#94a3b8", fontSize: 11 } as const,
  statValue: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
    marginTop: 5,
  } as const,
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  } as const,
  timerCard: {
    backgroundColor: "#fff",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  } as const,
  timerValue: { color: "#172033", fontSize: 24, fontWeight: "800", marginTop: 6 } as const,
  timerButton: { backgroundColor: "#ea580c", borderRadius: 9, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" } as const,
  timerStopButton: { borderColor: "#cbd5e1", borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center" } as const,
  timerStopText: { color: "#475569", fontWeight: "700", fontSize: 11 } as const,
  cardTitle: { color: "#172033", fontSize: 16, fontWeight: "800" } as const,
  label: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
  } as const,
  detail: { color: "#475569", lineHeight: 20, marginTop: 9 } as const,
  sectionTitle: {
    color: "#172033",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 10,
  } as const,
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  } as const,
  action: { backgroundColor: "#172033", borderRadius: 9, padding: 11 } as const,
  complete: { backgroundColor: "#059669" } as const,
  reject: { backgroundColor: "#be123c" } as const,
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
  submit: {
    backgroundColor: "#ea580c",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  } as const,
  disabled: { opacity: 0.45 } as const,
  link: { color: "#2563eb", fontWeight: "700", marginTop: 8 } as const,
  review: {
    backgroundColor: "#fff7ed",
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  } as const,
  empty: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  } as const,
  chatHeader: {
    backgroundColor: "#172033",
    borderRadius: 16,
    padding: 16,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
  } as const,
  chatIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ea580c",
    alignItems: "center",
    justifyContent: "center",
  } as const,
  chatIconText: { color: "#fff", fontSize: 22, fontWeight: "800" } as const,
  chatCopy: { flex: 1, marginLeft: 11 } as const,
  chatTitle: { color: "#fff", fontSize: 16, fontWeight: "800" } as const,
  chatSubtitle: { color: "#cbd5e1", fontSize: 12, marginTop: 4 } as const,
  live: { color: "#a7f3d0", fontSize: 10, fontWeight: "800" } as const,
  chatShell: {
    backgroundColor: "#eef2f7",
    borderRadius: 16,
    padding: 10,
    marginTop: 10,
  } as const,
  messagePane: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    minHeight: 280,
    maxHeight: 440,
  } as const,
  chatEmpty: { color: "#94a3b8", textAlign: "center", padding: 20 } as const,
  messageRow: {
    flexDirection: "row",
    marginBottom: 12,
    maxWidth: "88%",
  } as const,
  mine: { alignSelf: "flex-end" } as const,
  bubble: { borderRadius: 15, padding: 11 } as const,
  bubbleTheir: {
    backgroundColor: "#f1f5f9",
    borderBottomLeftRadius: 4,
  } as const,
  bubbleMine: {
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 4,
  } as const,
  sender: { color: "#334155", fontSize: 11, fontWeight: "800" } as const,
  senderMine: { color: "#dbeafe" } as const,
  bubbleText: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  } as const,
  bubbleTextMine: { color: "#fff" } as const,
  time: { color: "#94a3b8", fontSize: 10, marginTop: 5 } as const,
  timeMine: { color: "#bfdbfe" } as const,
  composer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 10,
    padding: 7,
    flexDirection: "row",
    alignItems: "flex-end",
  } as const,
  composerInput: {
    flex: 1,
    color: "#172033",
    padding: 8,
    maxHeight: 80,
  } as const,
  send: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#172033",
    alignItems: "center",
    justifyContent: "center",
  } as const,
  sendText: { color: "#fff", fontSize: 20, fontWeight: "800" } as const,
  error: {
    color: "#be123c",
    backgroundColor: "#fff1f2",
    padding: 14,
    borderRadius: 10,
  } as const,
};
