import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('database.sqlite');

console.log('=== Verificando dados do banco ===');

// Verificar usuários
db.all('SELECT id, email, name, user_type, cpf_crm FROM users', (err, users) => {
  if (err) {
    console.error('Erro ao buscar usuários:', err);
  } else {
    console.log('Usuários encontrados:', users.length);
    console.table(users);
  }

  // Verificar faturas
  db.all('SELECT id, user_id, month, year, original_filename, status FROM invoices', (err, invoices) => {
    if (err) {
      console.error('Erro ao buscar faturas:', err);
    } else {
      console.log('Faturas encontradas:', invoices.length);
      console.table(invoices);
    }

    // Verificar perfis de usuário
    db.all('SELECT id, user_id, name, user_type, cpf_crm FROM user_profiles', (err, profiles) => {
      if (err) {
        console.error('Erro ao buscar perfis:', err);
      } else {
        console.log('Perfis encontrados:', profiles.length);
        console.table(profiles);
      }

      // Verificar relacionamento entre users e user_profiles
      db.all(`
        SELECT u.id as user_id, u.email, u.name, u.user_type, u.cpf_crm, 
               p.id as profile_id, p.user_id as profile_user_id, p.name as profile_name
        FROM users u 
        LEFT JOIN user_profiles p ON u.id = p.user_id
        ORDER BY u.id
      `, (err, userProfiles) => {
        if (err) {
          console.error('Erro ao buscar relacionamento:', err);
        } else {
          console.log('Relacionamento users x user_profiles:', userProfiles.length);
          console.table(userProfiles);
        }

        // Verificar faturas com detalhes do usuário
        db.all(`
          SELECT i.id, i.user_id, i.month, i.year, i.original_filename, i.status, u.email, u.name
          FROM invoices i
          LEFT JOIN users u ON i.user_id = u.id
          ORDER BY i.id
        `, (err, invoicesWithUsers) => {
          if (err) {
            console.error('Erro ao buscar faturas com usuários:', err);
          } else {
            console.log('Faturas com usuários:', invoicesWithUsers.length);
            console.table(invoicesWithUsers);
          }

          db.close();
        });
      });
    });
  });
});