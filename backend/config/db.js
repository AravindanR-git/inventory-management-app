// backend/config/db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// Use env var if provided (useful on Render) otherwise use local inventory.db
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(__dirname, 'inventory.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to SQLite database at', dbPath);
  }
});

db.serialize(() => {
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      unit TEXT,
      category TEXT,
      brand TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      status TEXT,
      image TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventory_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      old_quantity INTEGER,
      new_quantity INTEGER,
      change_date TEXT,
      user_info TEXT,
      FOREIGN KEY(product_id) REFERENCES products(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  // Seed admin user (only if not exists)
  const adminUser = 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123'; // set via env in production
  db.get('SELECT * FROM users WHERE username = ?', [adminUser], (err, row) => {
    if (err) {
      console.error('Error checking admin user', err);
      return;
    }
    if (!row) {
      // Synchronous hash is fine during startup
      const hashed = bcrypt.hashSync(adminPassword, 10);
      db.run('INSERT INTO users (username, password) VALUES (?, ?)', [adminUser, hashed], (err) => {
        if (err) console.error('Failed to seed admin user', err.message);
        else console.log(`Seeded admin user (username: ${adminUser})`);
      });
    } else {
      console.log('Admin user already exists.');
    }
  });

  // Seed initial products if table is empty
  db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
    if (err) {
      console.error('Error counting products', err.message);
      return;
    }

    if (row.count === 0) {
      const seedProducts = [
        { name: 'Apple', unit: 'kg', category: 'Fruits', brand: 'FreshFarm', stock: 50, status: 'In Stock', image: '' },
        { name: 'Banana', unit: 'dozen', category: 'Fruits', brand: 'Tropics', stock: 30, status: 'In Stock', image: '' },
        { name: 'Milk', unit: 'liter', category: 'Dairy', brand: 'DairyPure', stock: 0, status: 'Out of Stock', image: '' },
      ];

      const stmt = db.prepare(`INSERT INTO products (name, unit, category, brand, stock, status, image) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      seedProducts.forEach(p => {
        stmt.run([p.name, p.unit, p.category, p.brand, p.stock, p.status, p.image]);
      });
      stmt.finalize(() => console.log('Seeded initial products!'));
    } else {
      console.log('Products table already has data.');
    }
  });
});

module.exports = db;
