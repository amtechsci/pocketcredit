import { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Users,
  Building2,
  List,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Link2,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApiService } from '../../services/adminApi';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../components/ui/table';

interface Partner {
  id: number;
  partner_uuid: string;
  client_id: string;
  name: string;
  category: string | null;
  activities: string | null;
  email: string | null;
  public_key_path: string | null;
  allowed_ips: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface PartnerLead {
  id: number;
  first_name: string;
  last_name: string;
  mobile_number: string;
  pan_number: string | null;
  dedupe_status: string;
  dedupe_code: number;
  lead_shared_at: string;
  loan_application_id: number | null;
  loan_status: string | null;
  disbursed_at: string | null;
  disbursal_amount: number | null;
  payout_eligible: number | null;
  payout_amount: number | null;
  payout_status: string | null;
  application_number: string | null;
}

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return '—';
  const s = String(dateString);
  const datePart = s.includes('T') ? s.split('T')[0] : s.split(' ')[0];
  const [y, m, d] = datePart.split('-');
  return [d, m, y].join('/');
};

/** Base URL for the main app (user-facing). Partners share links to this. */
const APP_BASE_URL = typeof window !== 'undefined' && (window as any).__APP_BASE_URL__
  ? (window as any).__APP_BASE_URL__
  : 'https://pocketcredit.in';

function buildPartnerUTMLink(partnerUuidOrClientId: string): string {
  const params = new URLSearchParams({
    utm_source: partnerUuidOrClientId,
    utm_medium: 'partner_api'
  });
  return `${APP_BASE_URL.replace(/\/$/, '')}?${params.toString()}`;
}

