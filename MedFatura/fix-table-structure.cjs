const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Erro ao conectar:', err.message);
    return;
  }
  
  console.log('=== VERIFICANDO ESTRUTURA DA TABELA ===\n');
  
  // Verificar estrutura atual da tabela users
  db.all("PRAGMA table_info(users)", (err, columns) => {
    if (err) {
      console.error('Erro ao verificar estrutura:', err.message);
      db.close();
      return;
    }
    
    console.log('Colunas atuais na tabela users:');
    columns.forEach(col => {
      console.log(`- ${col.name}: ${col.type}`);
    });
    
    // Verificar se cpf_crm existe
    const hasCpfCrm = columns.some(col => col.name === 'cpf_crm');
    
    if (hasCpfCrm) {
      console.log('\n✅ Coluna cpf_crm já existe!');
      db.close();
    } else {
      console.log('\n❌ Coluna cpf_crm não existe. Adicionando...');
      
      // Adicionar coluna cpf_crm
      db.run('ALTER TABLE users ADD COLUMN cpf_crm TEXT', (err) => {
        if (err) {
          console.error('Erro ao adicionar coluna:', err.message);
        } else {
          console.log('✅ Coluna cpf_crm adicionada com sucesso!');
          
          // Atualizar usuários existentes com valores padrão
          db.run(`UPDATE users SET cpf_crm = CASE 
                    WHEN user_type = 'admin' THEN 'ADMIN123'
                    WHEN user_type = 'medico' THEN 'CRM12345'
                    WHEN user_type = 'prestador' THEN '123.456.789-00'
                    ELSE 'N/A'
                  END`, (err) => {
            if (err) {
              console.error('Erro ao atualizar cpf_crm:', err.message);
            } else {
              console.log('✅ Valores padrão de cpf_crm definidos!');
            }
            db.close();
          });
        }
      });
    }
  });
});