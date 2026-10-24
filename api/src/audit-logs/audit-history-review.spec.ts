import { reviewHistoricalAudit } from './audit-history-review';

describe('Historical audit correction evidence', () => {
  const row = {
    entityType: 'Task',
    entityId: 9,
    organizationId: 1,
    oldValue: null,
    newValue: { id: 9, organizationId: 7 },
  };
  it('confirms a full record snapshot corroborated by the current owner', () => {
    expect(
      reviewHistoricalAudit(row, { organizationId: 7, reason: null })
        .confirmedOrganizationId,
    ).toBe(7);
  });
  it('retains record-snapshot evidence after the target has been deleted', () => {
    expect(
      reviewHistoricalAudit(row, {
        organizationId: null,
        reason: 'OWNERSHIP_UNRESOLVED',
      }).confirmedOrganizationId,
    ).toBe(7);
  });
  it('never treats current ownership alone as proof of historical ownership', () => {
    expect(
      reviewHistoricalAudit(
        { ...row, newValue: 'Changed field' },
        { organizationId: 7, reason: null },
      ).confirmedOrganizationId,
    ).toBeNull();
  });
  it('refuses conflicting before and after owners', () => {
    expect(
      reviewHistoricalAudit(
        { ...row, oldValue: { id: 9, organizationId: 55 } },
        { organizationId: 7, reason: null },
      ).reason,
    ).toBe('CONFLICTING_SNAPSHOTS');
  });
  it('refuses a snapshot for another record', () => {
    expect(
      reviewHistoricalAudit(
        { ...row, newValue: { id: 99, organizationId: 7 } },
        { organizationId: 7, reason: null },
      ).confirmedOrganizationId,
    ).toBeNull();
  });
  it('refuses correction when ownership has changed since the snapshot', () => {
    expect(
      reviewHistoricalAudit(row, { organizationId: 55, reason: null })
        .confirmedOrganizationId,
    ).toBeNull();
  });
  it('never maps platform events to a tenant', () => {
    expect(
      reviewHistoricalAudit(
        { ...row, entityType: 'Permission' },
        { organizationId: null, reason: 'PLATFORM_EVENT' },
      ).confirmedOrganizationId,
    ).toBeNull();
  });
});
