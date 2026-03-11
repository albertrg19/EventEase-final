'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Mail, Edit, Save, Loader2, Phone, Lock, Info } from 'lucide-react';

interface UserData {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  created_at: string;
}

export default function MyProfilePage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchUserProfile = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Fetch current user profile
      const res = await fetch(`${api}/api/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const raw = await res.json();
        // Normalize Go struct field casing to our interface
        const userData: UserData = {
          id: raw?.id ?? raw?.ID,
          name: raw?.name ?? raw?.Name ?? '',
          email: raw?.email ?? raw?.Email ?? '',
          phone: raw?.phone ?? raw?.Phone ?? '',
          role: raw?.role ?? raw?.Role ?? 'customer',
          created_at: raw?.created_at ?? raw?.CreatedAt ?? new Date().toISOString(),
        };
        setUser(userData);
        setFormData({
          name: userData.name,
          email: userData.email,
          phone: userData.phone || '',
          password: '',
          confirmPassword: '',
        });
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      setToast({ type: 'error', message: 'Failed to load profile' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (formData.password && formData.password !== formData.confirmPassword) {
      setToast({ type: 'error', message: 'Passwords do not match' });
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const updateData: any = {
        name: formData.name,
        email: formData.email,
      };
      if (formData.phone) updateData.phone = formData.phone;
      if (formData.password) updateData.password = formData.password;

      const res = await fetch(`${api}/api/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        setEditing(false);
        fetchUserProfile();
        setToast({ type: 'success', message: 'Profile updated successfully!' });
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to update profile' });
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      setToast({ type: 'error', message: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60]">
          <div
            className={`px-6 py-3 rounded-full shadow-2xl ring-1 backdrop-blur-md flex items-center gap-3 ${toast.type === 'success'
                ? 'bg-green-50/90 ring-green-200 text-green-800'
                : 'bg-red-50/90 ring-red-200 text-red-800'
              } animate-in fade-in slide-in-from-top-2 duration-300`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-linear-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-blue-100">
          <User className="h-7 w-7 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-bold bg-linear-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">My Profile</h1>
          <p className="text-blue-600 font-medium flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
            Manage your account settings
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-1 shadow-2xl border-0 bg-white/80 backdrop-blur-sm overflow-hidden rounded-2xl">
          <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-950 p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-r from-yellow-400/10 to-transparent"></div>
            <div className="relative">
              <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl ring-4 ring-yellow-400/30">
                <User className="h-14 w-14 text-blue-950" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">{user.name}</h2>
              <div className="flex items-center justify-center gap-2 text-white/90 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                <Mail className="h-4 w-4" />
                <span className="text-sm font-medium">{user.email}</span>
              </div>
            </div>
          </div>
          <CardContent className="p-6">
            <Button
              onClick={() => setEditing(!editing)}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white gap-2 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-12 font-semibold"
            >
              <Edit className="h-5 w-5" />
              {editing ? 'Cancel Edit' : 'Edit Profile'}
            </Button>
          </CardContent>
        </Card>

        {/* Edit Profile Form */}
        <Card className="lg:col-span-2 shadow-2xl border-0 bg-white/80 backdrop-blur-sm rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-8 pb-4 border-b-2 border-gray-200">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Edit className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">Edit Profile</h3>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" />
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!editing}
                  className="h-12 border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-xl transition-all disabled:bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  Email Address <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!editing}
                  className="h-12 border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-xl transition-all disabled:bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-600" />
                  Phone Number
                </label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={!editing}
                  placeholder="Enter phone number"
                  className="h-12 border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-xl transition-all disabled:bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-blue-600" />
                  New Password
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={!editing}
                  placeholder="Enter new password"
                  className="h-12 border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-xl transition-all disabled:bg-gray-50"
                />
                <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">Leave blank to keep current password</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-blue-600" />
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  disabled={!editing}
                  placeholder="Confirm new password"
                  className="h-12 border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-xl transition-all disabled:bg-gray-50"
                />
              </div>

              {editing && (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold h-12 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 gap-2 rounded-xl"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Saving Changes...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      Save Changes
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card className="lg:col-span-3 shadow-2xl border-0 bg-white/80 backdrop-blur-sm rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-gray-200">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                <Info className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">Account Information</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-6 rounded-xl border-2 border-blue-200">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-3">ACCOUNT ID</span>
                <span className="text-3xl font-bold text-blue-900">{user.id}</span>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-6 rounded-xl border-2 border-purple-200">
                <span className="text-xs font-bold text-purple-700 uppercase tracking-wider block mb-3">ACCOUNT TYPE</span>
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-blue-950 text-white shadow-lg">
                  {user.role === 'admin' ? 'Admin' : 'Customer'}
                </span>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100/50 p-6 rounded-xl border-2 border-green-200">
                <span className="text-xs font-bold text-green-700 uppercase tracking-wider block mb-3">MEMBER SINCE</span>
                <span className="text-lg font-bold text-gray-900">{formatDate(user.created_at)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

