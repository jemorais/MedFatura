import { useState, useEffect } from 'react';
import { useAuth } from '@/react-app/contexts/AuthContext';
import { useNavigate } from 'react-router';
import { FileText, Users, TrendingUp, Calendar, Plus, Search, Filter, LogOut, UserPlus, RefreshCw, Power, PowerOff, Trash2 } from 'lucide-react';
import InvoiceModal from '@/react-app/components/InvoiceModal';
import LoginModal from '@/react-app/components/LoginModal';
import InviteUserModal from '@/react-app/components/InviteUserModal';
import PendingInvitesModal from '@/react-app/components/PendingInvitesModal';
import StatCard from '@/react-app/components/StatCard';
import StatsModal from '@/react-app/components/StatsModal';
import UnifiedInvoicePanel from '@/react-app/components/UnifiedInvoicePanel';
import NotificationBell from '@/react-app/components/NotificationBell';
import { maskCpfCrm, getDocumentTypeLabel } from '@/react-app/utils/privacy';
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

interface Stats {
  totalInvoices: number;
  pendingInvoices: number;
  activeUsers: number;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function Home() {
  const { user, isPending, logout } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({ totalInvoices: 0, pendingInvoices: 0, activeUsers: 0 });
  const [loading, setLoading] = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showPendingInvitesModal, setShowPendingInvitesModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsModalType, setStatsModalType] = useState<'invoices' | 'users' | 'pending'>('invoices');
  const [statsModalTitle, setStatsModalTitle] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'recebido' | 'pendente'>('all');
  const [monthFilter, setMonthFilter] = useState<'all' | number>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!isPending && !user) {
      setShowLoginModal(true);
      setLoading(false);
      return;
    }

    if (user) {
      loadData();
    }
  }, [user, isPending]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load user profile first
      const profileResponse = await fetch('/api/profiles/me', {
        credentials: 'include'
      });

      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        setUserProfile(profile);
      } else if (profileResponse.status === 404) {
        // User doesn't have a profile, redirect to setup
        navigate('/setup');
        return;
      }

      // Load data in parallel
      const params = new URLSearchParams();
      const statsUrl = `/api/stats${params.toString() ? `?${params.toString()}` : ''}`;
      const [invoicesRes, usersRes, statsRes] = await Promise.all([
        fetch('/api/invoices', { credentials: 'include' }),
        fetch('/api/users', { credentials: 'include' }),
        fetch(statsUrl, { credentials: 'include' })
      ]);

      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        setInvoices(invoicesData);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: number, userName: string) => {
    if (!confirm(`Tem certeza que deseja deletar o usuário "${userName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setShowUserDetails(false);
        setSelectedUser(null);
        loadUsers();
        alert(data.message);
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao deletar usuário');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Erro ao deletar usuário');
    }
  };

  // Apply filters whenever invoices, searchTerm, statusFilter, or monthFilter changes
  useEffect(() => {
    let filtered = [...invoices];

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(invoice => 
        invoice.original_filename.toLowerCase().includes(search) ||
        invoice.stored_filename?.toLowerCase().includes(search) ||
        getMonthName(invoice.month).toLowerCase().includes(search) ||
        invoice.year.toString().includes(search)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.status === statusFilter);
    }

    // Apply month filter
    if (monthFilter !== 'all') {
      filtered = filtered.filter(invoice => invoice.month === monthFilter);
    }

    setFilteredInvoices(filtered);
  }, [invoices, searchTerm, statusFilter, monthFilter]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleStatusFilter = (status: 'all' | 'recebido' | 'pendente') => {
    setStatusFilter(status);
  };

  const handleMonthFilter = (month: 'all' | number) => {
    setMonthFilter(month);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setMonthFilter('all');
  };

  const getMonthName = (month: number) => {
    return MONTH_NAMES[month - 1] || 'Mês Inválido';
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/users', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const toggleUserStatus = async (userId: number) => {
    try {
      const response = await fetch(`/api/users/${userId}/toggle-status`, {
        method: 'PATCH',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        // Reload users to reflect the change
        loadUsers();
        // Show success message
        alert(data.message);
      } else {
        const error = await response.json();
        alert(error.error || 'Erro ao alterar status do usuário');
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      alert('Erro ao alterar status do usuário');
    }
  };



  const handleAddInvoice = async (invoiceData: FormData) => {
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        credentials: 'include',
        body: invoiceData, // FormData handles its own Content-Type
      });

      if (response.ok) {
        await loadData(); // Reload data
        setRefreshTrigger(prev => prev + 1); // Trigger modal refresh
        setShowInvoiceModal(false);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao criar fatura');
      }
    } catch (error) {
      console.error('Error adding invoice:', error);
      throw error; // Let the modal handle the error display
    }
  };

  const handleDownload = async (invoiceId: number, filename: string) => {
    await downloadInvoice(invoiceId, filename);
  };

  const handleInviteUser = async (inviteData: {
    email: string;
    name: string;
    cpf_crm: string;
    user_type: 'medico' | 'admin' | 'prestador';
  }) => {
    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(inviteData),
      });

      if (response.ok) {
        await loadData(); // Reload data
        setShowInviteModal(false);
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar convite');
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      throw error; // Let the modal handle the error display
    }
  };

  const handleStatsCardClick = (type: 'invoices' | 'users' | 'pending', title: string) => {
    setStatsModalType(type);
    setStatsModalTitle(title);
    setShowStatsModal(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const handleLogout = async () => {
    try {
      await logout();
      setShowLoginModal(true);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleViewUserDetails = (user: UserProfile) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-brand-600 to-brand-400 rounded-xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginModal isOpen={true} onClose={() => setShowLoginModal(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100">
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-brand-600 to-brand-400 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-700 to-brand-500 bg-clip-text text-transparent">
                  MedFatura
                </h1>
                <p className="text-sm text-gray-500">Sistema de Gestão de Faturas Médicas</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationBell />
              {userProfile && (
                <div className="flex items-center space-x-3 text-sm text-gray-600">
                  <div className="w-8 h-8 bg-gradient-to-r from-brand-600 to-brand-400 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {userProfile.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <span>{userProfile.name}</span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                {userProfile?.user_type === 'admin' && (
                  <>
                    <button
                      onClick={() => setShowPendingInvitesModal(true)}
                      className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Reenviar Convites</span>
                    </button>
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="bg-brand-700 hover:bg-brand-800 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Convidar Usuário</span>
                    </button>
                  </>
                )}
                {userProfile?.user_type === 'medico' && (
                  <button
                    onClick={() => setShowInvoiceModal(true)}
                    className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Enviar Nota Fiscal</span>
                  </button>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Total de Faturas"
            value={stats.totalInvoices}
            icon={FileText}
            color="blue"
            onClick={() => handleStatsCardClick('invoices', 'Todas as Faturas')}
          />
          
          {userProfile?.user_type === 'admin' && (
            <StatCard
              title="Usuários Ativos"
              value={stats.activeUsers}
              icon={Users}
              color="green"
              onClick={() => handleStatsCardClick('users', 'Usuários Ativos')}
            />
          )}
          
          <StatCard
            title="Pendentes"
            value={stats.pendingInvoices}
            icon={TrendingUp}
            color="yellow"
            onClick={() => handleStatsCardClick('pending', 'Faturas Pendentes')}
          />
        </div>

        {/* Unified Invoice Management */}
        {userProfile && (
          <UnifiedInvoicePanel 
            userProfile={userProfile} 
            users={users}

            onDataChange={loadData} // Recarregar dados quando houver mudanças
          />
        )}

        {/* Users Section - Only show for admin users */}
        {userProfile?.user_type === 'admin' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Usuários do Sistema</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CPF/CRM
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gradient-to-r from-brand-600 to-brand-400 rounded-full flex items-center justify-center mr-3">
                            <span className="text-white text-sm font-medium">
                              {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleViewUserDetails(user)}
                              className="text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline transition-colors"
                            >
                              {user.name}
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          user.user_type === 'medico' 
                            ? 'bg-brand-100 text-brand-800' 
                            : 'bg-brand-50 text-brand-700'
                        }`}>
                          {user.user_type === 'medico' ? 'Médico' : 'Administrador'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500 font-mono">
                            {maskCpfCrm(user.cpf_crm)}
                          </span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            {getDocumentTypeLabel(user.cpf_crm)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          user.is_active 
                            ? 'bg-brand-100 text-brand-800' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleUserStatus(user.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            user.is_active
                              ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                              : 'text-brand-600 hover:text-brand-800 hover:bg-brand-50'
                          }`}
                          title={user.is_active ? 'Desativar usuário' : 'Ativar usuário'}
                        >
                          {user.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                        </button>
                        {/* Delete user permanently */}
                        <button
                          onClick={() => deleteUser(user.id, user.name)}
                          className="p-2 ml-2 rounded-lg transition-colors text-red-600 hover:text-red-800 hover:bg-red-50"
                          title="Deletar usuário permanentemente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


      </main>

      {/* Modals */}
      {showInvoiceModal && userProfile && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          onSubmit={handleAddInvoice}
          userProfile={userProfile}
        />
      )}

      {showInviteModal && userProfile && (
        <InviteUserModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          onSubmit={handleInviteUser}
        />
      )}

      {showPendingInvitesModal && userProfile && (
        <PendingInvitesModal
          isOpen={showPendingInvitesModal}
          onClose={() => setShowPendingInvitesModal(false)}
        />
      )}

      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {showStatsModal && (
        <StatsModal
          isOpen={showStatsModal}
          onClose={() => setShowStatsModal(false)}
          type={statsModalType}
          title={statsModalTitle}
          refreshTrigger={refreshTrigger}
        />
      )}

      {/* User Details Modal */}
      {showUserDetails && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-brand-600 to-brand-400 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Detalhes do Usuário</h2>
                  <p className="text-sm text-gray-500">Informações completas</p>
                </div>
              </div>
              <button
                onClick={() => setShowUserDetails(false)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <p className="text-gray-900 font-medium">{selectedUser.name}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getDocumentTypeLabel(selectedUser.cpf_crm)}
                  </label>
                  <p className="text-gray-900 font-mono">{selectedUser.cpf_crm}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Usuário</label>
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                    selectedUser.user_type === 'medico' 
                      ? 'bg-brand-100 text-brand-800' 
                      : 'bg-brand-50 text-brand-700'
                  }`}>
                    {selectedUser.user_type === 'medico' ? 'Médico' : 'Administrador'}
                  </span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                    selectedUser.is_active 
                      ? 'bg-brand-100 text-brand-800' 
                      : 'bg-brand-50 text-brand-700'
                  }`}>
                    {selectedUser.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Cadastro</label>
                  <p className="text-gray-900">{formatDate(selectedUser.created_at)}</p>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
                  <p className="text-brand-700 text-sm">
                    <strong>Privacidade:</strong> Os dados completos são exibidos apenas nesta tela de detalhes, 
                    conforme as diretrizes da LGPD.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl">
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowUserDetails(false)}
                  className="flex-1 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors border border-gray-300 rounded-lg"
                >
                  Fechar
                </button>
                {user?.user_type === 'admin' && selectedUser.id !== Number(user.id) && (
                  <button
                    onClick={() => deleteUser(selectedUser.id, selectedUser.name)}
                    className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 transition-colors rounded-lg font-medium"
                  >
                    Deletar Usuário
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}