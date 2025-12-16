import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, MapPin, CheckCircle, Plus, AlertCircle, ArrowLeft } from 'lucide-react';
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
  const { user, refreshUser } = useAuth();
  
  const [residenceType, setResidenceType] = useState<'owned' | 'rented' | ''>('');
  const [loading, setLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(true);
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
    checkCompletionAndFetch();
  }, [user?.id, refreshUser, navigate]);

  const checkCompletionAndFetch = async () => {
    if (!user?.id) {
      setCheckingStatus(false);
      setLoading(false);
      return;
    }

    try {
      // Fetch latest user profile to check residence_type
      const profileResponse = await apiService.getUserProfile();
      const latestUser = profileResponse.status === 'success' && profileResponse.data?.user 
        ? profileResponse.data.user 
        : user;

      console.log('🔍 Checking residence_type:', latestUser?.residence_type);
      console.log('🔍 Full user object:', JSON.stringify(latestUser, null, 2));

      // Check if residence_type is already set (indicates completion)
      if (latestUser?.residence_type && (latestUser.residence_type === 'owned' || latestUser.residence_type === 'rented')) {
        console.log('✅ Residence address already completed, redirecting to additional information');
        navigate('/additional-information', { replace: true });
        return;
      }

      console.log('⚠️ Residence type not set, showing form');

      // If not completed, continue with normal flow
      setCheckingStatus(false);
      await fetchAddresses();
    } catch (error) {
      console.error('Error checking residence status:', error);
      setCheckingStatus(false);
      await fetchAddresses();
    }
  };

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAvailableAddresses();
      
      if (response.success && response.data) {
        console.log('📋 Received address data:', response.data);
        const addresses: AddressOption[] = [];
        
        // Add Digilocker address
        if (response.data.digilocker_address) {
          const digilockerAddr = {
            id: response.data.digilocker_address.id || 'digilocker',
            source: response.data.digilocker_address.source || 'digilocker',
            ...response.data.digilocker_address,
            label: response.data.digilocker_address.label || 'Address from Digilocker'
          };
          console.log('📋 Digilocker address:', digilockerAddr);
          addresses.push(digilockerAddr);
        }
        
        // Add Experian addresses (includes addresses from pan_api and other sources)
        if (response.data.experian_addresses && Array.isArray(response.data.experian_addresses)) {
          response.data.experian_addresses.forEach((addr: any, index: number) => {
            const addrOption = {
              id: addr.id || `experian_${index}`,
              source: addr.source || 'experian',
              ...addr,
              label: addr.label || `Address ${index + 1} from ${addr.source === 'pan_api' ? 'PAN API' : (addr.source || 'Experian')}`
            };
            console.log(`📋 Address ${index + 1} (${addrOption.source}):`, addrOption);
            addresses.push(addrOption);
          });
        }
        
        console.log('📋 All formatted addresses:', addresses);
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

  const formatAddressDetailed = (address: AddressOption) => {
    // Build complete address from all available fields
    const addressParts: string[] = [];
    
    if (address.address_line1) addressParts.push(address.address_line1);
    if (address.address_line2) addressParts.push(address.address_line2);
    
    const cityStatePincode = [address.city, address.state, address.pincode].filter(Boolean);
    if (cityStatePincode.length > 0) {
      addressParts.push(cityStatePincode.join(', '));
    }
    
    if (address.country && address.country !== 'India') {
      addressParts.push(address.country);
    }
    
    const completeAddress = addressParts.join(', ');
    
    // Show full_address if available, otherwise show constructed address
    const displayAddress = address.full_address || completeAddress || 'Address details not available';
    
    return (
      <div className="space-y-1">
        {address.full_address ? (
          // If full_address exists, show it (may contain line breaks)
          <p className="text-xs md:text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {address.full_address}
          </p>
        ) : (
          // Otherwise, show individual fields in structured format
          <>
            {address.address_line1 && (
              <p className="text-xs md:text-sm text-gray-700">{address.address_line1}</p>
            )}
            {address.address_line2 && (
              <p className="text-xs md:text-sm text-gray-700">{address.address_line2}</p>
            )}
            {(address.city || address.state || address.pincode) && (
              <p className="text-xs md:text-sm text-gray-700">
                {[address.city, address.state, address.pincode].filter(Boolean).join(', ')}
                {address.country && address.country !== 'India' && `, ${address.country}`}
              </p>
            )}
            {!address.address_line1 && !address.address_line2 && !address.city && !address.state && !address.pincode && (
              <p className="text-xs md:text-sm text-gray-500 italic">Address details not available</p>
            )}
          </>
        )}
      </div>
    );
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
        // Refresh user context to update residence_type
        await refreshUser();
        setTimeout(() => {
          navigate('/additional-information');
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

  // Show loading while checking completion status
  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full">
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking status...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gray-50 pb-24 overflow-y-auto">
      {/* Header with Back Button */}
      <div className="bg-white border-b sticky top-0 z-10 mb-4 md:mb-6">
        <div className="max-w-3xl mx-auto px-4 py-3 md:py-4 flex items-center gap-3">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg md:text-2xl font-bold text-gray-900">Residence Address</h1>
            <p className="text-gray-600 text-xs md:text-sm mt-1">Select your residence type and address</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4">

        {/* Residence Type Selection */}
        <Card className="mb-4 md:mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base md:text-xl flex items-center gap-2 flex-wrap">
              <Home className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
              Residence Type
              <span className="text-red-500 text-sm md:text-base">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 md:space-y-3">
              <label className="flex items-center gap-2 md:gap-3 p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50"
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
                  className="w-4 h-4 md:w-5 md:h-5 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 text-sm md:text-base">Owned</div>
                </div>
                {residenceType === 'owned' && (
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                )}
              </label>

              <label className="flex items-center gap-2 md:gap-3 p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-blue-500 hover:bg-blue-50"
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
                  className="w-4 h-4 md:w-5 md:h-5 text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 text-sm md:text-base">Rented</div>
                </div>
                {residenceType === 'rented' && (
                  <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                )}
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Address Selection */}
        {residenceType && (
          <Card className="mb-4 md:mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base md:text-xl flex items-center gap-2 flex-wrap">
                <MapPin className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                Select Your Residence Address
                <span className="text-red-500 text-sm md:text-base">*</span>
              </CardTitle>
              <p className="text-xs md:text-sm text-gray-600 mt-1">
                Select one of the addresses below or enter manually
              </p>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 pt-0">
              {/* Available Addresses */}
              {addressOptions.length > 0 && (
                <div className="space-y-2 md:space-y-3">
                  {addressOptions.map((address) => (
                    <div
                      key={address.id}
                      onClick={() => handleSelectAddress(address.id)}
                      className={`p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedAddressId === address.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 md:mb-3 flex-wrap">
                            <MapPin className={`w-3 h-3 md:w-4 md:h-4 ${selectedAddressId === address.id ? 'text-blue-600' : 'text-gray-400'}`} />
                            <span className="text-xs font-medium text-gray-500 uppercase">
                              {address.label}
                            </span>
                            {selectedAddressId === address.id && (
                              <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-blue-600" />
                            )}
                          </div>
                          {formatAddressDetailed(address)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Manual Entry Option */}
              <div
                onClick={handleManualEntry}
                className={`p-3 md:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedAddressId === 'manual'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Plus className={`w-3 h-3 md:w-4 md:h-4 ${selectedAddressId === 'manual' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span className="font-medium text-gray-900 text-sm md:text-base">Enter full residence address manually</span>
                  {selectedAddressId === 'manual' && (
                    <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-blue-600 ml-auto" />
                  )}
                </div>
              </div>

              {/* Manual Entry Form */}
              {showManualEntry && selectedAddressId === 'manual' && (
                <div className="mt-3 md:mt-4 p-3 md:p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3 md:space-y-4">
                  <div>
                    <Label htmlFor="address_line1" className="text-sm md:text-base">Address Line 1 *</Label>
                    <Input
                      id="address_line1"
                      value={manualAddress.address_line1}
                      onChange={(e) => setManualAddress({ ...manualAddress, address_line1: e.target.value })}
                      placeholder="Enter address line 1"
                      className="mt-1 text-sm md:text-base"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address_line2" className="text-sm md:text-base">Address Line 2</Label>
                    <Input
                      id="address_line2"
                      value={manualAddress.address_line2}
                      onChange={(e) => setManualAddress({ ...manualAddress, address_line2: e.target.value })}
                      placeholder="Enter address line 2 (optional)"
                      className="mt-1 text-sm md:text-base"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <Label htmlFor="city" className="text-sm md:text-base">City *</Label>
                      <Input
                        id="city"
                        value={manualAddress.city}
                        onChange={(e) => setManualAddress({ ...manualAddress, city: e.target.value })}
                        placeholder="Enter city"
                        className="mt-1 text-sm md:text-base"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state" className="text-sm md:text-base">State *</Label>
                      <Input
                        id="state"
                        value={manualAddress.state}
                        onChange={(e) => setManualAddress({ ...manualAddress, state: e.target.value })}
                        placeholder="Enter state"
                        className="mt-1 text-sm md:text-base"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="pincode" className="text-sm md:text-base">Pin Code *</Label>
                    <Input
                      id="pincode"
                      value={manualAddress.pincode}
                      onChange={(e) => setManualAddress({ ...manualAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="Enter 6-digit pincode"
                      className="mt-1 text-sm md:text-base"
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
          <div className="flex justify-end gap-3 md:gap-4 mt-4 md:mt-6 sticky bottom-0 bg-gray-50 pt-4 pb-4 -mx-4 px-4 md:mx-0 md:px-0 md:static">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 min-w-[120px] w-full sm:w-auto"
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

