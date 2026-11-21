export class EmployeeLeaveDecisionEvent {
  constructor(
    public readonly leaveRequestId: number,
    public readonly employeeUserId: number | null,
    public readonly employeeName: string,
    public readonly employeeEmail: string | null,
    public readonly leaveType: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly organizationId: number,
    public readonly decidedByName: string,
    public readonly reason?: string,
  ) {}
}
