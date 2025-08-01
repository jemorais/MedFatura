export const downloadInvoice = async (invoiceId: number, filename: string) => {
  try {
    console.log(`Iniciando download da fatura ${invoiceId}...`);
    
    const response = await fetch(`/api/invoices/${invoiceId}/download`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/pdf'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro no download:', errorText);
      throw new Error(`Erro ao baixar arquivo: ${response.status}`);
    }

    const blob = await response.blob();
    console.log('Blob size:', blob.size, 'bytes');
    console.log('Blob type:', blob.type);

    if (blob.size === 0) {
      throw new Error('Arquivo vazio recebido');
    }

    // Criar URL temporária e fazer download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    console.log('✅ Download concluído com sucesso!');
  } catch (error) {
    console.error('Erro no download:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    alert(`Erro ao baixar arquivo: ${errorMessage}`);
  }
};