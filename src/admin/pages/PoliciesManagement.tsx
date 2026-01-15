import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, FileText, Upload, Shield } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { adminApiService } from '../../services/adminApi';
import { toast } from 'sonner';

interface Policy {
  id: number;
  policy_name: string;
  policy_slug: string;
  pdf_url: string | null;
  pdf_filename: string | null;
  is_active: number;
  is_system_policy?: number | boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface PoliciesManagementProps {
  hideHeader?: boolean;
}

export function PoliciesManagement({ hideHeader = false }: PoliciesManagementProps = {}) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [formData, setFormData] = useState({
    policy_name: '',
    policy_slug: '',
    display_order: 0,
    is_active: 1
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const response = await adminApiService.getPolicies();
      if (response.status === 'success' && response.data) {
        setPolicies(response.data);
      }
    } catch (error) {
      console.error('Error fetching policies:', error);
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.policy_name || !formData.policy_slug) {
      toast.error('Policy name and slug are required');
      return;
    }

    try {
      setSubmitting(true);
      const formDataToSend = new FormData();
      formDataToSend.append('policy_name', formData.policy_name);
      formDataToSend.append('policy_slug', formData.policy_slug);
      formDataToSend.append('display_order', formData.display_order.toString());
      formDataToSend.append('is_active', formData.is_active.toString());
      
      if (selectedFile) {
        formDataToSend.append('pdf', selectedFile);
      }

      let response;
      if (editingPolicy) {
        response = await adminApiService.updatePolicy(editingPolicy.id, formDataToSend);
      } else {
        response = await adminApiService.createPolicy(formDataToSend);
      }

      if (response.status === 'success') {
        toast.success(editingPolicy ? 'Policy updated successfully' : 'Policy created successfully');
        setShowAddModal(false);
        setEditingPolicy(null);
        resetForm();
        fetchPolicies();
      } else {
        toast.error(response.message || 'Failed to save policy');
      }
    } catch (error: any) {
      console.error('Error saving policy:', error);
      toast.error(error.response?.data?.message || 'Failed to save policy');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (policy: Policy) => {
    setEditingPolicy(policy);
    setFormData({
      policy_name: policy.policy_name,
      policy_slug: policy.policy_slug,
      display_order: policy.display_order,
      is_active: policy.is_active
    });
    setSelectedFile(null);
    setShowAddModal(true);
  };

  const handleDelete = async (id: number) => {
    const policy = policies.find(p => p.id === id);
    
    // Frontend guard: Prevent deletion of system policies
    if (policy && (policy.is_system_policy === 1 || policy.is_system_policy === true)) {
      toast.error('System policies cannot be deleted. You can only update the PDF file or toggle active status.');
      return;
    }

    if (!confirm('Are you sure you want to delete this policy?')) {
      return;
    }

    try {
      const response = await adminApiService.deletePolicy(id);
      if (response.status === 'success') {
        toast.success('Policy deleted successfully');
        fetchPolicies();
      } else {
        if (response.message?.includes('System policies cannot be deleted')) {
          toast.error('System policies cannot be deleted. You can only update the PDF file or toggle active status.');
        } else {
          toast.error(response.message || 'Failed to delete policy');
        }
      }
    } catch (error: any) {
      console.error('Error deleting policy:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete policy';
      if (errorMessage.includes('System policies cannot be deleted') || error.response?.data?.code === 'SYSTEM_POLICY_PROTECTED') {
        toast.error('System policies cannot be deleted. You can only update the PDF file or toggle active status.');
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      policy_name: '',
      policy_slug: '',
      display_order: 0,
      is_active: 1
    });
    setSelectedFile(null);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Render policies list (common content)
  const renderPoliciesList = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading policies...</p>
        </div>
      );
    }

    return (
      <div className="grid gap-4">
        {policies.map((policy) => (
          <Card key={policy.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-lg">{policy.policy_name}</h3>
                      <p className="text-sm text-gray-600">Slug: {policy.policy_slug}</p>
                      {policy.pdf_url && (
                        <a
                          href={policy.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          View PDF
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {policy.is_system_policy && (
                    <span 
                      className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 flex items-center gap-1"
                      title="This is a system policy and cannot be deleted. You can only update the PDF or toggle active status."
                    >
                      <Shield className="w-3 h-3" />
                      System Policy
                    </span>
                  )}
                  <span className={`px-3 py-1 rounded-full text-sm ${policy.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {policy.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(policy)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  {!(policy.is_system_policy === 1 || policy.is_system_policy === true) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(policy.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className={hideHeader ? '' : 'p-6'}>
      {hideHeader ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Policies Management</h2>
              <p className="text-sm text-gray-600 mt-1">Manage website policies and upload PDFs</p>
            </div>
            <Button
              onClick={() => {
                setEditingPolicy(null);
                resetForm();
                setShowAddModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Policy
            </Button>
          </div>
          {renderPoliciesList()}
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Policies Management</h1>
              <p className="text-gray-600 mt-1">Manage website policies and upload PDFs</p>
            </div>
            <Button
              onClick={() => {
                setEditingPolicy(null);
                resetForm();
                setShowAddModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Policy
            </Button>
          </div>
          {renderPoliciesList()}
        </>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>{editingPolicy ? 'Edit Policy' : 'Add New Policy'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="policy_name">Policy Name *</Label>
                  <Input
                    id="policy_name"
                    value={formData.policy_name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData({
                        ...formData,
                        policy_name: name,
                        policy_slug: generateSlug(name)
                      });
                    }}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="policy_slug">Policy Slug *</Label>
                  <Input
                    id="policy_slug"
                    value={formData.policy_slug}
                    onChange={(e) => setFormData({ ...formData, policy_slug: e.target.value })}
                    required
                  />
                  <p className="text-sm text-gray-600 mt-1">URL-friendly identifier (auto-generated from name)</p>
                </div>

                <div>
                  <Label htmlFor="display_order">Display Order</Label>
                  <Input
                    id="display_order"
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active === 1}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <div>
                  <Label htmlFor="pdf">Upload PDF</Label>
                  <div className="mt-2">
                    <input
                      type="file"
                      id="pdf"
                      accept=".pdf"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100"
                    />
                    {editingPolicy?.pdf_url && !selectedFile && (
                      <p className="text-sm text-gray-600 mt-2">
                        Current file: {editingPolicy.pdf_filename || 'Uploaded'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingPolicy(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {submitting ? 'Saving...' : editingPolicy ? 'Update Policy' : 'Create Policy'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

