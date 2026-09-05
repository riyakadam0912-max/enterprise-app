import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { emailTemplates, previewEmail, type EmailPreviewResponse, type EmailTemplateOption } from '@/src/api/email';
import { apiError } from '@/src/api/client';
import { useAuth } from '@/src/providers/AuthProvider';
import { can } from '@/src/utils/permissions';

const SAMPLE_VALUES: Record<string, string> = {
  firstName: 'Asha',
  organization: 'Enterprise ERP',
  ctaUrl: 'https://example.com/dashboard',
  ctaText: 'Open dashboard',
  role: 'Manager',
  message: 'Please review this update in your workspace.',
};

export default function EmailPreview() {
  const { session } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([]);
  const [template, setTemplate] = useState('welcome');
  const [values, setValues] = useState(SAMPLE_VALUES);
  const [preview, setPreview] = useState<EmailPreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState('');
  const selected = useMemo(() => templates.find((item) => item.name === template), [template, templates]);

  useEffect(() => {
    let mounted = true;
    emailTemplates()
      .then((items) => {
        if (!mounted) return;
        setTemplates(items);
        setTemplate((current) => items.some((item) => item.name === current) ? current : items[0]?.name ?? 'welcome');
      })
      .catch((reason: unknown) => mounted && setError(apiError(reason)))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  if (!can(session, 'email.preview', ['ADMIN', 'SUPER_ADMIN'])) {
    return <View style={styles.center}><Text style={styles.error}>You do not have permission to preview email templates.</Text></View>;
  }

  async function renderPreview() {
    setRendering(true);
    setError('');
    try {
      setPreview(await previewEmail(template, values));
    } catch (reason: unknown) {
      setPreview(null);
      setError(apiError(reason));
    } finally {
      setRendering(false);
    }
  }

  return <ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.eyebrow}>COMMUNICATIONS</Text>
    <Text style={styles.title}>Email preview</Text>
    <Text style={styles.subtitle}>Review the rendered message before delivery.</Text>

    <Text style={styles.label}>Template</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
      {templates.map((item) => <Pressable key={item.name} onPress={() => { setTemplate(item.name); setPreview(null); }} style={[styles.templateChip, item.name === template && styles.templateChipActive]}><Text style={[styles.templateText, item.name === template && styles.templateTextActive]}>{item.name}</Text></Pressable>)}
    </ScrollView>

    {selected?.requiredFields.map((field) => <View key={field} style={styles.field}><Text style={styles.label}>{field}</Text><TextInput value={values[field] ?? ''} onChangeText={(value) => setValues((current) => ({ ...current, [field]: value }))} style={styles.input} /></View>)}
    <Pressable disabled={loading || rendering} onPress={() => void renderPreview()} style={styles.button}><Text style={styles.buttonText}>{rendering ? 'Rendering...' : 'Render preview'}</Text></Pressable>
    {error ? <Text style={styles.error}>{error}</Text> : null}

    <Text style={styles.previewTitle}>Rendered message</Text>
    {preview ? <View style={styles.webViewFrame}><WebView originWhitelist={['*']} source={{ html: preview.html }} style={styles.webView} /></View> : <View style={styles.empty}><Text style={styles.emptyText}>Choose values, then render the preview.</Text></View>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { padding: 20, backgroundColor: '#f8fafc', minHeight: '100%' },
  center: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#f8fafc' },
  eyebrow: { color: '#b45309', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#172033', fontSize: 30, fontWeight: '800', marginTop: 8 },
  subtitle: { color: '#64748b', fontSize: 15, marginTop: 8, marginBottom: 24 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 7 },
  templateRow: { gap: 8, paddingBottom: 18 },
  templateChip: { backgroundColor: '#fff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  templateChipActive: { backgroundColor: '#172033', borderColor: '#172033' },
  templateText: { color: '#475569', fontSize: 13, fontWeight: '700' },
  templateTextActive: { color: '#fff' },
  field: { marginBottom: 14 },
  input: { backgroundColor: '#fff', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11, color: '#172033' },
  button: { backgroundColor: '#172033', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontWeight: '800' },
  error: { color: '#b91c1c', backgroundColor: '#fef2f2', padding: 12, borderRadius: 10, marginTop: 14 },
  previewTitle: { color: '#172033', fontSize: 18, fontWeight: '800', marginTop: 28, marginBottom: 12 },
  webViewFrame: { height: 650, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderColor: '#e2e8f0', borderWidth: 1 },
  webView: { flex: 1 },
  empty: { height: 160, borderRadius: 14, borderColor: '#cbd5e1', borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#64748b' },
});