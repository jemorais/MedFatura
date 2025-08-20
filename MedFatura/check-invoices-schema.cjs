const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite');

console.log('=== Verificando estrutura da tabela invoices ===\n');

db.serialize(() => {
  // Verificar estrutura da tabela
  db.all("PRAGMA table_info(invoices)", (err, columns) => {
    if (err) {
      console.log('Erro ao obter estrutura da tabela:', err.message);
    } else {
      console.log('Colunas da tabela invoices:');
      columns.forEach(col => {
        console.log(`- ${col.name}: ${col.type} (nullable: ${col.notnull === 0 ? 'YES' : 'NO'}, default: ${col.dflt_value || 'NULL'})`);
      });
    }

    // Verificar se as colunas de soft-delete existem
    const hasDeletedByAdmin = columns.some(col => col.name === 'deleted_by_admin');
    const hasDeletedByUser = columns.some(col => col.name === 'deleted_by_user');
    
    console.log('\nColunas de soft-delete:');
    console.log('- deleted_by_admin:', hasDeletedByAdmin ? 'EXISTS' : 'NOT EXISTS');
    console.log('- deleted_by_user:', hasDeletedByUser ? 'EXISTS' : 'NOT EXISTS');

    // Se as colunas existem, verificar os valores
    if (hasDeletedByAdmin || hasDeletedByUser) {
      console.log('\nVerificando valores das colunas de soft-delete:');
      let query = 'SELECT id';
      if (hasDeletedByAdmin) query += ', deleted_by_admin';
      if (hasDeletedByUser) query += ', deleted_by_user';
      query += ' FROM invoices LIMIT 5';
      
      db.all(query, (err, rows) => {
        if (err) {
          console.log('Erro ao verificar valores:', err.message);
        } else {
          console.table(rows);
        }
        db.close();
      });
    } else {
      console.log('\nAs colunas de soft-delete não existem na tabela.');
      db.close();
    }
  });
});