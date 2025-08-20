import { useState, useEffect } from 'react';
import { X, FileText, Users, TrendingUp, Calendar, Eye } from 'lucide-react';
import { downloadInvoice } from '../utils/downloadUtils';
import { maskCpfCrm, getDocumentTypeLabel } from '@/react-app/utils/privacy';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'invoices' | 'users' | 'pending';
  title: string;
  refreshTrigger?: number; // Optional prop to force refresh
}

interface Invoice {
  id: number;
  month: number;
  year: number;
  original_filename: string;
  stored_filename?: string;
  status: 'recebido' | 'pendente';
  created_at: string;
  user_id: string;
}

interface PendingDoctor {
  id: number;
  name: string;
  user_type: 'medico' | 'admin' | 'prestador';
  cpf_crm: string;
  is_active: boolean;
  created_at: string;
  user_id: string;
}

interface PendingInvoice {
  id: number;
  month: number;
  year: number;
  original_filename: string;
  stored_filename?: string;
  status: 'pendente' | 'pending';
  created_at: string;
  user_id: string;
  user_name: string;
  type: 'direct' | 'pending';
  amount?: number;
  description?: string;
  notes?: string;
  invoice_filename?: string;
}

interface UserProfile {
  id: number;
  name: string;
  user_type: 'medico' | 'admin' | 'prestador';
  cpf_crm: string;
  is_active: boolean;
  created_at: string;
  user_id: string;
}

export default function StatsModal({ isOpen, onClose, type, title, refreshTrigger }: StatsModalProps) {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [pendingDoctors, setPendingDoctors] = useState<PendingDoctor[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoice[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, type, refreshTrigger]);

  // Reset data when modal closes to ensure fresh data on next open
  useEffect(() => {
    if (!isOpen) {
      setInvoices([]);
      setUsers([]);
      setPendingDoctors([]);
      setPendingInvoices([]);
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (type === 'invoices') {
        const response = await fetch('/api/invoices', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setInvoices(data);
        }
      } else if (type === 'pending') {
        const response = await fetch('/api/pending-invoices', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setPendingInvoices(data);
        }
      } else if (type === 'users') {
        const response = await fetch('/api/users', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setUsers(data.filter((user: UserProfile) => user.is_active));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (month: number) => {
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return months[month - 1];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-brand-600 to-brand-400 rounded-lg flex items-center justify-center">
              {type === 'invoices' && <FileText className="w-5 h-5 text-white" />}
              {type === 'users' && <Users className="w-5 h-5 text-white" />}
              {type === 'pending' && <TrendingUp className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">
                {type === 'invoices' && `${invoices.length} fatura(s) encontrada(s)`}
                {type === 'users' && `${users.length} usuário(s) ativo(s)`}
                {type === 'pending' && `${pendingInvoices.length} fatura(s) pendente(s)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
              <span className="ml-3 text-gray-600">Carregando dados...</span>
            </div>
          ) : (
            <>
              {type === 'invoices' && (
                <div className="space-y-3">
                  {invoices.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhuma fatura encontrada</p>
                    </div>
                  ) : (
                    invoices.map((invoice) => (
                      <div key={invoice.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div>
                              <button
                                onClick={() => downloadInvoice(invoice.id, invoice.stored_filename || invoice.original_filename)}
                                className="font-medium text-brand-700 hover:text-brand-800 hover:underline text-left"
                              >
                                {invoice.stored_filename || invoice.original_filename}
                              </button>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span className="flex items-center">
                                  <Calendar className="w-4 h-4 mr-1" />
                                  {getMonthName(invoice.month)} {invoice.year}
                                </span>
                                <span>Enviado em {formatDate(invoice.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-brand-100 text-brand-800">
                              Recebido
                            </span>
                            <button
                              onClick={() => downloadInvoice(invoice.id, invoice.stored_filename || invoice.original_filename)}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Baixar arquivo"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {type === 'pending' && (
                <div className="space-y-3">
                  {pendingInvoices.length === 0 ? (
                    <div className="text-center py-8">
                      <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Não há faturas pendentes no momento!</p>
                    </div>
                  ) : (
                    pendingInvoices.map((pendingItem) => (
                      <div key={`${pendingItem.type}-${pendingItem.id}`} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div>
                              <div className="font-medium text-gray-900">
                                {pendingItem.type === 'direct' ? pendingItem.original_filename : pendingItem.description}
                              </div>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span className="flex items-center">
                                  <Calendar className="w-4 h-4 mr-1" />
                                  {getMonthName(pendingItem.month)} {pendingItem.year}
                                </span>
                                <span>Por: {pendingItem.user_name}</span>
                                {pendingItem.type === 'pending' && pendingItem.amount && (
                                  <span className="text-green-600 font-medium">
                                    R$ {pendingItem.amount.toFixed(2)}
                                  </span>
                                )}
                                <span>Criado em {formatDate(pendingItem.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              pendingItem.type === 'direct' 
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {pendingItem.type === 'direct' ? 'Fatura Pendente' : 'Cobrança Pendente'}
                            </span>
                            {pendingItem.stored_filename && (
                              <button
                                onClick={() => {
                                  if (pendingItem.type === 'direct') {
                                    downloadInvoice(pendingItem.id, pendingItem.stored_filename!);
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                title="Baixar arquivo"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {type === 'users' && (
                <div className="space-y-3">
                  {users.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhum usuário encontrado</p>
                    </div>
                  ) : (
                    users.map((user) => (
                      <div key={user.id} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-brand-600 to-brand-400 rounded-lg flex items-center justify-center">
                              <span className="text-white text-sm font-medium">
                                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{user.name}</p>
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                <span className="font-mono">{maskCpfCrm(user.cpf_crm)}</span>
                                <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                                  {getDocumentTypeLabel(user.cpf_crm)}
                                </span>
                                <span>Criado em {formatDate(user.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              user.user_type === 'medico' 
                                ? 'bg-brand-100 text-brand-800' 
                                : 'bg-brand-50 text-brand-700'
                            }`}>
                              {user.user_type === 'medico' ? 'Médico' : 'Administrador'}
                            </span>
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-brand-100 text-brand-800">
                              Ativo
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
