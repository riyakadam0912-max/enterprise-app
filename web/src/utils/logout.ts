export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('employeeId');
    localStorage.removeItem('currentUser');
    window.location.href = '/login';
  }
}
