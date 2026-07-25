import React from 'react';
import { useOrganization } from '../context/OrganizationContext';

export const OrganizationSwitcher: React.FC = () => {
  const { activeOrganization, clearOrganization } = useOrganization();
  return (
    <div>
      <span>Current Organization: {activeOrganization?.name ?? 'None'}</span>
      {activeOrganization && <button onClick={() => clearOrganization()}>Leave Organization</button>}
    </div>
  );
};

export default OrganizationSwitcher;
