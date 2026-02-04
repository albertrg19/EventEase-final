'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, Building2, Calendar, Receipt, Grid, Settings, LogOut, 
  Bell, Search, Menu, X, User, Users, HelpCircle, CheckCircle2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface UserData {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
}

type NotificationType = 'booking' | 'invoice' | 'system';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  date: string;
  link: string;
  read?: boolean;
}

type RoleKey = 'superAdmin' | 'manager' | 'support';

const ROLE_MATRIX_STORAGE_KEY = 'admin-role-matrix';
const ROLE_ASSIGNMENTS_STORAGE_KEY = 'admin-role-assignments';

const defaultRoleMatrix: Record<RoleKey, string[]> = {
  superAdmin: ['dashboard', 'users', 'bookings', 'categories', 'halls', 'events', 'invoices', 'settings'],
  manager: ['dashboard', 'bookings', 'halls', 'events', 'invoices', 'categories'],
  support: ['dashboard', 'bookings', 'categories'],
};

type RoleAssignments = Record<string, RoleKey>;

type MenuItem = {
  icon: typeof Home;
  label: string;
  href: string;
  module: string;
};

const baseMenuItems: MenuItem[] = [
  { icon: Home, label: 'Dashboard', href: '/admin/dashboard', module: 'dashboard' },
  { icon: Users, label: 'Manage Users', href: '/admin/users', module: 'users' },
  { icon: Calendar, label: 'Manage Bookings', href: '/admin/bookings', module: 'bookings' },
  { icon: Grid, label: 'Manage Event Categories', href: '/admin/categories', module: 'categories' },
  { icon: Building2, label: 'Manage Event Halls', href: '/admin/halls', module: 'halls' },
  { icon: Calendar, label: 'Event Management', href: '/admin/events', module: 'events' },
  { icon: Receipt, label: 'Invoice Management', href: '/admin/invoices', module: 'invoices' },
  { icon: Settings, label: 'Settings', href: '/admin/settings', module: 'settings' },
];

