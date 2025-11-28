'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  Calendar,
  Building2,
  Receipt,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  BarChart3,
  Clock,
  Server,
  Database,
  HardDrive,
  Zap,
  FileText,
  UserPlus,
} from 'lucide-react';

type Booking = {
  id: number;
  event_name: string;
  event_date: string;
  status: string;
  hall?: { name?: string };
};

type SeriesPoint = { date: string; value: number };
type TrendInfo = { direction: 'up' | 'down' | 'flat'; percent: number };
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
type HealthStatus = 'checking' | 'ok' | 'warning' | 'down';
type ServiceHealth = {
  label: string;
  status: HealthStatus;
  detail?: string;
  latency?: number | null;
};

const rangeOptions = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const formatShortDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const parseBookingDate = (booking: any) => {
  const raw = booking.created_at || booking.CreatedAt || booking.event_date || booking.EventDate;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const parseInvoiceDate = (invoice: any) => {
  const raw = invoice.created_at || invoice.CreatedAt;
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
};

const getInvoiceAmount = (invoice: any) => Number(invoice.total_amount ?? invoice.TotalAmount ?? 0);

const buildDailySeries = <T,>(
  items: T[],
  dateAccessor: (item: T) => Date | null,
  start: Date,
  end: Date,
  valueAccessor: (item: T) => number = () => 1,
): SeriesPoint[] => {
  const bucket = new Map<string, number>();
  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);

  items.forEach((item) => {
    const date = dateAccessor(item);
    if (!date) return;
    const day = startOfDay(date);
    if (day < start || day > end) return;
    const key = day.toISOString();
    bucket.set(key, (bucket.get(key) || 0) + valueAccessor(item));
  });

  return Array.from({ length: dayCount }).map((_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = day.toISOString();
    return { date: formatShortDate(day), value: bucket.get(key) || 0 };
  });
};

const computeTrend = (current: number, previous: number): TrendInfo => {
  if (!current && !previous) return { direction: 'flat', percent: 0 };
  if (!previous) return { direction: 'up', percent: 100 };
  const delta = current - previous;
  const percent = Math.abs((delta / previous) * 100);
  if (delta === 0) return { direction: 'flat', percent: 0 };
  return { direction: delta > 0 ? 'up' : 'down', percent };
};

const DASHBOARD_PREFS_KEY = 'dashboard-card-prefs';
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

