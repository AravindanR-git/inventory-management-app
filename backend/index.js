// backend/index.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const db = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'your_super_secret_key'; // use environment variable in production

const app = express();
const PORT = process.env.PORT || 5000;


// Middleware
app.use(cors());
app.use(express.json());
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expect "Bearer TOKEN"
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user; // This is available in routes
    next();
  });
};

// Multer setup for CSV uploads
const upload = multer({ dest: 'uploads/' });

// ----------------------------
// Test route
app.get('/', (req, res) => {
  res.send('Inventory Management Backend is running');
});
// Login route
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username & password required' });

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  });
});
// ----------------------------
// GET /api/products - list all products, optional search & filter
app.get('/api/products', authenticateToken, (req, res) => {
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (req.query.name) {
    sql += ' AND name LIKE ?';
    params.push(`%${req.query.name}%`);
  }

  if (req.query.category) {
    sql += ' AND category = ?';
    params.push(req.query.category);
  }
  // Sorting
  const sortBy = req.query.sortBy || 'name'; // default sorting by name
  const sortOrder = req.query.sortOrder === 'desc' ? 'DESC' : 'ASC';
  sql += ` ORDER BY ${sortBy} ${sortOrder}`;

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  sql += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ----------------------------
// POST /api/products/import - CSV import
app.post('/api/products/import', authenticateToken, upload.single('csvFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = req.file.path;
  const productsToAdd = [];
  const added = [];
  const skipped = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => productsToAdd.push(row))
    .on('end', () => {
      if (productsToAdd.length === 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'CSV file is empty' });
      }

      let completed = 0;

      productsToAdd.forEach((product) => {
        const { name, unit, category, brand, stock, status, image } = product;

        db.get('SELECT id FROM products WHERE name = ?', [name], (err, row) => {
          if (err) console.error(err.message);

          if (row) {
            skipped.push(name); // duplicate
            completed++;
            if (completed === productsToAdd.length) {
              fs.unlinkSync(filePath);
              return res.json({ added, skipped });
            }
          } else {
            db.run(
              `INSERT INTO products (name, unit, category, brand, stock, status, image)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [name, unit, category, brand, stock || 0, status || 'In Stock', image || ''],
              (err) => {
                if (err) console.error(err.message);
                else added.push(name);

                completed++;
                if (completed === productsToAdd.length) {
                  fs.unlinkSync(filePath);
                  return res.json({ added, skipped });
                }
              }
            );
          }
        });
      });
    });
});



// ----------------------------
// GET /api/products/export - CSV export
app.get('/api/products/export', authenticateToken, (req, res) => {
  const sql = 'SELECT * FROM products';
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    let csvData = 'name,unit,category,brand,stock,status,image\n';
    rows.forEach((p) => {
      csvData += `${p.name || ''},${p.unit || ''},${p.category || ''},${p.brand || ''},${p.stock || 0},${p.status || ''},${p.image || ''}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
    res.status(200).send(csvData);
  });
});

// ----------------------------
// PUT /api/products/:id - Update product and track inventory history
app.put('/api/products/:id',authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, unit, category, brand, stock, status, image, user_info } = req.body;

  if (stock !== undefined && isNaN(stock)) {
    return res.status(400).json({ error: 'Stock must be a number' });
  }

  // Ensure unique name
  db.get('SELECT id FROM products WHERE name = ? AND id != ?', [name, id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: 'Product name must be unique' });

    // Get current stock
    db.get('SELECT stock FROM products WHERE id = ?', [id], (err, product) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!product) return res.status(404).json({ error: 'Product not found' });

      const oldStock = product.stock;

      // Update product
      db.run(
        `UPDATE products SET name=?, unit=?, category=?, brand=?, stock=?, status=?, image=? WHERE id=?`,
        [name, unit, category, brand, stock, status, image, id],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });

          // Track inventory history if stock changed
          if (stock !== undefined && oldStock !== stock) {
            db.run(
              `INSERT INTO inventory_history (product_id, old_quantity, new_quantity, change_date, user_info)
               VALUES (?, ?, ?, ?, ?)`,
              [id, oldStock, stock, new Date().toISOString(), user_info || null]
            );
          }

          res.json({ message: 'Product updated successfully' });
        }
      );
    });
  });
});

// ----------------------------
// GET /api/products/:id/history - fetch inventory history
app.get('/api/products/:id/history',authenticateToken, (req, res) => {
  const { id } = req.params;
  db.all(
    'SELECT * FROM inventory_history WHERE product_id = ? ORDER BY change_date DESC',
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ----------------------------
// DELETE /api/products/:id
app.delete('/api/products/:id',authenticateToken, (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM products WHERE id=?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Product deleted successfully' });
  });
});

// ----------------------------
// POST /api/products - Add new product
app.post('/api/products',authenticateToken, (req, res) => {
  const { name, unit, category, brand, stock, status, image } = req.body;

  if (!name) return res.status(400).json({ error: 'Product name is required' });

  db.get('SELECT id FROM products WHERE name = ?', [name], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: 'Product name must be unique' });

    db.run(
      `INSERT INTO products (name, unit, category, brand, stock, status, image)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, unit, category, brand, stock || 0, status || (stock > 0 ? 'In Stock' : 'Out of Stock'), image || ''],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Product added successfully', id: this.lastID });
      }
    );
  });
});

// ----------------------------
// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
