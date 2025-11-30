import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, MapPin, CheckCircle, Plus, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { apiService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface AddressOption {
  id: string;
  source: 'digilocker' | 'experian' | 'manual';
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  full_address?: string;
  label: string;
}

export const ResidenceAddressPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [residenceType, setResidenceType] = useState<'owned' | 'rented' | ''>('');
  const [loading, setLoading] = useState(true);
  const [addressOptions, setAddressOptions] = useState<AddressOption[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Manual entry form
  const [manualAddress, setManualAddress] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India'
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAvailableAddresses();
      
      if (response.success && response.data) {
        const addresses: AddressOption[] = [];
        
        // Add Digilocker address
        if (response.data.digilocker_address) {
          addresses.push({
            id: 'digilocker',
            source: 'digilocker',
            ...response.data.digilocker_address,
            label: 'Address from Digilocker'
          });
        }
        
        // Add Experian addresses
        if (response.data.experian_addresses && Array.isArray(response.data.experian_addresses)) {
          response.data.experian_addresses.forEach((addr: any, index: number) => {
            addresses.push({
              id: `experian_${index}`,
              source: 'experian',
              ...addr,
              label: `Address ${index + 1} from Experian`
            });
          });
        }
        
        setAddressOptions(addresses);
        
        // Auto-select if only one address
        if (addresses.length === 1) {
          setSelectedAddressId(addresses[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
      toast.error('Failed to fetch addresses');
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (address: AddressOption): string => {
    const parts: string[] = [];
    
    if (address.full_address) {
      return address.full_address;
    }
    
    if (address.address_line1) parts.push(address.address_line1);
    if (address.address_line2) parts.push(address.address_line2);
    if (address.city) parts.push(address.city);
    if (address.state) parts.push(address.state);
    if (address.pincode) parts.push(address.pincode);
    if (address.country && address.country !== 'India') parts.push(address.country);
    
    return parts.join(', ') || 'Address details not available';
  };

  const handleSelectAddress = (addressId: string) => {
    setSelectedAddressId(addressId);
    setShowManualEntry(false);
  };

  const handleManualEntry = () => {
    setShowManualEntry(true);
    setSelectedAddressId('manual');
  };

  const handleSubmit = async () => {
    // Validate residence type
    if (!residenceType) {
      toast.error('Please select your residence type');
      return;
    }

    // Validate address selection
    if (!selectedAddressId) {
      toast.error('Please select or enter your residence address');
      return;
    }

    // If manual entry, validate fields
    if (selectedAddressId === 'manual') {
      if (!manualAddress.address_line1 || !manualAddress.city || !manualAddress.state || !manualAddress.pincode) {
        toast.error('Please fill in all required address fields');
        return;
      }

      // Validate pincode
      if (!/^\d{6}$/.test(manualAddress.pincode)) {
        toast.error('Please enter a valid 6-digit pincode');
        return;
      }
    }

    try {
      setSubmitting(true);
      
      let addressData;
      if (selectedAddressId === 'manual') {
        addressData = {
          source: 'manual',
          ...manualAddress
        };
      } else {
        const selectedAddress = addressOptions.find(addr => addr.id === selectedAddressId);
        if (!selectedAddress) {
          toast.error('Selected address not found');
          return;
        }
        addressData = {
          source: selectedAddress.source,
          address_line1: selectedAddress.address_line1 || '',
          address_line2: selectedAddress.address_line2 || '',
          city: selectedAddress.city || '',
          state: selectedAddress.state || '',
          pincode: selectedAddress.pincode || '',
          country: selectedAddress.country || 'India',
          full_address: selectedAddress.full_address
        };
      }

      const response = await apiService.saveResidenceAddress({
        residence_type: residenceType,
        ...addressData
      });

      if (response.success) {
        toast.success('Residence address saved successfully!');
        setTimeout(() => {
          navigate('/application-under-review');
        }, 1500);
      } else {
        toast.error(response.message || 'Failed to save address');
      }
    } catch (error: any) {
      console.error('Error saving address:', error);
      toast.error(error.response?.data?.message || 'Failed to save address');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading addresses...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Residence Address</h1>
          <p className="text-gray-600">Select your residence type and address</p>
        </div>

        {/* Residence Type Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Home className="w-5 h-5 text-blue-600" />
              Residence Type
              <span className="text-red-500 text-base">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50"
                style={{
                  borderColor: residenceType === 'owned' ? '#3b82f6' : '#e5e7eb',
                  backgroundColor: residenceType === 'owned' ? '#eff6ff' : 'white'
                }}
              >
                <input
                  type="radio"
                  name="residenceType"
                  value="owned"
                  checked={residenceType === 'owned'}
                  onChange={(e) => setResidenceType(e.target.value as 'owned')}
                  className="w-5 h-5 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Owned</div>
                </div>
                {residenceType === 'owned' && (
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                )}
              </label>

              <label className="flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50"
                style={{
                  borderColor: residenceType === 'rented' ? '#3b82f6' : '#e5e7eb',
                  backgroundColor: residenceType === 'rented' ? '#eff6ff' : 'white'
                }}
              >
                <input
                  type="radio"
                  name="residenceType"
                  value="rented"
                  checked={residenceType === 'rented'}
                  onChange={(e) => setResidenceType(e.target.value as 'rented')}
                  className="w-5 h-5 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Rented</div>
                </div>
                {residenceType === 'rented' && (
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                )}
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Address Selection */}
        {residenceType && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Select Your Residence Address
                <span className="text-red-500 text-base">*</span>
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Select one of the addresses below or enter manually
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Available Addresses */}
              {addressOptions.length > 0 && (
                <div className="space-y-3">
                  {addressOptions.map((address) => (
                    <div
                      key={address.id}
                      onClick={() => handleSelectAddress(address.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedAddressId === address.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className={`w-4 h-4 ${selectedAddressId === address.id ? 'text-blue-600' : 'text-gray-400'}`} />
                            <span className="text-xs font-medium text-gray-500 uppercase">
                              {address.label}
                            </span>
                            {selectedAddressId === address.id && (
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                            )}
                          </div>
                          <p className="text-sm text-gray-700">
                            {formatAddress(address)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual Entry Option */}
              <div
                onClick={handleManualEntry}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedAddressId === 'manual'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Plus className={`w-4 h-4 ${selectedAddressId === 'manual' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="font-medium text-gray-900">Enter full residence address manually</span>
                  {selectedAddressId === 'manual' && (
                    <CheckCircle className="w-4 h-4 text-blue-600 ml-auto" />
                  )}
                </div>
              </div>

              {/* Manual Entry Form */}
              {showManualEntry && selectedAddressId === 'manual' && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                  <div>
                    <Label htmlFor="address_line1">Address Line 1 *</Label>
                    <Input
                      id="address_line1"
                      value={manualAddress.address_line1}
                      onChange={(e) => setManualAddress({ ...manualAddress, address_line1: e.target.value })}
                      placeholder="Enter address line 1"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address_line2">Address Line 2</Label>
                    <Input
                      id="address_line2"
                      value={manualAddress.address_line2}
                      onChange={(e) => setManualAddress({ ...manualAddress, address_line2: e.target.value })}
                      placeholder="Enter address line 2 (optional)"
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={manualAddress.city}
                        onChange={(e) => setManualAddress({ ...manualAddress, city: e.target.value })}
                        placeholder="Enter city"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        value={manualAddress.state}
                        onChange={(e) => setManualAddress({ ...manualAddress, state: e.target.value })}
                        placeholder="Enter state"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="pincode">Pin Code *</Label>
                    <Input
                      id="pincode"
                      value={manualAddress.pincode}
                      onChange={(e) => setManualAddress({ ...manualAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="Enter 6-digit pincode"
                      className="mt-1"
                      maxLength={6}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        {residenceType && selectedAddressId && (
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
            >
              Skip for now
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 min-w-[120px]"
            >
              {submitting ? 'Saving...' : 'Submit'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResidenceAddressPage;