export function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewingLeadsPartner, setViewingLeadsPartner] = useState<Partner | null>(null);
  const [leads, setLeads] = useState<PartnerLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsPagination, setLeadsPagination] = useState({ total: 0, total_pages: 1, limit: 20 });

  const [addForm, setAddForm] = useState({
    client_id: '',
    client_secret: '',
    name: '',
    category: '',
    activities: '',
    email: '',
    public_key_path: '',
    public_key_pem: '',
    allowed_ips: ''
  });

  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    activities: '',
    email: '',
    public_key_path: '',
    public_key_pem: '',
    allowed_ips: '',
    is_active: true,
    client_secret: ''
  });

  const fetchPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminApiService.getPartners();
      if (response.status === 'success' && response.data?.partners) {
        setPartners(response.data.partners);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchLeads = async (partnerId: number, page: number = 1) => {
    try {
      setLeadsLoading(true);
      const response = await adminApiService.getPartnerLeads(partnerId, {
        page,
        limit: 20
      });
      if (response.status === 'success' && response.data) {
        setLeads(response.data.leads || []);
        setLeadsPagination({
          total: response.data.pagination?.total ?? 0,
          total_pages: response.data.pagination?.total_pages ?? 1,
          limit: response.data.pagination?.limit ?? 20
        });
        setLeadsPage(page);
      }
    } catch (err: any) {
      console.error('Failed to fetch partner leads:', err);
    } finally {
      setLeadsLoading(false);
    }
  };

  useEffect(() => {
    if (viewingLeadsPartner) {
      fetchLeads(viewingLeadsPartner.id, 1);
    } else {
      setLeads([]);
    }
  }, [viewingLeadsPartner?.id]);

  const handleOpenAdd = () => {
    setAddForm({
      client_id: '',
      client_secret: '',
      name: '',
      category: '',
      activities: '',
      email: '',
      public_key_path: '',
      public_key_pem: '',
      allowed_ips: ''
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (p: Partner) => {
    setEditingPartner(p);
    setEditForm({
      name: p.name,
      category: p.category || '',
      activities: p.activities || '',
      email: p.email || '',
      public_key_path: p.public_key_path || '',
      public_key_pem: '',
      allowed_ips: p.allowed_ips || '',
      is_active: !!p.is_active,
      client_secret: ''
    });
    setShowEditModal(true);
  };

  const handleCreatePartner = async () => {
    if (!addForm.client_id.trim() || !addForm.client_secret.trim() || !addForm.name.trim()) {
      return;
    }
    try {
      setSaving(true);
      await adminApiService.createPartner({
        client_id: addForm.client_id.trim(),
        client_secret: addForm.client_secret,
        name: addForm.name.trim(),
        category: addForm.category.trim() || undefined,
        activities: addForm.activities.trim() || undefined,
        email: addForm.email.trim() || undefined,
        public_key_path: addForm.public_key_pem.trim() ? undefined : (addForm.public_key_path.trim() || undefined),
        public_key_pem: addForm.public_key_pem.trim() || undefined,
        allowed_ips: addForm.allowed_ips.trim() || undefined
      });
      setShowAddModal(false);
      fetchPartners();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to create partner');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePartner = async () => {
    if (!editingPartner) return;
    try {
      setSaving(true);
      await adminApiService.updatePartner(editingPartner.id, {
        name: editForm.name.trim(),
        category: editForm.category.trim() || undefined,
        activities: editForm.activities.trim() || undefined,
        email: editForm.email.trim() || undefined,
        public_key_path: editForm.public_key_pem.trim() ? undefined : (editForm.public_key_path.trim() || undefined),
        public_key_pem: editForm.public_key_pem.trim() || undefined,
        allowed_ips: editForm.allowed_ips.trim() || undefined,
        is_active: editForm.is_active,
        ...(editForm.client_secret.trim() ? { client_secret: editForm.client_secret } : {})
      });
      setShowEditModal(false);
      setEditingPartner(null);
      fetchPartners();
      if (viewingLeadsPartner?.id === editingPartner.id) {
        setViewingLeadsPartner((prev) => (prev ? { ...prev, ...editForm, is_active: editForm.is_active ? 1 : 0 } : null));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update partner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Partner Manager</h1>
          <p className="text-sm text-gray-500 mt-1">Create, update partners and view their leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPartners()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleOpenAdd} style={{ backgroundColor: '#0052FF' }}>
            <Plus className="w-4 h-4 mr-1" />
            Add New Partner
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="w-5 h-5" />
            Partners
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : partners.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No partners yet. Click &quot;Add New Partner&quot; to create one.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Category / Activities</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.client_id}</TableCell>
                      <TableCell className="text-sm">
                        {p.category && <span>{p.category}</span>}
                        {p.category && p.activities && ' / '}
                        {p.activities && <span>{p.activities}</span>}
                        {!p.category && !p.activities && '—'}
                      </TableCell>
                      <TableCell>{p.email || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? 'default' : 'secondary'}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(p)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingLeadsPartner(viewingLeadsPartner?.id === p.id ? null : p)}
                          >
                            <Users className="w-4 h-4 mr-1" />
                            Leads
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {viewingLeadsPartner && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <List className="w-5 h-5" />
              Leads: {viewingLeadsPartner.name}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setViewingLeadsPartner(null)}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {leadsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : leads.length === 0 ? (
              <p className="text-gray-500 text-center py-6">No leads for this partner.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Lead shared</TableHead>
                        <TableHead>Loan / Disbursal</TableHead>
                        <TableHead>Payout</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>{[lead.first_name, lead.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                          <TableCell>{lead.mobile_number || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{lead.dedupe_status || lead.dedupe_code}</Badge>
                          </TableCell>
                          <TableCell>{formatDate(lead.lead_shared_at)}</TableCell>
                          <TableCell>
                            {lead.loan_application_id ? `PLL${lead.loan_application_id}` : (lead.application_number || '—')}
                            {lead.disbursal_amount != null && ` / ₹${lead.disbursal_amount}`}
                          </TableCell>
                          <TableCell>
                            {lead.payout_eligible ? `₹${lead.payout_amount ?? 0}` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {leadsPagination.total_pages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-500">
                      Total {leadsPagination.total} leads
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={leadsPage <= 1}
                        onClick={() => fetchLeads(viewingLeadsPartner.id, leadsPage - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={leadsPage >= leadsPagination.total_pages}
                        onClick={() => fetchLeads(viewingLeadsPartner.id, leadsPage + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Partner Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Partner</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="add-client_id">Client ID *</Label>
              <Input
                id="add-client_id"
                value={addForm.client_id}
                onChange={(e) => setAddForm((f) => ({ ...f, client_id: e.target.value }))}
                placeholder="e.g. PC_ABC123"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-client_secret">Client Secret *</Label>
              <Input
                id="add-client_secret"
                type="password"
                value={addForm.client_secret}
                onChange={(e) => setAddForm((f) => ({ ...f, client_secret: e.target.value }))}
                placeholder="Secret for API auth"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-name">Name *</Label>
              <Input
                id="add-name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Partner display name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-category">Category</Label>
              <Input
                id="add-category"
                value={addForm.category}
                onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Communication Service - Outbound Dialing"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-activities">Activities</Label>
              <Textarea
                id="add-activities"
                value={addForm.activities}
                onChange={(e) => setAddForm((f) => ({ ...f, activities: e.target.value }))}
                placeholder="e.g. Outbound Dialing, Customer Communication"
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="contact@partner.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-public_key_pem">Public key (PEM)</Label>
              <Textarea
                id="add-public_key_pem"
                value={addForm.public_key_pem}
                onChange={(e) => setAddForm((f) => ({ ...f, public_key_pem: e.target.value }))}
                placeholder="Paste -----BEGIN PUBLIC KEY----- ... -----END PUBLIC KEY----- here to add or update the key. Optional."
                rows={4}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-public_key_path">Or public key path (if not pasting PEM above)</Label>
              <Input
                id="add-public_key_path"
                value={addForm.public_key_path}
                onChange={(e) => setAddForm((f) => ({ ...f, public_key_path: e.target.value }))}
                placeholder="e.g. partner_keys/partners/PC_xxx_public.pem"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="add-allowed_ips">Allowed IPs (comma-separated)</Label>
              <Input
                id="add-allowed_ips"
                value={addForm.allowed_ips}
                onChange={(e) => setAddForm((f) => ({ ...f, allowed_ips: e.target.value }))}
                placeholder="1.2.3.4, 5.6.7.8"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button
              onClick={handleCreatePartner}
              disabled={saving || !addForm.client_id.trim() || !addForm.client_secret || !addForm.name.trim()}
              style={{ backgroundColor: '#0052FF' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Create Partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => { setShowEditModal(open); if (!open) setEditingPartner(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Partner</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {editingPartner && (
              <>
                <p className="text-xs text-gray-500 font-mono">Client ID: {editingPartner.client_id}</p>
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Partner display name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Input
                    id="edit-category"
                    value={editForm.category}
                    onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Communication Service"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-activities">Activities</Label>
                  <Textarea
                    id="edit-activities"
                    value={editForm.activities}
                    onChange={(e) => setEditForm((f) => ({ ...f, activities: e.target.value }))}
                    placeholder="e.g. Outbound Dialing, Customer Communication"
                    rows={2}
                  />
                </div>
                <div className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <Label className="flex items-center gap-1.5 text-gray-700">
                    <Link2 className="w-4 h-4" />
                    Share link (no API needed)
                  </Label>
                  <p className="text-xs text-gray-600">
                    Share this single link with users. When they open it and register or log in, they will be counted as this partner&apos;s lead.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={buildPartnerUTMLink(editingPartner.partner_uuid)}
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = buildPartnerUTMLink(editingPartner.partner_uuid);
                        navigator.clipboard.writeText(url);
                        toast.success('Link copied');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="contact@partner.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-public_key_pem">Public key (PEM) – paste to add or replace key</Label>
              <Textarea
                id="edit-public_key_pem"
                value={editForm.public_key_pem}
                onChange={(e) => setEditForm((f) => ({ ...f, public_key_pem: e.target.value }))}
                placeholder="Paste -----BEGIN PUBLIC KEY----- ... -----END PUBLIC KEY----- here to update the key. Leave blank to keep current."
                rows={4}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-public_key_path">Or public key path (if not pasting PEM above)</Label>
              <Input
                id="edit-public_key_path"
                value={editForm.public_key_path}
                onChange={(e) => setEditForm((f) => ({ ...f, public_key_path: e.target.value }))}
                placeholder="e.g. partner_keys/partners/PC_xxx_public.pem"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-allowed_ips">Allowed IPs (comma-separated)</Label>
              <Input
                id="edit-allowed_ips"
                value={editForm.allowed_ips}
                onChange={(e) => setEditForm((f) => ({ ...f, allowed_ips: e.target.value }))}
                placeholder="1.2.3.4, 5.6.7.8"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-client_secret">New client secret (leave blank to keep)</Label>
              <Input
                id="edit-client_secret"
                type="password"
                value={editForm.client_secret}
                onChange={(e) => setEditForm((f) => ({ ...f, client_secret: e.target.value }))}
                placeholder="Leave blank to keep current"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-is_active"
                checked={editForm.is_active}
                onCheckedChange={(v) => setEditForm((f) => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="edit-is_active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button
              onClick={handleUpdatePartner}
              disabled={saving || !editForm.name.trim()}
              style={{ backgroundColor: '#0052FF' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
