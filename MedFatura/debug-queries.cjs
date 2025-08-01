const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

console.log('=== Debugging SQL Queries ===\n');

// Test individual queries
db.serialize(() => {
  console.log('1. Testing user count query...');
  db.get("SELECT COUNT(*) as total FROM users WHERE is_active = 1", (err, row) => {
    if (err) {
      console.error('User count error:', err);
    } else {
      console.log('User count result:', row);
    }
  });

  console.log('2. Testing invoice count query...');
  db.get("SELECT COUNT(*) as total FROM invoices", (err, row) => {
    if (err) {
      console.error('Invoice count error:', err);
    } else {
      console.log('Invoice count result:', row);
    }
  });

  console.log('3. Testing pending query...');
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const pendingQuery = `
    SELECT COUNT(*) as total FROM users u 
    WHERE u.user_type = 'medico' AND u.is_active = 1 
    AND u.id NOT IN (
      SELECT DISTINCT i.user_id FROM invoices i 
      WHERE i.month = ? AND i.year = ?
    )
  `;
  
  db.get(pendingQuery, [currentMonth, currentYear], (err, row) => {
    if (err) {
      console.error('Pending query error:', err);
    } else {
      console.log('Pending query result:', row);
    }
  });
});

setTimeout(() => {
  db.close();
}, 2000);