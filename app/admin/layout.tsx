'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, Building2, Calendar, Receipt, Grid, Settings, LogOut, 
  Bell, Search, Menu, X, User, Users, HelpCircle
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<UserData | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    // Basic role guard using JWT payload
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || ''));
      if (payload?.role !== 'admin') {
        router.push('/customer/bookings');
        return;
      }
    } catch {}
    fetchUserProfile();
  }, [router]);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoadingUser(false);
        return;
      }

      const res = await fetch(`${api}/api/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    } finally {
      setLoadingUser(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('remember');
    router.push('/login');
  };

  const menuItems = [
    { icon: Home, label: 'Dashboard', href: '/admin/dashboard' },
    { icon: Users, label: 'Manage Users', href: '/admin/users' },
    { icon: Calendar, label: 'Manage Bookings', href: '/admin/bookings' },
    { icon: Grid, label: 'Manage Event Categories', href: '/admin/categories' },
    { icon: Building2, label: 'Manage Event Halls', href: '/admin/halls' },
    { icon: Calendar, label: 'Event Management', href: '/admin/events' },
    { icon: Receipt, label: 'Invoice Management', href: '/admin/invoices' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
  ];

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
                        <p className="text-white font-semibold text-sm truncate">{user.name}</p>
                        <p className="text-gray-400 text-xs capitalize mt-0.5">{user.role}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-400">Online</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-white font-semibold text-sm truncate">Admin User</p>
                        <p className="text-gray-400 text-xs capitalize mt-0.5">Administrator</p>
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
            {menuItems.map((item) => {
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
                  >
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
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
                  >
                    <Bell className="h-4 w-4" />
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
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
    </div>
  );
}
