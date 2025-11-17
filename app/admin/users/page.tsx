'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { User, Mail, Phone, Shield, Edit, Trash2, Plus, Search, Loader2 } from 'lucide-react';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', role: 'customer' });
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);
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
        window.location.href = '/customer/bookings';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        // Normalize Go (ID/Name/Email/Phone/Role) -> frontend (id/name/email/phone/role)
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
        fetchUsers();
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

  const filteredUsers = users.filter(user => {
    const name = (user.name || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
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
              className={`w-2.5 h-2.5 rounded-full ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                }`}
            />
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-950 to-blue-700 bg-clip-text text-transparent">Manage Users</h1>
          <p className="text-blue-700/80 mt-1 text-sm">Dashboard / Users</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            {users.length} total
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64 h-10 border-2 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20 rounded-xl"
            />
          </div>
          <Button onClick={openAddDialog} className="bg-blue-950 hover:bg-blue-900 gap-2 rounded-xl h-10 shadow-md hover:shadow-lg">
            <Plus className="h-4 w-4" />
            Add New User
          </Button>
        </div>
      </div>

      {/* User List */}
      <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm rounded-2xl">
        <CardHeader className="border-b border-gray-200 pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
            <User className="h-5 w-5 text-blue-700" />
            User List
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
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">User</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Contact</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((user, index) => (
                    <tr key={user.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-4 px-4 text-gray-600 font-medium">#{users.length - index}</td>
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
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${user.role === 'admin' ? 'bg-blue-950 text-white border-blue-900' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {user.role === 'admin' ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                          {user.role === 'admin' ? 'Admin' : 'Customer'}
                        </span>
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
                  <>
                    New Password <span className="text-gray-500 text-xs font-normal">(leave blank to keep current)</span>
                  </>
                ) : (
                  <>
                    Password <span className="text-red-500">*</span>
                  </>
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

