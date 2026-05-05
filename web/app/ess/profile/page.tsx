'use client';

import React, { useState } from 'react';
import { useMyProfile, useUpdateProfile } from '@/hooks/useEss';
import { User, AlertCircle, CheckCircle } from 'lucide-react';

export default function ESSProfilePage() {
  const { data: profile, loading: profileLoading, refetch: refetchProfile } = useMyProfile();
  const { update, loading: updateLoading } = useUpdateProfile();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    phoneNumber: '',
    address: '',
    emergencyContact: '',
    emergencyContactPhone: '',
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleStartEditing = () => {
    if (profile) {
      setFormData({
        phoneNumber: profile.phoneNumber || '',
        address: profile.address || '',
        emergencyContact: profile.emergencyContact || '',
        emergencyContactPhone: profile.emergencyContactPhone || '',
      });
    }

    setIsEditing(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await update(formData);
      setShowSuccess(true);
      setShowError(false);
      setIsEditing(false);
      refetchProfile();

      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err) {
      setErrorMsg((err as Error).message);
      setShowError(true);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-6">
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse h-96"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 text-sm mt-1">Manage your personal information</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Alerts */}
        {showSuccess && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">Success</p>
              <p className="text-green-700 text-sm">Profile updated successfully</p>
            </div>
          </div>
        )}

        {showError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-red-700 text-sm">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Profile Header Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 rounded-full p-4">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{profile?.name}</h2>
                <p className="text-gray-600">{profile?.email}</p>
              </div>
            </div>
            {!isEditing && (
              <button
                onClick={handleStartEditing}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700"
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* Read-only Information */}
          {!isEditing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase mb-1">Employee ID</p>
                  <p className="text-lg font-medium text-gray-900">{profile?.id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase mb-1">Designation</p>
                  <p className="text-lg font-medium text-gray-900">{profile?.designation || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase mb-1">Department</p>
                  <p className="text-lg font-medium text-gray-900">{profile?.department || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase mb-1">Position</p>
                  <p className="text-lg font-medium text-gray-900">{profile?.position || '-'}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-600 uppercase mb-1">Phone (Professional)</p>
                  <p className="text-lg font-medium text-gray-900">{profile?.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase mb-1">Phone (Personal)</p>
                  <p className="text-lg font-medium text-gray-900">{profile?.phoneNumber || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase mb-1">Manager</p>
                  <p className="text-lg font-medium text-gray-900">{profile?.manager || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 uppercase mb-1">Hire Date</p>
                  <p className="text-lg font-medium text-gray-900">{profile?.hireDate || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Form */}
        {isEditing && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Edit Profile</h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Personal Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="+91 9876543210"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Enter your residential address"
                />
              </div>

              {/* Emergency Contact */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="font-semibold text-gray-900 mb-4">Emergency Contact</h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      value={formData.emergencyContact}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          emergencyContact: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      placeholder="Name of emergency contact"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.emergencyContactPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          emergencyContactPhone: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> You cannot edit name, email, designation, or department from this page.
                  Contact HR for those changes.
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-6">
                <button
                  type="submit"
                  disabled={updateLoading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-medium disabled:bg-gray-300 hover:bg-blue-700"
                >
                  {updateLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    if (profile) {
                      setFormData({
                        phoneNumber: profile.phoneNumber || '',
                        address: profile.address || '',
                        emergencyContact: profile.emergencyContact || '',
                        emergencyContactPhone:
                          profile.emergencyContactPhone || '',
                      });
                    }
                  }}
                  className="flex-1 bg-gray-200 text-gray-900 py-2 px-4 rounded-lg font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Non-editable Fields Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-4">Protected Fields</h3>
          <p className="text-blue-800 text-sm mb-3">
            The following fields cannot be edited from your self-service portal:
          </p>
          <ul className="text-blue-800 text-sm space-y-1 list-disc list-inside">
            <li>Name and Email Address</li>
            <li>Designation and Department</li>
            <li>Employee ID</li>
            <li>Manager assignment</li>
            <li>Shift assignment</li>
          </ul>
          <p className="text-blue-800 text-sm mt-3">
            To update these fields, please contact your HR department.
          </p>
        </div>
      </div>
    </div>
  );
}
