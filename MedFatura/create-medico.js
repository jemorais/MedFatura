import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🏥 Criando usuário médico para Solange Gomes...');

const medicoData = {
  email: 'solange.gomes@medfatura.com',
  password: 'medico123',
  name: 'Solange Gomes',
  cpf_crm: 'CRM: 56706',
  user_type: 'medico'
};

// Função para criar médico
const createMedico = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Verificar se já existe
      db.get('SELECT id FROM users WHERE email = ?', [medicoData.email], (err, row) => {
        if (err) {
          console.error('Erro ao verificar usuário:', err.message);
          reject(err);
          return;
        }

        if (row) {
          console.log('⚠️ Usuário já existe:', medicoData.email);
          resolve('existe');
        } else {
          // Inserir novo médico
          db.run(
            'INSERT INTO users (email, password_hash, name, cpf_crm, user_type, email_verified, is_active) VALUES (?, ?, ?, ?, ?, 1, 1)',
            [medicoData.email, medicoData.password, medicoData.name, medicoData.cpf_crm, medicoData.user_type],
            function(err) {
              if (err) {
                console.error('Erro ao criar médico:', err.message);
                reject(err);
              } else {
                console.log('✅ Médico criado com sucesso!');
                console.log('📧 Email:', medicoData.email);
                console.log('🔑 Senha:', medicoData.password);
                console.log('👩‍⚕️ Nome:', medicoData.name);
                console.log('📋 CRM:', medicoData.cpf_crm);
                resolve('criado');
              }
            }
          );
        }
      });
    });
  });
};

// Executar e aguardar
await createMedico();

db.close((err) => {
  if (err) {
    console.error('Erro ao fechar banco:', err.message);
  } else {
    console.log('🏥 Processo concluído com sucesso!');
  }
});