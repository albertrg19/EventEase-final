'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Receipt,
  Download,
  Loader2,
  Calendar,
  Building2,
  FileText,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  Info,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Booking {
  id: number;
  event_name: string;
  event_type: string;
  event_date: string;
  status: string;
  hall?: { id: number; name: string; location: string };
  user_id: number;
}

interface Invoice {
  id: number;
  booking_id: number;
  base_price: number;
  additional_fees: number;
  discount: number;
  total_amount: number;
  payment_status: string;
  payment_date?: string;
  payment_method?: string;
  payment_notes?: string;
  created_at: string;
  booking?: Booking;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Get user id from token
      let userId = 0;
      try {
        const tokenParts = token.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        userId = payload.sub || 0;
      } catch {
        userId = 0;
      }

      // Fetch bookings and invoices in parallel
      const [bookingsRes, invoicesRes] = await Promise.all([
        fetch(`${api}/api/bookings`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${api}/api/invoices`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        const userBookings = (bookingsData || []).filter(
          (b: any) => b.user_id === userId || b.user?.id === userId
        );
        setBookings(userBookings);

        if (invoicesRes.ok) {
          const invoicesData = await invoicesRes.json();
          // Filter invoices that belong to user's bookings
          const userBookingIds = new Set(userBookings.map((b: Booking) => b.id));
          const userInvoices = (invoicesData || []).filter((inv: Invoice) =>
            userBookingIds.has(inv.booking_id)
          );

          // Attach booking data to invoices
          const invoicesWithBookings = userInvoices.map((inv: Invoice) => ({
            ...inv,
            booking: userBookings.find((b: Booking) => b.id === inv.booking_id),
          }));

          setInvoices(invoicesWithBookings);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const thisYear = invoices.filter(
      (inv) => new Date(inv.created_at).getFullYear() === new Date().getFullYear()
    );
    const thisYearTotal = thisYear.reduce((sum, inv) => sum + inv.total_amount, 0);
    const avgPerBooking = invoices.length > 0 ? total / invoices.length : 0;
    const paidCount = invoices.filter((inv) => inv.payment_status === 'paid').length;
    const pendingCount = invoices.filter((inv) => inv.payment_status === 'pending').length;

    return {
      totalSpent: total,
      thisYearSpent: thisYearTotal,
      totalInvoices: invoices.length,
      avgPerBooking,
      paidCount,
      pendingCount,
    };
  }, [invoices]);

  const years = useMemo(() => {
    const yearSet = new Set(
      invoices.map((inv) => new Date(inv.created_at).getFullYear().toString())
    );
    return Array.from(yearSet).sort((a, b) => parseInt(b) - parseInt(a));
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesEvent = inv.booking?.event_name.toLowerCase().includes(query);
          const matchesVenue = inv.booking?.hall?.name.toLowerCase().includes(query);
          const matchesId = inv.id.toString().includes(query);
          if (!matchesEvent && !matchesVenue && !matchesId) return false;
        }

        // Year filter
        if (filterYear !== 'all') {
          const invYear = new Date(inv.created_at).getFullYear().toString();
          if (invYear !== filterYear) return false;
        }

        return true;
      })
      .sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
  }, [invoices, searchQuery, filterYear]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      pending: {
        label: 'Pending Payment',
        className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: <Clock className="h-3 w-3" />,
      },
      paid: {
        label: 'Paid',
        className: 'bg-blue-100 text-blue-700 border-blue-200',
        icon: <CheckCircle2 className="h-3 w-3" />,
      },
      overdue: {
        label: 'Overdue',
        className: 'bg-red-100 text-red-700 border-red-200',
        icon: <AlertCircle className="h-3 w-3" />,
      },
      cancelled: {
        label: 'Cancelled',
        className: 'bg-gray-100 text-gray-700 border-gray-200',
        icon: <XCircle className="h-3 w-3" />,
      },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${config.className}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setViewDialogOpen(true);
  };

  const downloadInvoice = (invoice: Invoice) => {
    // Generate a comprehensive printable invoice
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const paymentStatusText = invoice.payment_status === 'paid' 
      ? `PAID${invoice.payment_date ? ` on ${formatDate(invoice.payment_date)}` : ''}`
      : 'PENDING PAYMENT';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice #${invoice.id}</title>
        <style>
          @media print {
            @page { margin: 20mm; }
            body { margin: 0; }
          }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 40px; 
            max-width: 800px; 
            margin: 0 auto;
            color: #333;
          }
          .header { 
            text-align: center; 
            margin-bottom: 40px; 
            border-bottom: 3px solid #3B82F6;
            padding-bottom: 20px;
          }
          .logo { 
            font-size: 28px; 
            font-weight: bold; 
            color: #3B82F6; 
            margin-bottom: 10px;
          }
          .invoice-title { 
            font-size: 32px; 
            margin: 10px 0; 
            color: #1F2937;
          }
          .invoice-meta { 
            color: #666; 
            margin-bottom: 10px; 
            font-size: 14px;
          }
          .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 12px;
            margin-top: 10px;
            ${invoice.payment_status === 'paid' 
              ? 'background: #D1FAE5; color: #065F46;' 
              : 'background: #FEF3C7; color: #92400E;'}
          }
          .section { 
            margin-bottom: 30px; 
          }
          .section-title { 
            font-size: 16px; 
            color: #1F2937; 
            margin-bottom: 15px; 
            border-bottom: 2px solid #E5E7EB; 
            padding-bottom: 8px;
            font-weight: 600;
          }
          .detail-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 0; 
            border-bottom: 1px solid #F3F4F6;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            color: #6B7280;
            font-weight: 500;
          }
          .detail-value {
            color: #1F2937;
            font-weight: 600;
          }
          .total-row { 
            font-size: 20px; 
            font-weight: bold; 
            border-top: 3px solid #1F2937; 
            margin-top: 15px; 
            padding-top: 15px;
            color: #1F2937;
          }
          .payment-notice {
            background: #FEF3C7;
            border: 2px solid #FCD34D;
            border-radius: 8px;
            padding: 20px;
            margin: 30px 0;
            text-align: center;
          }
          .payment-notice h3 {
            color: #92400E;
            margin: 0 0 10px 0;
            font-size: 18px;
          }
          .payment-notice p {
            color: #78350F;
            margin: 5px 0;
            font-size: 14px;
          }
          .footer { 
            text-align: center; 
            margin-top: 50px; 
            color: #6B7280; 
            font-size: 12px;
            border-top: 1px solid #E5E7EB;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">EventEase</div>
          <div class="invoice-title">INVOICE</div>
          <div class="invoice-meta">Invoice #${invoice.id} • Issued: ${formatDateTime(invoice.created_at)}</div>
          <div class="status-badge">${paymentStatusText}</div>
        </div>
        
        <div class="section">
          <div class="section-title">EVENT DETAILS</div>
          <div class="detail-row">
            <span class="detail-label">Event Name</span>
            <span class="detail-value">${invoice.booking?.event_name || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Event Type</span>
            <span class="detail-value">${invoice.booking?.event_type || 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Event Date</span>
            <span class="detail-value">${invoice.booking ? formatDateTime(invoice.booking.event_date) : 'N/A'}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Venue</span>
            <span class="detail-value">${invoice.booking?.hall?.name || 'N/A'}</span>
          </div>
          ${invoice.booking?.hall?.location ? `
          <div class="detail-row">
            <span class="detail-label">Location</span>
            <span class="detail-value">${invoice.booking.hall.location}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="section">
          <div class="section-title">PAYMENT DETAILS</div>
          <div class="detail-row">
            <span class="detail-label">Base Price</span>
            <span class="detail-value">₱${invoice.base_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ${invoice.additional_fees > 0 ? `
          <div class="detail-row">
            <span class="detail-label">Additional Fees</span>
            <span class="detail-value">₱${invoice.additional_fees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ` : ''}
          ${invoice.discount > 0 ? `
          <div class="detail-row">
            <span class="detail-label">Discount</span>
            <span class="detail-value">-₱${invoice.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          ` : ''}
          <div class="detail-row total-row">
            <span>Total Amount</span>
            <span>₱${invoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        ${invoice.payment_status === 'paid' && invoice.payment_method ? `
        <div class="section">
          <div class="section-title">PAYMENT INFORMATION</div>
          <div class="detail-row">
            <span class="detail-label">Payment Method</span>
            <span class="detail-value">${invoice.payment_method}</span>
          </div>
          ${invoice.payment_date ? `
          <div class="detail-row">
            <span class="detail-label">Payment Date</span>
            <span class="detail-value">${formatDateTime(invoice.payment_date)}</span>
          </div>
          ` : ''}
          ${invoice.payment_notes ? `
          <div class="detail-row">
            <span class="detail-label">Notes</span>
            <span class="detail-value">${invoice.payment_notes}</span>
          </div>
          ` : ''}
        </div>
        ` : ''}

        ${invoice.payment_status === 'pending' ? `
        <div class="payment-notice">
          <h3>⚠️ Offline Payment Required</h3>
          <p><strong>This invoice requires offline payment.</strong></p>
          <p>Please contact us to complete your payment using one of the following methods:</p>
          <p style="margin-top: 15px;"><strong>• Cash Payment</strong> - Pay at our office</p>
          <p><strong>• Bank Transfer</strong> - Contact us for bank details</p>
          <p><strong>• Other Methods</strong> - Contact us for alternative payment options</p>
          <p style="margin-top: 15px; font-size: 12px;">For payment inquiries, please contact our support team.</p>
        </div>
        ` : ''}
        
        <div class="footer">
          <p><strong>Thank you for choosing EventEase!</strong></p>
          <p>For inquiries, contact us at support@eventease.com</p>
          <p style="margin-top: 10px; font-size: 11px;">This is a computer-generated invoice. No signature required.</p>
        </div>
        
        <script>window.print();</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
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
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-blue-100">
            <Receipt className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">Payment History</h1>
            <p className="text-blue-600 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              View and download your invoices
            </p>
          </div>
        </div>
      </div>

      {/* Offline Payment Notice */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-100 rounded-xl flex-shrink-0">
              <Info className="h-6 w-6 text-yellow-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-900 mb-2 text-lg">Offline Payment System</h3>
              <p className="text-sm text-yellow-800 leading-relaxed">
                All payments are processed offline. After your booking is approved, you'll receive an invoice. 
                Please contact us to complete payment via cash, bank transfer, or other offline methods.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-white rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Spent</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₱{stats.totalSpent.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">This Year</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₱{stats.thisYearSpent.toLocaleString()}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-white rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Paid</p>
                <p className="text-3xl font-bold text-gray-900">{stats.paidCount}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-white rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pendingCount}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm rounded-2xl">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-10 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-11 bg-white"
              >
                <option value="all">All Years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden">
        <CardHeader className="px-6 py-5 border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100/50">
          <CardTitle className="text-xl font-bold text-gray-900">Invoices ({filteredInvoices.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Receipt className="h-12 w-12 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No invoices found</h3>
              <p className="text-gray-500 mb-6">
                {invoices.length === 0
                  ? 'Your invoices will appear here after your bookings are approved'
                  : 'Try adjusting your search or filter'}
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {filteredInvoices.map((invoice, index) => (
                <div
                  key={invoice.id}
                  className="flex flex-col p-5 bg-gradient-to-br from-gray-50 to-white rounded-xl hover:shadow-md transition-all duration-200 gap-4 border border-gray-200 hover:border-blue-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Top row - Invoice info */}
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm flex-shrink-0 ring-2 ring-blue-100">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900 text-base">
                          Invoice #{invoice.id}
                        </h4>
                        {getStatusBadge(invoice.payment_status || 'pending')}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {invoice.booking?.event_name || 'Unknown Event'}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {invoice.booking?.hall?.name || 'Unknown Venue'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {invoice.booking ? formatDate(invoice.booking.event_date) : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment info for pending invoices */}
                  {invoice.payment_status === 'pending' && (
                    <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                          <AlertCircle className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div className="text-sm text-yellow-800">
                          <p className="font-bold mb-1.5">Payment Required</p>
                          <p className="leading-relaxed">Please contact us to complete payment via offline methods (cash, bank transfer, etc.)</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment info for paid invoices */}
                  {invoice.payment_status === 'paid' && invoice.payment_method && (
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                          <CheckCircle2 className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="text-sm text-blue-800">
                          <p className="font-bold mb-1.5">Payment Completed</p>
                          <p className="leading-relaxed">Method: <span className="font-semibold">{invoice.payment_method}</span></p>
                          {invoice.payment_date && (
                            <p className="leading-relaxed">Date: <span className="font-semibold">{formatDate(invoice.payment_date)}</span></p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bottom row - Amount and actions */}
                  <div className="flex items-center justify-between pt-4 border-t-2 border-gray-200">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        ₱{invoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Issued: {formatDate(invoice.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewInvoice(invoice)}
                        className="h-9 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-300 hover:from-blue-100 hover:to-blue-200 gap-1.5 shadow-sm hover:shadow-md transition-all"
                      >
                        <Info className="h-4 w-4" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadInvoice(invoice)}
                        className="h-9 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-300 hover:from-blue-100 hover:to-blue-200 gap-1.5 shadow-sm hover:shadow-md transition-all"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl shadow-2xl border-0 rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl -mt-6 -mx-6 mb-6">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6" />
              Invoice Details
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6 pt-2">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-xl border border-blue-200">
                  <label className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 block">Invoice Number</label>
                  <p className="text-gray-900 font-bold text-lg">#{selectedInvoice.id}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 p-4 rounded-xl border border-purple-200">
                  <label className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-2 block">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedInvoice.payment_status || 'pending')}</div>
                </div>
              </div>

              {/* Event Details */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 p-5 rounded-xl border border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Event Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Event Name</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedInvoice.booking?.event_name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Event Type</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedInvoice.booking?.event_type || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Event Date</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {selectedInvoice.booking ? formatDateTime(selectedInvoice.booking.event_date) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Venue</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedInvoice.booking?.hall?.name || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Payment Details</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Base Price</span>
                    <span className="text-sm font-semibold text-gray-900">
                      ₱{selectedInvoice.base_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  {selectedInvoice.additional_fees > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Additional Fees</span>
                      <span className="text-sm font-semibold text-gray-900">
                        ₱{selectedInvoice.additional_fees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Discount</span>
                      <span className="text-sm font-semibold text-gray-900">
                        -₱{selectedInvoice.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t border-blue-300">
                    <span className="text-base font-bold text-gray-900">Total Amount</span>
                    <span className="text-lg font-bold text-blue-700">
                      ₱{selectedInvoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              {selectedInvoice.payment_status === 'paid' && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-200">
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Payment Information</h3>
                  <div className="space-y-3">
                    {selectedInvoice.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Payment Method</span>
                        <span className="text-sm font-semibold text-gray-900">{selectedInvoice.payment_method}</span>
                      </div>
                    )}
                    {selectedInvoice.payment_date && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Payment Date</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {formatDateTime(selectedInvoice.payment_date)}
                        </span>
                      </div>
                    )}
                    {selectedInvoice.payment_notes && (
                      <div className="pt-3 border-t border-blue-300">
                        <span className="text-sm text-gray-600 block mb-1">Notes</span>
                        <p className="text-sm text-gray-900">{selectedInvoice.payment_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Offline Payment Notice */}
              {selectedInvoice.payment_status === 'pending' && (
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-5 rounded-xl border-2 border-yellow-300">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-yellow-900 mb-2">Offline Payment Required</h3>
                      <p className="text-sm text-yellow-800 mb-3">
                        This invoice requires offline payment. Please contact us to complete your payment.
                      </p>
                      <div className="text-sm text-yellow-800 space-y-1">
                        <p><strong>Available Payment Methods:</strong></p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                          <li>Cash Payment at our office</li>
                          <li>Bank Transfer (contact us for details)</li>
                          <li>Other methods (contact us for options)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => setViewDialogOpen(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    downloadInvoice(selectedInvoice);
                    setViewDialogOpen(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Invoice
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

