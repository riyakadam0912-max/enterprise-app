'use client';

import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useRouter } from 'next/navigation';
import type { Notification } from '@/api/notificationsApi';

// Icons
function BellIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function FilterIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SettingsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m0 6l4.2 4.2M23 12h-6m-6 0H1m18.2 5.2l-4.2-4.2m0-6l4.2-4.2" />
    </svg>
  );
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, markRead, markAllRead, remove, refetch, page } = useNotifications();
  const router = useRouter();
  
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const handleFilterChange = (newFilter: 'all' | 'unread') => {
    setFilter(newFilter);
    refetch({ unreadOnly: newFilter === 'unread', page: 1 });
  };

  const handleTypeFilterChange = (type: string) => {
    setTypeFilter(type);
    refetch({ type: type === 'all' ? undefined : type, page: 1 });
  };

  const handlePriorityFilterChange = (priority: string) => {
    setPriorityFilter(priority);
    refetch({ priority: priority === 'all' ? undefined : priority, page: 1 });
  };

  const handleModuleFilterChange = (module: string) => {
    setModuleFilter(module);
    refetch({ module: module === 'all' ? undefined : module, page: 1 });
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markRead(notification.id);
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'LOW': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'APPROVAL': return '✓';
      case 'WARNING': return '⚠';
      case 'ERROR': return '✕';
      case 'SUCCESS': return '✓';
      case 'INFO': return 'ℹ';
      case 'REMINDER': return '🔔';
      case 'MENTION': return '@';
      default: return '•';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <BellIcon className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Notification Center</h1>
                <p className="text-sm text-gray-500">
                  {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/notifications/preferences')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <SettingsIcon />
                Preferences
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <CheckIcon />
                  Mark All Read
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Read/Unread Filter */}
            <div className="flex items-center gap-2">
              <FilterIcon className="text-gray-400" />
              <button
                onClick={() => handleFilterChange('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  filter === 'all'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All ({page.total})
              </button>
              <button
                onClick={() => handleFilterChange('unread')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  filter === 'unread'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            <div className="w-px h-6 bg-gray-300" />

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => handleTypeFilterChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Types</option>
              <option value="APPROVAL">Approval</option>
              <option value="INFO">Info</option>
              <option value="SUCCESS">Success</option>
              <option value="WARNING">Warning</option>
              <option value="ERROR">Error</option>
              <option value="REMINDER">Reminder</option>
              <option value="MENTION">Mention</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => handlePriorityFilterChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Module Filter */}
            <select
              value={moduleFilter}
              onChange={(e) => handleModuleFilterChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Modules</option>
              <option value="LEAVE">Leave Management</option>
              <option value="EXPENSES">Expenses</option>
              <option value="TASKS">Tasks</option>
              <option value="PROJECTS">Projects</option>
              <option value="HR">HR</option>
              <option value="PAYROLL">Payroll</option>
              <option value="CRM">CRM</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <BellIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
            <p className="text-sm text-gray-500">
              {filter === 'unread' ? "You're all caught up! No unread notifications." : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg border transition-all hover:shadow-md ${
                  notification.isRead
                    ? 'border-gray-200'
                    : 'border-indigo-200 bg-indigo-50/30'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Type Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                      notification.isRead ? 'bg-gray-100' : 'bg-indigo-100'
                    }`}>
                      {getTypeIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1">
                          <h3 className={`text-sm font-semibold mb-1 ${
                            notification.isRead ? 'text-gray-700' : 'text-gray-900'
                          }`}>
                            {notification.title}
                          </h3>
                          <p className={`text-sm ${
                            notification.isRead ? 'text-gray-500' : 'text-gray-700'
                          }`}>
                            {notification.message}
                          </p>
                        </div>

                        {/* Priority Badge */}
                        <span className={`flex-shrink-0 px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(notification.priority)}`}>
                          {notification.priority}
                        </span>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{new Date(notification.createdAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                        {notification.module && (
                          <>
                            <span>•</span>
                            <span className="font-medium">{notification.module}</span>
                          </>
                        )}
                        {notification.category && (
                          <>
                            <span>•</span>
                            <span>{notification.category}</span>
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        {notification.actionUrl && (
                          <button
                            onClick={() => handleNotificationClick(notification)}
                            className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 transition-colors"
                          >
                            View Details
                          </button>
                        )}
                        {!notification.isRead && (
                          <button
                            onClick={() => markRead(notification.id)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                          >
                            Mark as Read
                          </button>
                        )}
                        <button
                          onClick={() => remove(notification.id)}
                          className="ml-auto p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete notification"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {page.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{(page.page - 1) * page.limit + 1}</span> to{' '}
              <span className="font-medium">{Math.min(page.page * page.limit, page.total)}</span> of{' '}
              <span className="font-medium">{page.total}</span> notifications
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch({ page: page.page - 1 })}
                disabled={!page.hasPreviousPage}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700">
                Page {page.page} of {page.totalPages}
              </span>
              <button
                onClick={() => refetch({ page: page.page + 1 })}
                disabled={!page.hasNextPage}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Made with Bob
