'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar as CalendarIcon, Plus, Edit, Trash2, Loader2, ChevronLeft, ChevronRight, Grid, LayoutGrid } from 'lucide-react';

interface Event {
  id: number;
  title: string;
  hall_id: number;
  start_date: string;
  end_date: string;
  description?: string;
  hall?: { name: string };
}

interface Booking {
  id: number;
  event_name: string;
  event_date: string;
  status: string;
  hall?: { name: string };
}

interface Hall {
  id: number;
  name: string;
}

type CalendarEvent = {
  id: string;
  title: string;
  date: Date;
  type: 'event' | 'booking';
  status?: string;
  venue?: string;
};

export default function EventManagementPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [formData, setFormData] = useState({
    title: '', hall_id: 0, start_date: '', end_date: '', description: ''
  });
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchEvents();
    fetchBookings();
    fetchHalls();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${api}/api/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('token');
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

  const fetchHalls = async () => {
    try {
      const res = await fetch(`${api}/api/halls`);
      if (res.ok) {
        const data = await res.json();
        setHalls(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch halls:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/events/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingEvent ? `${api}/api/admin/events/${editingEvent.id}` : `${api}/api/admin/events`;
      const method = editingEvent ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          hall_id: formData.hall_id,
          start_date: formData.start_date,
          end_date: formData.end_date,
          description: formData.description || null,
        }),
      });

      if (res.ok) {
        setDialogOpen(false);
        setEditingEvent(null);
        setFormData({ title: '', hall_id: 0, start_date: '', end_date: '', description: '' });
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save event');
      }
    } catch (error) {
      console.error('Failed to save event:', error);
    }
  };

  const openEditDialog = (event: Event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      hall_id: event.hall_id,
      start_date: event.start_date.split('T')[0],
      end_date: event.end_date.split('T')[0],
      description: event.description || '',
    });
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingEvent(null);
    setFormData({ title: '', hall_id: 0, start_date: '', end_date: '', description: '' });
    setDialogOpen(true);
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const calendarEvents = useMemo(() => {
    const items: CalendarEvent[] = [];
    
    events.forEach((event) => {
      items.push({
        id: `event-${event.id}`,
        title: event.title,
        date: new Date(event.start_date),
        type: 'event',
        venue: event.hall?.name,
      });
    });
    
    bookings.forEach((booking) => {
      items.push({
        id: `booking-${booking.id}`,
        title: booking.event_name,
        date: new Date(booking.event_date),
        type: 'booking',
        status: booking.status,
        venue: booking.hall?.name,
      });
    });
    
    return items;
  }, [events, bookings]);

  const getEventsForDay = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    return calendarEvents.filter((event) => {
      const eventDate = event.date;
      return eventDate.getFullYear() === year && 
             eventDate.getMonth() === month && 
             eventDate.getDate() === day;
    });
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Event Management</h1>
          <p className="text-gray-600 mt-1">Manage events and schedules</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 flex items-center gap-2 text-sm ${viewMode === 'table' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Grid className="h-4 w-4" />
              Table
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-2 flex items-center gap-2 text-sm ${viewMode === 'calendar' ? 'bg-blue-950 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <CalendarIcon className="h-4 w-4" />
              Calendar
            </button>
          </div>
          <Button onClick={openAddDialog} className="bg-yellow-400 hover:bg-yellow-500 text-blue-950 gap-2">
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-blue-600" />
              {monthName}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="bg-gray-50 p-2 text-center text-sm font-semibold text-gray-600">
                  {day}
                </div>
              ))}
              {Array.from({ length: startingDay }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-white min-h-[100px] p-2" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayEvents = getEventsForDay(day);
                const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();
                return (
                  <div
                    key={day}
                    className={`bg-white min-h-[100px] p-2 ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
                  >
                    <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                      {day}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={`text-xs px-1.5 py-0.5 rounded truncate ${
                            event.type === 'event'
                              ? 'bg-purple-100 text-purple-700'
                              : event.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : event.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                          title={`${event.title}${event.venue ? ` @ ${event.venue}` : ''}`}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200" />
                <span>Events</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-100 border border-green-200" />
                <span>Approved Bookings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200" />
                <span>Pending Bookings</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
                <span>Rejected Bookings</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Events ({events.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">Loading events...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <CalendarIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No events available. Add a new event to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Hall</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Start Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">End Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{event.title}</td>
                        <td className="py-3 px-4 text-gray-600">{event.hall?.name || 'N/A'}</td>
                        <td className="py-3 px-4 text-gray-600">{new Date(event.start_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-gray-600">{new Date(event.end_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(event)} className="gap-1">
                              <Edit className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(event.id)} className="gap-1 text-red-600 hover:text-red-700">
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
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
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader className="pb-4 border-b border-gray-200">
            <DialogTitle className="text-2xl font-bold text-gray-900">
              {editingEvent ? 'Edit Event' : 'Add New Event'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="Enter event title"
                className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                Hall <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.hall_id}
                onChange={(e) => setFormData({ ...formData, hall_id: parseInt(e.target.value) })}
                className="w-full h-11 rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-950/20"
                required
              >
                <option value={0}>Select a hall</option>
                {halls.map((hall) => (
                  <option key={hall.id} value={hall.id}>{hall.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 block">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                  className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 block">
                  End Date <span className="text-red-500">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                  className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter event description (optional)"
                rows={3}
                className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-950/20 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <Button
                type="submit"
                className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-semibold h-11 shadow-md hover:shadow-lg transition-all"
              >
                {editingEvent ? 'Update Event' : 'Create Event'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="h-11 border-gray-300 hover:bg-gray-50 font-semibold"
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
