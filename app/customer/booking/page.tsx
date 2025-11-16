'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Plus, User, Tag, List, Building2, Check, ChevronLeft, ChevronRight, Loader2, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format, isSameDay, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';

interface Category {
  id: number;
  name: string;
}

interface Hall {
  id: number;
  name: string;
}

interface Booking {
  id: number;
  event_date: string;
  hall_id: number;
  event_name: string;
  status: 'pending' | 'approved' | 'rejected';
  hall?: { name: string };
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function NewBookingPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    event_name: '',
    event_type: '',
    event_category_id: 0,
    hall_id: 0,
  });
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (currentDate) {
      fetchBookings();
    }
  }, [currentDate]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const fetchInitialData = async () => {
    setFetchingData(true);
    try {
      await Promise.all([fetchCategories(), fetchHalls()]);
    } finally {
      setFetchingData(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${api}/api/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data || []);
      } else {
        showToast('Failed to load categories', 'error');
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      showToast('Failed to load categories', 'error');
    }
  };

  const fetchHalls = async () => {
    try {
      const res = await fetch(`${api}/api/halls`);
      if (res.ok) {
        const data = await res.json();
        setHalls(data || []);
      } else {
        showToast('Failed to load halls', 'error');
      }
    } catch (error) {
      console.error('Failed to fetch halls:', error);
      showToast('Failed to load halls', 'error');
    }
  };

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${api}/api/bookings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setBookings(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  const getBookingsForDate = (date: Date): Booking[] => {
    return bookings.filter((booking) => isSameDay(new Date(booking.event_date), date));
  };

  const isHallAvailable = (hallId: number, date: Date): boolean => {
    if (!selectedDate || !isSameDay(date, selectedDate)) return true;
    const dateBookings = getBookingsForDate(date);
    return !dateBookings.some(
      (b) => b.hall_id === hallId && (b.status === 'pending' || b.status === 'approved')
    );
  };

  const getAvailableHalls = (): Hall[] => {
    if (!selectedDate) return halls;
    return halls.filter((hall) => isHallAvailable(hall.id, selectedDate));
  };

  const handleDateClick = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      showToast('Cannot book dates in the past', 'error');
      return;
    }
    setSelectedDate(date);
    setDialogOpen(true);
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.event_name.trim()) {
      errors.event_name = 'Event name is required';
    }
    if (!formData.event_type.trim()) {
      errors.event_type = 'Event type is required';
    }
    if (!formData.event_category_id || formData.event_category_id === 0) {
      errors.event_category_id = 'Please select a category';
    }
    if (!formData.hall_id || formData.hall_id === 0) {
      errors.hall_id = 'Please select a hall';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;

    if (!validateForm()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showToast('Please login first', 'error');
        router.push('/login');
        return;
      }

      // Decode JWT to get user ID
      let userId = 1;
      try {
        const tokenParts = token.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        userId = payload.sub || 1;
      } catch {
        showToast('Invalid session. Please login again', 'error');
        router.push('/login');
        return;
      }

      const res = await fetch(`${api}/api/bookings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: userId,
          user_id: userId,
          event_name: formData.event_name.trim(),
          event_type: formData.event_type.trim(),
          event_category_id: formData.event_category_id,
          hall_id: formData.hall_id,
          event_date: format(selectedDate, 'yyyy-MM-dd'),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Booking created successfully!', 'success');
        setDialogOpen(false);
        setFormData({ event_name: '', event_type: '', event_category_id: 0, hall_id: 0 });
        setSelectedDate(null);
        setFormErrors({});
        await fetchBookings();
        setTimeout(() => {
          router.push('/customer/bookings');
        }, 1500);
      } else {
        const errorMsg = data.error || 'Failed to create booking';
        showToast(errorMsg, 'error');
        if (errorMsg.includes('already booked')) {
          setFormErrors({ hall_id: 'This hall is already booked for the selected date' });
        }
      }
    } catch (error) {
      console.error('Failed to create booking:', error);
      showToast('Network error. Please try again', 'error');
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDate = (date: Date) => {
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  const isSelected = (date: Date) => {
    return selectedDate ? isSameDay(date, selectedDate) : false;
  };

  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'rejected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = getDay(monthStart);
  const emptyDays = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl min-w-[300px] max-w-md animate-in slide-in-from-right ${toast.type === 'success'
              ? 'bg-green-50 border-2 border-green-200 text-green-800'
              : toast.type === 'error'
                ? 'bg-red-50 border-2 border-red-200 text-red-800'
                : 'bg-blue-50 border-2 border-blue-200 text-blue-800'
              }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <p className="flex-1 font-medium text-sm">{toast.message}</p>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-3">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-blue-100">
            <Calendar className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
              Event Booking
            </h1>
            <p className="text-blue-600 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              Calendar shows all bookings across the venue. Your bookings will display your name.
            </p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden">
        <CardContent className="p-6 md:p-8">
          {/* Calendar Navigation */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 pb-6 border-b-2 border-gray-200">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={goToPreviousMonth}
                className="rounded-xl hover:bg-gray-100 transition-all hover:scale-110"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                onClick={goToToday}
                className="text-sm rounded-xl bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 font-semibold px-4"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={goToNextMonth}
                className="rounded-xl hover:bg-gray-100 transition-all hover:scale-110"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
              <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md rounded-lg">
                Month
              </Button>
              <Button variant="ghost" size="sm" className="rounded-lg hover:bg-white" disabled>
                Week
              </Button>
              <Button variant="ghost" size="sm" className="rounded-lg hover:bg-white" disabled>
                List
              </Button>
            </div>
          </div>

          {/* Loading State */}
          {fetchingData ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            /* Calendar Grid */
            <div className="grid grid-cols-7 gap-3">
              {/* Day Headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center font-bold text-blue-700 py-3 text-sm uppercase tracking-wider">
                  {day}
                </div>
              ))}

              {/* Empty cells for days before month starts */}
              {emptyDays.map((_, i) => (
                <div key={`empty-${i}`} className="h-20 md:h-24"></div>
              ))}

              {/* Calendar Days */}
              {monthDays.map((date) => {
                const dateBookings = getBookingsForDate(date);
                const past = isPast(date);
                const today = isToday(date);
                const selected = isSelected(date);

                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => !past && handleDateClick(date)}
                    disabled={past}
                    className={`h-20 md:h-24 border-2 rounded-xl transition-all duration-200 group relative overflow-hidden ${today
                      ? 'bg-gradient-to-br from-yellow-100 to-yellow-50 border-yellow-400 ring-2 ring-yellow-300/50 shadow-lg'
                      : selected
                        ? 'bg-gradient-to-br from-blue-100 to-blue-50 border-blue-500 ring-4 ring-blue-300/50 shadow-xl scale-105'
                        : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                      } ${past ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                  >
                    <div
                      className={`text-lg font-bold mb-1 ${today ? 'text-yellow-700' : selected ? 'text-blue-700' : 'text-gray-900'
                        } group-hover:text-blue-700 transition-colors`}
                    >
                      {format(date, 'd')}
                    </div>
                    {/* Booking Indicators */}
                    <div className="flex flex-wrap gap-1 justify-center">
                      {dateBookings.slice(0, 3).map((booking) => (
                        <div
                          key={booking.id}
                          className={`w-2 h-2 rounded-full ${getStatusColor(booking.status)}`}
                          title={`${booking.event_name} - ${booking.hall?.name || 'Hall'}`}
                        />
                      ))}
                      {dateBookings.length > 3 && (
                        <div className="text-xs text-gray-500 font-semibold">+{dateBookings.length - 3}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Event Booking Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setFormErrors({});
          setFormData({ event_name: '', event_type: '', event_category_id: 0, hall_id: 0 });
        }
      }}>
        <DialogContent className="max-w-2xl shadow-2xl border-0 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 text-white p-6 rounded-t-2xl -mt-6 -mx-6 mb-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-transparent"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Calendar className="h-6 w-6" />
                </div>
                <DialogTitle className="text-2xl font-bold">New Event Booking</DialogTitle>
              </div>
            </div>
          </DialogHeader>

          {selectedDate && (
            <div className="bg-gradient-to-r from-blue-50 via-blue-100/50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Selected Date</p>
                <p className="text-blue-900 font-bold text-lg">{formatDate(selectedDate)}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                Event Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.event_name}
                onChange={(e) => {
                  setFormData({ ...formData, event_name: e.target.value });
                  if (formErrors.event_name) {
                    setFormErrors({ ...formErrors, event_name: '' });
                  }
                }}
                required
                placeholder="Enter event name"
                className={`h-12 border-2 ${formErrors.event_name ? 'border-red-500' : 'border-gray-300'
                  } focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-xl transition-all`}
              />
              {formErrors.event_name && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {formErrors.event_name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Tag className="h-4 w-4 text-purple-600" />
                </div>
                Event Type <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.event_type}
                onChange={(e) => {
                  setFormData({ ...formData, event_type: e.target.value });
                  if (formErrors.event_type) {
                    setFormErrors({ ...formErrors, event_type: '' });
                  }
                }}
                required
                placeholder="e.g. Wedding, Conference, Birthday"
                className={`h-12 border-2 ${formErrors.event_type ? 'border-red-500' : 'border-gray-300'
                  } focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 rounded-xl transition-all`}
              />
              {formErrors.event_type && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {formErrors.event_type}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <List className="h-4 w-4 text-green-600" />
                </div>
                Event Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.event_category_id}
                onChange={(e) => {
                  setFormData({ ...formData, event_category_id: parseInt(e.target.value) });
                  if (formErrors.event_category_id) {
                    setFormErrors({ ...formErrors, event_category_id: '' });
                  }
                }}
                required
                className={`w-full h-12 rounded-xl border-2 ${formErrors.event_category_id ? 'border-red-500' : 'border-gray-300'
                  } bg-transparent px-4 py-2 text-sm shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 font-medium`}
              >
                <option value={0}>Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {formErrors.event_category_id && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {formErrors.event_category_id}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-orange-600" />
                </div>
                Event Hall <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.hall_id}
                onChange={(e) => {
                  setFormData({ ...formData, hall_id: parseInt(e.target.value) });
                  if (formErrors.hall_id) {
                    setFormErrors({ ...formErrors, hall_id: '' });
                  }
                }}
                required
                className={`w-full h-12 rounded-xl border-2 ${formErrors.hall_id ? 'border-red-500' : 'border-gray-300'
                  } bg-transparent px-4 py-2 text-sm shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20 font-medium`}
              >
                <option value={0}>Select a hall</option>
                {getAvailableHalls().map((hall) => (
                  <option key={hall.id} value={hall.id}>
                    {hall.name}
                  </option>
                ))}
              </select>
              {formErrors.hall_id && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {formErrors.hall_id}
                </p>
              )}
              {getAvailableHalls().length === 0 && selectedDate && (
                <p className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  No halls available for this date. Please select another date.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-6 border-t-2 border-gray-200">
              <Button
                type="submit"
                disabled={loading || (selectedDate !== null && getAvailableHalls().length === 0)}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold h-12 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 gap-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Book Now
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setFormErrors({});
                  setFormData({ event_name: '', event_type: '', event_category_id: 0, hall_id: 0 });
                }}
                className="h-12 border-2 border-gray-300 hover:bg-gray-50 font-semibold rounded-xl"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
