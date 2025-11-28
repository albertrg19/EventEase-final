'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Grid, Plus, Edit, Trash2, Loader2, Upload, Image as ImageIcon, X } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  description?: string;
  image?: string;
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
    // If an absolute URL points elsewhere, keep it as-is.
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

export default function CategoryManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', image: '' });
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [inlineEditId, setInlineEditId] = useState<number | null>(null);
  const [inlineForm, setInlineForm] = useState({ name: '', description: '' });
  const [inlineSaving, setInlineSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
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
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${api}/api/categories`);
      if (res.ok) {
        const data = await res.json();
        console.log('Fetched categories data:', data); // Debug log
        // Handle both array and object responses
        const categoriesArray = Array.isArray(data) ? data : (data.categories || data.data || []);
        // Normalize field names (handle both camelCase and snake_case from backend)
        const normalizedCategories = categoriesArray.map((category: any, index: number) => {
          // Normalize field names - backend might send different formats
          const normalized: Category = {
            id: category.id ?? category.ID ?? index + 1,
            name: category.name ?? category.Name ?? '',
            description: category.description ?? category.Description ?? undefined,
            image: resolveImageUrl(category.image ?? category.Image, assetBase),
          };
          return normalized;
        });
        console.log('Normalized categories:', normalizedCategories); // Debug log
        setCategories(normalizedCategories);
      } else {
        const errorText = await res.text().catch(() => res.statusText);
        console.error('Failed to fetch categories:', res.status, errorText);
        setCategories([]);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([]);
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
      // Server returns a relative URL (/uploads/filename). Prefix with asset base so browser can show it.
      const url = data.url?.startsWith('http')
        ? data.url
        : resolveImageUrl(data.url, assetBase) || '';
      setFormData(fd => ({ ...fd, image: url }));
      if (url) {
        setPreview(url);
      }
    } catch (err: any) {
      setImageError(err.message || 'Upload failed');
      if (formData.image) {
        setPreview(formData.image);
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
    setFormData({ ...formData, image: '' });
    setImageError(null);
    clearPreview();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        fetchCategories();
        setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === categories.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(categories.map((category) => category.id));
    }
  };

  const hasSelection = selectedIds.length > 0;

  const handleBulkDelete = async () => {
    if (!hasSelection) return;
    if (!confirm(`Delete ${selectedIds.length} selected categories? This cannot be undone.`)) return;
    try {
      setBulkDeleting(true);
      const token = localStorage.getItem('token');
      for (const id of selectedIds) {
        await fetch(`${api}/api/admin/categories/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      setSelectedIds([]);
      fetchCategories();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Failed to delete some categories. Please try again.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const startInlineEdit = (category: Category) => {
    setInlineEditId(category.id);
    setInlineForm({
      name: category.name || '',
      description: category.description || '',
    });
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineForm({ name: '', description: '' });
    setInlineSaving(false);
  };

  const saveInlineEdit = async () => {
    if (!inlineEditId) return;
    if (!inlineForm.name.trim()) {
      alert('Category name is required.');
      return;
    }
    const category = categories.find((c) => c.id === inlineEditId);
    if (!category) return;
    try {
      setInlineSaving(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${api}/api/admin/categories/${inlineEditId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: inlineForm.name.trim(),
          description: inlineForm.description?.trim() || null,
          image: normalizeImageForPayload(category.image, assetBase),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save changes');
      }
      const responseData = await res.json().catch(() => null);
      setCategories((prev) =>
        prev.map((item) =>
          item.id === inlineEditId
            ? {
              ...item,
              name: responseData?.name ?? responseData?.Name ?? inlineForm.name,
              description: responseData?.description ?? responseData?.Description ?? inlineForm.description,
              image: resolveImageUrl(responseData?.image ?? responseData?.Image ?? item.image, assetBase),
            }
            : item,
        ),
      );
      cancelInlineEdit();
    } catch (error: any) {
      console.error('Inline edit failed:', error);
      alert(error.message || 'Unable to update category.');
    } finally {
      setInlineSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a category name');
      return;
    }
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const url = editingCategory ? `${api}/api/admin/categories/${editingCategory.id}` : `${api}/api/admin/categories`;
      const method = editingCategory ? 'PUT' : 'POST';

      const payloadImage = normalizeImageForPayload(formData.image, assetBase);

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          image: payloadImage,
        }),
      });

      if (res.ok) {
        const responseData = await res.json().catch(() => null);

        // If we got the created/updated category back, add it to the list immediately
        if (responseData) {
          const newCategory: Category = {
            id: responseData.id ?? responseData.ID ?? Date.now(),
            name: responseData.name ?? responseData.Name ?? formData.name,
            description: (responseData.description ?? responseData.Description ?? formData.description) || undefined,
            image: resolveImageUrl(responseData.image ?? responseData.Image ?? formData.image, assetBase),
          };

          if (editingCategory) {
            // Update existing category in the list
            setCategories(prev => prev.map(c => c.id === editingCategory.id ? newCategory : c));
          } else {
            // Add new category to the list
            setCategories(prev => [...prev, newCategory]);
          }
        } else {
          // Fallback: refresh the entire list
          await fetchCategories();
        }

        setDialogOpen(false);
        setEditingCategory(null);
        setFormData({ name: '', description: '', image: '' });
        setImageError(null);
        clearPreview();
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Failed to save category' }));
        alert(errorData.error || `Failed to save category: ${res.status} ${res.statusText}`);
      }
    } catch (error: any) {
      console.error('Failed to save category:', error);
      alert(error.message || 'An error occurred while saving the category. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    const previewUrl = category.image ? resolveImageUrl(category.image, assetBase) || '' : '';
    setFormData({
      name: category.name || '',
      description: category.description || '',
      image: previewUrl || '',
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
    setEditingCategory(null);
    setFormData({ name: '', description: '', image: '' });
    setImageError(null);
    clearPreview();
    setIsDragging(false);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Category Management</h1>
          <p className="text-gray-600 mt-1">Manage event categories</p>
        </div>
        <Button onClick={openAddDialog} className="bg-yellow-400 hover:bg-yellow-500 text-blue-950 gap-2">
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {hasSelection && (
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 border border-yellow-200 rounded-lg bg-yellow-50">
              <div>
                <p className="text-sm font-semibold text-yellow-900">{selectedIds.length} categories selected</p>
                <p className="text-xs text-yellow-700">Apply quick bulk actions to streamline your workflow.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                  Clear
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="bg-red-600 hover:bg-red-500"
                >
                  {bulkDeleting ? (
                    <span className="inline-flex items-center gap-1 text-white">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Deleting...
                    </span>
                  ) : (
                    'Delete Selected'
                  )}
                </Button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">Loading categories...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <Grid className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No categories available. Add a category to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === categories.length && categories.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 accent-blue-600"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Image</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category, index) => (
                    <tr key={category.id ?? `category-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(category.id)}
                          onChange={() => toggleSelect(category.id)}
                          className="h-4 w-4 accent-blue-600"
                        />
                      </td>
                      <td className="py-3 px-4">
                        {category.image ? (
                          <img
                            src={category.image}
                            alt={category.name}
                            className="h-10 w-10 rounded object-cover border border-gray-200"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                            N/A
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {inlineEditId === category.id ? (
                          <Input
                            value={inlineForm.name}
                            onChange={(e) => setInlineForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="h-9"
                          />
                        ) : (
                          category.name || '-'
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {inlineEditId === category.id ? (
                          <Input
                            value={inlineForm.description}
                            onChange={(e) => setInlineForm((prev) => ({ ...prev, description: e.target.value }))}
                            className="h-9"
                          />
                        ) : (
                          category.description || '-'
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {inlineEditId === category.id ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-500 text-white"
                              disabled={inlineSaving}
                              onClick={saveInlineEdit}
                            >
                              {inlineSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={cancelInlineEdit}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => startInlineEdit(category)} className="gap-1">
                              <Edit className="h-3 w-3" />
                              Quick Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openEditDialog(category)} className="gap-1">
                              <Grid className="h-3 w-3" />
                              Modal Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDelete(category.id)} className="gap-1 text-red-600 hover:text-red-700">
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          </div>
                        )}
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
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader className="pb-4 border-b border-gray-200">
            <DialogTitle className="text-2xl font-bold text-gray-900">
              {editingCategory ? 'Edit Category' : 'Add Category'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Provide the category name, optional description, and image.
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
                placeholder="Enter category name"
                className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter category description (optional)"
                className="h-11 border-gray-300 focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 block">Image</label>
              {!imagePreview ? (
                <div
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${isDragging
                    ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                    : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
                  onClick={() => !isUploading && (document.getElementById('cat-image-input') as HTMLInputElement)?.click()}
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
                        setImageError('Unable to display the selected image.');
                      }}
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 rounded-lg flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => (document.getElementById('cat-image-input') as HTMLInputElement)?.click()}
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
              <input id="cat-image-input" type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
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
                    <Loader2 className="h-4 w-4 animate-spin" /> {editingCategory ? 'Updating...' : 'Creating...'}
                  </span>
                ) : (
                  editingCategory ? 'Update Category' : 'Create Category'
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
