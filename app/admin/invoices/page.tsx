'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Receipt, Plus, Loader2, DollarSign, CheckCircle2, Clock, AlertCircle, XCircle, Edit, Eye } from 'lucide-react';
import { Label } from '@/components/ui/label';

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
  booking?: { event_name: string; event_date?: string; hall?: { name: string } };
}

export default function InvoiceManagementPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState({
    booking_id: 0, base_price: 0, additional_fees: 0, discount: 0, total_amount: 0
  });
  const [paymentData, setPaymentData] = useState({
    payment_status: 'pending',
    payment_date: '',
    payment_method: '',
    payment_notes: '',
  });
  const [creatingMissing, setCreatingMissing] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchInvoices();
  }, []);

  const normalizeInvoice = (invoice: any): Invoice => {
    return {
      id: invoice.id || invoice.ID || invoice.Id || 0,
      booking_id: invoice.booking_id || invoice.BookingID || invoice.bookingId || 0,
      base_price: invoice.base_price || invoice.BasePrice || invoice.basePrice || 0,
      additional_fees: invoice.additional_fees || invoice.AdditionalFees || invoice.additionalFees || 0,
      discount: invoice.discount || invoice.Discount || 0,
      total_amount: invoice.total_amount || invoice.TotalAmount || invoice.totalAmount || 0,
      payment_status: invoice.payment_status || invoice.PaymentStatus || invoice.paymentStatus || 'pending',
      payment_date: invoice.payment_date || invoice.PaymentDate || invoice.paymentDate,
      payment_method: invoice.payment_method || invoice.PaymentMethod || invoice.paymentMethod,
      payment_notes: invoice.payment_notes || invoice.PaymentNotes || invoice.paymentNotes,
      created_at: invoice.created_at || invoice.CreatedAt || invoice.createdAt || new Date().toISOString(),
      booking: invoice.booking || invoice.Booking ? {
        event_name: invoice.booking?.event_name || invoice.booking?.EventName || invoice.Booking?.event_name || invoice.Booking?.EventName || '',
        event_date: invoice.booking?.event_date || invoice.booking?.EventDate || invoice.Booking?.event_date || invoice.Booking?.EventDate,
        hall: invoice.booking?.hall || invoice.booking?.Hall || invoice.Booking?.hall || invoice.Booking?.Hall,
      } : undefined,
    };
  };

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/invoices`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const normalizedInvoices = (data || []).map(normalizeInvoice);
        setInvoices(normalizedInvoices);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/invoices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setDialogOpen(false);
        setFormData({ booking_id: 0, base_price: 0, additional_fees: 0, discount: 0, total_amount: 0 });
        fetchInvoices();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create invoice');
      }
    } catch (error) {
      console.error('Failed to create invoice:', error);
    }
  };

  const handleOpenPaymentDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentData({
      payment_status: invoice.payment_status || 'pending',
      payment_date: invoice.payment_date ? invoice.payment_date.split('T')[0] : '',
      payment_method: invoice.payment_method || '',
      payment_notes: invoice.payment_notes || '',
    });
    setPaymentDialogOpen(true);
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    try {
      const token = localStorage.getItem('token');
      const updatePayload: any = {
        payment_status: paymentData.payment_status,
      };

      if (paymentData.payment_date) {
        updatePayload.payment_date = paymentData.payment_date;
      }
      if (paymentData.payment_method) {
        updatePayload.payment_method = paymentData.payment_method;
      }
      if (paymentData.payment_notes) {
        updatePayload.payment_notes = paymentData.payment_notes;
      }

      const res = await fetch(`${api}/api/admin/invoices/${selectedInvoice.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (res.ok) {
        setPaymentDialogOpen(false);
        setSelectedInvoice(null);
        setPaymentData({ payment_status: 'pending', payment_date: '', payment_method: '', payment_notes: '' });
        fetchInvoices();
        alert('Payment status updated successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update payment status');
      }
    } catch (error) {
      console.error('Failed to update payment:', error);
      alert('Failed to update payment status');
    }
  };

  const handleCreateMissing = async () => {
    if (!confirm('This will create invoices for all approved bookings that don\'t have invoices. Continue?')) {
      return;
    }
    
    setCreatingMissing(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/invoices/create-missing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        alert(data.message || `Created ${data.created} invoices`);
        fetchInvoices();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create missing invoices');
      }
    } catch (error) {
      console.error('Failed to create missing invoices:', error);
      alert('Failed to create missing invoices');
    } finally {
      setCreatingMissing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      pending: {
        label: 'Pending',
        className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        icon: <Clock className="h-3 w-3" />,
      },
      paid: {
        label: 'Paid',
        className: 'bg-green-100 text-green-700 border-green-200',
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setViewDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoice Management</h1>
          <p className="text-gray-600 mt-1">View and manage invoices and payment status</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleCreateMissing} 
            disabled={creatingMissing}
            variant="outline"
            className="gap-2"
          >
            {creatingMissing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Missing
              </>
            )}
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Plus className="h-4 w-4" />
            Create Invoice
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices ({invoices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Loading invoices...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No invoices available.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Booking</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Base Price</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Fees</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Discount</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Total</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Payment Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-semibold">#{invoice.id}</td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {invoice.booking?.event_name || `Booking #${invoice.booking_id}`}
                          </div>
                          {invoice.booking?.hall?.name && (
                            <div className="text-xs text-gray-500">{invoice.booking.hall.name}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">₱{invoice.base_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-gray-600">₱{invoice.additional_fees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 text-gray-600">₱{invoice.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900">₱{invoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="py-3 px-4">
                        {getStatusBadge(invoice.payment_status)}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">{formatDate(invoice.created_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewInvoice(invoice)}
                            className="h-8"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPaymentDialog(invoice)}
                            className="h-8 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                          >
                            <Edit className="h-3.5 w-3.5" />
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

      {/* Create Invoice Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader className="pb-4 border-b border-gray-200">
            <DialogTitle className="text-2xl font-bold text-gray-900">Create Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="booking_id">
                Booking ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="booking_id"
                type="number"
                min="1"
                value={formData.booking_id}
                onChange={(e) => setFormData({ ...formData, booking_id: parseInt(e.target.value) || 0 })}
                required
                placeholder="Enter booking ID"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="base_price">
                Base Price <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                  required
                  placeholder="0.00"
                  className="h-11 pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="additional_fees">Additional Fees</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                <Input
                  id="additional_fees"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.additional_fees}
                  onChange={(e) => setFormData({ ...formData, additional_fees: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="h-11 pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount">Discount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                <Input
                  id="discount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="h-11 pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="total_amount">
                Total Amount <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                <Input
                  id="total_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                  required
                  placeholder="0.00"
                  className="h-11 pl-8"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <Button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold h-11"
              >
                Create Invoice
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="h-11"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Management Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader className="pb-4 border-b border-gray-200">
            <DialogTitle className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-blue-600" />
              Update Payment Status
            </DialogTitle>
            {selectedInvoice && (
              <p className="text-sm text-gray-600 mt-1">Invoice #{selectedInvoice.id} • ₱{selectedInvoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            )}
          </DialogHeader>
          <form onSubmit={handleUpdatePayment} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="payment_status">
                Payment Status <span className="text-red-500">*</span>
              </Label>
              <select
                id="payment_status"
                value={paymentData.payment_status}
                onChange={(e) => setPaymentData({ ...paymentData, payment_status: e.target.value })}
                required
                className="w-full h-11 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Input
                id="payment_method"
                type="text"
                value={paymentData.payment_method}
                onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                placeholder="e.g., Cash, Bank Transfer, Check"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_notes">Payment Notes</Label>
              <textarea
                id="payment_notes"
                value={paymentData.payment_notes}
                onChange={(e) => setPaymentData({ ...paymentData, payment_notes: e.target.value })}
                placeholder="Additional notes about the payment..."
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <Button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold h-11"
              >
                Update Payment
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPaymentDialogOpen(false);
                  setSelectedInvoice(null);
                  setPaymentData({ payment_status: 'pending', payment_date: '', payment_method: '', payment_notes: '' });
                }}
                className="h-11"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="pb-4 border-b border-gray-200">
            <DialogTitle className="text-2xl font-bold text-gray-900">Invoice Details</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <Label className="text-xs text-gray-600 uppercase">Invoice ID</Label>
                  <p className="text-lg font-bold text-gray-900">#{selectedInvoice.id}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <Label className="text-xs text-gray-600 uppercase">Payment Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedInvoice.payment_status)}</div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Event Information</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Event Name:</span>
                    <span className="font-medium">{selectedInvoice.booking?.event_name || 'N/A'}</span>
                  </div>
                  {selectedInvoice.booking?.hall?.name && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Venue:</span>
                      <span className="font-medium">{selectedInvoice.booking.hall.name}</span>
                    </div>
                  )}
                  {selectedInvoice.booking?.event_date && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Event Date:</span>
                      <span className="font-medium">{formatDate(selectedInvoice.booking.event_date)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Payment Details</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Price:</span>
                    <span className="font-medium">₱{selectedInvoice.base_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Additional Fees:</span>
                    <span className="font-medium">₱{selectedInvoice.additional_fees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-medium">₱{selectedInvoice.discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-300">
                    <span className="font-bold text-gray-900">Total Amount:</span>
                    <span className="font-bold text-lg text-blue-600">₱{selectedInvoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
              {selectedInvoice.payment_status === 'paid' && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">Payment Information</h3>
                  <div className="bg-green-50 p-4 rounded-lg space-y-2">
                    {selectedInvoice.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Method:</span>
                        <span className="font-medium">{selectedInvoice.payment_method}</span>
                      </div>
                    )}
                    {selectedInvoice.payment_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Date:</span>
                        <span className="font-medium">{formatDate(selectedInvoice.payment_date)}</span>
                      </div>
                    )}
                    {selectedInvoice.payment_notes && (
                      <div>
                        <span className="text-gray-600 block mb-1">Notes:</span>
                        <p className="font-medium">{selectedInvoice.payment_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                    setViewDialogOpen(false);
                    handleOpenPaymentDialog(selectedInvoice);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Update Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
