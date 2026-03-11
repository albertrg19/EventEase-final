'use client';

import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);
import Link from 'next/link';
import { Building2, Calendar, Check, Eye, Users, Phone, Mail, Clock, Facebook, Twitter, Instagram, Linkedin, ChevronUp, Star, ArrowRight, Sparkles, MapPin, Zap, Search, FileCheck, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  type Hall = {
    id: number;
    name: string;
    capacity: number;
    max_capacity?: number;
    price?: number;
    photo?: string | null;
    location?: string;
    description?: string | null;
  };

  type EventItem = {
    id: number;
    title: string;
    hall_id: number;
    start_date: string;
    end_date: string;
    description?: string | null;
    hall?: { name: string };
  };

  type Category = {
    id: number;
    name: string;
    description?: string | null;
    image?: string | null;
  };

  const [halls, setHalls] = useState<Hall[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedHall, setSelectedHall] = useState<Hall | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookedDates, setBookedDates] = useState<string[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
      setShowScrollTop(window.scrollY > 500);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useGSAP(() => {
    // Hero Animations
    gsap.from('.hero-headline', { y: 50, opacity: 0, duration: 1, delay: 0.2, ease: 'power3.out' });
    gsap.from('.hero-subheadline', { y: 30, opacity: 0, duration: 1, delay: 0.4, ease: 'power3.out' });
    gsap.from('.hero-buttons', { y: 20, opacity: 0, duration: 1, delay: 0.6, ease: 'power3.out' });
    gsap.from('.stat-item', { scale: 0.8, opacity: 0, duration: 0.8, stagger: 0.2, delay: 0.8, ease: 'back.out(1.7)' });

    // Section Titles
    gsap.utils.toArray('.section-title').forEach((title: any) => {
      gsap.from(title, {
        scrollTrigger: {
          trigger: title,
          start: 'top bottom-=100',
          toggleActions: 'play none none reverse'
        },
        y: 40, opacity: 0, duration: 0.8, ease: 'power3.out'
      });
    });

    // Cards & Items
    gsap.utils.toArray('.venue-card').forEach((card: any, i) => {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: 'top bottom-=50', toggleActions: 'play none none reverse' },
        y: 50, opacity: 0, duration: 0.8, delay: i * 0.1, ease: 'power3.out'
      });
    });

    gsap.utils.toArray('.category-card').forEach((card: any, i) => {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: 'top bottom-=50', toggleActions: 'play none none reverse' },
        y: 50, opacity: 0, duration: 0.8, delay: i * 0.1, ease: 'power3.out'
      });
    });

    gsap.utils.toArray('.step-card').forEach((card: any, i) => {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: 'top bottom-=50', toggleActions: 'play none none reverse' },
        y: 50, opacity: 0, duration: 0.6, delay: i * 0.15, ease: 'back.out(1.5)'
      });
    });

    gsap.utils.toArray('.gallery-item').forEach((item: any, i) => {
      gsap.from(item, {
        scrollTrigger: { trigger: item, start: 'top bottom-=50', toggleActions: 'play none none reverse' },
        scale: 0.8, opacity: 0, duration: 0.6, delay: (i % 4) * 0.1, ease: 'power2.out'
      });
    });
  }, { scope: container });

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const [hallsRes, eventsRes, categoriesRes] = await Promise.all([
          fetch(`${api}/api/halls`),
          fetch(`${api}/api/events`),
          fetch(`${api}/api/categories`),
        ]);

        // Normalize halls data (handle different field name formats from backend)
        let hallsData = hallsRes.ok ? await hallsRes.json() : [];
        if (!Array.isArray(hallsData)) {
          hallsData = hallsData.halls || hallsData.data || [];
        }
        const normalizedHalls = hallsData
          .filter((hall: any) => hall && (hall.id || hall.ID) && (hall.name || hall.Name)) // Only include halls with valid ID and name
          .map((hall: any) => {
            const photoValue = hall.photo ?? hall.Photo;
            // Ensure photo URL is absolute if it's a relative path
            const photoUrl = photoValue
              ? (photoValue.startsWith('http') ? photoValue : `${api}${photoValue.startsWith('/') ? photoValue : '/' + photoValue}`)
              : null;

            return {
              id: hall.id ?? hall.ID ?? 0,
              name: hall.name ?? hall.Name ?? '',
              capacity: Number(hall.capacity ?? hall.Capacity ?? 0),
              max_capacity: Number(hall.max_capacity ?? hall.maxCapacity ?? hall.MaxCapacity ?? hall.capacity ?? hall.Capacity ?? 0),
              price: Number(hall.price ?? hall.Price ?? 0),
              photo: photoUrl,
              location: hall.location ?? hall.Location ?? '',
              description: hall.description ?? hall.Description ?? null,
            };
          })
          .sort((a: Hall, b: Hall) => a.id - b.id); // Sort by ID to maintain consistent order

        // Normalize events data
        let eventsData = eventsRes.ok ? await eventsRes.json() : [];
        if (!Array.isArray(eventsData)) {
          eventsData = eventsData.events || eventsData.data || [];
        }
        const normalizedEvents = eventsData.map((ev: any) => ({
          id: ev.id ?? ev.ID ?? 0,
          title: ev.title ?? ev.Title ?? '',
          hall_id: ev.hall_id ?? ev.hallId ?? ev.HallID ?? 0,
          start_date: ev.start_date ?? ev.startDate ?? ev.StartDate ?? '',
          end_date: ev.end_date ?? ev.endDate ?? ev.EndDate ?? '',
          description: ev.description ?? ev.Description ?? null,
          hall: ev.hall ?? ev.Hall ?? null,
        }));

        // Normalize categories data (handle different field name formats from backend)
        let categoriesData = categoriesRes.ok ? await categoriesRes.json() : [];
        if (!Array.isArray(categoriesData)) {
          categoriesData = categoriesData.categories || categoriesData.data || [];
        }
        const normalizedCategories = categoriesData
          .filter((cat: any) => cat && (cat.id || cat.ID) && (cat.name || cat.Name)) // Only include categories with valid ID and name
          .map((cat: any) => {
            const imageValue = cat.image ?? cat.Image;
            // Ensure image URL is absolute if it's a relative path
            const imageUrl = imageValue
              ? (imageValue.startsWith('http') ? imageValue : `${api}${imageValue.startsWith('/') ? imageValue : '/' + imageValue}`)
              : null;

            return {
              id: cat.id ?? cat.ID ?? 0,
              name: cat.name ?? cat.Name ?? '',
              description: cat.description ?? cat.Description ?? null,
              image: imageUrl,
            };
          })
          .sort((a: Category, b: Category) => a.id - b.id); // Sort by ID to maintain consistent order

        setHalls(normalizedHalls);
        setEvents(normalizedEvents);
        setCategories(normalizedCategories);

        // Extract booked dates from events
        const booked = normalizedEvents.map((event: EventItem) => {
          const dates = [];
          const start = new Date(event.start_date);
          const end = new Date(event.end_date);
          
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d).toISOString().split('T')[0]);
          }
          return dates;
        }).flat();
        setBookedDates(booked);
      } catch (e: any) {
        console.error('Failed to fetch data:', e);
        setError('Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    // Refresh data when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [api]);

  const formatCurrency = (value?: number) => {
    if (value == null) return '—';
    try {
      return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(value);
    } catch {
      return `P${value.toFixed(2)}`;
    }
  };

  const formatDate = (dateString?: string | null, options?: Intl.DateTimeFormatOptions) => {
    if (!dateString) return 'Date TBA';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date TBA';
      return date.toLocaleDateString('en-US', options || { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'Date TBA';
    }
  };

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const generateCalendarDays = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const isDateBooked = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return bookedDates.includes(dateString);
  };

  const isDatePast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    if (!isDatePast(date) && !isDateBooked(date)) {
      setSelectedDate(date);
    }
  };

  return (
    <div className="min-h-screen bg-white" ref={container}>
      {/* Header */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrolled ? 'bg-blue-950/98 backdrop-blur-xl shadow-2xl py-3' : 'bg-transparent py-4'}`}>
        <nav className="container mx-auto px-4 md:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src="/Logooo.png"
              alt="EventEase Logo"
              className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </Link>
          <div className="hidden md:flex gap-8 items-center">
            <Link href="/venues" className="flex items-center gap-2 text-white/90 hover:text-yellow-400 transition-all duration-300 relative group">
              <Building2 className="h-4 w-4 transition-transform group-hover:scale-110" />
              <span className="font-medium">Halls</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-yellow-400 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="/events" className="flex items-center gap-2 text-white/90 hover:text-yellow-400 transition-all duration-300 relative group">
              <Calendar className="h-4 w-4 transition-transform group-hover:scale-110" />
              <span className="font-medium">Events</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-yellow-400 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="/availability" className="flex items-center gap-2 text-white/90 hover:text-yellow-400 transition-all duration-300 relative group">
              <Check className="h-4 w-4 transition-transform group-hover:scale-110" />
              <span className="font-medium">Availability</span>
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-yellow-400 transition-all duration-300 group-hover:w-full"></span>
            </Link>
            <Link href="/login">
              <Button className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-950 font-semibold px-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                Login / Register
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-32 px-4 min-h-[90vh] flex items-center justify-center overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(250,204,21,0.1),transparent_50%)] animate-pulse"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(59,130,246,0.1),transparent_50%)] animate-pulse delay-1000"></div>
        </div>

        {/* Floating Shapes */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-float-delayed"></div>

        <div className="relative z-10 container mx-auto text-center max-w-5xl">
          <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-yellow-400/10 backdrop-blur-sm border border-yellow-400/20 rounded-full text-yellow-400 text-sm font-semibold hero-headline">
            <Sparkles className="h-4 w-4" />
            Premium Event Venues
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-400 hero-headline leading-tight">
            Your Perfect Event Venue Awaits
          </h1>

          <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-3xl mx-auto leading-relaxed drop-shadow-lg hero-subheadline">
            Experience exceptional event venues at Coliseum EventEase. From intimate gatherings to grand celebrations, we make every occasion memorable.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center hero-buttons">
            <Link href="/login" className="group">
              <Button size="lg" className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-950 px-10 py-7 text-lg font-bold shadow-2xl hover:shadow-yellow-400/50 transition-all duration-300 transform hover:scale-105 group">
                <Calendar className="mr-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                RESERVE NOW
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/login" className="group">
              <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:border-white hover:bg-white/10 backdrop-blur-sm px-10 py-7 text-lg font-bold transition-all duration-300 transform hover:scale-105 group">
                <Building2 className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
                EXPLORE VENUES
              </Button>
            </Link>
          </div>

          {/* Stats Bar */}
          <div className="mt-20 grid grid-cols-3 gap-8 max-w-3xl mx-auto pt-12 border-t border-white/10">
            <div className="text-center stat-item">
              <div className="text-4xl md:text-5xl font-bold text-yellow-400 mb-2">500+</div>
              <div className="text-white/70 text-sm uppercase tracking-wider">Events Hosted</div>
            </div>
            <div className="text-center stat-item">
              <div className="text-4xl md:text-5xl font-bold text-yellow-400 mb-2">98%</div>
              <div className="text-white/70 text-sm uppercase tracking-wider">Satisfaction</div>
            </div>
            <div className="text-center stat-item">
              <div className="text-4xl md:text-5xl font-bold text-yellow-400 mb-2">10+</div>
              <div className="text-white/70 text-sm uppercase tracking-wider">Premium Venues</div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
            <div className="w-1.5 h-3 bg-white/50 rounded-full mt-2"></div>
          </div>
        </div>
      </section>

      {/* Premier Event Halls */}
      <section id="venues" data-section className="py-24 px-4 bg-gradient-to-b from-white via-gray-50/50 to-white relative overflow-hidden">
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        ></div>

        <div className="container mx-auto relative z-10">
          <div className="text-center mb-20 section-title">
            <div className="inline-flex items-center gap-2 mb-4 px-5 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-blue-950 text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
              <Star className="h-3 w-3 fill-blue-950" />
              Premium Venues
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 bg-clip-text text-transparent">
              Our Premier Event Halls
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Discover the perfect space for your next event, from intimate gatherings to grand celebrations.
            </p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {!loading && halls.length === 0 && !error && (
            <div className="text-center py-16">
              <Building2 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg">No halls available at the moment. Please check back later.</p>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-8 lg:gap-10 max-w-7xl mx-auto">
            {loading ? (
              // Show loading skeletons only when actually loading
              Array.from({ length: 3 }).map((_, i: number) => (
                <Card
                  key={`loading-hall-${i}`}
                  className="overflow-hidden border-2 border-gray-200 bg-white shadow-lg animate-pulse"
                >
                  <div className="relative h-72 bg-gradient-to-br from-gray-200 to-gray-300"></div>
                  <CardContent className="p-6 bg-white">
                    <div className="h-6 bg-gray-200 rounded mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))
            ) : (
              halls.map((hall: any, i: number) => (
                <Card
                  key={hall.id ?? `hall-${i}`}
                  className="overflow-hidden group cursor-pointer border-0 bg-transparent rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 flex flex-col h-full venue-card"
                  style={{ transitionDelay: `${i * 150}ms` }}
                >
                  {/* Image Section - Fixed Height */}
                  <div className="relative h-80 overflow-hidden rounded-t-2xl flex-shrink-0">
                    {hall?.photo ? (
                      <img
                        src={hall.photo}
                        alt={hall.name || 'Hall image'}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'block';
                        }}
                      />
                    ) : null}
                    {/* Fallback gradient */}
                    <div 
                      className={`absolute inset-0 bg-gradient-to-br from-blue-800 via-indigo-800 to-purple-800 ${hall?.photo ? 'hidden' : 'block'}`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Building2 className="h-24 w-24 text-white/20" />
                      </div>
                    </div>
                    
                    {/* Bookmark icon (top right) */}
                    <div className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg">
                      <Star className="h-5 w-5 text-yellow-400" />
                    </div>
                  </div>

                  {/* Content Section with Dark Overlay - Fixed Height */}
                  <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 -mt-12 pt-16 pb-5 px-5 rounded-b-2xl flex-1 flex flex-col min-h-[200px]">
                    {/* Title and Price Row */}
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-xl font-bold text-white flex-1 pr-4 line-clamp-1">{hall.name}</h3>
                      <div className="text-xl font-bold text-white whitespace-nowrap">{formatCurrency(hall.price)}</div>
                    </div>

                    {/* Description - Fixed Height */}
                    <div className="mb-3 min-h-[32px]">
                      {hall.description ? (
                        <p className="text-white/80 text-xs leading-relaxed line-clamp-1">{hall.description}</p>
                      ) : (
                        <p className="text-white/80 text-xs leading-relaxed line-clamp-1">Experience exceptional event space with premium amenities.</p>
                      )}
                    </div>

                    {/* Tags - Fixed Height */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap min-h-[28px]">
                      {hall.location && (
                        <span className="px-3 py-1 bg-gradient-to-r from-yellow-400/30 to-yellow-500/30 backdrop-blur-sm border border-yellow-400/40 rounded-full text-yellow-300 text-xs font-bold uppercase tracking-wider">
                          {hall.location}
                        </span>
                      )}
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium">
                        {Number(hall.max_capacity || hall.capacity).toLocaleString()} Capacity
                      </span>
                    </div>

                    {/* View Details Button - Fixed at Bottom */}
                    <div className="mt-auto">
                      <Button 
                        onClick={() => {
                          setSelectedHall(hall);
                          setDetailsDialogOpen(true);
                        }}
                        className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 group text-sm"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <Eye className="h-5 w-5 group-hover:scale-110 transition-transform" />
                          View details
                          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Event Categories */}
      <section id="categories" data-section className="py-24 px-4 bg-gradient-to-b from-white via-gray-50/50 to-white relative overflow-hidden">
        {/* Background Pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        ></div>

        <div className="container mx-auto relative z-10">
          <div className="text-center mb-20 section-title">
            <div className="inline-flex items-center gap-2 mb-4 px-5 py-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-blue-950 text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
              <Sparkles className="h-3 w-3 fill-blue-950" />
              Event Types
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 bg-clip-text text-transparent">
              Our Event Categories
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Choose from a variety of event types we specialize in. Each category is tailored to make your occasion unforgettable.
            </p>
          </div>

          {!loading && categories.length === 0 && !error && (
            <div className="text-center py-16">
              <Sparkles className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg">No event categories available at the moment. Please check back later.</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10 max-w-7xl mx-auto">
            {loading ? (
              // Show loading skeletons only when actually loading
              Array.from({ length: 6 }).map((_, i: number) => (
                <Card
                  key={`loading-category-${i}`}
                  className="overflow-hidden border-2 border-gray-200 bg-white shadow-lg animate-pulse"
                >
                  <div className="relative h-48 bg-gradient-to-br from-gray-200 to-gray-300"></div>
                  <CardContent className="p-6 bg-white">
                    <div className="h-5 bg-gray-200 rounded mb-3"></div>
                    <div className="h-4 bg-gray-200 rounded mb-4"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </CardContent>
                </Card>
              ))
            ) : (
              categories.map((category: any, i: number) => (
                <Card
                  key={category.id ?? `category-${i}`}
                  className="overflow-hidden group cursor-pointer border-0 bg-transparent rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 flex flex-col h-full category-card"
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  {/* Image Section - Fixed Height */}
                  <div className="relative h-64 overflow-hidden rounded-t-2xl flex-shrink-0">
                    {category?.image ? (
                      <img
                        src={category.image}
                        alt={category.name || 'Category image'}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'block';
                        }}
                      />
                    ) : null}
                    {/* Fallback gradient */}
                    <div 
                      className={`absolute inset-0 bg-gradient-to-br from-blue-800 via-indigo-800 to-purple-800 ${category?.image ? 'hidden' : 'block'}`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="h-24 w-24 text-white/20" />
                      </div>
                    </div>
                    
                    {/* Bookmark icon (top right) */}
                    <div className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg">
                      <Star className="h-5 w-5 text-yellow-400" />
                    </div>
                  </div>

                  {/* Content Section with Dark Overlay - Fixed Height */}
                  <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 -mt-12 pt-16 pb-5 px-5 rounded-b-2xl flex-1 flex flex-col min-h-[180px]">
                    {/* Title */}
                    <div className="mb-2">
                      <h3 className="text-xl font-bold text-white line-clamp-1">{category.name}</h3>
                    </div>

                    {/* Description - Fixed Height */}
                    <div className="mb-3 min-h-[32px] flex-1">
                      <p className="text-white/80 text-xs leading-relaxed line-clamp-1">
                        {category.description || 'Perfect for your special occasion.'}
                      </p>
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap min-h-[28px]">
                      <span className="px-3 py-1 bg-gradient-to-r from-yellow-400/30 to-yellow-500/30 backdrop-blur-sm border border-yellow-400/40 rounded-full text-yellow-300 text-xs font-bold uppercase tracking-wider">
                        {category.name}
                      </span>
                      <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs font-medium">
                        Event Category
                      </span>
                    </div>

                    {/* Explore Button - Fixed at Bottom */}
                    <div className="mt-auto">
                      <Link href="/login" className="block">
                        <Button className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-gray-100 shadow-lg hover:shadow-xl transition-all duration-300 group text-sm">
                          <span className="flex items-center justify-center gap-2">
                            <Calendar className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            Explore
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                          </span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Check Availability */}
      <section id="availability" data-section className="py-24 px-4 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center mb-16 section-title">
            <div className="inline-flex items-center gap-2 mb-4 px-5 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg hover:shadow-xl transition-shadow">
              <Calendar className="h-3 w-3 animate-pulse" />
              Plan Ahead
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Check Availability
            </h2>
            <p className="text-lg md:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Select your perfect date and book with confidence
            </p>
          </div>

          <Card className="border-0 bg-white shadow-2xl hover:shadow-3xl overflow-hidden transition-all duration-1000 rounded-3xl venue-card">
            {/* Premium Header - Brand Colors */}
            <div className="relative overflow-hidden">
              {/* Blue gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800"></div>
              
              {/* Decorative shapes */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-400/10 rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-2xl"></div>
              
              <div className="relative p-8">
                <div className="flex items-center justify-between">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={handlePrevMonth}
                    className="border-2 border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/20 backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-yellow-400 rounded-xl shadow-lg hover:shadow-xl group"
                  >
                    <ArrowRight className="h-5 w-5 rotate-180 group-hover:-translate-x-1 transition-transform" />
                  </Button>
                  
                  <div className="text-center">
                    <h3 className="text-3xl md:text-4xl font-extrabold text-white mb-1 drop-shadow-lg">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long' })}
                    </h3>
                    <p className="text-yellow-400 text-lg font-medium">
                      {currentMonth.getFullYear()}
                    </p>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={handleNextMonth}
                    className="border-2 border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/20 backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-yellow-400 rounded-xl shadow-lg hover:shadow-xl group"
                  >
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </div>

            <CardContent className="p-8 md:p-10">
              {/* Day labels */}
              <div className="grid grid-cols-7 gap-3 mb-6">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <div key={day} className={`text-center text-xs md:text-sm font-bold py-3 rounded-xl transition-all duration-300 
                    ${i === 0 || i === 6 
                      ? 'bg-blue-50 text-blue-900' 
                      : 'bg-gray-50 text-gray-700'
                    }`}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-2.5">
                {generateCalendarDays().map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="aspect-square"></div>;
                  }

                  const isBooked = isDateBooked(date);
                  const isPast = isDatePast(date);
                  const isSelected = isDateSelected(date);
                  const isAvailable = !isBooked && !isPast;
                  const isToday = new Date().toDateString() === date.toDateString();

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => handleDateClick(date)}
                      disabled={isPast || isBooked}
                      className={`
                        group aspect-square rounded-2xl font-bold text-sm md:text-base transition-all duration-300 relative overflow-hidden
                        ${isPast 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' 
                          : isBooked
                          ? 'bg-red-50 border-2 border-red-300 text-red-700 cursor-not-allowed shadow-sm'
                          : isSelected
                          ? 'bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-2xl scale-110 ring-4 ring-blue-200 z-10'
                          : isToday
                          ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-400 text-yellow-900 hover:scale-105 hover:shadow-xl cursor-pointer ring-2 ring-yellow-300'
                          : 'bg-white border-2 border-blue-200 text-blue-900 hover:bg-blue-50 hover:border-blue-400 hover:scale-105 hover:shadow-xl cursor-pointer'
                        }
                        ${isAvailable && !isSelected ? 'hover:ring-4 hover:ring-blue-200' : ''}
                      `}
                    >
                      {/* Shimmer effect for available dates */}
                      {isAvailable && !isSelected && (
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-100/40 to-transparent animate-shimmer"></div>
                        </div>
                      )}
                      
                      {/* Date number */}
                      <span className="relative z-10 flex items-center justify-center h-full">
                        {date.getDate()}
                      </span>
                      
                      {/* Status indicators */}
                      {isBooked && (
                        <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-base">
                          🔒
                        </span>
                      )}
                      {isToday && !isSelected && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                      )}
                      {isAvailable && !isSelected && !isToday && (
                        <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          ✓
                        </span>
                      )}
                      {isSelected && (
                        <span className="absolute top-1 right-1 text-lg animate-pulse">
                          ⭐
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Modern Legend */}
              <div className="mt-10 pt-8 border-t-2 border-gray-100">
                <h4 className="text-center text-sm font-bold text-blue-900 uppercase tracking-wider mb-6">Legend</h4>
                <div className="flex flex-wrap gap-6 justify-center">
                  <div className="flex items-center gap-3 group cursor-default">
                    <div className="w-10 h-10 rounded-xl bg-white border-2 border-blue-200 flex items-center justify-center text-base shadow-sm group-hover:shadow-md transition-all group-hover:scale-110">
                      ✓
                    </div>
                    <span className="text-gray-700 font-semibold text-sm">Available</span>
                  </div>
                  <div className="flex items-center gap-3 group cursor-default">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-400 flex items-center justify-center shadow-sm group-hover:shadow-md transition-all group-hover:scale-110">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    </div>
                    <span className="text-gray-700 font-semibold text-sm">Today</span>
                  </div>
                  <div className="flex items-center gap-3 group cursor-default">
                    <div className="w-10 h-10 rounded-xl bg-red-50 border-2 border-red-300 flex items-center justify-center text-base shadow-sm group-hover:shadow-md transition-all group-hover:scale-110">
                      🔒
                    </div>
                    <span className="text-gray-700 font-semibold text-sm">Booked</span>
                  </div>
                  <div className="flex items-center gap-3 group cursor-default">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-base shadow-lg group-hover:shadow-xl transition-all group-hover:scale-110">
                      ⭐
                    </div>
                    <span className="text-gray-700 font-semibold text-sm">Selected</span>
                  </div>
                  <div className="flex items-center gap-3 group cursor-default">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center opacity-50 shadow-sm group-hover:shadow-md transition-all group-hover:scale-110">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <span className="text-gray-700 font-semibold text-sm">Past</span>
                  </div>
                </div>
              </div>

              {/* Premium Selected Date Panel - Brand Colors */}
              {selectedDate && (
                <div className="mt-8 relative overflow-hidden rounded-2xl animate-fade-in">
                  {/* Blue gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800"></div>
                  
                  {/* Decorative shapes */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-2xl"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-yellow-400/10 rounded-full blur-xl"></div>
                  
                  <div className="relative p-6 md:p-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="text-center md:text-left">
                        <div className="flex items-center gap-2 mb-2 justify-center md:justify-start">
                          <Calendar className="h-5 w-5 text-yellow-400" />
                          <p className="text-sm font-semibold text-yellow-400 uppercase tracking-wider">Selected Date</p>
                        </div>
                        <p className="text-2xl md:text-3xl font-extrabold text-white drop-shadow-lg">
                          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </p>
                        <p className="text-yellow-400 text-lg font-medium mt-1">
                          {selectedDate.getFullYear()}
                        </p>
                      </div>
                      <Link href="/login">
                        <Button size="lg" className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-950 px-8 py-6 text-lg font-bold shadow-2xl hover:shadow-yellow-400/50 transition-all duration-300 transform hover:scale-105 group rounded-xl">
                          <Calendar className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                          Book This Date
                          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" data-section className="py-24 px-4 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="container mx-auto relative z-10">
          <div className="text-center mb-20 section-title">
            <div className="inline-flex items-center gap-2 mb-4 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
              <Zap className="h-3 w-3" />
              Simple Process
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 bg-clip-text text-transparent">
              How It Works
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Book your perfect venue in just 4 simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-7xl mx-auto">
            {[
              { icon: Search, title: 'Browse Venues', desc: 'Explore our collection of premium event halls and find the perfect match', color: 'from-blue-500 to-cyan-500' },
              { icon: Calendar, title: 'Check Availability', desc: 'View real-time availability and select your preferred date', color: 'from-purple-500 to-pink-500' },
              { icon: FileCheck, title: 'Submit Request', desc: 'Fill out the booking form with your event details', color: 'from-orange-500 to-red-500' },
              { icon: PartyPopper, title: 'Celebrate!', desc: 'Get confirmed and enjoy your perfect event', color: 'from-green-500 to-emerald-500' }
            ].map((step, i) => (
              <div
                key={i}
                className="relative text-center transition-all duration-1000 step-card"
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                {/* Connector Line */}
                {i < 3 && (
                  <div className="hidden md:block absolute top-16 left-[60%] w-[80%] h-1 bg-gradient-to-r from-gray-300 to-gray-200 z-0">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-400 rounded-full"></div>
                  </div>
                )}

                {/* Step Number Badge */}
                <div className="relative mb-6 inline-block">
                  <div className={`w-32 h-32 mx-auto rounded-2xl bg-gradient-to-br ${step.color} p-1 shadow-xl transform hover:scale-110 hover:rotate-3 transition-all duration-300`}>
                    <div className="w-full h-full bg-white rounded-xl flex items-center justify-center">
                      <step.icon className="h-14 w-14 text-gray-700" />
                    </div>
                  </div>
                  <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                    {i + 1}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Showcase */}
      <section id="gallery" data-section className="py-24 px-4 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
        <div className="container mx-auto relative z-10">
          <div className="text-center mb-20 section-title">
            <div className="inline-flex items-center gap-2 mb-4 px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
              <Eye className="h-3 w-3" />
              Visual Gallery
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 bg-gradient-to-r from-blue-950 via-blue-800 to-blue-950 bg-clip-text text-transparent">
              See Our Venues in Action
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Real events, real memories, real success stories
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-7xl mx-auto">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl aspect-square shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 gallery-item"
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <div className={`w-full h-full bg-gradient-to-br ${
                  i % 4 === 0 ? 'from-blue-400 to-blue-600' :
                  i % 4 === 1 ? 'from-purple-400 to-purple-600' :
                  i % 4 === 2 ? 'from-pink-400 to-pink-600' :
                  'from-orange-400 to-orange-600'
                }`}>
                  <div className="absolute inset-0 flex items-center justify-center text-white/20">
                    <Building2 className="h-20 w-20" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-4">
                  <p className="text-white font-semibold">Event Gallery {i + 1}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-28 px-4 bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="container mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 mb-6 px-5 py-2 bg-yellow-400/10 backdrop-blur-sm border border-yellow-400/20 rounded-full text-yellow-400 text-sm font-semibold">
            <Star className="h-4 w-4 fill-yellow-400" />
            Start Your Journey Today
          </div>

          <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 text-white leading-tight">
            Ready to Book Your Event?
          </h2>

          <p className="text-xl md:text-2xl mb-12 text-white/90 max-w-3xl mx-auto leading-relaxed">
            Contact us today to discuss your requirements or register to make your booking online.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link href="/login?tab=register" className="group">
              <Button size="lg" className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-950 px-10 py-7 text-lg font-bold shadow-2xl hover:shadow-yellow-400/50 transition-all duration-300 transform hover:scale-105 group">
                <Users className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                REGISTER NOW
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/contact" className="group">
              <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:border-white hover:bg-white/10 backdrop-blur-sm px-10 py-7 text-lg font-bold transition-all duration-300 transform hover:scale-105 group">
                <Mail className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                CONTACT US
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 text-white py-16 px-4 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-400/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto relative z-10">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <img
                  src="/Logooo.png"
                  alt="EventEase Logo"
                  className="h-14 w-auto object-contain"
                />
              </div>
              <p className="text-white/70 mb-6 text-sm leading-relaxed">
                Providing exceptional event venues and services for all your special occasions. Our mission is to create memorable experiences that exceed your expectations.
              </p>
              <div className="flex gap-3">
                <a href="#" className="w-10 h-10 bg-white/10 hover:bg-yellow-400 hover:text-blue-950 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:rotate-12">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 hover:bg-yellow-400 hover:text-blue-950 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:rotate-12">
                  <Twitter className="h-5 w-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 hover:bg-yellow-400 hover:text-blue-950 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:rotate-12">
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-white/10 hover:bg-yellow-400 hover:text-blue-950 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:rotate-12">
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-6 uppercase text-sm tracking-wide text-yellow-400">Quick Links</h4>
              <ul className="space-y-3 text-white/80 text-sm">
                <li>
                  <Link href="/venues" className="hover:text-yellow-400 transition-all duration-300 flex items-center gap-2 group">
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    <span>Our Venues</span>
                  </Link>
                </li>
                <li>
                  <Link href="/venues" className="hover:text-yellow-400 transition-all duration-300 flex items-center gap-2 group">
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    <span>Event Packages</span>
                  </Link>
                </li>
                <li>
                  <Link href="/availability" className="hover:text-yellow-400 transition-all duration-300 flex items-center gap-2 group">
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    <span>Availability</span>
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-yellow-400 transition-all duration-300 flex items-center gap-2 group">
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    <span>About Us</span>
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-6 uppercase text-sm tracking-wide text-yellow-400">Event Types</h4>
              <ul className="space-y-3 text-white/80 text-sm">
                <li>
                  <Link href="/venues" className="hover:text-yellow-400 transition-all duration-300 flex items-center gap-2 group">
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    <span>Weddings</span>
                  </Link>
                </li>
                <li>
                  <Link href="/venues" className="hover:text-yellow-400 transition-all duration-300 flex items-center gap-2 group">
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    <span>Corporate Events</span>
                  </Link>
                </li>
                <li>
                  <Link href="/venues" className="hover:text-yellow-400 transition-all duration-300 flex items-center gap-2 group">
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    <span>Birthday Parties</span>
                  </Link>
                </li>
                <li>
                  <Link href="/venues" className="hover:text-yellow-400 transition-all duration-300 flex items-center gap-2 group">
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    <span>Conferences</span>
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-6 uppercase text-sm tracking-wide text-yellow-400">Contact Information</h4>
              <ul className="space-y-4 text-white/80 text-sm">
                <li className="flex items-start gap-3 group">
                  <div className="p-2 bg-white/10 rounded-lg group-hover:bg-yellow-400 group-hover:text-blue-950 transition-all duration-300">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span className="pt-1.5">123 Event Street, City</span>
                </li>
                <li className="flex items-start gap-3 group">
                  <div className="p-2 bg-white/10 rounded-lg group-hover:bg-yellow-400 group-hover:text-blue-950 transition-all duration-300">
                    <Phone className="h-4 w-4" />
                  </div>
                  <span className="pt-1.5">(123) 456-7890</span>
                </li>
                <li className="flex items-start gap-3 group">
                  <div className="p-2 bg-white/10 rounded-lg group-hover:bg-yellow-400 group-hover:text-blue-950 transition-all duration-300">
                    <Mail className="h-4 w-4" />
                  </div>
                  <span className="pt-1.5">info@coliseum.com</span>
                </li>
                <li className="flex items-start gap-3 group">
                  <div className="p-2 bg-white/10 rounded-lg group-hover:bg-yellow-400 group-hover:text-blue-950 transition-all duration-300">
                    <Clock className="h-4 w-4" />
                  </div>
                  <span className="pt-1.5">Mon-Fri 9am-5pm</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/20 pt-8 text-center">
            <p className="text-white/60 text-sm">
              © 2025 EventEase. All rights reserved. | <Link href="/privacy" className="hover:text-yellow-400 transition-colors">Privacy Policy</Link> | <Link href="/terms" className="hover:text-yellow-400 transition-colors">Terms of Service</Link>
            </p>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-950 rounded-full shadow-2xl hover:shadow-yellow-400/50 flex items-center justify-center transition-all duration-300 transform hover:scale-110 hover:-translate-y-1 z-50 group"
          aria-label="Scroll to top"
        >
          <ChevronUp className="h-6 w-6 group-hover:-translate-y-1 transition-transform" />
        </button>
      )}

      {/* Hall Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-white border-0 shadow-2xl p-0 gap-0 rounded-2xl">
          {selectedHall && (
            <div className="relative">
              {/* Hero Image Section */}
              <div className="relative h-96 w-full overflow-hidden">
                {selectedHall.photo ? (
                  <img
                    src={selectedHall.photo}
                    alt={selectedHall.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-800 via-indigo-800 to-purple-800 flex items-center justify-center">
                    <Building2 className="h-32 w-32 text-white/20" />
                  </div>
                )}
                
                {/* Bookmark icon */}
                <div className="absolute top-6 right-6 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-xl">
                  <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                </div>
              </div>

              {/* Content Section with Dark Overlay */}
              <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 -mt-20 pt-24 pb-8 px-8">
                {/* Title and Price Row */}
                <div className="flex items-start justify-between mb-4">
                  <DialogTitle className="text-4xl md:text-5xl font-bold text-white flex-1 pr-6">
                    {selectedHall.name}
                  </DialogTitle>
                  <div className="text-4xl font-bold text-white whitespace-nowrap">{formatCurrency(selectedHall.price)}</div>
                </div>

                {/* Description */}
                {selectedHall.description ? (
                  <p className="text-white/80 text-base leading-relaxed mb-6">{selectedHall.description}</p>
                ) : (
                  <p className="text-white/80 text-base leading-relaxed mb-6">Experience exceptional event space with premium amenities and stunning ambiance for your special occasions.</p>
                )}

                {/* Tags */}
                <div className="flex items-center gap-4 mb-8 flex-wrap">
                  {selectedHall.location && (
                    <span className="px-4 py-2 bg-gradient-to-r from-yellow-400/30 to-yellow-500/30 backdrop-blur-sm border border-yellow-400/40 rounded-full text-yellow-300 text-sm font-bold uppercase tracking-wider">
                      {selectedHall.location}
                    </span>
                  )}
                  <span className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm font-medium">
                    {Number(selectedHall.max_capacity || selectedHall.capacity).toLocaleString()} Capacity
                  </span>
                </div>

                {/* Key Features */}
                <div className="grid sm:grid-cols-2 gap-4 mb-8">
                  <div className="flex items-center gap-3 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                    <div className="w-12 h-12 bg-blue-500/30 rounded-lg flex items-center justify-center">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-xs text-white/70 uppercase tracking-wider mb-1">Capacity</div>
                      <div className="text-xl font-bold text-white">
                        {Number(selectedHall.max_capacity || selectedHall.capacity).toLocaleString()} people
                      </div>
                    </div>
                  </div>
                  {selectedHall.location && (
                    <div className="flex items-center gap-3 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                      <div className="w-12 h-12 bg-yellow-500/30 rounded-lg flex items-center justify-center">
                        <MapPin className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <div className="text-xs text-white/70 uppercase tracking-wider mb-1">Location</div>
                        <div className="text-xl font-bold text-white">{selectedHall.location}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Book Now Button */}
                <Link href="/login?tab=register" className="block">
                  <Button className="w-full bg-white text-slate-900 font-bold py-5 rounded-xl hover:bg-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300 group text-lg">
                    <span className="flex items-center justify-center gap-3">
                      <Calendar className="h-6 w-6 group-hover:scale-110 transition-transform" />
                      Book now
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}