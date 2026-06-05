'use client';

import { useState, useEffect, useCallback } from 'react';

// Mock API - Replace with actual API calls
interface ProviderHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: string;
  successRate: number;
  avgResponseTime: number;
  totalSent: number;
  totalFailed: number;
}

interface DeliveryLog {
  id: number;
  notificationId: number;
  userId: number;
  userName: string;
  channel: string;
  provider: string;
  status: 'sent' | 'failed' | 'pending' | 'retry';
  subject: string;
  recipient: string;
  sentAt: string;
  deliveredAt?: string;
  error?: string;
  retryCount: number;
}

function ShieldIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}


function AlertIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function RefreshIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function CheckCircleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function XCircleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

export default function NotificationAdminPage() {
  const [activeTab, setActiveTab] = useState<'providers' | 'logs' | 'failed'>('providers');
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [failedLogs, setFailedLogs] = useState<DeliveryLog[]>([]);

  const loadData = useCallback(() => {
    setLoading(true);
    // Mock data - Replace with actual API calls
    setTimeout(() => {
      setProviders([
        {
          name: 'SendGrid',
          status: 'healthy',
          lastCheck: new Date().toISOString(),
          successRate: 99.8,
          avgResponseTime: 245,
          totalSent: 15234,
          totalFailed: 31,
        },
        {
          name: 'AWS SES',
          status: 'healthy',
          lastCheck: new Date().toISOString(),
          successRate: 99.5,
          avgResponseTime: 312,
          totalSent: 8921,
          totalFailed: 45,
        },
        {
          name: 'Resend',
          status: 'degraded',
          lastCheck: new Date().toISOString(),
          successRate: 95.2,
          avgResponseTime: 567,
          totalSent: 3456,
          totalFailed: 167,
        },
      ]);

      setDeliveryLogs([
        {
          id: 1,
          notificationId: 1001,
          userId: 1,
          userName: 'John Doe',
          channel: 'EMAIL',
          provider: 'SendGrid',
          status: 'sent',
          subject: 'Leave Request Approved',
          recipient: 'john@example.com',
          sentAt: new Date(Date.now() - 300000).toISOString(),
          deliveredAt: new Date(Date.now() - 295000).toISOString(),
          retryCount: 0,
        },
        {
          id: 2,
          notificationId: 1002,
          userId: 2,
          userName: 'Jane Smith',
          channel: 'EMAIL',
          provider: 'AWS SES',
          status: 'sent',
          subject: 'New Task Assigned',
          recipient: 'jane@example.com',
          sentAt: new Date(Date.now() - 600000).toISOString(),
          deliveredAt: new Date(Date.now() - 595000).toISOString(),
          retryCount: 0,
        },
      ]);

      setFailedLogs([
        {
          id: 3,
          notificationId: 1003,
          userId: 3,
          userName: 'Bob Wilson',
          channel: 'EMAIL',
          provider: 'Resend',
          status: 'failed',
          subject: 'Expense Report Rejected',
          recipient: 'bob@invalid-domain.com',
          sentAt: new Date(Date.now() - 900000).toISOString(),
          error: 'Invalid recipient email address',
          retryCount: 3,
        },
      ]);

      setLoading(false);
    }, 500);
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab, loadData]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
      case 'degraded': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'down': return 'bg-red-100 text-red-800 border-red-200';
      case 'sent': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'retry': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleRetry = async (logId: number) => {
    console.log('Retrying notification:', logId);
    // Implement retry logic
  };

  const handleRetryAll = async () => {
    console.log('Retrying all failed notifications');
    // Implement retry all logic
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ShieldIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Notification Administration</h1>
                <p className="text-sm text-gray-500">Monitor providers, delivery logs, and system health</p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshIcon className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'providers'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Provider Health
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'logs'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Delivery Logs
            </button>
            <button
              onClick={() => setActiveTab('failed')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'failed'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Failed Notifications
              {failedLogs.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-red-100 text-red-800 rounded-full">
                  {failedLogs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <>
            {/* Provider Health Tab */}
            {activeTab === 'providers' && (
              <div className="space-y-4">
                {providers.map((provider) => (
                  <div key={provider.name} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(provider.status)}`}>
                          {provider.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        Last checked: {new Date(provider.lastCheck).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="px-6 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Success Rate</p>
                          <p className="text-2xl font-bold text-gray-900">{provider.successRate}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Avg Response</p>
                          <p className="text-2xl font-bold text-gray-900">{provider.avgResponseTime}ms</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Total Sent</p>
                          <p className="text-2xl font-bold text-green-600">{provider.totalSent.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Total Failed</p>
                          <p className="text-2xl font-bold text-red-600">{provider.totalFailed.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Health Score</p>
                          <div className="flex items-center gap-2">
                            {provider.status === 'healthy' ? (
                              <CheckCircleIcon className="w-6 h-6 text-green-600" />
                            ) : provider.status === 'degraded' ? (
                              <AlertIcon className="w-6 h-6 text-yellow-600" />
                            ) : (
                              <XCircleIcon className="w-6 h-6 text-red-600" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Delivery Logs Tab */}
            {activeTab === 'logs' && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Channel</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {deliveryLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{log.notificationId}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{log.userName}</div>
                            <div className="text-xs text-gray-500">{log.recipient}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{log.subject}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.channel}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.provider}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded border ${getStatusColor(log.status)}`}>
                              {log.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(log.sentAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Failed Notifications Tab */}
            {activeTab === 'failed' && (
              <div className="space-y-4">
                {failedLogs.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleRetryAll}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <RefreshIcon className="w-4 h-4" />
                      Retry All Failed
                    </button>
                  </div>
                )}
                {failedLogs.length === 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Failed Notifications</h3>
                    <p className="text-sm text-gray-500">All notifications have been delivered successfully!</p>
                  </div>
                ) : (
                  failedLogs.map((log) => (
                    <div key={log.id} className="bg-white rounded-lg border border-red-200 overflow-hidden">
                      <div className="px-6 py-4 bg-red-50 border-b border-red-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <XCircleIcon className="w-5 h-5 text-red-600" />
                          <h3 className="text-sm font-semibold text-gray-900">Notification #{log.notificationId}</h3>
                          <span className="text-xs text-gray-500">Retry attempts: {log.retryCount}</span>
                        </div>
                        <button
                          onClick={() => handleRetry(log.id)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 transition-colors"
                        >
                          <RefreshIcon className="w-3 h-3" />
                          Retry
                        </button>
                      </div>
                      <div className="px-6 py-4">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Recipient</p>
                            <p className="text-sm font-medium text-gray-900">{log.userName}</p>
                            <p className="text-xs text-gray-500">{log.recipient}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Subject</p>
                            <p className="text-sm font-medium text-gray-900">{log.subject}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Channel / Provider</p>
                            <p className="text-sm font-medium text-gray-900">{log.channel} / {log.provider}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Failed At</p>
                            <p className="text-sm font-medium text-gray-900">{new Date(log.sentAt).toLocaleString()}</p>
                          </div>
                        </div>
                        {log.error && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-red-800 mb-1">Error Details:</p>
                            <p className="text-xs text-red-700">{log.error}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Made with Bob