const NotificationPanel = ({
  open,
  onClose,
  notifications,
  markAllRead,
  toggleRead,
  refreshing,
}: {
  open: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  markAllRead: () => void;
  toggleRead: (id: string) => void;
  refreshing: boolean;
}) => {
  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
            <p className="text-sm text-gray-500">{notifications.length} alerts</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs">
              Mark all read
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-72px)] bg-gray-50">
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-3" />
              <p>All caught up! No new notifications.</p>
            </div>
          ) : (
            notifications.map((item) => {
              const isBooking = item.type === 'booking';
              const iconClass = isBooking ? 'text-blue-600 bg-blue-100' : item.type === 'invoice' ? 'text-amber-600 bg-amber-100' : 'text-purple-600 bg-purple-100';
              const IconComponent = isBooking ? Calendar : item.type === 'invoice' ? Receipt : Bell;
              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition cursor-pointer ${
                    item.read ? 'opacity-70' : ''
                  }`}
                  onClick={() => toggleRead(item.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${iconClass}`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-600">{item.description}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(item.date).toLocaleString()}</p>
                      <Link href={item.link} className="text-xs text-blue-600 font-semibold mt-2 inline-block">
                        View details →
                      </Link>
                    </div>
                    {!item.read && <span className="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>}
                  </div>
                </div>
              );
            })
          )}
          {refreshing && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing…
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<UserData | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [refreshingNotifications, setRefreshingNotifications] = useState(false);
  const [roleMatrix, setRoleMatrix] = useState(defaultRoleMatrix);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignments>({});
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedMatrix = localStorage.getItem(ROLE_MATRIX_STORAGE_KEY);
      if (storedMatrix) {
        setRoleMatrix((prev) => ({ ...prev, ...JSON.parse(storedMatrix) }));
      }
      const storedAssignments = localStorage.getItem(ROLE_ASSIGNMENTS_STORAGE_KEY);
      if (storedAssignments) {
        setRoleAssignments(JSON.parse(storedAssignments));
      }
    } catch (error) {
      console.warn('Failed to load admin roles:', error);
    }
    const handler = (event: StorageEvent) => {
      if (event.key === ROLE_MATRIX_STORAGE_KEY && event.newValue) {
        try {
          setRoleMatrix((prev) => ({ ...prev, ...JSON.parse(event.newValue!) }));
        } catch {
          /* noop */
        }
      }
      if (event.key === ROLE_ASSIGNMENTS_STORAGE_KEY && event.newValue) {
        try {
          setRoleAssignments(JSON.parse(event.newValue));
        } catch {
          /* noop */
        }
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    // Basic role guard using JWT payload
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.error('Invalid token format');
        localStorage.removeItem('token');
        router.push('/login');
        return;
      }
      const payload = JSON.parse(atob(tokenParts[1] || ''));
      
      // Check token expiration
      if (payload.exp && payload.exp < Date.now() / 1000) {
        console.error('Token has expired');
        localStorage.removeItem('token');
        localStorage.removeItem('remember');
        router.push('/login');
        return;
      }
      
      if (payload?.role !== 'admin') {
        router.push('/customer/dashboard');
        return;
      }
    } catch (e) {
      console.error('Failed to parse token:', e);
      localStorage.removeItem('token');
      router.push('/login');
      return;
    }
    fetchUserProfile();
  }, [router]);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoadingUser(false);
        router.push('/login');
        return;
      }

      // Validate token format and expiration before making request
      try {
        const tokenParts = token.trim().split('.');
        if (tokenParts.length !== 3) {
          throw new Error('Invalid token format');
        }
        const payload = JSON.parse(atob(tokenParts[1] || ''));
        
        // Check if token has required fields
        if (!payload.sub && !payload.userId) {
          throw new Error('Token missing user ID');
        }
        
        // Check token expiration
        if (payload.exp && payload.exp < Date.now() / 1000) {
          throw new Error('Token expired');
        }
      } catch (tokenError) {
        console.warn('Invalid or expired token:', tokenError);
        localStorage.removeItem('token');
        localStorage.removeItem('remember');
        setLoadingUser(false);
        router.push('/login');
        return;
      }

      console.log('Fetching user profile from:', `${api}/api/me`);
      const res = await fetch(`${api}/api/me`, {
        headers: { 
          'Authorization': `Bearer ${token.trim()}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include',
      });
      
      console.log('Response status:', res.status, res.statusText);
      
      // Handle 401 immediately - token is invalid or expired
      if (res.status === 401 || res.status === 403) {
        try {
          const errorData = await res.json().catch(() => ({}));
          console.warn('Authentication failed:', res.status, errorData);
        } catch (e) {
          // Ignore JSON parse errors
        }
        localStorage.removeItem('token');
        localStorage.removeItem('remember');
        setLoadingUser(false);
        router.push('/login');
        return;
      }
      
      if (res.ok) {
        const userData = await res.json();
        console.log('User data fetched successfully:', userData);
        // Handle both lowercase (with JSON tags) and capitalized (without JSON tags) field names
        const name = userData.name || userData.Name;
        const email = userData.email || userData.Email;
        const role = userData.role || userData.Role;
        const id = userData.id || userData.ID;
        
        if (userData && (name || email)) {
          setUser({
            id: id || 0,
            name: name || email || 'Super Admin',
            email: email || 'superadmin@gmail.com',
            role: role || 'admin',
            phone: userData.phone || userData.Phone,
          });
        } else {
          console.warn('User data missing name/email:', userData);
          // Try to get from token as fallback
          try {
            const payload = JSON.parse(atob(token.split('.')[1] || ''));
            setUser({
              id: Number(payload.sub),
              name: 'Super Admin',
              email: payload.email || 'superadmin@gmail.com',
              role: payload.role || 'admin',
            });
          } catch (e) {
            setUser({
              id: 0,
              name: 'Super Admin',
              email: 'superadmin@gmail.com',
              role: 'admin',
            });
          }
        }
      } else {
        // This should not happen for 401/403 (handled above), but handle other errors
        let errorData = {};
        try {
          errorData = await res.json().catch(() => ({}));
        } catch (e) {
          // Ignore JSON parse errors
        }
        
        // Don't log 401/403 errors here as they're already handled above
        if (res.status !== 401 && res.status !== 403) {
          console.warn('Failed to fetch user profile (non-auth error):', res.status, res.statusText, errorData);
        }
        // Try to fetch user by ID from admin endpoint as fallback
        try {
          const tokenParts = token.split('.');
          if (tokenParts.length !== 3) {
            throw new Error('Invalid token format');
          }
          const payload = JSON.parse(atob(tokenParts[1] || ''));
          console.log('Token payload:', payload);
          const userId = payload.sub || payload.userId;
          if (userId) {
            const userRes = await fetch(`${api}/api/admin/users/${userId}`, {
              headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              console.log('User data from admin endpoint:', userData);
              const name = userData.name || userData.Name || 'Super Admin';
              const email = userData.email || userData.Email || 'superadmin@gmail.com';
              const role = userData.role || userData.Role || 'admin';
              setUser({
                id: userData.id || userData.ID || Number(userId),
                name,
                email,
                role,
                phone: userData.phone || userData.Phone,
              });
            } else {
              // Set default super admin data from token
              setUser({
                id: Number(userId),
                name: 'Super Admin',
                email: payload.email || 'superadmin@gmail.com',
                role: payload.role || 'admin',
              });
            }
          } else {
            // No user ID in token, set default
            setUser({
              id: 0,
              name: 'Super Admin',
              email: 'superadmin@gmail.com',
              role: 'admin',
            });
          }
        } catch (e) {
          console.error('Failed to parse token or fetch user:', e);
          // Set default super admin
          setUser({
            id: 0,
            name: 'Super Admin',
            email: 'superadmin@gmail.com',
            role: 'admin',
          });
        }
      }
    } catch (error) {
      // Only log non-authentication errors
      if (!(error instanceof Error && (error.message.includes('401') || error.message.includes('403')))) {
        console.warn('Failed to fetch user profile (network/parsing error):', error);
      }
      
      // Check if it's an authentication error
      if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
        localStorage.removeItem('token');
        localStorage.removeItem('remember');
        setLoadingUser(false);
        router.push('/login');
        return;
      }
      
      // Set default on error (only if not redirecting to login)
      setUser({
        id: 0,
        name: 'Super Admin',
        email: 'superadmin@gmail.com',
        role: 'admin',
      });
    } finally {
      setLoadingUser(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      setRefreshingNotifications(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setNotifications([]);
        return;
      }
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };
      const [bookingsRes, invoicesRes] = await Promise.all([
        fetch(`${api}/api/bookings`, { headers }),
        fetch(`${api}/api/invoices`, { headers }).catch(() => ({ ok: false })),
      ]);

      const bookingsData = bookingsRes.ok ? await bookingsRes.json() : [];
      const invoicesData = invoicesRes instanceof Response && invoicesRes.ok ? await invoicesRes.json() : [];

      const now = new Date();
      const twoDaysFromNow = new Date(now);
      twoDaysFromNow.setDate(now.getDate() + 2);

      const bookingAlerts: NotificationItem[] = (bookingsData || [])
        .filter((booking: any) => {
          const status = (booking.status || booking.Status || '').toLowerCase();
          const date = booking.event_date || booking.EventDate;
          const eventDate = date ? new Date(date) : null;
          const isUpcoming = eventDate && eventDate <= twoDaysFromNow;
          return status === 'pending' || isUpcoming;
        })
        .slice(0, 10)
        .map((booking: any) => {
          const status = (booking.status || booking.Status || '').toLowerCase();
          return {
            id: `booking-${booking.id || booking.ID}`,
            type: 'booking' as const,
            title: status === 'pending' ? 'Booking awaiting approval' : 'Upcoming event',
            description: `${booking.event_name || booking.EventName || 'Event'} on ${new Date(
              booking.event_date || booking.EventDate,
            ).toLocaleDateString()}`,
            date: booking.created_at || booking.CreatedAt || booking.event_date || booking.EventDate || new Date().toISOString(),
            link: '/admin/bookings',
          };
        });

      const invoiceAlerts: NotificationItem[] = (invoicesData || [])
        .filter((inv: any) => {
          const createdAt = inv.created_at || inv.CreatedAt;
          if (!createdAt) return false;
          const createdDate = new Date(createdAt);
          const ageInDays = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
          return ageInDays <= 7;
        })
        .slice(0, 10)
        .map((inv: any) => ({
          id: `invoice-${inv.id || inv.ID}`,
          type: 'invoice' as const,
          title: 'Recent invoice issued',
          description: `Invoice #${inv.id || inv.ID} totaling ₱${Number(inv.total_amount || inv.TotalAmount || 0).toFixed(2)}`,
          date: inv.created_at || inv.CreatedAt || new Date().toISOString(),
          link: '/admin/invoices',
        }));

      const newItems = [...bookingAlerts, ...invoiceAlerts].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setNotifications((prev) => {
        const readMap = new Map(prev.map((item) => [item.id, item.read]));
        return newItems.map((item) => ({ ...item, read: readMap.get(item.id) ?? item.read ?? false }));
      });
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setRefreshingNotifications(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markAllNotificationsRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const toggleNotificationRead = (id: string) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)),
    );

  const superAdminEmail = 'superadmin@gmail.com';

  const effectiveRole: RoleKey = useMemo(() => {
    if (!user || user.role !== 'admin') {
      return 'support';
    }
    if (user.email === superAdminEmail) {
      return 'superAdmin';
    }
    return roleAssignments[user.id] || 'manager';
  }, [user, roleAssignments]);

  const allowedModules = useMemo(() => {
    if (!user || user.role !== 'admin') {
      return baseMenuItems.map((item) => item.module);
    }
    return roleMatrix[effectiveRole] || roleMatrix.manager;
  }, [user, roleMatrix, effectiveRole]);

  const navigationItems = useMemo(() => {
    const allowedSet = new Set(allowedModules);
    return baseMenuItems.filter((item) => allowedSet.has(item.module));
  }, [allowedModules]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('remember');
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
      {/* Top Header Bar */}
      <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 text-white shadow-xl backdrop-blur-sm border-b border-blue-800/50 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 md:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="text-white hover:bg-white/10 md:hidden"
            >
              {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-3">
              <img 
                src="/Logooo.png" 
                alt="EventEase Logo" 
                className="h-10 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`bg-gradient-to-b from-blue-950 via-blue-900 to-blue-950 text-white transition-all duration-300 shadow-2xl backdrop-blur-sm relative ${
          sidebarOpen ? 'w-64' : 'w-20'
        } min-h-[calc(100vh-73px)] fixed md:relative z-40 ${
          mobileSidebarOpen ? 'left-0' : '-left-64 md:left-0'
        }`}>
          {/* Background texture overlay */}
          <div 
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }}
          ></div>
          
          <div className="relative p-6 h-full flex flex-col">
            {/* User Profile Section - Always visible at the top */}
            <div className="mb-6 pb-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-semibold shadow-lg ring-2 ring-white/20">
                    {loadingUser ? (
                      <div className="w-6 h-6 border-2 border-white/40 border-t-transparent rounded-full animate-spin"></div>
                    ) : user?.name ? (
                      <span className="text-sm font-bold">
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    ) : (
                      <User className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-gray-900"></div>
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    {loadingUser ? (
                      <>
                        <div className="h-4 bg-blue-700/50 rounded w-24 mb-2 animate-pulse"></div>
                        <div className="h-3 bg-blue-700/50 rounded w-16 mb-2 animate-pulse"></div>
                        <div className="h-3 bg-blue-700/50 rounded w-12 animate-pulse"></div>
                      </>
                    ) : user ? (
                      <>
                        <p className="text-white font-semibold text-sm truncate">
                          {user.name?.trim() || user.email || 'Loading...'}
                        </p>
                        <p className="text-gray-400 text-xs capitalize mt-0.5">{user.role || 'admin'}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-400">Online</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-white font-semibold text-sm truncate">Loading...</p>
                        <p className="text-gray-400 text-xs capitalize mt-0.5">Admin</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-400">Online</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Search Bar */}
            {sidebarOpen && (
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-blue-900/50 border-blue-700 text-white placeholder:text-blue-300 focus:border-yellow-400 focus:ring-yellow-400/20 h-9 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Navigation Section */}
            <div className="mb-4 flex-1 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">General</p>
              <nav className="space-y-1.5">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                    <Link key={item.href} href={item.href} onClick={() => setMobileSidebarOpen(false)}>
                      <div className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                          : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}>
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                        {sidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
                  </div>
                </Link>
              );
            })}
              </nav>
            </div>

            {/* Footer Icons */}
            <div className="mt-auto pt-4 border-t border-white/10">
              {sidebarOpen ? (
                <div className="flex items-center justify-between">
                  <button
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    title="Help"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </button>
                  <button
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all relative"
                    title="Notifications"
                    onClick={() => setNotificationsOpen(true)}
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-4 bg-red-500 text-white text-[10px] font-semibold rounded-full flex items-center justify-center px-1">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <Link href="/admin/settings">
                    <button
                      className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                      title="Settings"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Logout"
                  >
                    <LogOut className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 items-center">
                  <button
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    title="Help"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </button>
                  <button
                    className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all relative"
                    title="Notifications"
                    onClick={() => setNotificationsOpen(true)}
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-3.5 bg-red-500 text-white text-[9px] font-semibold rounded-full flex items-center justify-center px-1">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <Link href="/admin/settings">
                    <button
                      className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                      title="Settings"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                  </Link>
              <button
                onClick={handleLogout}
                    className="p-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Logout"
              >
                    <LogOut className="h-4 w-4" />
              </button>
            </div>
              )}
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'md:ml-0' : 'md:ml-0'}`}>
          <div className="p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      <NotificationPanel
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        markAllRead={markAllNotificationsRead}
        toggleRead={toggleNotificationRead}
        refreshing={refreshingNotifications}
      />
    </div>
  );
}
