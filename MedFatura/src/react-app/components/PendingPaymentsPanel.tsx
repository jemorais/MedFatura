import { useState, useEffect } from 'react';
import { DollarSign, XCircle, Plus, Calendar, User, Upload, FileText } from 'lucide-react';

interface PendingPayment {
  id: number;
  user_id: number;
  admin_id: number;
  amount: number;
  description: string;
  month: number;
  year: number;
  status: 'pending' | 'sent';
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
}

interface UserProfile {
  id: number;
  name: string;
  user_type: 'medico' | 'admin' | 'prestador';
  cpf_crm: string;
  is_active: boolean;
  user_id: string;
  created_at: string;
}

interface PendingPaymentsPanelProps {
  userProfile: UserProfile;
  users: any[];
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-green-100 text-green-800'
};

export default function PendingPaymentsPanel({ userProfile, users }: PendingPaymentsPanelProps) {
  const STATUS_LABELS = {
    pending: 'Pendente',
    sent: userProfile?.user_type === 'admin' ? 'Recebido' : 'Enviado'
  };
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPendingId, setSelectedPendingId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPendingPayments();
  }, []);

  const loadPendingPayments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pending-payments', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setPendingPayments(data.pending_payments || []);
      } else {
        console.error('Erro ao carregar pendências');
      }
    } catch (error) {
      console.error('Erro ao carregar pendências:', error);
    } finally {
      setLoading(false);
    }
  };

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
        loadPendingPayments();
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
      
      // Criar FormData para envio do arquivo
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
        loadPendingPayments();
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
      // Validar tipo de arquivo (PDF, imagens)
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        alert('Apenas arquivos PDF, JPEG ou PNG são permitidos.');
        return;
      }
      
      // Validar tamanho (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('O arquivo deve ter no máximo 10MB.');
        return;
      }
      
      setUploadFile(file);
    }
  };





  const handleCancelPending = async (pendingId: number) => {
    if (!confirm('Tem certeza que deseja deletar esta cobrança permanentemente? Esta ação não pode ser desfeita.')) return;

    try {
      const response = await fetch(`/api/pending-payments/${pendingId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message);
        loadPendingPayments();
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao deletar cobrança');
      }
    } catch (error) {
      console.error('Erro ao deletar cobrança:', error);
      alert('Erro ao deletar cobrança');
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const medicos = users.filter(u => u.user_type === 'medico' && u.is_active);

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Pendências Financeiras</h2>
        </div>
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Carregando pendências...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Pendências Financeiras</h2>
        {userProfile.user_type === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Cobrança
          </button>
        )}
      </div>

      {pendingPayments.length === 0 ? (
        <div className="p-6 text-center">
          <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {userProfile.user_type === 'admin' 
              ? 'Nenhuma cobrança pendente. Clique em "Nova Cobrança" para começar.'
              : 'Você não possui cobranças pendentes no momento.'
            }
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {userProfile.user_type === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Médico
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Período
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                {userProfile.user_type === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nota Fiscal
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pendingPayments.map((pending) => (
                <tr key={pending.id} className="hover:bg-gray-50 transition-colors">
                  {userProfile.user_type === 'admin' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          {pending.user_name}
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {pending.description}
                    </div>
                    {pending.notes && (
                      <div className="text-sm text-gray-500 mt-1">
                        {pending.notes}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-green-600">
                      {formatCurrency(pending.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">
                        {MONTH_NAMES[pending.month - 1]} {pending.year}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      STATUS_COLORS[pending.status]
                    }`}>
                      {STATUS_LABELS[pending.status]}
                    </span>
                  </td>
                  {userProfile.user_type === 'admin' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pending.invoice_filename ? (
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-700">
                            {pending.invoice_filename}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500">
                      {formatDate(pending.created_at)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      {(userProfile.user_type === 'medico' || userProfile.user_type === 'prestador') && pending.status === 'pending' && (
                        <button
                          onClick={() => handleOpenUploadModal(pending.id)}
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                          title="Enviar nota fiscal"
                        >
                          Enviar nota
                        </button>
                      )}

                      {userProfile.user_type === 'admin' && pending.status === 'pending' && (
                        <button
                          onClick={() => handleCancelPending(pending.id)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          title="Deletar cobrança"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para upload de nota fiscal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Enviar Nota Fiscal</h3>
            </div>
            
            <form onSubmit={handleUploadNote} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arquivo da Nota Fiscal *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    required
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {uploadFile ? (
                      <div className="flex items-center justify-center space-x-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-gray-700">{uploadFile.name}</span>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Clique para selecionar o arquivo</p>
                        <p className="text-xs text-gray-500 mt-1">PDF, JPEG ou PNG (máx. 10MB)</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Informações adicionais sobre a nota fiscal..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedPendingId(null);
                    setUploadFile(null);
                    setUploadNotes('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Enviar Nota</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para criar nova cobrança */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Nova Cobrança</h3>
            </div>
            
            <form onSubmit={handleCreatePendingPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Médico
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                >
                  <option value="">Selecione um médico</option>
                  {medicos.map((medico) => (
                    <option key={medico.id} value={medico.id}>
                      {medico.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="0,00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descrição
                </label>
                <select
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  required
                >
                  <option value="">Selecione o tipo de serviço</option>
                  <option value="Honorários Médicos">Honorários Médicos</option>
                  <option value="Prestação de Serviços">Prestação de Serviços</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mês
                  </label>
                  <select
                    value={month}
                    onChange={(e) => setMonth(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  >
                    {MONTH_NAMES.map((monthName, index) => (
                      <option key={index} value={index + 1}>
                        {monthName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ano
                  </label>
                  <input
                    type="number"
                    min="2020"
                    max="2030"
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Informações adicionais sobre a cobrança..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Criando...' : 'Criar Cobrança'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}