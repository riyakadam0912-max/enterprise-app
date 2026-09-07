import { ModuleListScreen, RecordCard } from '@/src/components/ModuleListScreen';
import { listEndpoint } from '@/src/api/modules';
export default function Notifications() { return <ModuleListScreen title="Notifications" subtitle="Updates from your ERP workspace." queryKey={['notifications']} load={() => listEndpoint('/notifications')} renderItem={(item) => <RecordCard item={item} titleKey="title" detailKeys={['message', 'createdAt', 'read']} />} />; }
