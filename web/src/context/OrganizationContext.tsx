import React, { createContext, useContext, useState } from 'react';

type Org = { id: number; name: string } | null;

type OrgContext = {
  activeOrganization: Org;
  setActiveOrganization: (org: Org) => void;
  clearOrganization: () => void;
};

const OrganizationContext = createContext<OrgContext | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeOrganization, setActiveOrganizationState] = useState<Org>(() => {
    if (typeof window === 'undefined') return null;

    const raw = window.sessionStorage.getItem('activeOrganization');
    if (!raw) return null;

    try {
      return JSON.parse(raw) as Org;
    } catch {
      return null;
    }
  });

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
