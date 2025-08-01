const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('database.sqlite');

console.log('=== Debugging Stats Calculation ===\n');

// Check users table structure
console.log('1. Users table structure:');
db.serialize(() => {
  db.all("PRAGMA table_info(users)", (err, rows) => {
    if (err) {
      console.log('Error getting users table info:', err.message);
    } else {
      console.log('Columns:', rows.map(col => `${col.name} (${col.type})`).join(', '));
    }

    // Check users data
    console.log('\n2. Users data:');
    db.all("SELECT id, name, email, user_type, is_active FROM users", (err, users) => {
      if (err) {
        console.log('Error getting users:', err.message);
      } else {
        console.log('Total users:', users.length);
        users.forEach(user => {
          console.log(`- ${user.name} (${user.email}): ${user.user_type}, active: ${user.is_active}`);
        });
      }

      // Check invoices data
      console.log('\n3. Invoices data:');
      db.all("SELECT id, user_id, month, year, status FROM invoices", (err, invoices) => {
        if (err) {
          console.log('Error getting invoices:', err.message);
        } else {
          console.log('Total invoices:', invoices.length);
          invoices.forEach(invoice => {
            console.log(`- Invoice ${invoice.id}: user ${invoice.user_id}, ${invoice.month}/${invoice.year}, status: ${invoice.status}`);
          });
        }

        // Test the actual stats queries
        console.log('\n4. Testing stats queries:');

        // Test total invoices
        db.get("SELECT COUNT(*) as total FROM invoices", (err, totalInvoices) => {
          if (err) {
            console.log('Error in total invoices query:', err.message);
          } else {
            console.log('Total invoices query result:', totalInvoices);
          }

          // Test active users
          db.get("SELECT COUNT(*) as total FROM users WHERE is_active = 1", (err, activeUsers) => {
            if (err) {
              console.log('Error in active users query:', err.message);
            } else {
              console.log('Active users query result:', activeUsers);
            }

            // Test pending invoices for current month
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            console.log(`\n5. Testing pending invoices for ${currentMonth}/${currentYear}:`);

            const pendingQuery = `
              SELECT COUNT(*) as total FROM users u 
              WHERE u.user_type = 'medico' AND u.is_active = 1 
              AND u.id NOT IN (
                SELECT DISTINCT i.user_id FROM invoices i 
                WHERE i.month = ? AND i.year = ?
              )
            `;
            db.get(pendingQuery, [currentMonth, currentYear], (err, pendingInvoices) => {
              if (err) {
                console.log('Error in pending invoices query:', err.message);
              } else {
                console.log('Pending invoices query result:', pendingInvoices);
              }

              db.close();
            });
          });
        });
      });
    });
  });
});