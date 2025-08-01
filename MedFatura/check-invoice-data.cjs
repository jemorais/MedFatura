const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

console.log('=== Verificando dados das faturas ===\n');

db.serialize(() => {
  console.log('1. Verificando faturas existentes...');
  db.all("SELECT id, user_id, original_filename, stored_filename, file_size, CASE WHEN file_data IS NULL THEN 'NULL' WHEN file_data = '' THEN 'EMPTY' WHEN LENGTH(file_data) > 0 THEN 'HAS_DATA' ELSE 'UNKNOWN' END as file_data_status, LENGTH(file_data) as data_length FROM invoices", (err, invoices) => {
    if (err) {
      console.error('Erro ao consultar faturas:', err);
      return;
    }
    
    console.log('Faturas encontradas:', invoices.length);
    if (invoices.length > 0) {
      console.table(invoices);
      
      // Verificar uma fatura específica em detalhes
      if (invoices.length > 0) {
        const firstInvoice = invoices[0];
        console.log('\n2. Verificando detalhes da primeira fatura...');
        db.get("SELECT id, original_filename, stored_filename, file_size, SUBSTR(file_data, 1, 50) as file_data_preview FROM invoices WHERE id = ?", [firstInvoice.id], (err, detail) => {
          if (err) {
            console.error('Erro ao consultar detalhes:', err);
          } else {
            console.log('Detalhes da fatura:', detail);
            
            // Verificar se o file_data começa com caracteres base64 válidos
            if (detail.file_data_preview) {
              console.log('\nPrimeiros 50 caracteres do file_data:', detail.file_data_preview);
              console.log('Parece ser base64 válido?', /^[A-Za-z0-9+/]/.test(detail.file_data_preview));
            }
          }
          
          db.close();
        });
      }
    } else {
      console.log('Nenhuma fatura encontrada no banco de dados.');
      db.close();
    }
  });
});