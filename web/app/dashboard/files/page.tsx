import { FileManagementPanel } from '@/components/files/FileManagementPanel';

export default function FilesDashboardPage() {
  return (
    <main
      className="min-h-screen bg-slate-50 px-4 py-6 md:px-6 lg:px-8"
      style={{
        backgroundImage:
          'radial-gradient(circle at top, rgba(34, 211, 238, 0.08), transparent 35%), linear-gradient(180deg, #f8fbff, #eef4fb)',
      }}
    >
      <div className="mx-auto max-w-7xl">
        <FileManagementPanel />
      </div>
    </main>
  );
}
