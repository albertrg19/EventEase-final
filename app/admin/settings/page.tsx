'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Settings, SlidersHorizontal, LayoutDashboard, Users } from 'lucide-react';

type RoleKey = 'superAdmin' | 'manager' | 'support';

type RoleMatrix = Record<RoleKey, string[]>;
type RoleAssignments = Record<string, RoleKey>;

type DashboardPrefs = {
  showMetrics: boolean;
  showPerformance: boolean;
  showStatus: boolean;
  showRecent: boolean;
  showTopVenues: boolean;
  showQuickActions: boolean;
  showActivity: boolean;
  showHealth: boolean;
};

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

const ROLE_MATRIX_KEY = 'admin-role-matrix';
const ROLE_ASSIGNMENTS_KEY = 'admin-role-assignments';
const DASHBOARD_PREFS_KEY = 'dashboard-card-prefs';

const moduleOptions = [
  { key: 'dashboard', label: 'Dashboard Overview' },
  { key: 'users', label: 'Manage Users' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'categories', label: 'Event Categories' },
  { key: 'halls', label: 'Event Halls' },
  { key: 'events', label: 'Events' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'settings', label: 'Settings' },
];

const defaultRoleMatrix: RoleMatrix = {
  superAdmin: moduleOptions.map((m) => m.key),
  manager: ['dashboard', 'bookings', 'halls', 'events', 'invoices', 'categories'],
  support: ['dashboard', 'bookings', 'categories'],
};

const defaultDashboardPrefs: DashboardPrefs = {
  showMetrics: true,
  showPerformance: true,
  showStatus: true,
  showRecent: true,
  showTopVenues: true,
  showQuickActions: true,
  showActivity: true,
  showHealth: true,
};

const storageAvailable = () => typeof window !== 'undefined' && !!window.localStorage;

