'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, ChevronLeft, ChevronRight, Search, Filter, Loader2, CheckCircle, XCircle, Trash2, Download } from 'lucide-react';

interface Booking {
  id: number;
  event_name: string;
  event_date: string;
  status: 'pending' | 'approved' | 'rejected';
  user?: { id: number; name: string; email: string };
  hall?: { id: number; name: string };
  event_category?: { id: number; name: string };
  customer_id?: number;
  user_id?: number;
  event_type?: string;
  event_category_id?: number;
  hall_id?: number;
  admin_notes?: string;
}

export default function BookingManagementPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchBookings();
  }, [currentPage]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/bookings?page=${currentPage}&size=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data || []);
        setTotalPages(Math.max(1, Math.ceil((data?.length || 0) / 10)));
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch = 
      booking.event_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.hall?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredBookings.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredBookings.map((b) => b.id));
    }
  };

  const hasSelection = selectedIds.length > 0;

  const updateBookingStatus = async (id: number, newStatus: 'approved' | 'rejected') => {
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return false;
    
    try {
      setProcessingId(id);
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/bookings/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: booking.customer_id || booking.user_id || booking.user?.id || 1,
          user_id: booking.user_id || booking.user?.id || 1,
          event_name: booking.event_name,
          event_type: booking.event_type || 'general',
          event_category_id: booking.event_category_id || booking.event_category?.id || 1,
          hall_id: booking.hall_id || booking.hall?.id || 1,
          event_date: booking.event_date,
          status: newStatus,
          admin_notes: booking.admin_notes,
        }),
      });
      if (res.ok) {
        setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b)));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update booking status:', error);
      return false;
    } finally {
      setProcessingId(null);
    }
  };

  const deleteBooking = async (id: number) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    try {
      setProcessingId(id);
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/bookings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setBookings((prev) => prev.filter((b) => b.id !== id));
        setSelectedIds((prev) => prev.filter((i) => i !== id));
      }
    } catch (error) {
      console.error('Failed to delete booking:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject' | 'delete') => {
    if (!hasSelection) return;
    const confirmMsg = action === 'delete' 
      ? `Delete ${selectedIds.length} bookings? This cannot be undone.`
      : `${action === 'approve' ? 'Approve' : 'Reject'} ${selectedIds.length} bookings?`;
    if (!confirm(confirmMsg)) return;

    setBulkProcessing(true);
    try {
      const token = localStorage.getItem('token');
      for (const id of selectedIds) {
        if (action === 'delete') {
          await fetch(`${api}/api/bookings/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
          });
        } else {
          await updateBookingStatus(id, action === 'approve' ? 'approved' : 'rejected');
        }
      }
      if (action === 'delete') {
        setBookings((prev) => prev.filter((b) => !selectedIds.includes(b.id)));
      }
      setSelectedIds([]);
      fetchBookings();
    } catch (error) {
      console.error('Bulk action failed:', error);
      alert('Some operations failed. Please try again.');
    } finally {
      setBulkProcessing(false);
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Event Name', 'Date', 'Status', 'Customer', 'Venue'];
    const rows = filteredBookings.map((b) => [
      b.id,
      b.event_name,
      formatDate(b.event_date),
      b.status,
      b.user?.name || 'N/A',
      b.hall?.name || 'N/A',
    ]);
    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bookings_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Booking Management</h1>
          <p className="text-gray-600 mt-1">Manage all event bookings and reservations</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Search bookings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {hasSelection && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
          <div>
            <p className="text-sm font-semibold text-blue-900">{selectedIds.length} bookings selected</p>
            <p className="text-xs text-blue-700">Apply bulk actions to selected items.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-500 text-white gap-1"
              onClick={() => handleBulkAction('approve')}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
              Approve
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-500 text-white gap-1"
              onClick={() => handleBulkAction('reject')}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
              Reject
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1"
              onClick={() => handleBulkAction('delete')}
              disabled={bulkProcessing}
            >
              {bulkProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Bookings ({filteredBookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Loading bookings...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No bookings found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredBookings.length && filteredBookings.length > 0}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 accent-blue-600"
                        />
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Event Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Venue</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Customer</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(booking.id)}
                            onChange={() => toggleSelect(booking.id)}
                            className="h-4 w-4 accent-blue-600"
                          />
                        </td>
                        <td className="py-3 px-4 font-medium">{booking.event_name}</td>
                        <td className="py-3 px-4 text-gray-600">{formatDate(booking.event_date)}</td>
                        <td className="py-3 px-4 text-gray-600">{booking.hall?.name || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <select
                            value={booking.status}
                            onChange={(e) => updateBookingStatus(booking.id, e.target.value as 'approved' | 'rejected')}
                            disabled={processingId === booking.id}
                            className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(booking.status)} focus:outline-none cursor-pointer`}
                          >
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{booking.user?.name || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-green-600 hover:text-green-700"
                              onClick={() => updateBookingStatus(booking.id, 'approved')}
                              disabled={processingId === booking.id || booking.status === 'approved'}
                            >
                              {processingId === booking.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-amber-600 hover:text-amber-700"
                              onClick={() => updateBookingStatus(booking.id, 'rejected')}
                              disabled={processingId === booking.id || booking.status === 'rejected'}
                            >
                              {processingId === booking.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                              Reject
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-red-600 hover:text-red-700"
                              onClick={() => deleteBooking(booking.id)}
                              disabled={processingId === booking.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing {filteredBookings.length} bookings
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
