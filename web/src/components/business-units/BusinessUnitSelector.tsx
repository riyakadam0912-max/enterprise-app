'use client';

import { useState } from 'react';
import { useAuthSession, setActiveBusinessUnit, getActiveBusinessUnitId } from '@/stores/auth-store';
import { axiosClient } from '@/api/axiosClient';

interface SwitchBusinessUnitResponse {
  success: boolean;
  businessUnitId: number | null;
  allBusinessUnits: boolean;
  message: string;
}

/**
 * Business Unit Selector Component
 * Displays available business units and allows switching between them.
 * Only visible when user has access to multiple business units.
 * Respects backend authorization (all validation happens server-side).
 */
export function BusinessUnitSelector() {
  const session = useAuthSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const activeBUId = getActiveBusinessUnitId();

  // Only show if user can select multiple BUs or has multiple available
  if (!session.canSelectAllBusinessUnits && session.availableBusinessUnits.length <= 1) {
    return null;
  }

  const activeBU = session.availableBusinessUnits.find((bu) => bu.id === activeBUId);
  const displayLabel = activeBU
    ? `${activeBU.name} (${activeBU.code})`
    : session.canSelectAllBusinessUnits
      ? 'All Business Units'
      : 'Business Unit';

  const handleSwitchBusinessUnit = async (targetBUId: number | null) => {
    if (isSwitching) return;

    setIsSwitching(true);
    try {
      const response = await axiosClient.post<SwitchBusinessUnitResponse>(
        '/me/business-units/switch',
        { businessUnitId: targetBUId },
      );

      if (response.data.success) {
        // Update frontend context based on backend response
        setActiveBusinessUnit(response.data.businessUnitId);

        // Close menu on success
        setIsOpen(false);

        // Optionally reload current page data (depends on app architecture)
        // Could trigger a refresh of relevant data here
      }
    } catch (error) {
      console.error('Failed to switch business unit:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="relative inline-block">
      {/* Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4"
          />
        </svg>
        <span className="truncate max-w-[200px]">{displayLabel}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
          <div className="p-2">
            {/* "All Business Units" option (if user can select all) */}
            {session.canSelectAllBusinessUnits && (
              <button
                onClick={() => handleSwitchBusinessUnit(null)}
                disabled={isSwitching}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  activeBUId === null
                    ? 'bg-blue-100 text-blue-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path
                      fillRule="evenodd"
                      d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-medium">All Business Units</span>
                </div>
              </button>
            )}

            {/* Divider */}
            {session.canSelectAllBusinessUnits && session.availableBusinessUnits.length > 0 && (
              <div className="my-1 border-t border-slate-200" />
            )}

            {/* Business Unit List */}
            <div className="max-h-64 overflow-y-auto">
              {session.availableBusinessUnits.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-500 text-center">
                  No business units available
                </div>
              ) : (
                session.availableBusinessUnits.map((bu) => (
                  <button
                    key={bu.id}
                    onClick={() => handleSwitchBusinessUnit(bu.id)}
                    disabled={isSwitching}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      activeBUId === bu.id
                        ? 'bg-blue-100 text-blue-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold text-white bg-slate-400 rounded">
                        {bu.code.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{bu.name}</div>
                        <div className="text-xs text-slate-500">{bu.code}</div>
                      </div>
                      {bu.status !== 'ACTIVE' && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                          {bu.status}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