export default function SettingsPage() {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const [roleMatrix, setRoleMatrix] = useState<RoleMatrix>(defaultRoleMatrix);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignments>({});
  const [dashboardPrefs, setDashboardPrefs] = useState<DashboardPrefs>(defaultDashboardPrefs);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (!storageAvailable()) return;
    try {
      const storedMatrix = localStorage.getItem(ROLE_MATRIX_KEY);
      if (storedMatrix) {
        setRoleMatrix((prev) => ({ ...prev, ...JSON.parse(storedMatrix) }));
      }
      const storedAssignments = localStorage.getItem(ROLE_ASSIGNMENTS_KEY);
      if (storedAssignments) {
        setRoleAssignments(JSON.parse(storedAssignments));
      }
      const storedPrefs = localStorage.getItem(DASHBOARD_PREFS_KEY);
      if (storedPrefs) {
        setDashboardPrefs((prev) => ({ ...prev, ...JSON.parse(storedPrefs) }));
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoadingAdmins(true);
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${api}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const users = await res.json();
      setAdmins(users.filter((user: AdminUser) => user.role === 'admin'));
    } finally {
      setLoadingAdmins(false);
    }
  };

  const persistRoleMatrix = (next: RoleMatrix) => {
    if (!storageAvailable()) return;
    setSavingMatrix(true);
    setRoleMatrix(next);
    localStorage.setItem(ROLE_MATRIX_KEY, JSON.stringify(next));
    setTimeout(() => setSavingMatrix(false), 400);
  };

  const persistAssignments = (next: RoleAssignments) => {
    if (!storageAvailable()) return;
    setRoleAssignments(next);
    localStorage.setItem(ROLE_ASSIGNMENTS_KEY, JSON.stringify(next));
  };

  const persistDashboardPrefs = (next: DashboardPrefs) => {
    if (!storageAvailable()) return;
    setSavingPrefs(true);
    setDashboardPrefs(next);
    localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(next));
    setTimeout(() => setSavingPrefs(false), 400);
  };

  const toggleModuleAccess = (roleKey: RoleKey, moduleKey: string) => {
    if (roleKey === 'superAdmin') return;
    const allowed = new Set(roleMatrix[roleKey]);
    if (allowed.has(moduleKey)) {
      allowed.delete(moduleKey);
    } else {
      allowed.add(moduleKey);
    }
    persistRoleMatrix({ ...roleMatrix, [roleKey]: Array.from(allowed) });
  };

  const handleAssignmentChange = (userId: number, newRole: RoleKey) => {
    persistAssignments({ ...roleAssignments, [userId]: newRole });
  };

  const assignmentSummary = useMemo(() => {
    const summary: Record<RoleKey, number> = { superAdmin: 0, manager: 0, support: 0 };
    Object.values(roleAssignments).forEach((role) => {
      summary[role] += 1;
    });
    return summary;
  }, [roleAssignments]);

  const toggleDashboardPref = (key: keyof DashboardPrefs) => {
    persistDashboardPrefs({ ...dashboardPrefs, [key]: !dashboardPrefs[key] });
  };

  const resetPreferences = () => {
    persistDashboardPrefs(defaultDashboardPrefs);
  };

  const resetMatrix = () => {
    persistRoleMatrix(defaultRoleMatrix);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Controls</h1>
        <p className="text-gray-600 mt-1">Manage access, audit, and personalization for the admin portal.</p>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Role Permissions
            </CardTitle>
            <p className="text-sm text-gray-500">Define which modules each role can access.</p>
          </div>
          <Button variant="outline" size="sm" onClick={resetMatrix} disabled={savingMatrix}>
            Reset to defaults
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Role</th>
                  {moduleOptions.map((mod) => (
                    <th key={mod.key} className="text-center py-2 px-3 font-semibold text-gray-600">{mod.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['superAdmin', 'manager', 'support'] as RoleKey[]).map((roleKey) => (
                  <tr key={roleKey} className="border-t border-gray-100">
                    <td className="py-3 px-3 font-semibold text-gray-800 capitalize">
                      {roleKey === 'superAdmin' ? 'Super Admin' : roleKey}
                      <p className="text-xs text-gray-500">
                        {roleKey === 'superAdmin' ? 'Immutable full access' : `${roleMatrix[roleKey].length} modules`}
                      </p>
                    </td>
                    {moduleOptions.map((mod) => {
                      const enabled = roleMatrix[roleKey].includes(mod.key);
                      return (
                        <td key={mod.key} className="text-center py-3">
                          <label className="inline-flex items-center justify-center gap-2 text-xs font-medium">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-blue-600"
                              checked={enabled}
                              disabled={roleKey === 'superAdmin'}
                              onChange={() => toggleModuleAccess(roleKey, mod.key)}
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {savingMatrix && <p className="text-xs text-blue-600">Saving changes…</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Users className="h-5 w-5 text-blue-600" />
              Team Role Assignments
            </CardTitle>
            <p className="text-sm text-gray-500">Assign scoped roles to each admin user.</p>
          </div>
          <div className="text-xs text-gray-500 space-x-3">
            <span>Managers: {assignmentSummary.manager}</span>
            <span>Support: {assignmentSummary.support}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingAdmins ? (
            <p className="text-sm text-gray-500">Loading admin users…</p>
          ) : admins.length === 0 ? (
            <p className="text-sm text-gray-500">No admin users found.</p>
          ) : (
            <div className="space-y-3">
              {admins.map((admin) => {
                const isSuperAdmin = admin.email === 'superadmin@gmail.com';
                const activeRole = roleAssignments[admin.id] || (isSuperAdmin ? 'superAdmin' : 'manager');
                return (
                  <div key={admin.id} className="flex flex-wrap items-center gap-3 justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-semibold text-gray-800">{admin.name}</p>
                      <p className="text-xs text-gray-500">{admin.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold uppercase text-gray-500">Role</label>
                      <select
                        value={activeRole}
                        onChange={(e) => handleAssignmentChange(admin.id, e.target.value as RoleKey)}
                        disabled={isSuperAdmin}
                        className="border rounded-md px-3 py-2 text-sm focus:border-blue-600 focus:ring-0"
                      >
                        <option value="superAdmin" disabled>
                          Super Admin
                        </option>
                        <option value="manager">Manager</option>
                        <option value="support">Support</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-gray-500">
            These scoped roles control which admin modules are available in navigation. Enforcement is handled client-side until backend scopes are added.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <LayoutDashboard className="h-5 w-5 text-blue-600" />
              Dashboard Personalization
            </CardTitle>
            <p className="text-sm text-gray-500">Toggle which analytics cards show up on the dashboard.</p>
          </div>
          <Button variant="outline" size="sm" onClick={resetPreferences} disabled={savingPrefs}>
            Reset cards
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'showMetrics', label: 'Metric Overview' },
              { key: 'showPerformance', label: 'Performance Snapshot' },
              { key: 'showStatus', label: 'Booking Status' },
              { key: 'showRecent', label: 'Recent Bookings' },
              { key: 'showTopVenues', label: 'Top Venues' },
              { key: 'showQuickActions', label: 'Quick Actions' },
              { key: 'showActivity', label: 'Admin Activity Log' },
              { key: 'showHealth', label: 'System Health' },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-3 border rounded-lg px-3 py-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={dashboardPrefs[item.key as keyof DashboardPrefs]}
                  onChange={() => toggleDashboardPref(item.key as keyof DashboardPrefs)}
                />
                {item.label}
              </label>
            ))}
          </div>
          {savingPrefs && <p className="text-xs text-blue-600 mt-2">Updating dashboard layout…</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <SlidersHorizontal className="h-5 w-5 text-blue-600" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>Server-side enforcement once permission scopes land in the API.</li>
            <li>Audit trail export and email alerts for role changes.</li>
            <li>Multi-admin dashboard presets.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
