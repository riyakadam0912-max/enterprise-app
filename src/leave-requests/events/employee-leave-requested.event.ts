/**
 * Event emitted when an employee requests leave
 * Used for triggering notifications and email workflows
 */
export class EmployeeLeaveRequestedEvent {
  constructor(
    public readonly leaveRequestId: number,
    public readonly employeeId: number,
    public readonly employeeName: string,
    public readonly employeeEmail: string | null,
    public readonly managerId: number | null,
    public readonly managerName: string | null,
    public readonly leaveType: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly reason?: string,
  ) {}
}
