'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Archive, RotateCcw, Trash2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

type EntityType = 'users' | 'halls' | 'events' | 'categories' | 'bookings';

interface ArchivedRecord {
  id: number;
  ID?: number;
  name?: string;
  Name?: string;
  title?: string;
  Title?: string;
  deleted_at?: string;
  DeletedAt?: { Time: string; Valid: boolean };
}

export default function ArchiveDashboard() {
  const [activeTab, setActiveTab] = useState<EntityType>('users');
  const [records, setRecords] = useState<ArchivedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchArchivedRecords(activeTab);
  }, [activeTab]);

  const fetchArchivedRecords = async (entity: EntityType) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/archive/${entity}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data || []);
      } else {
        setRecords([]);
      }
    } catch (err) {
      console.error(err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/archive/${activeTab}/${id}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMsg({ text: 'Record restored successfully', type: 'success' });
        fetchArchivedRecords(activeTab);
      } else {
        setMsg({ text: 'Failed to restore record', type: 'error' });
      }
    } catch (err) {
      setMsg({ text: 'Network error', type: 'error' });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const handleDeletePermanent = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this record? This action cannot be undone.')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/archive/${activeTab}/${id}/permanent`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMsg({ text: 'Record permanently deleted', type: 'success' });
        fetchArchivedRecords(activeTab);
      } else {
        setMsg({ text: 'Failed to permanently delete record', type: 'error' });
      }
    } catch (err) {
      setMsg({ text: 'Network error', type: 'error' });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const getRecordName = (record: ArchivedRecord) => {
    return record.name || record.Name || record.title || record.Title || `Record #${record.id || record.ID}`;
  };

  const getDeletedDate = (record: ArchivedRecord) => {
    if (record.deleted_at) return new Date(record.deleted_at).toLocaleDateString();
    if (record.DeletedAt?.Valid) return new Date(record.DeletedAt.Time).toLocaleDateString();
    return 'Unknown date';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-8 text-red-700">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center shadow-lg">
          <Archive className="h-7 w-7 text-red-600" />
        </div>
        <div>
          <h1 className="text-4xl font-bold">Archive Dashboard</h1>
          <p className="font-medium text-red-600">Restore or permanently delete soft-deleted records</p>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl text-sm mb-6 flex items-start gap-3 ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <div className="mt-0.5">
            {msg.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          </div>
          <p>{msg.text}</p>
        </div>
      )}

      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm rounded-2xl">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['users', 'halls', 'events', 'categories', 'bookings'] as EntityType[]).map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? 'default' : 'outline'}
                onClick={() => setActiveTab(tab)}
                className={`capitalize ${activeTab === tab ? 'bg-red-600 hover:bg-red-700 text-white shadow-md' : 'text-gray-600 hover:text-red-700'}`}
              >
                {tab}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin mb-4 text-red-600" />
              <p>Loading archived records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Archive className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No Archived records found</h3>
              <p className="text-gray-500">There are no soft-deleted {activeTab} at the moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left py-4 px-6 font-bold text-gray-700 uppercase">Record ID</th>
                    <th className="text-left py-4 px-6 font-bold text-gray-700 uppercase">Item Name</th>
                    <th className="text-left py-4 px-6 font-bold text-gray-700 uppercase">Deleted Date</th>
                    <th className="text-right py-4 px-6 font-bold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id || record.ID} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6 font-medium text-gray-900">#{record.id || record.ID}</td>
                      <td className="py-4 px-6">{getRecordName(record)}</td>
                      <td className="py-4 px-6 text-gray-500">{getDeletedDate(record)}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(record.id || record.ID as number)}
                            className="bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" /> Restore
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeletePermanent(record.id || record.ID as number)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
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
    </div>
  );
}
