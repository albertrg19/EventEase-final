'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Plus, User, Tag, List, Building2, Check, ChevronLeft, ChevronRight, Loader2, AlertCircle, X, CheckCircle2, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format, isSameDay, isSameMonth, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import 'intro.js/introjs.css';

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
    start_hour: '09',
    start_minute: '00',
    start_period: 'AM',
    end_hour: '05',
    end_minute: '00',
    end_period: 'PM',
    booking_type: 'custom',
  });
  const [currentHallIndex, setCurrentHallIndex] = useState(0);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (currentDate) {
      fetchBookings();
    }
  }, [currentDate]);

  useEffect(() => {
    // Reset carousel index when available halls change
    setCurrentHallIndex(0);
  }, [selectedDate, halls]);

  useEffect(() => {
    // Auto-start tour on first visit if data is loaded
    const hasSeenTour = localStorage.getItem('hasSeenCalendarTour_v2');
    if (!hasSeenTour && !fetchingData && !loading) {
      const timer = setTimeout(() => startTour(), 1000);
      return () => clearTimeout(timer);
    }
  }, [fetchingData, loading]);

  const startTour = async () => {
    const introJsMod = await import('intro.js');
    const introJs = introJsMod.default || introJsMod;
    const tour = (typeof introJs === 'function' ? introJs() : (introJs as any).introJs());

    tour.setOptions({
      steps: [
        {
          element: '#calendar-header',
          intro: 'Welcome to the Event Booking Calendar! This is where you can view availability and schedule your events.',
          position: 'bottom'
        },
        {
          element: '#calendar-grid',
          intro: 'Here you can navigate through months and see a high-level view of all bookings.',
          position: 'top'
        },
        {
          element: '#calendar-days',
          intro: 'Click on any available future date to start a new booking request. Colored dots indicate existing bookings for that day.',
          position: 'top'
        }
      ],
      showProgress: true,
      showBullets: false,
      exitOnOverlayClick: false,
      exitOnEsc: false,
      doneLabel: 'Got it!'
    });

    tour.onexit(() => localStorage.setItem('hasSeenCalendarTour_v2', 'true'));
    tour.oncomplete(() => localStorage.setItem('hasSeenCalendarTour_v2', 'true'));
    
    tour.start();
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev: Toast[]) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev: Toast[]) => prev.filter((t: Toast) => t.id !== id));
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
        // Normalize hall data - keep Photo as-is, URL resolution happens at render time
        const normalizedHalls = (data || []).map((hall: any) => ({
          ID: hall.id ?? hall.ID ?? 0,
          Name: hall.name ?? hall.Name ?? '',
          Photo: hall.photo ?? hall.Photo ?? undefined, // Keep raw path, resolve in img src
          Capacity: hall.capacity ?? hall.Capacity ?? 0,
          MaxCapacity: hall.max_capacity ?? hall.maxCapacity ?? hall.MaxCapacity ?? 0,
          Description: hall.description ?? hall.Description ?? undefined,
          Location: hall.location ?? hall.Location ?? '',
          Price: hall.price ?? hall.Price ?? 0,
        }));
        setHalls(normalizedHalls);
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
    return bookings.filter((booking: Booking) => isSameDay(new Date(booking.event_date), date));
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
    return halls.filter((hall: Hall) => isHallAvailable(hall.ID, selectedDate));
  };

  const nextHall = () => {
    const availableHalls = getAvailableHalls();
    setCurrentHallIndex((prev: number) => (prev + 1) % availableHalls.length);
  };

  const prevHall = () => {
    const availableHalls = getAvailableHalls();
    setCurrentHallIndex((prev: number) => (prev - 1 + availableHalls.length) % availableHalls.length);
  };

  const to24Hour = (hour: string, period: string): number => {
    let h = parseInt(hour, 10);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h;
  };

  const formatTimeTo24Hour = (hour: string, minute: string, period: string): string => {
    const h24 = to24Hour(hour, period);
    return `${String(h24).padStart(2, '0')}:${minute}`;
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

    // Validate time - check if all time fields are filled
    if (!formData.start_hour || !formData.start_minute || !formData.start_period) {
      errors.start_time = 'Start time is required';
    }
    if (!formData.end_hour || !formData.end_minute || !formData.end_period) {
      errors.end_time = 'End time is required';
    }

    // Validate end time is after start time
    if (formData.start_hour && formData.end_hour) {
      const startTime24 = formatTimeTo24Hour(formData.start_hour, formData.start_minute, formData.start_period);
      const endTime24 = formatTimeTo24Hour(formData.end_hour, formData.end_minute, formData.end_period);
      if (startTime24 >= endTime24) {
        errors.end_time = 'End time must be after start time';
      }
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

      // Create proper Date objects for backend
      const startHour24 = to24Hour(formData.start_hour, formData.start_period);
      const startTime = new Date(selectedDate);
      startTime.setHours(startHour24, parseInt(formData.start_minute), 0, 0);

      const endHour24 = to24Hour(formData.end_hour, formData.end_period);
      const endTime = new Date(selectedDate);
      endTime.setHours(endHour24, parseInt(formData.end_minute), 0, 0);

      if (endTime <= startTime) {
        showToast('End time must be after start time', 'error');
        setLoading(false);
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
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          booking_type: formData.booking_type,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast('Booking created successfully!', 'success');
        setDialogOpen(false);
        setFormData({
          event_name: '',
          event_category_id: 0,
          hall_id: 0,
          start_time: '',
          end_time: '',
          start_hour: '09',
          start_minute: '00',
          start_period: 'AM',
          end_hour: '05',
          end_minute: '00',
          end_period: 'PM',
          booking_type: 'custom',
        });
        setSelectedDate(null);
        setFormErrors({});
        setCurrentHallIndex(0);
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
        {toasts.map((toast: Toast) => (
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
              onClick={() => setToasts((prev: Toast[]) => prev.filter((t: Toast) => t.id !== toast.id))}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div id="calendar-header" className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
        
        <Button 
          onClick={startTour}
          variant="outline" 
          className="shrink-0 border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          How to Book
        </Button>
      </div>

      {/* Calendar */}
      <div id="calendar-grid">
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
            <div id="calendar-days" className="grid grid-cols-7 gap-3">
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
              {monthDays.map((date: Date) => {
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
      </div>

      {/* New Event Booking Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open: boolean) => {
        setDialogOpen(open);
        if (!open) {
          setFormErrors({});
          setFormData({
            event_name: '',
            event_category_id: 0,
            hall_id: 0,
            start_time: '',
            end_time: '',
            start_hour: '09',
            start_minute: '00',
            start_period: 'AM',
            end_hour: '05',
            end_minute: '00',
            end_period: 'PM',
          });
          setCurrentHallIndex(0);
        }
      }}>
        <DialogContent className="max-w-3xl shadow-2xl border-0 rounded-2xl overflow-hidden max-h-[90vh]">
          <DialogHeader className="bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 text-white p-3 rounded-t-2xl -mt-6 -mx-6 mb-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-transparent"></div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  <Calendar className="h-4 w-4" />
                </div>
                <DialogTitle className="text-lg font-bold">New Event Booking</DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3 p-1">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Left Column - Event Details */}
              <div className="space-y-2.5">
                {/* Date & Time Section */}
                {selectedDate && (
                  <div className="space-y-2.5">
                    <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                      Date & Time
                    </label>

                    {/* Date Display */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div>
                          <p className="text-[8px] font-semibold text-blue-700 uppercase tracking-wide">Selected Date</p>
                          <p className="text-[11px] font-bold text-blue-900 leading-tight">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Time Selection */}
                    <div className="bg-white border-2 border-gray-300 rounded-lg p-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <p className="text-sm font-bold text-gray-800">Event Time</p>
                        </div>
                        {/* Quick Action Marks */}
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, start_hour: '08', start_minute: '00', start_period: 'AM', end_hour: '12', end_minute: '00', end_period: 'PM', booking_type: 'half_day_am' });
                            }}
                            className={`text-[10px] sm:text-xs px-2 py-1 rounded-full font-bold transition-colors ${formData.booking_type === 'half_day_am' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                          >
                            Morning
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, start_hour: '01', start_minute: '00', start_period: 'PM', end_hour: '05', end_minute: '00', end_period: 'PM', booking_type: 'half_day_pm' });
                            }}
                            className={`text-[10px] sm:text-xs px-2 py-1 rounded-full font-bold transition-colors ${formData.booking_type === 'half_day_pm' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                          >
                            Afternoon
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, start_hour: '08', start_minute: '00', start_period: 'AM', end_hour: '05', end_minute: '00', end_period: 'PM', booking_type: 'full_day' });
                            }}
                            className={`text-[10px] sm:text-xs px-2 py-1 rounded-full font-bold transition-colors ${formData.booking_type === 'full_day' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                          >
                            Whole Day
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Start Time */}
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-2">Start Time</label>
                          <div className="flex items-center gap-1">
                            {/* Hour Dropdown */}
                            <div className="relative">
                              <select
                                value={formData.start_hour}
                                onChange={(e) => {
                                  setFormData({ ...formData, start_hour: e.target.value });
                                  if (formErrors.start_time) {
                                    setFormErrors({ ...formErrors, start_time: '' });
                                  }
                                }}
                                className="h-10 w-14 border-2 border-gray-300 rounded-lg px-1 text-sm font-medium text-center focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none bg-white cursor-pointer"
                              >
                                {Array.from({ length: 12 }, (_, i) => {
                                  const hour = String(i + 1).padStart(2, '0');
                                  return (
                                    <option key={hour} value={hour}>
                                      {hour}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronRight className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none rotate-90" />
                            </div>
                            <span className="text-gray-700 font-bold">:</span>
                            {/* Minute Input */}
                            <div className="relative">
                              <input
                                type="text"
                                maxLength={2}
                                value={formData.start_minute}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                                  const num = parseInt(val);
                                  const formatted = isNaN(num) || val === '' ? '00' : String(Math.min(59, Math.max(0, num))).padStart(2, '0');
                                  setFormData({ ...formData, start_minute: val, booking_type: 'custom' });
                                }}
                                onBlur={() => {
                                  const num = parseInt(formData.start_minute);
                                  const formatted = isNaN(num) || formData.start_minute === '' ? '00' : String(Math.min(59, Math.max(0, num))).padStart(2, '0');
                                  setFormData({ ...formData, start_minute: formatted });
                                }}
                                className="h-10 w-12 border-2 border-gray-300 rounded-lg px-1 text-sm font-medium text-center focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                              />
                            </div>
                            {/* AM/PM Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const newPeriod = formData.start_period === 'AM' ? 'PM' : 'AM';
                                setFormData({ ...formData, start_period: newPeriod });
                                if (formErrors.start_time) {
                                  setFormErrors({ ...formErrors, start_time: '' });
                                }
                              }}
                              className="h-10 w-14 bg-blue-950 hover:bg-blue-900 text-white font-bold rounded-lg flex items-center justify-center gap-1 transition-all shadow-sm text-xs px-1"
                            >
                              {formData.start_period}
                              <ChevronRight className="h-3 w-3 rotate-90" />
                            </button>
                          </div>
                        </div>

                        {/* End Time */}
                        <div>
                          <label className="text-xs font-medium text-gray-700 block mb-2">End Time</label>
                          <div className="flex items-center gap-1">
                            {/* Hour Dropdown */}
                            <div className="relative">
                              <select
                                value={formData.end_hour}
                                onChange={(e) => {
                                  setFormData({ ...formData, end_hour: e.target.value });
                                  if (formErrors.end_time) {
                                    setFormErrors({ ...formErrors, end_time: '' });
                                  }
                                }}
                                className="h-10 w-14 border-2 border-gray-300 rounded-lg px-1 text-sm font-medium text-center focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 appearance-none bg-white cursor-pointer"
                              >
                                {Array.from({ length: 12 }, (_, i) => {
                                  const hour = String(i + 1).padStart(2, '0');
                                  return (
                                    <option key={hour} value={hour}>
                                      {hour}
                                    </option>
                                  );
                                })}
                              </select>
                              <ChevronRight className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none rotate-90" />
                            </div>
                            <span className="text-gray-700 font-bold">:</span>
                            {/* Minute Input */}
                            <div className="relative">
                              <input
                                type="text"
                                maxLength={2}
                                value={formData.end_minute}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '').slice(0, 2);
                                  const num = parseInt(val);
                                  const formatted = isNaN(num) || val === '' ? '00' : String(Math.min(59, Math.max(0, num))).padStart(2, '0');
                                  setFormData({ ...formData, end_minute: val, booking_type: 'custom' });
                                }}
                                onBlur={() => {
                                  const num = parseInt(formData.end_minute);
                                  const formatted = isNaN(num) || formData.end_minute === '' ? '00' : String(Math.min(59, Math.max(0, num))).padStart(2, '0');
                                  setFormData({ ...formData, end_minute: formatted });
                                }}
                                className="h-10 w-12 border-2 border-gray-300 rounded-lg px-1 text-sm font-medium text-center focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                              />
                            </div>
                            {/* AM/PM Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const newPeriod = formData.end_period === 'AM' ? 'PM' : 'AM';
                                setFormData({ ...formData, end_period: newPeriod });
                                if (formErrors.end_time) {
                                  setFormErrors({ ...formErrors, end_time: '' });
                                }
                              }}
                              className="h-10 w-14 bg-blue-950 hover:bg-blue-900 text-white font-bold rounded-lg flex items-center justify-center gap-1 transition-all shadow-sm text-xs px-1"
                            >
                              {formData.end_period}
                              <ChevronRight className="h-3 w-3 rotate-90" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {(formErrors.start_time || formErrors.end_time) && (
                        <div className="mt-1.5 bg-red-50 border border-red-200 rounded-lg p-1.5">
                          <p className="text-[10px] text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-2.5 w-2.5" />
                            {formErrors.start_time || formErrors.end_time}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Event Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      Event Name
                    </label>
                    <Input
                      value={formData.event_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setFormData({ ...formData, event_name: e.target.value });
                        if (formErrors.event_name) {
                          setFormErrors({ ...formErrors, event_name: '' });
                        }
                      }}
                      required
                      placeholder="Event Name"
                      className={`h-9 text-sm border-2 ${formErrors.event_name ? 'border-red-500' : 'border-gray-300'
                        } focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg transition-all`}
                    />
                    {formErrors.event_name && (
                      <p className="text-[10px] text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5" />
                        {formErrors.event_name}
                      </p>
                    )}
                  </div>

                  {/* Event Category */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700">
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
                      className={`w-full h-9 rounded-lg border-2 ${formErrors.event_category_id ? 'border-red-500' : 'border-gray-300'
                        } bg-white px-3 py-2 text-sm shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                    >
                      <option value={0}>Select a category</option>
                      {categories.map((cat: Category, index: number) => (
                        <option key={`cat-${cat.ID || index}`} value={cat.ID}>
                          {cat.Name}
                        </option>
                      ))}
                    </select>
                    {formErrors.event_category_id && (
                      <p className="text-[10px] text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-2.5 w-2.5" />
                        {formErrors.event_category_id}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Event Hall */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-blue-600" />
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
                    <div className={`relative ${formErrors.hall_id ? 'ring-2 ring-red-500 rounded-lg p-1' : ''}`}>
                      {/* Carousel Container */}
                      <div className="relative overflow-hidden rounded-lg bg-gray-50">
                        {/* Previous Button */}
                        {getAvailableHalls().length > 1 && (
                          <button
                            type="button"
                            onClick={prevHall}
                            className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/95 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-all hover:scale-110 border border-gray-200"
                            aria-label="Previous hall"
                          >
                            <ChevronLeft className="h-4 w-4 text-gray-700" />
                          </button>
                        )}

                        {/* Hall Cards Container */}
                        <div className="flex transition-transform duration-300 ease-in-out" style={{ transform: `translateX(-${currentHallIndex * 100}%)` }}>
                          {getAvailableHalls().map((hall, index) => (
                            <div key={hall.ID} className="w-full flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, hall_id: hall.ID });
                                  if (formErrors.hall_id) {
                                    setFormErrors({ ...formErrors, hall_id: '' });
                                  }
                                }}
                                className={`w-full relative overflow-hidden rounded-lg border-2 transition-all duration-200 ${formData.hall_id === hall.ID
                                  ? 'border-blue-500 ring-2 ring-blue-300/50 shadow-md'
                                  : 'border-gray-200 hover:border-blue-300'
                                  }`}
                              >
                                <div className="h-48 relative bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                                  {hall.Photo ? (
                                    <img
                                      src={hall.Photo.startsWith('http') ? hall.Photo : `${api}${hall.Photo.startsWith('/') ? hall.Photo : '/' + hall.Photo}`}
                                      alt={hall.Name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.currentTarget;
                                        target.style.display = 'none';
                                        const fallback = target.nextElementSibling as HTMLElement;
                                        if (fallback) fallback.style.display = 'flex';
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className={`w-full h-full flex flex-col items-center justify-center ${hall.Photo ? 'hidden' : 'flex'}`}
                                  >
                                    <Building2 className="h-12 w-12 text-gray-400" />
                                    <p className="text-sm text-gray-500 mt-2">{hall.Name}</p>
                                  </div>

                                  {/* Text Overlay - Bottom Left */}
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/50 to-transparent p-3">
                                    <div className="text-white">
                                      <p className="font-bold text-sm leading-tight">
                                        {hall.Name}
                                      </p>
                                      {hall.Capacity && (
                                        <p className="text-xs text-white/90 mt-0.5">
                                          Capacity: {hall.Capacity}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Selected Checkmark - Top Right */}
                                  {formData.hall_id === hall.ID && (
                                    <div className="absolute top-2 right-2">
                                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
                                        <Check className="h-4 w-4 text-white" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Next Button */}
                        {getAvailableHalls().length > 1 && (
                          <button
                            type="button"
                            onClick={nextHall}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-white/95 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-all hover:scale-110 border border-gray-200"
                            aria-label="Next hall"
                          >
                            <ChevronRight className="h-4 w-4 text-gray-700" />
                          </button>
                        )}
                      </div>

                      {/* Carousel Indicators */}
                      {getAvailableHalls().length > 1 && (
                        <div className="flex justify-center gap-1.5 mt-1.5">
                          {getAvailableHalls().map((_, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => setCurrentHallIndex(index)}
                              className={`h-1.5 rounded-full transition-all ${index === currentHallIndex
                                ? 'w-5 bg-blue-500'
                                : 'w-1.5 bg-gray-300 hover:bg-gray-400'
                                }`}
                              aria-label={`Go to hall ${index + 1}`}
                            />
                          ))}
                        </div>
                      )}
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

            <div className="flex gap-2 pt-2 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setFormErrors({});
                  setFormData({
                    event_name: '',
                    event_category_id: 0,
                    hall_id: 0,
                    start_time: '',
                    end_time: '',
                    start_hour: '09',
                    start_minute: '00',
                    start_period: 'AM',
                    end_hour: '05',
                    end_minute: '00',
                    end_period: 'PM',
                  });
                  setCurrentHallIndex(0);
                }}
                className="flex-1 h-9 border-2 border-gray-300 hover:bg-gray-50 font-semibold rounded-lg text-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || (selectedDate !== null && getAvailableHalls().length === 0)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 shadow-md hover:shadow-lg transition-all gap-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
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
