import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { FileText, CheckCircle, XCircle, Loader } from 'lucide-react';

interface InvitationData {
  id: number;
  email: string;
  name: string;
  cpf_crm: string;
  user_type: 'medico' | 'admin' | 'prestador';
  expires_at: string;
  is_used: boolean;
}

export default function InviteAccept() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token de convite inválido');
      setLoading(false);
      return;
    }

    loadInvitation();
  }, [token]);

  const loadInvitation = async () => {
    try {
      const response = await fetch(`/api/invitations/validate?token=${token}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Convite inválido');
      }

      const invitationData = await response.json();
      setInvitation(invitationData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao validar convite');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitation || !token) return;

    setAccepting(true);
    setError('');

    try {
      const response = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao aceitar convite');
      }

      // Redirect to login with success message
      navigate('/?invited=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aceitar convite');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4">
            <Loader className="w-6 h-6" />
          </div>
          <p className="text-gray-600">Validando convite...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Convite Inválido</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Ir para Login
          </button>
        </div>
      </div>
    );
  }

  const isExpired = new Date(invitation.expires_at) < new Date();

  if (isExpired || invitation.is_used) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-xl flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {invitation.is_used ? 'Convite Já Utilizado' : 'Convite Expirado'}
          </h1>
          <p className="text-gray-600 mb-6">
            {invitation.is_used 
              ? 'Este convite já foi utilizado anteriormente.'
              : 'Este convite expirou. Entre em contato com o administrador para solicitar um novo convite.'
            }
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Ir para Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-2">
            Aceitar Convite
          </h1>
          <p className="text-gray-600">Você foi convidado para usar o MedFatura</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Nome:</span>
              <span className="text-sm font-medium text-gray-900">{invitation.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Email:</span>
              <span className="text-sm font-medium text-gray-900">{invitation.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">CPF/CRM:</span>
              <span className="text-sm font-medium text-gray-900">{invitation.cpf_crm}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Tipo:</span>
              <span className={`text-sm font-medium ${
                invitation.user_type === 'medico' ? 'text-blue-600' : 'text-purple-600'
              }`}>
                {invitation.user_type === 'medico' ? 'Médico' : 'Administrador'}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleAcceptInvitation}
            disabled={accepting}
            className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {accepting ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Aceitando...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Aceitar Convite e Acessar Sistema</span>
              </>
            )}
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Ao aceitar, você concorda em usar o sistema MedFatura conforme as políticas estabelecidas.
          </p>
        </div>
      </div>
    </div>
  );
}
