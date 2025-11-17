'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Plus, User, Tag, List, Building2, Check, ChevronLeft, ChevronRight, Loader2, AlertCircle, X, CheckCircle2, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format, isSameDay, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';

interface Category {
  ID: number;
  Name: string;
  Image?: string;
  Description?: string;
}

interface Hall {
  ID: number;
  Name: string;
  Photo?: string;
  Capacity?: number;
  MaxCapacity?: number;
  Description?: string;
  Location?: string;
  Price?: number;
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
    event_category_id: 0,
    hall_id: 0,
    start_time: '',
    end_time: '',
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
        console.log('✅ Categories loaded from database:', data);
        setCategories(data || []);
      } else {
        showToast('Failed to load categories', 'error');
        console.error('❌ Failed to fetch categories:', res.status);
      }
    } catch (error) {
      console.error('❌ Failed to fetch categories:', error);
      showToast('Failed to load categories', 'error');
    }
  };

  const fetchHalls = async () => {
    try {
      const res = await fetch(`${api}/api/halls`);
      if (res.ok) {
        const data = await res.json();
        console.log('✅ Halls loaded from database:', data);
        setHalls(data || []);
      } else {
        showToast('Failed to load halls', 'error');
        console.error('❌ Failed to fetch halls:', res.status);
      }
    } catch (error) {
      console.error('❌ Failed to fetch halls:', error);
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
    return halls.filter((hall) => isHallAvailable(hall.ID, selectedDate));
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
    if (!formData.event_category_id || formData.event_category_id === 0) {
      errors.event_category_id = 'Please select a category';
    }
    if (!formData.hall_id || formData.hall_id === 0) {
      errors.hall_id = 'Please select a hall';
    }
    if (!formData.start_time) {
      errors.start_time = 'Start time is required';
    }
    if (!formData.end_time) {
      errors.end_time = 'End time is required';
    }
    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
      errors.end_time = 'End time must be after start time';
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
          event_category_id: formData.event_category_id,
          hall_id: formData.hall_id,
          event_date: format(selectedDate, 'yyyy-MM-dd'),
          start_time: formData.start_time,
          end_time: formData.end_time,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Booking created successfully!', 'success');
        setDialogOpen(false);
        setFormData({ event_name: '', event_category_id: 0, hall_id: 0, start_time: '', end_time: '' });
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
          setFormData({ event_name: '', event_category_id: 0, hall_id: 0, start_time: '', end_time: '' });
        }
      }}>
        <DialogContent className="max-w-3xl shadow-2xl border-0 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Event Details */}
              <div className="space-y-4">
                {/* Date & Time Section */}
                {selectedDate && (
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      Date & Time
                    </label>

                    {/* Date Display */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide">Selected Date</p>
                          <p className="text-sm font-bold text-blue-900">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Time Selection */}
                    <div className="bg-white border-2 border-gray-300 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-gray-600" />
                        <p className="text-xs font-semibold text-gray-700">Event Duration</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        {/* Start Time */}
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1.5">Start Time</label>
                          <div className="relative">
                            <Input
                              type="time"
                              value={formData.start_time}
                              onChange={(e) => {
                                setFormData({ ...formData, start_time: e.target.value });
                                if (formErrors.start_time) {
                                  setFormErrors({ ...formErrors, start_time: '' });
                                }
                              }}
                              required
                              className={`h-10 text-sm border-2 ${formErrors.start_time ? 'border-red-500' : 'border-gray-300'
                                } focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg transition-all font-medium`}
                            />
                          </div>
                        </div>

                        {/* End Time */}
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-1.5">End Time</label>
                          <div className="relative">
                            <Input
                              type="time"
                              value={formData.end_time}
                              onChange={(e) => {
                                setFormData({ ...formData, end_time: e.target.value });
                                if (formErrors.end_time) {
                                  setFormErrors({ ...formErrors, end_time: '' });
                                }
                              }}
                              required
                              className={`h-10 text-sm border-2 ${formErrors.end_time ? 'border-red-500' : 'border-gray-300'
                                } focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg transition-all font-medium`}
                            />
                          </div>
                        </div>
                      </div>

                      {(formErrors.start_time || formErrors.end_time) && (
                        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {formErrors.start_time || formErrors.end_time}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Event Name */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">
                    Event Name
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
                    placeholder="Event Name"
                    className={`h-10 border-2 ${formErrors.event_name ? 'border-red-500' : 'border-gray-300'
                      } focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg transition-all`}
                  />
                  {formErrors.event_name && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {formErrors.event_name}
                    </p>
                  )}
                </div>

                {/* Event Category */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">
                    Event Category
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
                    className={`w-full h-10 rounded-lg border-2 ${formErrors.event_category_id ? 'border-red-500' : 'border-gray-300'
                      } bg-white px-3 py-2 text-sm shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  >
                    <option value={0}>Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.ID} value={cat.ID}>
                        {cat.Name}
                      </option>
                    ))}
                  </select>
                  {formErrors.event_category_id && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {formErrors.event_category_id}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Column - Event Hall */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">
                  Event Hall
                </label>
                {getAvailableHalls().length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                    <Building2 className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                    <p className="text-sm text-amber-700 font-semibold">
                      No halls available for this date
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      All halls are booked
                    </p>
                  </div>
                ) : halls.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                    <Building2 className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">No halls available</p>
                  </div>
                ) : (
                  <>
                    <div className={`grid grid-cols-2 gap-2 ${formErrors.hall_id ? 'ring-2 ring-red-500 rounded-lg p-1' : ''}`}>
                      {getAvailableHalls().map((hall) => (
                        <button
                          key={hall.ID}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, hall_id: hall.ID });
                            if (formErrors.hall_id) {
                              setFormErrors({ ...formErrors, hall_id: '' });
                            }
                          }}
                          className={`relative overflow-hidden rounded-lg border-2 transition-all duration-200 hover:shadow-sm ${formData.hall_id === hall.ID
                            ? 'border-blue-500 ring-2 ring-blue-300/50 shadow-md'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                          <div className="aspect-square relative bg-gradient-to-br from-gray-100 to-gray-200">
                            {hall.Photo ? (
                              <img
                                src={hall.Photo}
                                alt={hall.Name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center">
                                <Building2 className="h-8 w-8 text-gray-400" />
                              </div>
                            )}
                            {formData.hall_id === hall.ID && (
                              <div className="absolute top-1.5 right-1.5">
                                <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="p-2 bg-white border-t border-gray-200">
                            <p className="font-semibold text-[11px] text-center text-gray-800 truncate">
                              {hall.Name}
                            </p>
                            {hall.Capacity && (
                              <p className="text-[10px] text-gray-500 text-center truncate">
                                Capacity: {hall.Capacity}
                              </p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    {formErrors.hall_id && (
                      <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {formErrors.hall_id}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setFormErrors({});
                  setFormData({ event_name: '', event_category_id: 0, hall_id: 0, start_time: '', end_time: '' });
                }}
                className="flex-1 h-11 border-2 border-gray-300 hover:bg-gray-50 font-semibold rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || (selectedDate !== null && getAvailableHalls().length === 0)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 shadow-md hover:shadow-lg transition-all gap-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
