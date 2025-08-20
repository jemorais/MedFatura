const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

console.log('=== Verificando flags de soft-delete nas faturas ===');

db.serialize(() => {
  db.get(`SELECT 
    COUNT(*) AS total,
    SUM(CASE WHEN deleted_by_admin = 1 THEN 1 ELSE 0 END) AS del_admin,
    SUM(CASE WHEN deleted_by_user = 1 THEN 1 ELSE 0 END) AS del_user,
    SUM(CASE WHEN COALESCE(deleted_by_admin,0)=0 AND COALESCE(deleted_by_user,0)=0 THEN 1 ELSE 0 END) AS visiveis
  FROM invoices`, (err, row) => {
    if (err) {
      console.error('Erro ao contar flags:', err.message);
    } else {
      console.log('Contagem geral:', row);
    }
    
    db.all(`SELECT id, user_id, original_filename, stored_filename, 
                   COALESCE(deleted_by_admin,0) AS deleted_by_admin,
                   COALESCE(deleted_by_user,0) AS deleted_by_user,
                   deleted_at
            FROM invoices 
            ORDER BY id DESC LIMIT 20`, (err2, rows) => {
      if (err2) {
        console.error('Erro ao listar amostra:', err2.message);
      } else {
        console.table(rows);
      }
      db.close();
    });
  });
});