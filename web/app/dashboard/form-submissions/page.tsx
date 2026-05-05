'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FormSubmissionsAliasPage() {
	const router = useRouter();

	useEffect(() => {
		router.replace('/dashboard/forms');
	}, [router]);

	return <div className="p-6 text-sm text-slate-500">Redirecting...</div>;
}
