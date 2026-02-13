import { useState, useEffect } from 'react';
import { Users, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { apiService } from '../../services/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';

interface ServicePartner {
  id: number;
  name: string;
  category: string | null;
  activities: string | null;
  status: string;
}

export function PartnersPage() {
  const [partners, setPartners] = useState<ServicePartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        setLoading(true);
        const response = await apiService.getPartnersForDisplay();
        if (response.status === 'success' && response.data) {
          setPartners(response.data);
        }
      } catch (error) {
        console.error('Error fetching partners:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPartners();
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F4F8' }}>
      {/* Hero Section */}
      <section className="py-16 px-4" style={{ backgroundColor: '#1E2A3B' }}>
        <div className="max-w-6xl mx-auto text-center">
          <Users className="w-16 h-16 mx-auto mb-6 text-white" />
          <h1 className="text-4xl md:text-5xl mb-6 text-white">
            Our Partners & Service Providers
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Strategic partnerships with leading service providers to enhance our lending platform capabilities
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Company Information */}
          <div className="text-center mb-12">
            <h2 className="text-3xl mb-4" style={{ color: '#1E2A3B' }}>
              Spheeti Fintech Private Limited
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              List of Third-Party Service Providers (LSPs) engaged for various operational activities
            </p>
            <div className="max-w-2xl mx-auto p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Corporate Address:</strong> Mahadev Compound Gala No. A7, Dhobi Ghat Road, Ulhasnagar MUMBAI MAHARASHTRA , MUMBAI, Maharashtra, India - 421001
              </p>
            </div>
          </div>

          {/* Partners Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                </div>
              ) : partners.length === 0 ? (
                <p className="text-center text-gray-500 py-12">No partners to display.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20 font-semibold" style={{ color: '#1E2A3B' }}>S.No</TableHead>
                        <TableHead className="font-semibold" style={{ color: '#1E2A3B' }}>Name of Partners</TableHead>
                        <TableHead className="font-semibold" style={{ color: '#1E2A3B' }}>Category / Activities</TableHead>
                        <TableHead className="w-28 font-semibold" style={{ color: '#1E2A3B' }}>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partners.map((partner, index) => (
                        <TableRow key={partner.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-medium">{partner.name}</TableCell>
                          <TableCell>
                            <span className="text-gray-700">
                              {partner.category && <span>{partner.category}</span>}
                              {partner.category && partner.activities && ' / '}
                              {partner.activities && <span>{partner.activities}</span>}
                              {!partner.category && !partner.activities && '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={partner.status === 'Active' ? 'default' : 'secondary'}
                              className={partner.status === 'Active' ? 'bg-green-100 text-green-800' : ''}
                            >
                              {partner.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
