import React, { useEffect, useState } from 'react';
import { axiosClient } from '../../api/axiosClient';
import { useOrganization } from '../../context/OrganizationContext';

export default function GlobalDashboard() {
  const [orgs, setOrgs] = useState<Array<{ id: number; name: string }>>([]);
  const { setActiveOrganization } = useOrganization();

  useEffect(() => {
    (async () => {
      try {
        const resp = await axiosClient.get('/organizations');
        setOrgs(resp.data || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  return (
    <div>
      <h1>Global Dashboard</h1>
      <ul>
        {orgs.map((o) => (
          <li key={o.id}>
            {o.name} <button onClick={() => setActiveOrganization(o)}>Enter</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
