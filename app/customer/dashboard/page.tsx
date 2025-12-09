'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Receipt,
  Building2,
  ArrowRight,
  Loader2,
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';

interface Booking {
  id: number;
  event_name: string;
  event_type: string;
  event_date: string;
  status: 'pending' | 'approved' | 'rejected';
  hall?: { name: string };
  created_at?: string;
}

interface Invoice {
  id: number;
  booking_id: number;
  total_amount: number;
  created_at?: string;
}

interface UserStats {
  totalBookings: number;
  pendingBookings: number;
  approvedBookings: number;
  rejectedBookings: number;
  totalSpent: number;
  upcomingEvents: number;
}

export default function CustomerDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('User');
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Get user info from token
      let userId = 0;
      try {
        const tokenParts = token.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        userId = payload.sub || 0;
      } catch {
        userId = 0;
      }

      // Fetch user details
      const userRes = await fetch(`${api}/api/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (userRes.ok) {
        const userData = await userRes.json();
        setUserName(userData.name || userData.Name || 'User');
      }

      // Fetch bookings
      const bookingsRes = await fetch(`${api}/api/bookings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        const userBookings = (bookingsData || []).filter(
          (b: Booking) => (b as any).user_id === userId || (b as any).user?.id === userId
        );
        setBookings(userBookings);
      }

      // Fetch invoices
      const invoicesRes = await fetch(`${api}/api/invoices`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        setInvoices(invoicesData || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats: UserStats = useMemo(() => {
    const now = new Date();
    const upcoming = bookings.filter((b) => {
      const eventDate = new Date(b.event_date);
      return eventDate > now && b.status === 'approved';
    }).length;

    const userInvoiceTotal = invoices.reduce((sum, inv) => {
      const bookingBelongsToUser = bookings.some((b) => b.id === inv.booking_id);
      return bookingBelongsToUser ? sum + (inv.total_amount || 0) : sum;
    }, 0);

    return {
      totalBookings: bookings.length,
      pendingBookings: bookings.filter((b) => b.status === 'pending').length,
      approvedBookings: bookings.filter((b) => b.status === 'approved').length,
      rejectedBookings: bookings.filter((b) => b.status === 'rejected').length,
      totalSpent: userInvoiceTotal,
      upcomingEvents: upcoming,
    };
  }, [bookings, invoices]);

  const recentBookings = useMemo(() => {
    return [...bookings]
      .sort((a, b) => new Date(b.created_at || b.event_date).getTime() - new Date(a.created_at || a.event_date).getTime())
      .slice(0, 5);
  }, [bookings]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return bookings
      .filter((b) => new Date(b.event_date) > now && b.status === 'approved')
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .slice(0, 5);
  }, [bookings]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {userName}!</h1>
        <p className="text-blue-100">Here&apos;s an overview of your booking activity.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Bookings</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalBookings}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Approved</p>
                <p className="text-3xl font-bold text-gray-900">{stats.approvedBookings}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pendingBookings}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Spent</p>
                <p className="text-3xl font-bold text-gray-900">₱{stats.totalSpent.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Events */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Upcoming Events
            </CardTitle>
            <Link href="/customer/bookings" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No upcoming events</p>
                <Link href="/customer/booking">
                  <Button className="mt-4" variant="outline">
                    Book an Event
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Building2 className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{booking.event_name}</p>
                        <p className="text-xs text-gray-500">{booking.hall?.name || 'Venue TBD'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatDate(booking.event_date)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-purple-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-gray-200 transition"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(booking.status)}
                      <div>
                        <p className="font-semibold text-gray-900">{booking.event_name}</p>
                        <p className="text-xs text-gray-500">{booking.event_type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{formatDate(booking.event_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/customer/booking">
              <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white hover:from-blue-600 hover:to-blue-700 transition cursor-pointer">
                <Calendar className="h-6 w-6 mb-2" />
                <p className="font-semibold">New Booking</p>
                <p className="text-sm text-blue-100">Reserve a venue</p>
              </div>
            </Link>
            <Link href="/customer/bookings">
              <div className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl text-white hover:from-purple-600 hover:to-purple-700 transition cursor-pointer">
                <Receipt className="h-6 w-6 mb-2" />
                <p className="font-semibold">My Bookings</p>
                <p className="text-sm text-purple-100">View all bookings</p>
              </div>
            </Link>
            <Link href="/customer/profile">
              <div className="p-4 bg-gradient-to-br from-green-500 to-green-600 rounded-xl text-white hover:from-green-600 hover:to-green-700 transition cursor-pointer">
                <Building2 className="h-6 w-6 mb-2" />
                <p className="font-semibold">My Profile</p>
                <p className="text-sm text-green-100">Update your info</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

