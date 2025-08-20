import { useState } from 'react';
import { UserPlus, Mail, User, CreditCard, Shield, X } from 'lucide-react';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (inviteData: {
    email: string;
    name: string;
    cpf_crm: string;
    user_type: 'medico' | 'admin' | 'prestador';
  }) => Promise<void>;
}

export default function InviteUserModal({ isOpen, onClose }: InviteUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    cpf_crm: '',
    user_type: 'medico' as 'medico' | 'admin' | 'prestador'
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setInviteLink('');

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao enviar convite');
      }

      if (result.email_sent) {
        setSuccess('Convite enviado com sucesso por email!');
        setTimeout(() => {
          setFormData({
            email: '',
            name: '',
            cpf_crm: '',
            user_type: 'medico'
          });
          onClose();
        }, 2000);
      } else {
        setSuccess('Convite criado! Como o email não pôde ser enviado, compartilhe o link abaixo:');
        setInviteLink(result.invitation_link);
        setError(result.email_error || 'Erro no envio do email');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar convite');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      email: '',
      name: '',
      cpf_crm: '',
      user_type: 'medico'
    });
    setError('');
    setSuccess('');
    setInviteLink('');
    onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Visual feedback could be added here
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-brand-600 to-brand-400 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Convidar Usuário</h2>
              <p className="text-sm text-gray-500">Adicionar novo usuário ao sistema</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 mb-4">
<p className="text-brand-700 text-sm">{success}</p>
              {inviteLink && (
                <div className="mt-3 p-3 bg-gray-100 rounded border">
                  <p className="text-sm text-gray-600 mb-2">Link do convite:</p>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="flex-1 px-2 py-1 text-xs bg-white border rounded text-gray-800"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(inviteLink)}
                      className="px-2 py-1 bg-brand-600 text-white text-xs rounded hover:bg-brand-700"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="email@exemplo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Digite o nome completo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CreditCard className="w-4 h-4 inline mr-2" />
                CPF, CNPJ ou CRM
              </label>
              <input
                type="text"
                required
                value={formData.cpf_crm}
                onChange={(e) => setFormData({ ...formData, cpf_crm: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="CPF (123.456.789-00), CNPJ (12.345.678/0001-90) ou CRM (12345-SP)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Shield className="w-4 h-4 inline mr-2" />
                Tipo de Usuário
              </label>
              <select
                value={formData.user_type}
                onChange={(e) => setFormData({ ...formData, user_type: e.target.value as 'medico' | 'admin' | 'prestador' })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              >
                <option value="medico">Médico</option>
                <option value="admin">Administrador</option>
                <option value="prestador">Prestador de Serviços</option>
              </select>
            </div>
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-brand-600 to-brand-400 hover:from-brand-700 hover:to-brand-500 text-white px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando...' : 'Enviar Convite'}
            </button>
          </div>
        </form>

        <div className="px-6 pb-6">
          <div className="bg-brand-50 border border-brand-200 rounded-lg p-3">
            <p className="text-brand-700 text-sm">
              <strong>Nota:</strong> O usuário receberá um email automático com link de acesso. 
              O convite expira em 7 dias e não é necessário ter conta Google.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
