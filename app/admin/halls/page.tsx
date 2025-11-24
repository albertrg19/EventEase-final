'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Plus, Edit, Trash2, Search, Loader2, Upload, Image as ImageIcon, X } from 'lucide-react';

interface Hall {
  id: number;
  name: string;
  location: string;
  capacity: number;
  max_capacity: number;
  price: number;
  description?: string;
  photo?: string;
}

const stripApiPath = (apiUrl: string) => {
  try {
    const parsed = new URL(apiUrl);
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.origin;
  } catch {
    return apiUrl.replace(/\/api\b.*$/, '');
  }
};

const resolveImageUrl = (rawUrl: string | undefined | null, assetBase: string) => {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `http:${trimmed}`;
  }
  const ensuredBase = assetBase.replace(/\/$/, '');
  if (trimmed.startsWith('/')) {
    return `${ensuredBase}${trimmed}`;
  }
  return `${ensuredBase}/${trimmed.replace(/^\/+/, '')}`;
};

const normalizeImageForPayload = (rawUrl: string | undefined | null, assetBase: string) => {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const ensuredBase = assetBase.replace(/\/$/, '');
  if (trimmed.startsWith(ensuredBase)) {
    const relative = trimmed.slice(ensuredBase.length);
    return relative.startsWith('/') ? relative : `/${relative}`;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

function HallImageCell({ photo, name }: { photo?: string; name?: string }) {
  const [imageError, setImageError] = useState(false);

  if (!photo || imageError) {
    return (
      <div className="w-16 h-16 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center">
        <ImageIcon className="h-6 w-6 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
      <img
        src={photo}
        alt={name || 'Hall image'}
        className="w-full h-full object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  );
}

export default function HallManagementPage() {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHall, setEditingHall] = useState<Hall | null>(null);
  const [formData, setFormData] = useState({
    name: '', location: '', capacity: 0, max_capacity: 0, price: 0, description: '', photo: ''
  });
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const assetBase = process.env.NEXT_PUBLIC_ASSET_BASE_URL || stripApiPath(api);
  const previewObjectUrlRef = useRef<string | null>(null);

  const setPreview = (url: string, isBlob = false) => {
    if (previewObjectUrlRef.current && previewObjectUrlRef.current !== url) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    if (isBlob) {
      previewObjectUrlRef.current = url;
    }
    setImagePreview(url);
  };

  const clearPreview = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setImagePreview('');
  };

  useEffect(() => {
    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    fetchHalls();
  }, []);

  const fetchHalls = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${api}/api/halls`);
      if (res.ok) {
        const data = await res.json();
        console.log('Fetched halls data:', data); // Debug log
        // Handle both array and object responses
        const hallsArray = Array.isArray(data) ? data : (data.halls || data.data || []);
        // Normalize field names (handle both camelCase and snake_case from backend)
        const normalizedHalls = hallsArray.map((hall: any, index: number) => {
          // Normalize field names - backend might send MaxCapacity, maxCapacity, or max_capacity
          const photoValue = hall.photo ?? hall.Photo;
          const photoUrl = resolveImageUrl(photoValue, assetBase);

          const normalized: Hall = {
            id: hall.id ?? hall.ID ?? index + 1,
            name: hall.name ?? hall.Name ?? '',
            location: hall.location ?? hall.Location ?? '',
            capacity: hall.capacity ?? hall.Capacity ?? 0,
            max_capacity: hall.max_capacity ?? hall.maxCapacity ?? hall.MaxCapacity ?? 0,
            price: hall.price ?? hall.Price ?? 0,
            description: hall.description ?? hall.Description ?? undefined,
            photo: photoUrl,
          };
          return normalized;
        });
        console.log('Normalized halls:', normalizedHalls); // Debug log
        setHalls(normalizedHalls);
      } else {
        const errorText = await res.text().catch(() => res.statusText);
        console.error('Failed to fetch halls:', res.status, errorText);
        setHalls([]);
      }
    } catch (error) {
      console.error('Failed to fetch halls:', error);
      setHalls([]);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File) => {
    setIsUploading(true);
    setImageError(null);
    const tempPreview = URL.createObjectURL(file);
    setPreview(tempPreview, true);
    try {
      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${api}/api/admin/uploads/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }
      const data = await res.json();
      const url = data.url?.startsWith('http')
        ? data.url
        : resolveImageUrl(data.url, assetBase) || '';
      setFormData(fd => ({ ...fd, photo: url }));
      if (url) {
        setPreview(url);
      }
    } catch (err: any) {
      setImageError(err.message || 'Upload failed');
      if (formData.photo) {
        setPreview(formData.photo);
      } else {
        clearPreview();
      }
    } finally {
      setIsUploading(false);
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setImageError('Only image files are allowed.');
      return;
    }
    uploadImage(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setImageError('Only image files are allowed.');
      return;
    }
    uploadImage(file);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeImage = () => {
    setFormData({ ...formData, photo: '' });
    setImageError(null);
    clearPreview();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this hall?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/halls/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        fetchHalls();
      }
    } catch (error) {
      console.error('Failed to delete hall:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.location.trim()) {
      alert('Please fill in all required fields');
      return;
    }
    if (formData.capacity < 0 || formData.max_capacity < 0 || formData.price < 0) {
      alert('Capacity and price must be non-negative numbers');
      return;
    }
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const url = editingHall ? `${api}/api/admin/halls/${editingHall.id}` : `${api}/api/admin/halls`;
      const method = editingHall ? 'PUT' : 'POST';

      const payloadPhoto = normalizeImageForPayload(formData.photo, assetBase);

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          location: formData.location.trim(),
          capacity: Number(formData.capacity) || 0,
          max_capacity: Number(formData.max_capacity) || 0,
          price: Number(formData.price) || 0,
          description: formData.description?.trim() || null,
          photo: payloadPhoto,
        }),
      });

      if (res.ok) {
        const responseData = await res.json().catch(() => null);

        // If we got the created/updated hall back, add it to the list immediately
        if (responseData) {
          const newHall: Hall = {
            id: responseData.id ?? responseData.ID ?? Date.now(),
            name: responseData.name ?? responseData.Name ?? formData.name,
            location: responseData.location ?? responseData.Location ?? formData.location,
            capacity: responseData.capacity ?? responseData.Capacity ?? formData.capacity,
            max_capacity: responseData.max_capacity ?? responseData.maxCapacity ?? responseData.MaxCapacity ?? formData.max_capacity,
            price: responseData.price ?? responseData.Price ?? formData.price,
            description: (responseData.description ?? responseData.Description ?? formData.description) || undefined,
            photo: resolveImageUrl(responseData.photo ?? responseData.Photo ?? formData.photo, assetBase),
          };

          if (editingHall) {
            // Update existing hall in the list
            setHalls(prev => prev.map(h => h.id === editingHall.id ? newHall : h));
          } else {
            // Add new hall to the list
            setHalls(prev => [...prev, newHall]);
          }
        } else {
          // Fallback: refresh the entire list
          await fetchHalls();
        }

        setDialogOpen(false);
        setEditingHall(null);
        setFormData({ name: '', location: '', capacity: 0, max_capacity: 0, price: 0, description: '', photo: '' });
        setImageError(null);
        clearPreview();
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to save hall' }));
        alert(errorData.error || `Failed to save hall: ${res.status} ${res.statusText}`);
      }
    } catch (error: any) {
      console.error('Failed to save hall:', error);
      alert(error.message || 'An error occurred while saving the hall. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (hall: Hall) => {
    setEditingHall(hall);
    const previewUrl = hall.photo ? resolveImageUrl(hall.photo, assetBase) || '' : '';
    setFormData({
      name: hall.name || '',
      location: hall.location || '',
      capacity: hall.capacity ?? 0,
      max_capacity: hall.max_capacity ?? 0,
      price: hall.price ?? 0,
      description: hall.description || '',
      photo: previewUrl || '',
    });
    if (previewUrl) {
      setPreview(previewUrl);
    } else {
      clearPreview();
    }
    setImageError(null);
    setIsDragging(false);
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingHall(null);
    setFormData({ name: '', location: '', capacity: 0, max_capacity: 0, price: 0, description: '', photo: '' });
    setImageError(null);
    clearPreview();
    setIsDragging(false);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Hall Management</h1>
          <p className="text-gray-600 mt-1">Manage event halls and venues</p>
        </div>
        <Button onClick={openAddDialog} className="bg-yellow-400 hover:bg-yellow-500 text-blue-950 gap-2">
          <Plus className="h-4 w-4" />
          Add New Hall
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Halls</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Loading halls...</p>
            </div>
          ) : halls.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No halls available. Add a new hall to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Image</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Location</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Capacity</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Price</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {halls.map((hall, index) => (
                    <tr key={hall.id ?? `hall-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <HallImageCell photo={hall.photo} name={hall.name} />
                      </td>
                      <td className="py-3 px-4 font-medium">{hall.name || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">{hall.location || '-'}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {hall.max_capacity != null ? hall.max_capacity.toLocaleString() : '-'}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {hall.price != null ? `₱${hall.price.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(hall)} className="gap-1">
                            <Edit className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(hall.id)} className="gap-1 text-red-600 hover:text-red-700">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b border-gray-200">
            <DialogTitle className="text-2xl font-bold text-gray-900">
              {editingHall ? 'Edit Hall' : 'Add New Hall'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Provide hall details, pricing, and upload a photo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter hall name"
                className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                Location <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
                placeholder="Enter hall location"
                className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 block">
                  Capacity <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                  required
                  placeholder="0"
                  className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 block">
                  Max Capacity <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  value={formData.max_capacity}
                  onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) || 0 })}
                  required
                  placeholder="0"
                  className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">
                Price <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  required
                  placeholder="0.00"
                  className="h-11 pl-8 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter hall description (optional)"
                rows={3}
                className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus:border-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-950/20 resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">Photo</label>
              {!imagePreview ? (
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${isDragging
                    ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
                  onClick={() => !isUploading && (document.getElementById('hall-photo-input') as HTMLInputElement)?.click()}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
                      <p className="text-sm font-medium text-gray-700">Uploading image...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-center mb-3">
                        <div className={`p-3 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          <Upload className={`h-6 w-6 ${isDragging ? 'text-blue-600' : 'text-gray-600'}`} />
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        {isDragging ? 'Drop your image here' : 'Drag & drop an image here'}
                      </p>
                      <p className="text-xs text-gray-500 mb-2">or</p>
                      <p className="text-sm text-blue-600 font-medium hover:text-blue-700">Click to browse</p>
                      <p className="text-xs text-gray-400 mt-3">PNG, JPG, GIF, WEBP up to 10MB</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative group">
                  <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        clearPreview();
                        setImageError('Unable to display the selected photo.');
                      }}
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 rounded-lg flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => (document.getElementById('hall-photo-input') as HTMLInputElement)?.click()}
                        className="bg-white hover:bg-gray-100"
                      >
                        <ImageIcon className="h-4 w-4 mr-1" />
                        Replace
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeImage}
                        className="bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border-red-200"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <input id="hall-photo-input" type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
              {imageError && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <X className="h-4 w-4" />
                    {imageError}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <Button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-950 hover:bg-blue-900 text-white font-semibold h-11 shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> {editingHall ? 'Updating...' : 'Creating...'}
                  </span>
                ) : (
                  editingHall ? 'Update Hall' : 'Create Hall'
                )}
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
