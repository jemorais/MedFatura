const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

console.log('=== Verificando pagamento pendente ID 12 ===\n');

db.serialize(() => {
  // Verificar se existe o registro com ID 12
  db.get("SELECT * FROM pending_payments WHERE id = 12", (err, row) => {
    if (err) {
      console.error('Erro ao consultar:', err.message);
    } else if (!row) {
      console.log('❌ Não existe pagamento pendente com ID 12');
    } else {
      console.log('✅ Pagamento pendente encontrado:');
      console.table([row]);
      
      // Verificar se tem arquivo armazenado
      if (row.invoice_stored_filename) {
        console.log('\n📁 Arquivo armazenado:', row.invoice_stored_filename);
        
        // Verificar se o arquivo existe fisicamente
        const fs = require('fs');
        const path = require('path');
        const filePath = path.resolve(`uploads/${row.invoice_stored_filename}`);
        
        if (fs.existsSync(filePath)) {
          console.log('✅ Arquivo existe no sistema de arquivos');
          const stats = fs.statSync(filePath);
          console.log('📊 Tamanho do arquivo:', stats.size, 'bytes');
        } else {
          console.log('❌ Arquivo NÃO existe no sistema de arquivos');
          console.log('🔍 Caminho procurado:', filePath);
        }
      } else {
        console.log('❌ Nenhum arquivo armazenado (invoice_stored_filename é NULL)');
      }
    }
    
    // Listar todos os pagamentos pendentes para referência
    console.log('\n=== Todos os pagamentos pendentes ===');
    db.all("SELECT id, description, invoice_filename, invoice_stored_filename FROM pending_payments", (err, rows) => {
      if (err) {
        console.error('Erro ao listar:', err.message);
      } else {
        console.table(rows);
      }
      db.close();
    });
  });
});