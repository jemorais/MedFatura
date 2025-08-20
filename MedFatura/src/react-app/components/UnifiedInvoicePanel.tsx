import { useState, useEffect } from 'react';
import { FileText, Calendar, Filter, Upload, DollarSign, XCircle, User, Eye } from 'lucide-react';
import { downloadInvoice } from '@/react-app/utils/downloadUtils';

interface Invoice {
  id: number;
  month: number;
  year: number;
  original_filename: string;
  stored_filename?: string;
  status: 'recebido' | 'pendente';
  created_at: string;
  user_id: string;
  type: 'direct'; // Faturas enviadas diretamente
}

interface PendingPayment {
  id: number;
  user_id: number;
  admin_id: number;
  amount: number;
  description: string;
  month: number;
  year: number;
  status: 'pending' | 'sent' | 'confirmed';
  notes?: string;
  invoice_filename?: string;
  invoice_stored_filename?: string;
  invoice_file_size?: number;
  created_at: string;
  sent_at?: string;
  confirmed_at?: string;
  user_name?: string;
  user_email?: string;
  admin_name?: string;
  type: 'pending'; // Notas fiscais via pendências
}

type UnifiedInvoiceItem = Invoice | PendingPayment;

interface UserProfile {
  id: number;
  name: string;
  user_type: 'medico' | 'admin' | 'prestador';
  cpf_crm: string;
  is_active: boolean;
  user_id: string;
  created_at: string;
}

