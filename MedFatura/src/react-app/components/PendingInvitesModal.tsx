import { useState, useEffect } from 'react';
import { UserPlus, Mail, CreditCard, Shield, X, RefreshCw, Calendar, AlertCircle } from 'lucide-react';

interface PendingInvitation {
  id: number;
  email: string;
  name: string;
  cpf_crm: string;
  user_type: 'medico' | 'admin' | 'prestador';
  invitation_token: string;
  expires_at: string;
  is_used: boolean;
  created_at: string;
}

interface PendingInvitesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PendingInvitesModal({ isOpen, onClose }: PendingInvitesModalProps) {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (isOpen) {
      loadInvitations();
    }
  }, [isOpen]);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/invitations', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        
        // Filter only pending invitations with more robust date handling
        const pending = data.filter((inv: PendingInvitation) => {
          // Check if invitation is not used
          const isNotUsed = !inv.is_used;
          
          // Check if invitation is not expired with better date handling
          let isNotExpired = true;
          try {
            const expiryDate = new Date(inv.expires_at);
            const now = new Date();
            isNotExpired = expiryDate > now;
          } catch (error) {
            console.warn('Error parsing expiry date for invitation:', inv.id, inv.expires_at);
            // If we can't parse the date, assume it's valid to be safe
            isNotExpired = true;
          }
          
          return isNotUsed && isNotExpired;
        });
        
        setInvitations(pending);
      } else {
        console.error('Failed to load invitations');
      }
    } catch (error) {
      console.error('Error loading invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvitation = async (invitationId: number) => {
    setResendingId(invitationId);
    setMessage('');

    try {
      const response = await fetch(`/api/invitations/${invitationId}/resend`, {
        method: 'POST',
        credentials: 'include'
      });

      const result = await response.json();

      if (response.ok && result.success) {
        if (result.email_sent) {
          setMessage('Convite reenviado com sucesso por email!');
          setMessageType('success');
        } else {
          setMessage(`${result.message} ${result.invitation_link}`);
          setMessageType('success');
        }
        setTimeout(() => setMessage(''), 5000);
      } else {
        setMessage(result.error || 'Erro ao reenviar convite');
        setMessageType('error');
      }
    } catch (error) {
      setMessage('Erro ao reenviar convite');
      setMessageType('error');
    } finally {
      setResendingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-brand-600 to-brand-400 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Convites Pendentes</h2>
              <p className="text-sm text-gray-500">Gerencie convites que ainda não foram aceitos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className={`mx-6 mt-4 p-3 rounded-lg border ${
            messageType === 'success' 
              ? 'bg-brand-50 border-brand-200 text-brand-700' 
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <p className="text-sm">{message}</p>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando convites...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-8">
              <UserPlus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-2">Nenhum convite pendente</p>
              <p className="text-gray-400 text-sm">Todos os convites foram aceitos ou expiraram</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invitations.map((invitation) => {
                const daysLeft = getDaysUntilExpiry(invitation.expires_at);
                const isExpiringSoon = daysLeft <= 2;
                
                return (
                  <div key={invitation.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-brand-600 to-brand-400 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              {invitation.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-medium text-gray-900">{invitation.name}</h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span className="flex items-center">
                                <Mail className="w-3 h-3 mr-1" />
                                {invitation.email}
                              </span>
                              <span className="flex items-center">
                                <CreditCard className="w-3 h-3 mr-1" />
                                {invitation.cpf_crm}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            invitation.user_type === 'medico' 
                              ? 'bg-brand-100 text-brand-800' 
                              : 'bg-brand-50 text-brand-700'
                          }`}>
                            <Shield className="w-3 h-3 mr-1" />
                            {invitation.user_type === 'medico' ? 'Médico' : 'Administrador'}
                          </span>
                          
                          <span className="text-gray-500 flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            Enviado em {formatDate(invitation.created_at)}
                          </span>
                          
                          <span className={`flex items-center ${isExpiringSoon ? 'text-red-600' : 'text-gray-500'}`}>
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {daysLeft > 0 ? `Expira em ${daysLeft} dia${daysLeft > 1 ? 's' : ''}` : 'Expira hoje'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleResendInvitation(invitation.id)}
                          disabled={resendingId === invitation.id}
                          className="bg-brand-100 text-brand-800 hover:bg-brand-700 text-white px-3 py-2 rounded-lg flex items-center space-x-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resendingId === invitation.id ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Enviando...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              <span>Reenviar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
            <p className="text-brand-700 text-sm">
              <strong>Dica:</strong> Se o email não chegar, verifique a pasta de spam. 
              Os convites expiram em 7 dias após o envio.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
