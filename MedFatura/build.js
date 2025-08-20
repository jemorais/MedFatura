#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Iniciando build para produção...');

// 1. Limpar diretório dist
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true });
  console.log('✅ Diretório dist limpo');
}

// 2. Criar diretório dist
fs.mkdirSync('dist', { recursive: true });

// 3. Build do React app
console.log('📦 Fazendo build do React app...');
try {
  execSync('npm run build:react', { stdio: 'inherit' });
  console.log('✅ Build do React concluído');
} catch (error) {
  console.error('❌ Erro no build do React:', error.message);
  process.exit(1);
}

// 4. Copiar arquivos estáticos
console.log('📁 Copiando arquivos estáticos...');
const staticFiles = [
  'src/react-app/dist',
  'uploads'
];

staticFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const dest = path.join('dist', path.basename(file));
    fs.cpSync(file, dest, { recursive: true });
    console.log(`✅ Copiado: ${file} -> ${dest}`);
  }
});

// 5. Criar arquivo de configuração para Workers
const workerConfig = {
  name: 'MedFatura',
  version: require('./package.json').version,
  buildTime: new Date().toISOString(),
  environment: 'production'
};

fs.writeFileSync(
  'dist/worker-config.json',
  JSON.stringify(workerConfig, null, 2)
);

console.log('✅ Configuração do worker criada');

// 6. Verificar arquivos essenciais
const essentialFiles = [
  'dist/index.html',
  'dist/assets',
  'src/worker/index.ts'
];

let allFilesExist = true;
essentialFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    console.error(`❌ Arquivo essencial não encontrado: ${file}`);
    allFilesExist = false;
  }
});

if (!allFilesExist) {
  console.error('❌ Build falhou - arquivos essenciais não encontrados');
  process.exit(1);
}

console.log('🎉 Build concluído com sucesso!');
console.log('📋 Próximos passos:');
console.log('   1. Configure as variáveis de ambiente no Cloudflare');
console.log('   2. Execute: wrangler deploy');
console.log('   3. Teste a aplicação em produção');