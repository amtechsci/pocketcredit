import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DashboardHeader } from '../DashboardHeader';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from 'sonner';

interface ReferenceData {
  name: string;
  phone: string;
  relation: string;
}

interface ExistingReference {
  id: number;
  user_id: number;
  name: string;
  phone: string;
  relation: string;
  status: string;
  admin_id: number | null;
  created_at: string;
  updated_at: string;
}

const RELATION_OPTIONS = [
  'Family',
  'Friend',
  'Colleague',
  'Relative',
  'Neighbor'
];

export function UserReferencesPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingReferences, setExistingReferences] = useState<ExistingReference[]>([]);
  const [references, setReferences] = useState<ReferenceData[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadUserReferences();
  }, [isAuthenticated, navigate]);

  const loadUserReferences = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUserReferences();
      
      if (response.success && response.data) {
        setExistingReferences(response.data);
        // Convert existing references to form format
        const formReferences = response.data.map(ref => ({
          name: ref.name,
          phone: ref.phone,
          relation: ref.relation
        }));
        setReferences(formReferences);
      } else {
        // Initialize with empty references if none exist
        setReferences([
          { name: '', phone: '', relation: 'Family' },
          { name: '', phone: '', relation: 'Family' },
          { name: '', phone: '', relation: 'Friend' }
        ]);
      }
    } catch (error) {
      console.error('Error loading user references:', error);
      toast.error('Failed to load references');
      // Initialize with empty references on error
      setReferences([
        { name: '', phone: '', relation: 'Family' },
        { name: '', phone: '', relation: 'Family' },
        { name: '', phone: '', relation: 'Friend' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReferenceChange = (index: number, field: keyof ReferenceData, value: string) => {
    const updatedReferences = [...references];
    updatedReferences[index] = {
      ...updatedReferences[index],
      [field]: value
    };
    setReferences(updatedReferences);
  };

  const addReference = () => {
    if (references.length < 3) {
      setReferences([...references, { name: '', phone: '', relation: 'Family' }]);
    }
  };

  const removeReference = (index: number) => {
    if (references.length > 1) {
      const updatedReferences = references.filter((_, i) => i !== index);
      setReferences(updatedReferences);
    }
  };

  const validateReferences = () => {
    const validReferences = references.filter(ref => 
      ref.name.trim() && ref.phone.trim() && ref.relation.trim()
    );

    if (validReferences.length === 0) {
      toast.error('Please add at least one reference');
      return false;
    }

    if (validReferences.length > 3) {
      toast.error('Maximum 3 references allowed');
      return false;
    }

    // Validate phone numbers
    const phoneRegex = /^[6-9]\d{9}$/;
    for (const ref of validReferences) {
      if (!phoneRegex.test(ref.phone)) {
        toast.error(`Invalid phone number: ${ref.phone}`);
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateReferences()) return;

    try {
      setSaving(true);
      
      const validReferences = references.filter(ref => 
        ref.name.trim() && ref.phone.trim() && ref.relation.trim()
      );

      const response = await apiService.saveUserReferences(validReferences);
      
      if (response.success) {
        toast.success('References saved successfully!');
        await loadUserReferences(); // Reload to get updated data
        navigate('/dashboard');
      } else {
        toast.error(response.message || 'Failed to save references');
      }
    } catch (error) {
      console.error('Error saving references:', error);
      toast.error('Failed to save references');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    loadUserReferences(); // Reload to reset changes
  };

  const handleUpdateReference = async (index: number) => {
    const ref = references[index];
    if (!ref.name.trim() || !ref.phone.trim() || !ref.relation.trim()) {
      toast.error('Please fill all fields');
      return;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(ref.phone)) {
      toast.error('Invalid phone number format');
      return;
    }

    try {
      setSaving(true);
      const existingRef = existingReferences[index];
      if (existingRef) {
        const response = await apiService.updateUserReference(existingRef.id, {
          name: ref.name,
          phone: ref.phone,
          relation: ref.relation
        });
        
        if (response.success) {
          toast.success('Reference updated successfully!');
          setEditingIndex(null);
          await loadUserReferences();
        } else {
          toast.error(response.message || 'Failed to update reference');
        }
      }
    } catch (error) {
      console.error('Error updating reference:', error);
      toast.error('Failed to update reference');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReference = async (index: number) => {
    const existingRef = existingReferences[index];
    if (!existingRef) return;

    if (!confirm('Are you sure you want to delete this reference?')) return;

    try {
      setSaving(true);
      const response = await apiService.deleteUserReference(existingRef.id);
      
      if (response.success) {
        toast.success('Reference deleted successfully!');
        await loadUserReferences();
      } else {
        toast.error(response.message || 'Failed to delete reference');
      }
    } catch (error) {
      console.error('Error deleting reference:', error);
      toast.error('Failed to delete reference');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading references...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reference Details</h1>
            <p className="text-gray-600">Add up to 3 personal references for your loan applications</p>
          </div>
        </div>

        {/* References Form */}
        <div className="max-w-4xl mx-auto space-y-6">
          {references.map((reference, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Reference {index + 1}</h3>
                <div className="flex items-center gap-2">
                  {editingIndex === index ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateReference(index)}
                        disabled={saving}
                        className="flex items-center gap-1"
                      >
                        <Check className="w-4 h-4" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={saving}
                        className="flex items-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(index)}
                        className="flex items-center gap-1"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                      {references.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteReference(index)}
                          disabled={saving}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor={`name-${index}`}>Full Name</Label>
                  <Input
                    id={`name-${index}`}
                    value={reference.name}
                    onChange={(e) => handleReferenceChange(index, 'name', e.target.value)}
                    placeholder="Enter full name"
                    disabled={editingIndex !== null && editingIndex !== index}
                  />
                </div>
                
                <div>
                  <Label htmlFor={`phone-${index}`}>Phone Number</Label>
                  <Input
                    id={`phone-${index}`}
                    value={reference.phone}
                    onChange={(e) => handleReferenceChange(index, 'phone', e.target.value)}
                    placeholder="10-digit mobile number"
                    disabled={editingIndex !== null && editingIndex !== index}
                  />
                </div>
                
                <div>
                  <Label htmlFor={`relation-${index}`}>Relationship</Label>
                  <Select
                    value={reference.relation}
                    onValueChange={(value) => handleReferenceChange(index, 'relation', value)}
                    disabled={editingIndex !== null && editingIndex !== index}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATION_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          ))}

          {/* Add Reference Button */}
          {references.length < 3 && (
            <Button
              onClick={addReference}
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Reference ({references.length}/3)
            </Button>
          )}

          {/* Save Button */}
          <div className="flex justify-end gap-4 pt-6">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save References
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
