import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('database.sqlite');

console.log('=== Verificando convites ===');

// Verificar todos os convites
db.all('SELECT * FROM user_invitations ORDER BY created_at DESC', (err, invites) => {
  if (err) {
    console.error('Erro ao buscar convites:', err);
  } else {
    console.log('Total de convites encontrados:', invites.length);
    console.table(invites);
    
    // Filtrar convites da Isabelle
    const isabelleInvites = invites.filter(invite => 
      invite.email?.toLowerCase().includes('isabelle') || 
      invite.name?.toLowerCase().includes('isabelle')
    );
    
    console.log('\n=== Convites da Isabelle ===');
    console.log('Convites da Isabelle encontrados:', isabelleInvites.length);
    if (isabelleInvites.length > 0) {
      console.table(isabelleInvites);
      
      // Verificar status de cada convite
      isabelleInvites.forEach(invite => {
        const now = new Date();
        const expiresAt = new Date(invite.expires_at);
        const isExpired = expiresAt < now;
        const isPending = !invite.is_used && !isExpired;
        
        console.log(`\nConvite ID ${invite.id}:`);
        console.log(`- Email: ${invite.email}`);
        console.log(`- Nome: ${invite.name}`);
        console.log(`- Usado: ${invite.is_used ? 'Sim' : 'Não'}`);
        console.log(`- Expira em: ${invite.expires_at}`);
        console.log(`- Expirado: ${isExpired ? 'Sim' : 'Não'}`);
        console.log(`- Pendente: ${isPending ? 'Sim' : 'Não'}`);
      });
    }
  }
  
  db.close();
});