import sqlite3 from 'sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const dbPath = './database.sqlite';
const migrationsDir = './migrations';

async function runMigrations() {
  const db = new sqlite3.Database(dbPath);

  // Executar migrações
  const migrations = ['2.sql', '3.sql', '4.sql', '5.sql', '6.sql', '7.sql', '8.sql', '9.sql', '10.sql', '11.sql'];

  console.log('🔄 Executando migrações...');

  for (const migration of migrations) {
    const migrationPath = join(migrationsDir, migration);
    
    if (existsSync(migrationPath)) {
      const sql = readFileSync(migrationPath, 'utf8');
      
      try {
        await new Promise<void>((resolve, reject) => {
          db.exec(sql, (err) => {
            if (err) {
              console.error(`❌ Erro na migração ${migration}:`, err.message);
              reject(err);
            } else {
              console.log(`✅ Migração ${migration} executada com sucesso`);
              resolve();
            }
          });
        });
      } catch (error) {
        console.error(`❌ Falha na migração ${migration}`);
      }
    }
  }

  db.close();
  console.log('🎉 Migrações concluídas!');
}

runMigrations().catch(console.error);