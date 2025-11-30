'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Building2, Receipt, TrendingUp, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

type Booking = { id: number; event_name: string; event_date: string; status?: string; user?: { name: string } };

export default function DashboardPage() {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ bookings: 0, halls: 0, revenue: 0, customers: 0 });
  const [recent, setRecent] = useState<Booking[]>([]);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);
        const token = localStorage.getItem('token') || '';
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : ({} as Record<string, string>);
        const [bookingsRes, hallsRes, invoicesRes, usersRes] = await Promise.all([
          fetch(`${api}/api/bookings`, { headers }),
          fetch(`${api}/api/halls`, { headers }),
          fetch(`${api}/api/invoices`, { headers }),
          fetch(`${api}/api/admin/users`, { headers }).catch(() => ({ ok: false }))
        ]);

        const bookings = bookingsRes.ok ? await bookingsRes.json() : [];
        const halls = hallsRes.ok ? await hallsRes.json() : [];
        const invoices = invoicesRes.ok ? await invoicesRes.json() : [];
        const users = usersRes instanceof Response && usersRes.ok ? await usersRes.json() : [];

        const revenue = (invoices || []).reduce((sum: number, inv: any) => sum + (inv.total_amount || inv.TotalAmount || 0), 0);
        setMetrics({ bookings: (bookings || []).length, halls: (halls || []).length, revenue, customers: (users || []).length });
        setRecent((bookings || []).slice(0, 6));
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, [api]);

  const fmtMoney = (v: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v || 0);

  const stats = [
    { label: 'Total Bookings', value: metrics.bookings.toString(), icon: Calendar, color: 'from-blue-500 to-blue-700' },
    { label: 'Active Venues', value: metrics.halls.toString(), icon: Building2, color: 'from-green-500 to-green-700' },
    { label: 'Total Revenue', value: fmtMoney(metrics.revenue), icon: Receipt, color: 'from-yellow-400 to-yellow-600', darkText: true },
    { label: 'Customers', value: metrics.customers.toString(), icon: Users, color: 'from-purple-500 to-purple-700' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-950 via-blue-700 to-blue-950 bg-clip-text text-transparent">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of system performance and activity.</p>
        </div>
        <Link href="/admin/bookings" className="group">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-950 text-white shadow-lg hover:bg-blue-900 transition">
            View Bookings
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{stat.label}</CardTitle>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color} text-white shadow`}> <Icon className="h-5 w-5" /> </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-extrabold ${stat.darkText ? 'text-yellow-600' : 'text-gray-900'}`}>{loading ? '—' : stat.value}</div>
                <p className="text-xs text-gray-500 mt-1">
                  <TrendingUp className="inline h-3 w-3 mr-1" />
                  Updated now
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Recent Bookings</CardTitle>
            <Link href="/admin/bookings" className="text-sm text-blue-600 hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-gray-600">No recent bookings to display.</p>
            ) : (
              <div className="divide-y">
                {recent.map((b, index) => (
                  <div key={`booking-${b.id ?? index}`} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-semibold text-gray-900">{b.event_name}</div>
                      <div className="text-xs text-gray-500">{new Date(b.event_date).toLocaleDateString()}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${(b.status || 'pending') === 'approved' ? 'bg-green-50 text-green-700 border-green-200' : (b.status || 'pending') === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                      }`}>
                      <CheckCircle2 className="h-3 w-3" />
                      {(b.status || 'pending').toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/admin/bookings" className="px-4 py-3 rounded-xl bg-blue-950 text-white hover:bg-blue-900 transition shadow">Manage Bookings</Link>
              <Link href="/admin/halls" className="px-4 py-3 rounded-xl bg-white border hover:bg-gray-50 transition shadow">Manage Venues</Link>
              <Link href="/admin/events" className="px-4 py-3 rounded-xl bg-white border hover:bg-gray-50 transition shadow">Event Management</Link>
              <Link href="/admin/invoices" className="px-4 py-3 rounded-xl bg-white border hover:bg-gray-50 transition shadow">Invoice Center</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