interface UnifiedInvoicePanelProps {
  userProfile: UserProfile;
  users: any[];
  onDataChange?: () => void; // Callback para notificar mudanças nos dados
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function UnifiedInvoicePanel({ userProfile, users, onDataChange }: UnifiedInvoicePanelProps) {
  const [items, setItems] = useState<UnifiedInvoiceItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<UnifiedInvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'recebido' | 'pendente' | 'sent'>('all');
  const [monthFilter, setMonthFilter] = useState<number | 'all'>('all');

  const [showFilters, setShowFilters] = useState(false);
  
  // Estados para criação de cobrança
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Estados para upload de nota fiscal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPendingId, setSelectedPendingId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Estados para modal de detalhes
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<UnifiedInvoiceItem | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [items, searchTerm, statusFilter, monthFilter]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      // Carregar faturas diretas
      const invoicesResponse = await fetch('/api/invoices', {
        credentials: 'include'
      });
      
      // Carregar pendências financeiras
      const pendingResponse = await fetch('/api/pending-payments', {
        credentials: 'include'
      });
      
      const allItems: UnifiedInvoiceItem[] = [];
      
      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        const invoices = (invoicesData.invoices || []).map((invoice: Invoice) => ({
          ...invoice,
          type: 'direct' as const
        }));
        allItems.push(...invoices);
      }
      
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        const pendingPayments = (pendingData.pending_payments || []).map((payment: PendingPayment) => ({
          ...payment,
          type: 'pending' as const
        }));
        allItems.push(...pendingPayments);
      }
      
      // Ordenar por data de criação (mais recentes primeiro)
      allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setItems(allItems);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...items];

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(item => {
        const searchLower = searchTerm.toLowerCase();
        
        if (item.type === 'direct') {
          const invoice = item as Invoice;
          return (
            (invoice.original_filename || '').toLowerCase().includes(searchLower) ||
            (invoice.stored_filename || '').toLowerCase().includes(searchLower) ||
            MONTH_NAMES[invoice.month - 1].toLowerCase().includes(searchLower) ||
            invoice.year.toString().includes(searchLower)
          );
        } else {
          const payment = item as PendingPayment;
          return (
            (payment.description || '').toLowerCase().includes(searchLower) ||
            (payment.user_name || '').toLowerCase().includes(searchLower) ||
            (payment.invoice_filename || '').toLowerCase().includes(searchLower) ||
            MONTH_NAMES[payment.month - 1].toLowerCase().includes(searchLower) ||
            payment.year.toString().includes(searchLower)
          );
        }
      });
    }

    // Filtro de status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => {
        if (item.type === 'direct') {
          return (item as Invoice).status === statusFilter;
        } else {
          return (item as PendingPayment).status === statusFilter;
        }
      });
    }

    // Filtro de mês
    if (monthFilter !== 'all') {
      filtered = filtered.filter(item => item.month === monthFilter);
    }

    setFilteredItems(filtered);
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleStatusFilter = (status: 'all' | 'recebido' | 'pendente' | 'sent') => {
    setStatusFilter(status);
  };

  const handleMonthFilter = (month: number | 'all') => {
    setMonthFilter(month);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setMonthFilter('all');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getMonthName = (month: number) => {
    return MONTH_NAMES[month - 1] || 'Mês inválido';
  };

  const handleDownload = async (item: UnifiedInvoiceItem) => {
    try {
      if (item.type === 'direct') {
        const invoice = item as Invoice;
        await downloadInvoice(invoice.id, invoice.stored_filename || invoice.original_filename);
      } else {
        const payment = item as PendingPayment;
        if (payment.invoice_stored_filename) {
          const response = await fetch(`/api/pending-payments/${payment.id}/download`, {
            credentials: 'include'
          });
          
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = payment.invoice_filename || 'nota-fiscal.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
          } else {
            throw new Error('Erro ao baixar arquivo');
          }
        }
      }
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      alert('Erro ao fazer download do arquivo');
    }
  };

  const getStatusLabel = (item: UnifiedInvoiceItem) => {
    if (item.type === 'direct') {
      const invoice = item as Invoice;
      return invoice.status === 'recebido' ? 'Recebido' : 'Pendente';
    } else {
      const payment = item as PendingPayment;
      if (userProfile.user_type === 'admin') {
        if (payment.status === 'confirmed') return 'Confirmado';
        return payment.status === 'sent' ? 'Recebido' : 'Pendente';
      } else {
        if (payment.status === 'confirmed') return 'Confirmado';
        return payment.status === 'sent' ? 'Enviado' : 'Pendente';
      }
    }
  };

  const getStatusColor = (item: UnifiedInvoiceItem) => {
    if (item.type === 'direct') {
      const invoice = item as Invoice;
      return invoice.status === 'recebido'
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800';
    } else {
      const payment = item as PendingPayment;
      return payment.status === 'sent'
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800';
    }
  };

  const canUploadInvoice = (item: UnifiedInvoiceItem) => {
    return item.type === 'pending' && 
           (item as PendingPayment).status === 'pending' && 
           userProfile.user_type !== 'admin';
  };

  const hasInvoiceFile = (item: UnifiedInvoiceItem) => {
    if (item.type === 'direct') {
      return true; // Faturas diretas sempre têm arquivo
    } else {
      return !!(item as PendingPayment).invoice_stored_filename;
    }
  };

  const handleDeleteInvoice = async (item: UnifiedInvoiceItem) => {
    const confirmMessage = item.type === 'direct' 
      ? 'Tem certeza que deseja excluir esta fatura?'
      : 'Tem certeza que deseja excluir esta cobrança?';
    
    if (!confirm(confirmMessage)) return;

    try {
      const endpoint = item.type === 'direct' 
        ? `/api/invoices/${item.id}`
        : `/api/pending-payments/${item.id}`;
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        // Recarregar dados após exclusão
        await loadAllData();
        // Notificar a página pai sobre a mudança
        onDataChange?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao excluir item');
      }
    } catch (error) {
      console.error('Erro ao excluir:', error);
      alert('Erro ao excluir item');
    }
  };

  const handleViewDetails = (item: UnifiedInvoiceItem) => {
    setSelectedItem(item);
    setShowDetailsModal(true);
  };

  // Funções para criação de cobrança (apenas admin)
  const handleCreatePendingPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !amount || !description) return;

    try {
      setSubmitting(true);
      const response = await fetch('/api/pending-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          user_id: selectedUserId,
          amount: parseFloat(amount),
          description,
          month,
          year,
          notes: notes || undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        setShowCreateModal(false);
        resetForm();
        loadAllData();
        // Notificar a página pai sobre a mudança
        onDataChange?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao criar cobrança');
      }
    } catch (error) {
      console.error('Erro ao criar cobrança:', error);
      alert('Erro ao criar cobrança');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedUserId('');
    setAmount('');
    setDescription('');
    setMonth(new Date().getMonth() + 1);
    setYear(new Date().getFullYear());
    setNotes('');
  };

  // Funções para upload de nota fiscal
  const handleOpenUploadModal = (pendingId: number) => {
    setSelectedPendingId(pendingId);
    setShowUploadModal(true);
    setUploadFile(null);
    setUploadNotes('');
  };

  const handleUploadNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPendingId || !uploadFile) return;

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadNotes) {
        formData.append('notes', uploadNotes);
      }

      const response = await fetch(`/api/pending-payments/${selectedPendingId}/send`, {
        method: 'PUT',
        credentials: 'include',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        setShowUploadModal(false);
        setSelectedPendingId(null);
        setUploadFile(null);
        setUploadNotes('');
        loadAllData();
        // Notificar a página pai sobre a mudança
        onDataChange?.();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao enviar nota fiscal');
      }
    } catch (error) {
      console.error('Erro ao enviar nota fiscal:', error);
      alert('Erro ao enviar nota fiscal');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        alert('Apenas arquivos PDF, JPEG ou PNG são permitidos.');
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        alert('O arquivo deve ter no máximo 10MB.');
        return;
      }
      
      setUploadFile(file);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Gestão de Notas Fiscais</h2>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Gestão de Notas Fiscais</h2>
            <div className="flex items-center space-x-2">
              {userProfile.user_type === 'admin' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  Nova Cobrança
                </button>
              )}
              
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Filtrar"
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Painel de Filtros */}
        {showFilters && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buscar
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusFilter(e.target.value as 'all' | 'recebido' | 'pendente' | 'sent')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">Todos</option>
                  <option value="recebido">Recebido</option>
                  <option value="pendente">Pendente</option>
                  <option value="sent">Enviado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mês
                </label>
                <select
                  value={monthFilter}
                  onChange={(e) => handleMonthFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="all">Todos os meses</option>
                  {MONTH_NAMES.map((month, index) => (
                    <option key={index + 1} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Limpar
                </button>
              </div>
            </div>
            {(searchTerm || statusFilter !== 'all' || monthFilter !== 'all') && (
              <div className="mt-3 text-sm text-gray-600">
                Mostrando {filteredItems.length} de {items.length} itens
              </div>
            )}
          </div>
        )}
        
        <div className="overflow-x-auto">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {items.length === 0 
                  ? "Nenhuma nota fiscal encontrada" 
                  : "Nenhum item corresponde aos filtros aplicados"
                }
              </p>
              <p className="text-sm text-gray-400">
                {items.length === 0 
                  ? (userProfile.user_type === 'admin' 
                      ? 'Clique em "Nova Cobrança" para começar' 
                      : 'Aguarde cobranças serem criadas pelo administrador')
                  : 'Tente ajustar os filtros ou limpar a busca'
                }
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Período
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {userProfile.user_type === 'admin' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuário
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item) => (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-start">
                        <FileText className="w-5 h-5 text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          {item.type === 'direct' ? (
                            <div className="text-sm font-medium text-gray-900">
                              {(item as Invoice).stored_filename || (item as Invoice).original_filename}
                            </div>
                          ) : (
                            <>
                              <div className="text-sm font-medium text-gray-900">
                                {(item as PendingPayment).description}
                              </div>
                              <div className="text-sm text-gray-500">
                                R$ {(item as PendingPayment).amount.toFixed(2)}
                              </div>
                              {(item as PendingPayment).invoice_filename && (
                                <div className="text-xs text-blue-600 mt-1">
                                  📎 {(item as PendingPayment).invoice_filename}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-900">
                          {getMonthName(item.month)} {item.year}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        getStatusColor(item)
                      }`}>
                        {getStatusLabel(item)}
                      </span>
                    </td>
                    {userProfile.user_type === 'admin' && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {item.type === 'pending' ? (item as PendingPayment).user_name : 'N/A'}
                          </span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-3">
                        {hasInvoiceFile(item) && (
                          <button
                            onClick={() => handleDownload(item)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            📥
                          </button>
                        )}
                        {canUploadInvoice(item) && (
                          <button
                            onClick={() => handleOpenUploadModal((item as PendingPayment).id)}
                            className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                            title="Enviar Nota Fiscal"
                          >
                            📤
                          </button>
                        )}
                        {userProfile.user_type === 'admin' && (
                          <button
                            onClick={() => handleViewDetails(item)}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
                            title="Ver Detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteInvoice(item)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal para criar cobrança (Admin) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-green-400 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Nova Cobrança</h2>
                  <p className="text-sm text-gray-500">Criar cobrança para usuário</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreatePendingPayment} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Usuário *
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione um usuário</option>
                    {users.filter(user => user.user_type !== 'admin').map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0,00"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição *
                  </label>
                  <select
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecione o tipo de serviço</option>
                    <option value="Honorários Médicos">Honorários Médicos</option>
                    <option value="Prestação de Serviços">Prestação de Serviços</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mês *
                    </label>
                    <select
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    >
                      {MONTH_NAMES.map((monthName, index) => (
                        <option key={index + 1} value={index + 1}>
                          {monthName}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ano *
                    </label>
                    <input
                      type="number"
                      min="2020"
                      max="2030"
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Observações adicionais (opcional)"
                  />
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white hover:bg-green-700 transition-colors rounded-lg font-medium disabled:opacity-50"
                >
                  {submitting ? 'Criando...' : 'Criar Cobrança'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para upload de nota fiscal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-blue-400 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Enviar Nota Fiscal</h2>
                  <p className="text-sm text-gray-500">Upload do arquivo da nota fiscal</p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUploadNote} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Arquivo da Nota Fiscal *
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Formatos aceitos: PDF, JPEG, PNG (máx. 10MB)
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <textarea
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Observações sobre a nota fiscal (opcional)"
                  />
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded-lg font-medium disabled:opacity-50"
                >
                  {uploading ? 'Enviando...' : 'Enviar Nota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes (Admin) */}
      {showDetailsModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                Detalhes da {selectedItem.type === 'direct' ? 'Fatura' : 'Cobrança'}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                    <p className="text-sm text-gray-900">#{selectedItem.id}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <p className="text-sm text-gray-900">
                      {selectedItem.type === 'direct' ? 'Fatura Direta' : 'Via Cobrança'}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mês/Ano</label>
                    <p className="text-sm text-gray-900">
                      {MONTH_NAMES[selectedItem.month - 1]} {selectedItem.year}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedItem.type === 'direct'
                        ? (selectedItem as Invoice).status === 'recebido'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                        : (selectedItem as PendingPayment).status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : (selectedItem as PendingPayment).status === 'sent'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selectedItem.type === 'direct'
                        ? (selectedItem as Invoice).status === 'recebido' ? 'Recebido' : 'Pendente'
                        : (selectedItem as PendingPayment).status === 'confirmed' ? 'Confirmado' : 
                          (selectedItem as PendingPayment).status === 'sent' ? 'Enviado' : 'Pendente'
                      }
                    </span>
                  </div>
                </div>

                {selectedItem.type === 'pending' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
                        <p className="text-sm text-gray-900">{(selectedItem as PendingPayment).user_name}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                        <p className="text-sm text-gray-900">
                          R$ {(selectedItem as PendingPayment).amount?.toFixed(2) || '0.00'}
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                      <p className="text-sm text-gray-900">{(selectedItem as PendingPayment).description}</p>
                    </div>
                    
                    {(selectedItem as PendingPayment).notes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                        <p className="text-sm text-gray-900">{(selectedItem as PendingPayment).notes}</p>
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Criado em</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedItem.created_at)}</p>
                  </div>
                  {selectedItem.type === 'pending' && (selectedItem as PendingPayment).sent_at && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enviado em</label>
                      <p className="text-sm text-gray-900">{formatDate((selectedItem as PendingPayment).sent_at!)}</p>
                    </div>
                  )}
                </div>

                {hasInvoiceFile(selectedItem) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo</label>
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {selectedItem.type === 'direct'
                          ? (selectedItem as Invoice).original_filename
                          : (selectedItem as PendingPayment).invoice_filename
                        }
                      </span>
                      <button
                        onClick={() => handleDownload(selectedItem)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Baixar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}