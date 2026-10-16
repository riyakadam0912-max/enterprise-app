import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { apiError } from '@/src/api/client';
import { reviewTimesheet, submitTimesheet, timesheet } from '@/src/api/modules';
import { useAuth } from '@/src/providers/AuthProvider';
import { formatHoursDuration } from '@/src/utils/time-format';

const statusLabel = (status: string) =>
  status === 'PENDING' ? 'Draft' : status.charAt(0) + status.slice(1).toLowerCase();

const sourceLabel = (source?: string) =>
  source === 'TASK_TIMER'
    ? 'Task timer'
    : source === 'IMPORT'
      ? 'Import'
      : source === 'MANUAL'
        ? 'Manual entry'
        : 'Legacy entry';

export default function TimesheetDetail() {
  const router = useRouter();
  const client = useQueryClient();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const timesheetId = Number(id);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const query = useQuery({
    queryKey: ['timesheet', timesheetId],
    queryFn: () => timesheet(timesheetId),
    enabled: Number.isInteger(timesheetId) && timesheetId > 0,
  });
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['timesheet', timesheetId] });
    void client.invalidateQueries({ queryKey: ['timesheets'] });
  };
  const submitMutation = useMutation({
    mutationFn: () => submitTimesheet(timesheetId),
    onSuccess: () => {
      refresh();
      Alert.alert('Timesheet submitted', 'Your entry is now waiting for review.');
    },
    onError: (error) => Alert.alert('Unable to submit', apiError(error)),
  });
  const reviewMutation = useMutation({
    mutationFn: (decision: 'APPROVED' | 'REJECTED') =>
      reviewTimesheet(
        timesheetId,
        decision,
        decision === 'REJECTED' ? rejectionReason.trim() : undefined,
      ),
    onSuccess: (_result, decision) => {
      refresh();
      setRejectOpen(false);
      setRejectionReason('');
      Alert.alert(
        decision === 'APPROVED' ? 'Timesheet approved' : 'Timesheet returned',
        decision === 'APPROVED'
          ? 'The work log is approved.'
          : 'The employee can update and resubmit this entry.',
      );
    },
    onError: (error) => setReviewError(apiError(error)),
  });

  if (query.isLoading) {
    return <View style={styles.page}><Text style={styles.muted}>Loading timesheet...</Text></View>;
  }
  if (query.isError || !query.data) {
    return (
      <View style={styles.page}>
        <Text style={styles.error}>{apiError(query.error)}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Go back</Text></Pressable>
      </View>
    );
  }

  const current = query.data;
  const owner = current.createdByUserId === session?.user.id;
  const reviewer = ['ADMIN', 'HR', 'SUPER_ADMIN', 'MANAGER'].includes(session?.role ?? '');
  const canEdit = owner && ['PENDING', 'REJECTED'].includes(current.status);
  const canSubmit = canEdit;
  const canReview = reviewer && !owner && current.status === 'SUBMITTED';
  const statusColors: Record<string, { backgroundColor: string; color: string }> = {
    PENDING: { backgroundColor: '#f1f5f9', color: '#475569' },
    SUBMITTED: { backgroundColor: '#fffbeb', color: '#a16207' },
    APPROVED: { backgroundColor: '#f0fdfa', color: '#0f766e' },
    REJECTED: { backgroundColor: '#fff1f2', color: '#be123c' },
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back to timesheets</Text></Pressable>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>WORK LOG</Text>
            <Text style={styles.title}>{current.task}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColors[current.status]?.backgroundColor ?? '#f1f5f9' }]}><Text style={[styles.statusText, { color: statusColors[current.status]?.color ?? '#475569' }]}>{statusLabel(current.status)}</Text></View>
        </View>

        <View style={styles.card}>
          {[
            ['Date', current.date],
            ['Duration', formatHoursDuration(current.hours)],
            ['Project', current.project ?? 'Not set'],
            ['Source', sourceLabel(current.source)],
            ['Notes', current.notes ?? 'Not set'],
          ].map(([label, value]) => (
            <View key={label} style={styles.detailRow}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.detail}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Submission &amp; review</Text>
          {current.createdByUser?.name ? <Text style={styles.detail}>Created by {current.createdByUser.name}</Text> : null}
          <View style={styles.timeline}>
            <View style={styles.timelineStep}><View style={styles.timelineDot} /><Text style={styles.timelineText}>Draft</Text></View>
            <View style={[styles.timelineLine, current.submittedAt && styles.timelineLineActive]} />
            <View style={styles.timelineStep}><View style={[styles.timelineDot, current.submittedAt && styles.timelineDotActive]} /><Text style={[styles.timelineText, !current.submittedAt && styles.timelineTextMuted]}>Submitted</Text></View>
            <View style={[styles.timelineLine, current.reviewedAt && styles.timelineLineActive]} />
            <View style={styles.timelineStep}><View style={[styles.timelineDot, current.reviewedAt && styles.timelineDotActive]} /><Text style={[styles.timelineText, !current.reviewedAt && styles.timelineTextMuted]}>{current.status === 'REJECTED' ? 'Returned' : 'Reviewed'}</Text></View>
          </View>
          <Text style={styles.detail}>
            {current.createdAt
              ? `Created as a draft ${new Date(current.createdAt).toLocaleString()}`
              : 'Created as a draft'}
          </Text>
          {current.submittedAt ? <Text style={styles.detail}>Submitted {new Date(current.submittedAt).toLocaleString()}</Text> : null}
          {current.reviewedAt ? <Text style={styles.detail}>Last reviewed {new Date(current.reviewedAt).toLocaleString()}{current.reviewedByUser?.name ? ` by ${current.reviewedByUser.name}` : ''}</Text> : null}
          {current.rejectionReason ? <View style={styles.reason}><Text style={styles.reasonLabel}>Reason for return</Text><Text style={styles.reasonText}>{current.rejectionReason}</Text></View> : null}
        </View>

        {canEdit ? (
          <Link href={{ pathname: '/timesheet/[id]/edit', params: { id: String(timesheetId) } }} asChild>
            <Pressable accessibilityRole="button" style={styles.secondaryAction}><Text style={styles.secondaryActionText}>{current.status === 'REJECTED' ? 'Edit returned entry' : 'Edit draft'}</Text></Pressable>
          </Link>
        ) : null}
        {canSubmit ? (
          <Pressable accessibilityRole="button" disabled={submitMutation.isPending} onPress={() => submitMutation.mutate()} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>{submitMutation.isPending ? 'Submitting…' : current.status === 'REJECTED' ? 'Resubmit for review' : 'Submit for review'}</Text>
          </Pressable>
        ) : null}
        {canReview ? (
          <View style={styles.reviewActions}>
            <Pressable accessibilityRole="button" disabled={reviewMutation.isPending} onPress={() => Alert.alert('Approve this work log?', 'This confirms the reported hours and locks the entry from further edits.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Approve', onPress: () => reviewMutation.mutate('APPROVED') }])} style={styles.approveAction}>
              <Text style={styles.approveText}>{reviewMutation.isPending ? 'Saving…' : 'Approve'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { setReviewError(''); setRejectOpen(true); }} style={styles.rejectAction}>
              <Text style={styles.rejectText}>Return for edits</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={rejectOpen} transparent animationType="fade" onRequestClose={() => setRejectOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Return timesheet</Text>
            <Text style={styles.muted}>Add a short reason so the employee knows what to update.</Text>
            <TextInput
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="Reason for returning this entry"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              style={styles.reasonInput}
            />
            {reviewError ? <Text style={styles.error}>{reviewError}</Text> : null}
            <View style={styles.reviewActions}>
              <Pressable accessibilityRole="button" onPress={() => setRejectOpen(false)} style={styles.cancelAction}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={reviewMutation.isPending || !rejectionReason.trim()}
                onPress={() => reviewMutation.mutate('REJECTED')}
                style={[styles.returnAction, (!rejectionReason.trim() || reviewMutation.isPending) && { opacity: 0.5 }]}
              >
                <Text style={styles.primaryActionText}>{reviewMutation.isPending ? 'Saving…' : 'Return entry'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = {
  page: { padding: 20, backgroundColor: '#f8fafc', flexGrow: 1 } as const,
  back: { color: '#475569', fontWeight: '700' } as const,
  eyebrow: { color: '#0f766e', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 } as const,
  title: { color: '#172033', fontSize: 26, fontWeight: '800', marginTop: 5 } as const,
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22, marginBottom: 14 } as const,
  statusPill: { backgroundColor: '#fffbeb', borderRadius: 99, paddingHorizontal: 11, paddingVertical: 7 } as const,
  statusText: { color: '#a16207', fontSize: 12, fontWeight: '700' } as const,
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 17, marginBottom: 12 } as const,
  detailRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' } as const,
  label: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 } as const,
  detail: { color: '#334155', marginTop: 5, lineHeight: 20 } as const,
  sectionTitle: { color: '#172033', fontSize: 16, fontWeight: '800', marginBottom: 8 } as const,
  timeline: { flexDirection: 'row', alignItems: 'center', marginVertical: 13 } as const,
  timelineStep: { alignItems: 'center', gap: 5 } as const,
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#cbd5e1' } as const,
  timelineDotActive: { backgroundColor: '#0f766e' } as const,
  timelineLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0', marginHorizontal: 5 } as const,
  timelineLineActive: { backgroundColor: '#5eead4' } as const,
  timelineText: { color: '#475569', fontSize: 10, fontWeight: '700' } as const,
  timelineTextMuted: { color: '#94a3b8' } as const,
  muted: { color: '#64748b', marginTop: 5, lineHeight: 19 } as const,
  reason: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#fff1f2' } as const,
  reasonLabel: { color: '#be123c', fontWeight: '700', fontSize: 12, marginBottom: 5 } as const,
  reasonText: { color: '#881337', lineHeight: 19 } as const,
  secondaryAction: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 2 } as const,
  secondaryActionText: { color: '#334155', fontWeight: '800' } as const,
  primaryAction: { backgroundColor: '#0f766e', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 10 } as const,
  primaryActionText: { color: '#fff', fontWeight: '800' } as const,
  reviewActions: { flexDirection: 'row', gap: 10, marginTop: 10 } as const,
  approveAction: { flex: 1, backgroundColor: '#0f766e', borderRadius: 12, padding: 14, alignItems: 'center' } as const,
  approveText: { color: '#fff', fontWeight: '800' } as const,
  rejectAction: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fecdd3', borderRadius: 12, padding: 14, alignItems: 'center' } as const,
  rejectText: { color: '#be123c', fontWeight: '800' } as const,
  error: { color: '#be123c', marginTop: 10, lineHeight: 19 } as const,
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'center', padding: 20 } as const,
  modalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 20 } as const,
  reasonInput: { minHeight: 110, marginTop: 16, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, color: '#172033' } as const,
  cancelAction: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 13, alignItems: 'center' } as const,
  cancelText: { color: '#475569', fontWeight: '700' } as const,
  returnAction: { flex: 1, backgroundColor: '#e11d48', borderRadius: 12, padding: 13, alignItems: 'center' } as const,
};
