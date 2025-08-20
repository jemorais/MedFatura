import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { FileText } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Opcional: tentar validar sessão existente
        await fetch('/api/users/me', { credentials: 'include' });
      } catch (error) {
        // Ignorar erros aqui, apenas redirecionar
      } finally {
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-brand-600 to-brand-400 rounded-xl flex items-center justify-center mx-auto mb-6">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent mb-2">
          MedFatura
        </h1>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mt-6"></div>
        <p className="text-gray-600">Autenticando...</p>
      </div>
    </div>
  );
}