const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  if (!data.length) {
    return <div className="h-12" />;
  }
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = data.length === 1 ? 100 : (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" className="h-12 w-full" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

export default function DashboardPage() {
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<any[]>([]);
  const [halls, setHalls] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [recent, setRecent] = useState<Booking[]>([]);
  const [range, setRange] = useState<number>(rangeOptions[1].value);
  const [dashboardPrefs, setDashboardPrefs] = useState<DashboardPrefs>(defaultDashboardPrefs);
  const [serviceHealth, setServiceHealth] = useState<Record<string, ServiceHealth>>({
    api: { label: 'API Core', status: 'checking', detail: 'Pinging endpoints', latency: null },
    database: { label: 'Database', status: 'checking', detail: 'Syncing records' },
    storage: { label: 'Assets / Uploads', status: 'checking', detail: 'Verifying uploads' },
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedPrefs = localStorage.getItem(DASHBOARD_PREFS_KEY);
      if (storedPrefs) {
        setDashboardPrefs((prev) => ({ ...prev, ...JSON.parse(storedPrefs) }));
      }
    } catch {
      /* no-op */
    }
    const handler = (event: StorageEvent) => {
      if (event.key === DASHBOARD_PREFS_KEY && event.newValue) {
        try {
          setDashboardPrefs((prev) => ({ ...prev, ...JSON.parse(event.newValue) }));
        } catch {
          /* no-op */
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setLoading(true);
        const token = localStorage.getItem('token') || '';
        const headers: HeadersInit = token
          ? { Authorization: `Bearer ${token}` }
          : ({} as Record<string, string>);

        const requestStarted = performance.now();
        const [bookingsRes, hallsRes, invoicesRes, usersRes] = await Promise.all([
          fetch(`${api}/api/bookings`, { headers }),
          fetch(`${api}/api/halls`, { headers }),
          fetch(`${api}/api/invoices`, { headers }),
          fetch(`${api}/api/admin/users`, { headers }).catch(() => ({ ok: false })),
        ]);
        const apiLatency = Math.round(performance.now() - requestStarted);

        const bookingsData = bookingsRes.ok ? await bookingsRes.json() : [];
        const hallsData = hallsRes.ok ? await hallsRes.json() : [];
        const invoicesData = invoicesRes.ok ? await invoicesRes.json() : [];
        const usersData = usersRes instanceof Response && usersRes.ok ? await usersRes.json() : [];

        let assetOk = false;
        try {
          const assetResponse = await fetch('/Logooo.png', { method: 'HEAD' });
          assetOk = assetResponse.ok;
        } catch {
          assetOk = false;
        }

        setBookings(bookingsData);
        setHalls(hallsData);
        setInvoices(invoicesData);
        setCustomers(usersData);
        setRecent((bookingsData || []).slice(0, 6));
        setServiceHealth({
          api: {
            label: 'API Core',
            status: bookingsRes.ok ? 'ok' : 'down',
            detail: `${(bookingsData || []).length} bookings loaded`,
            latency: apiLatency,
          },
          database: {
            label: 'Database',
            status: hallsRes.ok ? 'ok' : 'down',
            detail: `${(hallsData || []).length} venues indexed`,
          },
          storage: {
            label: 'Assets / Uploads',
            status: assetOk ? 'ok' : 'warning',
            detail: assetOk ? 'Uploads reachable' : 'Asset ping failed',
          },
        });
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
  }, [api]);

  const analytics = useMemo(() => {
    const now = startOfDay(new Date());
    const start = new Date(now);
    start.setDate(now.getDate() - (range - 1));
    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - range);
    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);

    const inRange = (date: Date | null) => date && date >= start && date <= now;
    const inPrevRange = (date: Date | null) => date && date >= prevStart && date <= prevEnd;

    const bookingCurrent = bookings.filter((b) => inRange(parseBookingDate(b)));
    const bookingPrev = bookings.filter((b) => inPrevRange(parseBookingDate(b)));

    const invoiceCurrent = invoices.filter((inv) => inRange(parseInvoiceDate(inv)));
    const invoicePrev = invoices.filter((inv) => inPrevRange(parseInvoiceDate(inv)));

    const totalBookings = bookingCurrent.length;
    const totalRevenue = invoiceCurrent.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);
    const prevBookings = bookingPrev.length;
    const prevRevenue = invoicePrev.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);

    const bookingsSeries = buildDailySeries(bookings, parseBookingDate, start, now);
    const revenueSeries = buildDailySeries(invoices, parseInvoiceDate, start, now, getInvoiceAmount);

    const statusCounts = bookings.reduce<Record<string, number>>((acc, booking) => {
      const status = (booking.status || booking.Status || 'pending').toLowerCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const venuesMap = new Map<string, number>();
    bookings.forEach((booking) => {
      const hallName =
        booking.hall?.name ||
        booking.Hall?.name ||
        booking.Hall?.Name ||
        booking.hall_name ||
        booking.HallName;
      if (!hallName) return;
      venuesMap.set(hallName, (venuesMap.get(hallName) || 0) + 1);
    });
    const topVenues = Array.from(venuesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalBookings,
      totalRevenue,
      prevBookings,
      prevRevenue,
      bookingsSeries,
      revenueSeries,
      statusCounts,
      topVenues,
      rangeLabel: `${formatShortDate(start)} - ${formatShortDate(now)}`,
    };
  }, [bookings, invoices, range]);

  const fmtMoney = (v: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(v || 0);
  const bookingsTrend = computeTrend(analytics.totalBookings, analytics.prevBookings);
  const revenueTrend = computeTrend(analytics.totalRevenue, analytics.prevRevenue);

  const activityFeed = useMemo(() => {
    const events: Array<{ id: string; type: string; title: string; timestamp: string; meta: string }> = [];
    (bookings || []).slice(0, 8).forEach((booking) => {
      const ts = booking.updated_at || booking.UpdatedAt || booking.created_at || booking.CreatedAt || booking.event_date || booking.EventDate;
      if (!ts) return;
      events.push({
        id: `booking-${booking.id}`,
        type: 'booking',
        title: `${booking.event_name || 'Booking'} ${((booking.status || booking.Status || '') as string).toUpperCase()}`,
        timestamp: ts,
        meta: booking.status || booking.Status || 'pending',
      });
    });
    (invoices || []).slice(0, 6).forEach((inv) => {
      const ts = inv.created_at || inv.CreatedAt;
      if (!ts) return;
      events.push({
        id: `invoice-${inv.id}`,
        type: 'invoice',
        title: `Invoice #${inv.id || inv.ID} issued`,
        timestamp: ts,
        meta: fmtMoney(getInvoiceAmount(inv)),
      });
    });
    (customers || []).slice(0, 6).forEach((customer) => {
      const ts = customer.created_at || customer.CreatedAt;
      if (!ts) return;
      events.push({
        id: `user-${customer.id}`,
        type: 'user',
        title: `${customer.name || customer.Name || customer.email} joined`,
        timestamp: ts,
        meta: customer.email,
      });
    });
    return events
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 6);
  }, [bookings, invoices, customers]);

  const stats = [
    {
      label: 'Bookings',
      value: loading ? '—' : analytics.totalBookings.toString(),
      icon: Calendar,
      gradient: 'from-blue-500/90 to-blue-700',
      trend: bookingsTrend,
      color: '#1d4ed8',
      data: analytics.bookingsSeries.map((p) => p.value),
    },
    {
      label: 'Active Venues',
      value: loading ? '—' : halls.length.toString(),
      icon: Building2,
      gradient: 'from-emerald-500/90 to-emerald-700',
      trend: { direction: 'flat', percent: 0 },
      color: '#10b981',
      data: analytics.bookingsSeries.map(() => halls.length || 0),
    },
    {
      label: 'Revenue',
      value: loading ? '—' : fmtMoney(analytics.totalRevenue),
      icon: Receipt,
      gradient: 'from-amber-400 to-amber-500',
      trend: revenueTrend,
      color: '#d97706',
      data: analytics.revenueSeries.map((p) => p.value),
    },
    {
      label: 'Customers',
      value: loading ? '—' : customers.length.toString(),
      icon: Users,
      gradient: 'from-purple-500/90 to-purple-700',
      trend: { direction: 'flat', percent: 0 },
      color: '#7c3aed',
      data: analytics.bookingsSeries.map(() => customers.length || 0),
    },
  ];

  const statusMeta = [
    { key: 'pending', label: 'Pending', color: 'bg-yellow-500' },
    { key: 'approved', label: 'Approved', color: 'bg-emerald-500' },
    { key: 'rejected', label: 'Rejected', color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-blue-950 via-blue-700 to-blue-950 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Overview of system performance and activity.</p>
          <p className="text-xs text-gray-500">{analytics.rangeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {rangeOptions.map((option) => (
            <Button
              key={option.value}
              variant={option.value === range ? 'default' : 'outline'}
              onClick={() => setRange(option.value)}
              className={`px-4 ${option.value === range ? 'bg-blue-950 text-white' : 'border-gray-200 text-gray-600'}`}
            >
              {option.label}
            </Button>
          ))}
          <Link href="/admin/bookings" className="group ml-2">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-950 text-white shadow-lg hover:bg-blue-900 transition">
              View Bookings
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>
        </div>
      </div>

      {dashboardPrefs.showMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const trendIcon =
              stat.trend.direction === 'up' ? ArrowUpRight : stat.trend.direction === 'down' ? ArrowDownRight : Activity;
            const TrendIcon = trendIcon;
            return (
              <Card key={stat.label} className="overflow-hidden border-none shadow-lg shadow-blue-950/5">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle className="text-sm font-semibold text-gray-600">{stat.label}</CardTitle>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <TrendingUp className="h-3 w-3" />
                      {stat.trend.direction === 'flat' ? 'No change' : `${stat.trend.percent.toFixed(1)}% vs prev.`}
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} text-white shadow`}> <Icon className="h-5 w-5" /> </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-extrabold text-gray-900">{stat.value}</div>
                    <span
                      className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-full ${stat.trend.direction === 'down'
                        ? 'bg-rose-50 text-rose-600'
                        : stat.trend.direction === 'up'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-gray-100 text-gray-500'
                        }`}
                    >
                      <TrendIcon className="h-3 w-3 mr-1" />
                      {stat.trend.direction === 'flat' ? 'Stable' : `${stat.trend.direction === 'down' ? '-' : '+'}${stat.trend.percent.toFixed(1)}%`}
                    </span>
                  </div>
                  <Sparkline data={stat.data} color={stat.color} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(dashboardPrefs.showPerformance || dashboardPrefs.showStatus) && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {dashboardPrefs.showPerformance && (
            <Card className="xl:col-span-2">
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                  Performance Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-600">Bookings</span>
                    <span className="text-xs text-gray-500">{range}-day trend</span>
                  </div>
                  <Sparkline data={analytics.bookingsSeries.map((p) => p.value)} color="#2563eb" />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>{analytics.bookingsSeries[0]?.date}</span>
                    <span>{analytics.bookingsSeries[analytics.bookingsSeries.length - 1]?.date}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-600">Revenue</span>
                    <span className="text-xs text-gray-500">{range}-day trend</span>
                  </div>
                  <Sparkline data={analytics.revenueSeries.map((p) => p.value)} color="#d97706" />
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>{analytics.revenueSeries[0]?.date}</span>
                    <span>{analytics.revenueSeries[analytics.revenueSeries.length - 1]?.date}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {dashboardPrefs.showStatus && (
            <Card className={dashboardPrefs.showPerformance ? '' : 'xl:col-span-3'}>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Booking Status</CardTitle>
                <span className="text-xs text-gray-500">Live counts</span>
              </CardHeader>
              <CardContent className="space-y-4">
                {statusMeta.map(({ key, label, color }) => {
                  const count = analytics.statusCounts[key] || 0;
                  const total = bookings.length || 1;
                  const percent = Math.round((count / total) * 100);
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <span className="font-semibold">{label}</span>
                        <span>{count} ({percent}%)</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {(dashboardPrefs.showRecent || dashboardPrefs.showTopVenues) && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {dashboardPrefs.showRecent && (
            <Card className={`overflow-hidden ${dashboardPrefs.showTopVenues ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Recent Bookings</CardTitle>
                <Link href="/admin/bookings" className="text-sm text-blue-600 hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                {recent.length === 0 ? (
                  <p className="text-sm text-gray-600">No recent bookings to display.</p>
                ) : (
                  <div className="divide-y">
                    {recent.map((b) => (
                      <div key={b.id} className="flex items-center justify-between py-3">
                        <div>
                          <div className="font-semibold text-gray-900">{b.event_name}</div>
                          <div className="text-xs text-gray-500">{new Date(b.event_date).toLocaleDateString()}</div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${b.status === 'approved'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : b.status === 'rejected'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            }`}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          {b.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {dashboardPrefs.showTopVenues && (
            <Card className={dashboardPrefs.showRecent ? '' : 'xl:col-span-3'}>
              <CardHeader>
                <CardTitle>Top Venues</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analytics.topVenues.length === 0 ? (
                  <p className="text-sm text-gray-600">No bookings recorded yet.</p>
                ) : (
                  analytics.topVenues.map(([name, count], index) => (
                    <div key={name} className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">{index + 1}. {name}</p>
                        <p className="text-xs text-gray-500">{count} bookings</p>
                      </div>
                      <span className="text-sm font-semibold text-blue-600">{((count / bookings.length) * 100).toFixed(1)}%</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {dashboardPrefs.showQuickActions && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Link href="/admin/bookings" className="px-4 py-3 rounded-xl bg-blue-950 text-white hover:bg-blue-900 transition shadow">
                Manage Bookings
              </Link>
              <Link href="/admin/halls" className="px-4 py-3 rounded-xl bg-white border hover:bg-gray-50 transition shadow">
                Manage Venues
              </Link>
              <Link href="/admin/events" className="px-4 py-3 rounded-xl bg-white border hover:bg-gray-50 transition shadow">
                Event Management
              </Link>
              <Link href="/admin/invoices" className="px-4 py-3 rounded-xl bg-white border hover:bg-gray-50 transition shadow">
                Invoice Center
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {(dashboardPrefs.showActivity || dashboardPrefs.showHealth) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {dashboardPrefs.showActivity && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Activity Log
                </CardTitle>
                <span className="text-xs text-gray-500">Recent events</span>
              </CardHeader>
              <CardContent>
                {activityFeed.length === 0 ? (
                  <p className="text-sm text-gray-600">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {activityFeed.map((event) => {
                      const IconComponent = event.type === 'booking' ? Calendar : event.type === 'invoice' ? FileText : UserPlus;
                      const iconBg = event.type === 'booking' ? 'bg-blue-100 text-blue-600' : event.type === 'invoice' ? 'bg-amber-100 text-amber-600' : 'bg-purple-100 text-purple-600';
                      return (
                        <div key={event.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                          <div className={`p-2 rounded-lg ${iconBg}`}>
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">{event.title}</p>
                            <p className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleString()}</p>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">{event.meta}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {dashboardPrefs.showHealth && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-emerald-600" />
                  System Health
                </CardTitle>
                <span className="text-xs text-gray-500">Live status</span>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(serviceHealth).map(([key, service]) => {
                    const IconComponent = key === 'api' ? Zap : key === 'database' ? Database : HardDrive;
                    const statusColor = service.status === 'ok' ? 'bg-emerald-500' : service.status === 'warning' ? 'bg-amber-500' : service.status === 'down' ? 'bg-rose-500' : 'bg-gray-300';
                    const statusText = service.status === 'ok' ? 'Operational' : service.status === 'warning' ? 'Degraded' : service.status === 'down' ? 'Down' : 'Checking…';
                    return (
                      <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <IconComponent className="h-4 w-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{service.label}</p>
                            <p className="text-xs text-gray-500">{service.detail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {service.latency !== undefined && service.latency !== null && (
                            <span className="text-xs text-gray-400">{service.latency}ms</span>
                          )}
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${service.status === 'ok' ? 'bg-emerald-50 text-emerald-700' : service.status === 'warning' ? 'bg-amber-50 text-amber-700' : service.status === 'down' ? 'bg-rose-50 text-rose-700' : 'bg-gray-100 text-gray-500'}`}>
                            <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
                            {statusText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Overall System Status</span>
                    <span className={`font-semibold ${Object.values(serviceHealth).every((s) => s.status === 'ok') ? 'text-emerald-600' : Object.values(serviceHealth).some((s) => s.status === 'down') ? 'text-rose-600' : 'text-amber-600'}`}>
                      {Object.values(serviceHealth).every((s) => s.status === 'ok') ? '✓ All Systems Operational' : Object.values(serviceHealth).some((s) => s.status === 'down') ? '✗ System Issues Detected' : '⚠ Partial Degradation'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
