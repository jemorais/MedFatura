const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite');

console.log('=== Corrigindo faturas marcadas como deletadas ===\n');

db.serialize(() => {
  // Primeiro, verificar quantas faturas estão marcadas como deletadas
  db.get("SELECT COUNT(*) as total FROM invoices WHERE deleted_by_admin = 1 OR deleted_by_user = 1", (err, result) => {
    if (err) {
      console.log('Erro ao verificar faturas deletadas:', err.message);
      db.close();
      return;
    }
    
    console.log(`Faturas marcadas como deletadas: ${result.total}`);
    
    if (result.total > 0) {
      console.log('Resetando todas as faturas para não deletadas...');
      
      // Resetar todas as faturas para não deletadas
      db.run(
        "UPDATE invoices SET deleted_by_admin = 0, deleted_by_user = 0, deleted_at = NULL",
        function(err) {
          if (err) {
            console.log('Erro ao resetar faturas:', err.message);
          } else {
            console.log(`✅ ${this.changes} faturas foram resetadas para não deletadas`);
            
            // Verificar o resultado
            db.get("SELECT COUNT(*) as total FROM invoices WHERE deleted_by_admin = 0 AND deleted_by_user = 0", (err, result) => {
              if (err) {
                console.log('Erro ao verificar resultado:', err.message);
              } else {
                console.log(`✅ Total de faturas ativas agora: ${result.total}`);
              }
              db.close();
            });
          }
        }
      );
    } else {
      console.log('Nenhuma fatura precisa ser corrigida.');
      db.close();
    }
  });
});