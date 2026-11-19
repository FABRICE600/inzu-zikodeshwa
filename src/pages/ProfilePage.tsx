import React, { useState } from 'react';
import { Camera, CheckCircle2, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest, UserProfile } from '../lib/api.ts';

interface ProfilePageProps {
  onLoggedOut: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onLoggedOut }) => {
  const { user, token, logout, setUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [role, setRole] = useState<'tenant' | 'landlord'>(
    user?.role === 'landlord' ? 'landlord' : 'tenant'
  );

  const [otpCode, setOtpCode] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!user || !token) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');
    setError('');
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          fullName,
          phone,
          whatsapp,
          bio,
          role: user.role === 'admin' ? undefined : role,
        }),
      });
      setUser(res.user);
      setFeedback('Profile updated.');
    } catch (err: any) {
      setError(err.message || 'Could not save profile.');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('avatar', file);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/avatar', {
        method: 'POST',
        token,
        body: form,
      });
      setUser(res.user);
      setFeedback('Profile photo updated.');
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    }
  };

  const handleSendVerifyOtp = async () => {
    if (!user.phone) {
      setError('Save a phone number first before verifying.');
      return;
    }
    setError('');
    try {
      const res = await apiRequest<{ demoOtp: string }>('/api/auth/otp/send', {
        method: 'POST',
        body: JSON.stringify({ target: user.phone, purpose: 'verify_phone' }),
      });
      setDemoOtp(res.demoOtp);
      setFeedback(`OTP sent to ${user.phone}. Demo code: ${res.demoOtp}`);
    } catch (err: any) {
      setError(err.message || 'Could not send OTP.');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/otp/verify-phone', {
        method: 'POST',
        token,
        body: JSON.stringify({ code: otpCode }),
      });
      setUser(res.user);
      setDemoOtp('');
      setOtpCode('');
      setFeedback('Phone number verified!');
    } catch (err: any) {
      setError(err.message || 'Invalid OTP code.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        token,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setFeedback('Password changed successfully.');
    } catch (err: any) {
      setError(err.message || 'Could not change password.');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await apiRequest('/api/auth/account', { method: 'DELETE', token });
      await logout();
      onLoggedOut();
    } catch (err: any) {
      setError(err.message || 'Could not delete account.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Account & Profile</h1>
          <p className="text-sm text-zinc-500">
            Role: <span className="capitalize font-medium text-zinc-800">{user.role}</span> ·{' '}
            {user.email || user.phone}
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            await logout();
            onLoggedOut();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-zinc-200 bg-white hover:bg-zinc-50 rounded-lg text-zinc-700 cursor-pointer"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
          {error}
        </div>
      )}
      {feedback && (
        <div className="p-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
          {feedback}
        </div>
      )}

      {/* Profile Details Card */}
      <form
        onSubmit={handleSaveProfile}
        className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5"
      >
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full bg-zinc-200 overflow-hidden flex items-center justify-center font-bold text-xl text-zinc-700 shrink-0">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt={user.fullName} className="w-full h-full object-cover" />
            ) : (
              user.fullName.charAt(0).toUpperCase()
            )}
          </div>
          <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer">
            <Camera className="w-4 h-4" /> Upload Photo
            <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
            />
          </div>

          {user.role !== 'admin' && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Account Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'tenant' | 'landlord')}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
              >
                <option value="tenant">Tenant</option>
                <option value="landlord">Landlord / Agent</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+250788..."
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">WhatsApp Number</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+250788..."
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 mb-1">Bio</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell tenants or landlords about yourself..."
            className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#0D5C43] hover:bg-[#094431] text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            Save Profile
          </button>
        </div>
      </form>

      {/* Phone Verification (OTP) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Phone Number Verification (OTP)</h2>
            <p className="text-xs text-zinc-500">
              {user.phone ? `Current phone: ${user.phone}` : 'Add a phone number above to verify.'}
            </p>
          </div>
          {user.phoneVerified ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="w-4 h-4" /> Verified
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSendVerifyOtp}
              className="px-3.5 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-lg cursor-pointer"
            >
              Send OTP Code
            </button>
          )}
        </div>

        {!user.phoneVerified && user.phone && (
          <form onSubmit={handleVerifyOtp} className="flex flex-wrap items-center gap-2 pt-2">
            <input
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder={demoOtp ? `Enter ${demoOtp}` : '6-digit code'}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg font-mono w-40"
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold bg-[#0D5C43] text-white rounded-lg cursor-pointer"
            >
              Verify Phone
            </button>
          </form>
        )}
      </div>

      {/* Change Password */}
      <form
        onSubmit={handleChangePassword}
        className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4"
      >
        <h2 className="text-base font-bold text-zinc-900">Change Password</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password (blank if Google account)"
            className="px-3 py-2 text-sm border border-zinc-200 rounded-lg"
          />
          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 6 chars)"
            className="px-3 py-2 text-sm border border-zinc-200 rounded-lg"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-semibold bg-zinc-900 text-white rounded-lg cursor-pointer"
        >
          Update Password
        </button>
      </form>

      {/* Delete Account */}
      <div className="bg-white border border-rose-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-rose-900">Delete Account</h2>
          <p className="text-xs text-zinc-600">
            Permanently remove your profile, saved searches, and any listings you posted.
          </p>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-2 text-xs text-zinc-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg cursor-pointer"
            >
              Confirm Permanent Delete
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Delete Account
          </button>
        )}
      </div>
    </div>
  );
};
