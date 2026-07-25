import React, { createContext, useContext, useState, useEffect } from 'react';

type Org = { id: number; name: string } | null;

type OrgContext = {
  activeOrganization: Org;
  setActiveOrganization: (org: Org) => void;
  clearOrganization: () => void;
};

const OrganizationContext = createContext<OrgContext | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeOrganization, setActiveOrganizationState] = useState<Org>(null);

  useEffect(() => {
    // Hydration: read from sessionStorage if present
    const raw = sessionStorage.getItem('activeOrganization');
    if (raw) {
      try {
        setActiveOrganizationState(JSON.parse(raw));
      } catch {}
    }
  }, []);

  const setActiveOrganization = (org: Org) => {
    setActiveOrganizationState(org);
    if (org) sessionStorage.setItem('activeOrganization', JSON.stringify(org));
    else sessionStorage.removeItem('activeOrganization');
  };

  const clearOrganization = () => setActiveOrganization(null);

  return (
    <OrganizationContext.Provider value={{ activeOrganization, setActiveOrganization, clearOrganization }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used within OrganizationProvider');
  return ctx;
};

export default OrganizationContext;
