'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Eye, Printer, Info, Loader2, MoreVertical, Tag, Building2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Booking {
  id: number;
  user_id?: number;
  event_name: string;
  event_type: string;
  event_date: string;
  status: 'pending' | 'approved' | 'rejected';
  hall?: { name: string };
  user?: { id: number; name: string };
  admin_notes?: string;
}

export default function MyBookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Get user ID from token
      let userId = 0;
      try {
        const tokenParts = token.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        userId = payload.sub || 0;
      } catch {
        userId = 0;
      }

      const res = await fetch(`${api}/api/bookings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Filter bookings for current user
        const userBookings = (data || []).filter((booking: Booking) => booking.user?.id === userId || booking.user_id === userId);
        setBookings(userBookings);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (booking: Booking) => {
    setSelectedBooking(booking);
    setViewDialogOpen(true);
  };

  const handlePrint = (booking: Booking) => {
    window.print();
  };

  const handleReason = (booking: Booking) => {
    setSelectedBooking(booking);
    setReasonDialogOpen(true);
  };

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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-linear-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-blue-100">
            <Calendar className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-linear-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">My Bookings</h1>
            <p className="text-blue-600 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              Your Event Bookings
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="hover:bg-gray-100 rounded-xl">
          <MoreVertical className="h-5 w-5 text-gray-600" />
        </Button>
      </div>

      {/* Bookings Table */}
      <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-20">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
              <p className="text-gray-500 font-medium">Loading your bookings...</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Calendar className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No bookings yet</h3>
              <p className="text-gray-500 mb-6">Create your first booking to get started!</p>
              <Button
                onClick={() => router.push('/customer/booking')}
                className="bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg hover:shadow-xl transition-all"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Booking
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b-2 border-gray-200">
                    <th className="text-left py-5 px-6 font-bold text-gray-700 uppercase text-xs tracking-wider">EVENT</th>
                    <th className="text-left py-5 px-6 font-bold text-gray-700 uppercase text-xs tracking-wider">HALL</th>
                    <th className="text-left py-5 px-6 font-bold text-gray-700 uppercase text-xs tracking-wider">DATE</th>
                    <th className="text-left py-5 px-6 font-bold text-gray-700 uppercase text-xs tracking-wider">STATUS</th>
                    <th className="text-left py-5 px-6 font-bold text-gray-700 uppercase text-xs tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking, index) => (
                    <tr
                      key={booking.id}
                      className="border-b border-gray-100 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent transition-all duration-200 group"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="py-5 px-6">
                        <div className="font-bold text-gray-900 text-base mb-1">{booking.event_name}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          <Tag className="h-3 w-3" />
                          {booking.event_type}
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-2 text-gray-700 font-medium">
                          <Building2 className="h-4 w-4 text-blue-600" />
                          {booking.hall?.name || 'N/A'}
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex items-center gap-2 text-gray-700">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">{formatDate(booking.event_date)}</span>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold border-2 shadow-sm transition-all ${getStatusColor(booking.status)}`}>
                          <span className={`w-2 h-2 rounded-full mr-2 ${
                            booking.status === 'approved' ? 'bg-green-500' :
                            booking.status === 'pending' ? 'bg-yellow-500 animate-pulse' :
                            'bg-red-500'
                          }`}></span>
                          {booking.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex gap-2">
                          {booking.status === 'rejected' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReason(booking)}
                              className="bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-300 hover:from-blue-100 hover:to-blue-200 gap-1.5 shadow-sm hover:shadow-md transition-all transform hover:scale-105"
                            >
                              <Info className="h-3.5 w-3.5" />
                              Reason
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleView(booking)}
                                className="bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-300 hover:from-blue-100 hover:to-blue-200 gap-1.5 shadow-sm hover:shadow-md transition-all transform hover:scale-105"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                              {booking.status === 'approved' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePrint(booking)}
                                  className="bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-300 hover:from-green-100 hover:to-green-200 gap-1.5 shadow-sm hover:shadow-md transition-all transform hover:scale-105"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                  Print
                                </Button>
                              )}
                            </>
                          )}
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

      {/* View Booking Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl shadow-2xl border-0 rounded-2xl">
          <DialogHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl -mt-6 -mx-6 mb-6">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Booking Details
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-xl border border-blue-200">
                  <label className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 block">Event Name</label>
                  <p className="text-gray-900 font-bold text-lg">{selectedBooking.event_name}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 rounded-xl border border-purple-200">
                  <label className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2 block">Event Type</label>
                  <p className="text-gray-900 font-bold text-lg">{selectedBooking.event_type}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100/50 p-4 rounded-xl border border-green-200">
                  <label className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2 block">Hall</label>
                  <p className="text-gray-900 font-bold text-lg">{selectedBooking.hall?.name || 'N/A'}</p>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 p-4 rounded-xl border border-orange-200">
                  <label className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2 block">Date</label>
                  <p className="text-gray-900 font-bold text-lg">{formatDate(selectedBooking.event_date)}</p>
                </div>
                <div className="col-span-2 bg-gradient-to-br from-gray-50 to-gray-100/50 p-4 rounded-xl border border-gray-200">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 block">Status</label>
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold border-2 shadow-sm ${getStatusColor(selectedBooking.status)}`}>
                    {selectedBooking.status.toUpperCase()}
                  </span>
                </div>
              </div>
              {selectedBooking.admin_notes && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border-2 border-blue-200">
                  <label className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3 block">Admin Notes</label>
                  <p className="text-gray-900 leading-relaxed">{selectedBooking.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent className="max-w-md shadow-2xl border-0 rounded-2xl">
          <DialogHeader className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-2xl -mt-6 -mx-6 mb-6">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Info className="h-6 w-6" />
              Booking Rejected
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-6 pt-2">
              <div className="bg-gradient-to-br from-red-50 via-red-100/50 to-orange-50 border-2 border-red-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                    <Info className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-red-800 mb-2 uppercase tracking-wide">Rejection Reason</p>
                    <p className="text-gray-900 leading-relaxed">
                      {selectedBooking.admin_notes || 'No reason provided by administrator.'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3 bg-gray-50 p-4 rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-600">Event:</span>
                  <span className="text-gray-900 font-bold">{selectedBooking.event_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-600">Date:</span>
                  <span className="text-gray-900 font-bold">{formatDate(selectedBooking.event_date)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-600">Hall:</span>
                  <span className="text-gray-900 font-bold">{selectedBooking.hall?.name || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

