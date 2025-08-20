export async function downloadInvoice(invoiceId: number, filename?: string) {
  try {
    const response = await fetch(`/api/invoices/${invoiceId}/download`, {
      method: 'GET',
      headers: {
        Accept: 'application/pdf',
      },
      // credentials serão garantidas pelo wrapper global de fetch
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Erro ao baixar arquivo (${response.status}): ${errorText || 'sem detalhes'}`);
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      throw new Error('Arquivo vazio recebido');
    }

    // Tentar usar nome vindo do header caso não tenha sido fornecido
    let outName = filename || 'fatura.pdf';
    const cd = response.headers.get('content-disposition');
    if (!filename && cd) {
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
      const raw = decodeURIComponent(match?.[1] || match?.[2] || '');
      if (raw) outName = raw;
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = outName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro no download:', error);
    alert(`Erro ao baixar arquivo: ${message}`);
  }
}