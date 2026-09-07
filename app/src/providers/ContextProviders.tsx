import { OrganizationProvider } from './OrganizationProvider';
import { useAuth } from './AuthProvider';
import { BusinessUnitProvider } from './BusinessUnitProvider';
import { useOrganization } from './OrganizationProvider';
export function ContextProviders({ children }: { children: React.ReactNode }) { const { session } = useAuth(); return <OrganizationProvider session={session}><ScopedProviders>{children}</ScopedProviders></OrganizationProvider>; }
function ScopedProviders({ children }: { children: React.ReactNode }) { const { organizationId } = useOrganization(); return <BusinessUnitProvider organizationId={organizationId}>{children}</BusinessUnitProvider>; }
