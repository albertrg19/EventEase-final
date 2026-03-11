'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, Mail, Phone, Shield, Edit, Trash2, Plus, Search, Loader2, Download } from 'lucide-react';

interface UserData {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'customer';
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', role: 'customer' });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineRole, setInlineRole] = useState<string>('customer');
  const [inlineSaving, setInlineSaving] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.status === 401) {
        setToast({ type: 'error', message: 'Your session has expired. Please login again.' });
        window.location.href = '/login';
        return;
      }
      if (res.status === 403) {
        setToast({ type: 'error', message: 'You do not have permission to access users.' });
        window.location.href = '/customer/dashboard';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        const normalized: UserData[] = (data || []).map((u: any) => ({
          id: u?.id ?? u?.ID,
          name: u?.name ?? u?.Name ?? '',
          email: u?.email ?? u?.Email ?? '',
          phone: u?.phone ?? u?.Phone ?? undefined,
          role: (u?.role ?? u?.Role) === 'admin' ? 'admin' : 'customer',
        }));
        setUsers(normalized);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setToast({ type: 'error', message: 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setToast({ type: 'success', message: 'User deleted successfully' });
        setUsers((prev) => prev.filter((u) => u.id !== id));
        setSelectedIds((prev) => prev.filter((i) => i !== id));
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to delete user' });
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      setToast({ type: 'error', message: 'Failed to delete user' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setToast({ type: 'error', message: 'Please login first.' });
        return;
      }
      const payload: any = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
      };
      if (formData.phone) payload.phone = formData.phone;
      if (formData.password) payload.password = formData.password;

      const url = editingUser
        ? `${api}/api/admin/users/${editingUser.id}`
        : `${api}/api/admin/users`;

      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        setToast({ type: 'error', message: 'Your session has expired. Please login again.' });
        window.location.href = '/login';
        return;
      }
      if (res.status === 403) {
        setToast({ type: 'error', message: 'You do not have permission to perform this action.' });
        return;
      }
      if (res.ok) {
        setDialogOpen(false);
        setEditingUser(null);
        setFormData({ name: '', email: '', phone: '', password: '', role: 'customer' });
        fetchUsers();
        setToast({ type: 'success', message: editingUser ? 'User updated successfully' : 'User created successfully' });
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to save user' });
      }
    } catch (error) {
      console.error('Failed to save user:', error);
      setToast({ type: 'error', message: 'Failed to save user' });
    }
  };

  const openEditDialog = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      role: user.role,
    });
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', phone: '', password: '', role: 'customer' });
    setDialogOpen(true);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map((u) => u.id));
    }
  };

  const hasSelection = selectedIds.length > 0;

  const handleBulkDelete = async () => {
    if (!hasSelection) return;
    if (!confirm(`Delete ${selectedIds.length} users? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const token = localStorage.getItem('token');
      for (const id of selectedIds) {
        await fetch(`${api}/api/admin/users/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }
      setUsers((prev) => prev.filter((u) => !selectedIds.includes(u.id)));
      setSelectedIds([]);
      setToast({ type: 'success', message: 'Users deleted successfully' });
    } catch (error) {
      console.error('Bulk delete failed:', error);
      setToast({ type: 'error', message: 'Some deletions failed. Please try again.' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkRoleChange = async (newRole: 'admin' | 'customer') => {
    if (!hasSelection) return;
    if (!confirm(`Change ${selectedIds.length} users to ${newRole}?`)) return;
    setBulkDeleting(true);
    try {
      const token = localStorage.getItem('token');
      for (const id of selectedIds) {
        const user = users.find((u) => u.id === id);
        if (!user) continue;
        await fetch(`${api}/api/admin/users/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: user.name, email: user.email, role: newRole }),
        });
      }
      setUsers((prev) => prev.map((u) => (selectedIds.includes(u.id) ? { ...u, role: newRole } : u)));
      setSelectedIds([]);
      setToast({ type: 'success', message: 'Roles updated successfully' });
    } catch (error) {
      console.error('Bulk role change failed:', error);
      setToast({ type: 'error', message: 'Some updates failed. Please try again.' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const startInlineEdit = (user: UserData) => {
    setInlineEditId(user.id);
    setInlineRole(user.role);
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineRole('customer');
  };

  const saveInlineRole = async (user: UserData) => {
    if (!inlineEditId) return;
    setInlineSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: user.name, email: user.email, role: inlineRole }),
      });
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: inlineRole as 'admin' | 'customer' } : u)));
        setToast({ type: 'success', message: 'Role updated' });
        cancelInlineEdit();
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to update role' });
      }
    } catch (error) {
      console.error('Inline role update failed:', error);
      setToast({ type: 'error', message: 'Failed to update role' });
    } finally {
      setInlineSaving(false);
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Name', 'Email', 'Phone', 'Role'];
    const rows = filteredUsers.map((u) => [u.id, u.name, u.email, u.phone || '', u.role]);
    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredUsers = users.filter((user) => {
    const name = (user.name || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.includes(query) || email.includes(query);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-950 to-blue-700 bg-clip-text text-transparent">Manage Users</h1>
          <p className="text-blue-700/80 mt-1 text-sm">Dashboard / Users</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="hidden md:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            {users.length} total
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-48 h-10 border-2 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20 rounded-xl"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="customer">Customers</option>
          </select>
          <Button variant="outline" onClick={exportCSV} className="gap-2 rounded-xl">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button onClick={openAddDialog} className="bg-blue-950 hover:bg-blue-900 gap-2 rounded-xl h-10 shadow-md hover:shadow-lg">
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {hasSelection && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
          <div>
            <p className="text-sm font-semibold text-blue-900">{selectedIds.length} users selected</p>
            <p className="text-xs text-blue-700">Apply bulk actions to selected users.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white gap-1"
              onClick={() => handleBulkRoleChange('admin')}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
              Make Admin
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => handleBulkRoleChange('customer')}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <User className="h-3 w-3" />}
              Make Customer
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* User List */}
      <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm rounded-2xl">
        <CardHeader className="border-b border-gray-200 pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
            <User className="h-5 w-5 text-blue-700" />
            User List ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredUsers.length && filteredUsers.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 accent-blue-600"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(user.id)}
                          onChange={() => toggleSelect(user.id)}
                          className="h-4 w-4 accent-blue-600"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-sm ${user.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                            <User className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{user.name || 'N/A'}</span>
                            <span className="text-xs text-gray-500">{user.email || 'N/A'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail className="h-4 w-4" />
                            <span className="text-sm">{user.email || 'N/A'}</span>
                          </div>
                          {user.phone && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Phone className="h-4 w-4" />
                              <span className="text-sm">{user.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {inlineEditId === user.id ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={inlineRole}
                              onChange={(e) => setInlineRole(e.target.value)}
                              className="px-2 py-1 border rounded text-xs"
                            >
                              <option value="customer">Customer</option>
                              <option value="admin">Admin</option>
                            </select>
                            <Button size="sm" className="h-7 text-xs" onClick={() => saveInlineRole(user)} disabled={inlineSaving}>
                              {inlineSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={cancelInlineEdit}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <span
                            onClick={() => startInlineEdit(user)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border cursor-pointer hover:opacity-80 ${user.role === 'admin' ? 'bg-blue-950 text-white border-blue-900' : 'bg-blue-50 text-blue-700 border-blue-200'}`}
                          >
                            {user.role === 'admin' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                            {user.role === 'admin' ? 'Admin' : 'Customer'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            className="gap-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 rounded-lg"
                          >
                            <Edit className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(user)}
                            className="gap-1 bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100 rounded-lg"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader className="pb-4 border-b border-gray-200">
            <DialogTitle className="text-2xl font-bold text-gray-900">
              {editingUser ? 'Edit User' : 'Add New User'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter user name"
                className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                placeholder="Enter email address"
                className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">Phone (Optional)</label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone number"
                className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                {editingUser ? (
                  <>New Password <span className="text-gray-500 text-xs font-normal">(leave blank to keep current)</span></>
                ) : (
                  <>Password <span className="text-red-500">*</span></>
                )}
              </label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
                placeholder={editingUser ? "Enter new password" : "Enter password"}
                className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full h-11 rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-950/20"
              >
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <Button
                type="submit"
                className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-semibold h-11 shadow-md hover:shadow-lg transition-all"
              >
                {editingUser ? 'Update User' : 'Create User'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="h-11 border-gray-300 hover:bg-gray-50 font-semibold"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-bold text-gray-900">Delete User</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">{deleteTarget?.name || 'this user'}</span>? This action
            cannot be undone.
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1 border-gray-300 hover:bg-gray-50"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteTarget) handleDelete(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Confirm Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
