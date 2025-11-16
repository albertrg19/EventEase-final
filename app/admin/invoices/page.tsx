'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Receipt, Plus, Loader2 } from 'lucide-react';

interface Invoice {
  id: number;
  booking_id: number;
  base_price: number;
  additional_fees: number;
  discount: number;
  total_amount: number;
  created_at: string;
  booking?: { event_name: string };
}

export default function InvoiceManagementPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    booking_id: 0, base_price: 0, additional_fees: 0, discount: 0, total_amount: 0
  });
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${api}/api/invoices`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data || []);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Invoice Management</h1>
          <p className="text-gray-600 mt-1">View and manage invoices</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-yellow-400 hover:bg-yellow-500 text-blue-950 gap-2">
          <Plus className="h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
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
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Booking</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Base Price</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Fees</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Discount</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Total</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">#{invoice.id}</td>
                      <td className="py-3 px-4 text-gray-600">Booking #{invoice.booking_id}</td>
                      <td className="py-3 px-4 text-gray-600">₱{invoice.base_price.toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-600">₱{invoice.additional_fees.toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-600">₱{invoice.discount.toLocaleString()}</td>
                      <td className="py-3 px-4 font-semibold">₱{invoice.total_amount.toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-600">{new Date(invoice.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader className="pb-4 border-b border-gray-200">
            <DialogTitle className="text-2xl font-bold text-gray-900">Create Invoice</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                Booking ID <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                value={formData.booking_id}
                onChange={(e) => setFormData({ ...formData, booking_id: parseInt(e.target.value) || 0 })}
                required
                placeholder="Enter booking ID"
                className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                Base Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                  required
                  placeholder="0.00"
                  className="h-11 pl-8 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">Additional Fees</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.additional_fees}
                  onChange={(e) => setFormData({ ...formData, additional_fees: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="h-11 pl-8 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">Discount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="h-11 pl-8 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                Total Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.total_amount}
                  onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                  required
                  placeholder="0.00"
                  className="h-11 pl-8 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <Button
                type="submit"
                className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-semibold h-11 shadow-md hover:shadow-lg transition-all"
              >
                Create Invoice
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
