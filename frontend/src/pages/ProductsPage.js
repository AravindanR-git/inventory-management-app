import React, { useEffect, useState,useCallback } from 'react';
import api from '../api';
import ProductTable from '../components/ProductTable';

const ProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    unit: '',
    category: '',
    brand: '',
    stock: 0,
    status: 'In Stock',
    image: ''
  });

  const [historyModal, setHistoryModal] = useState({ show: false, data: [], productName: '' });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch products
 const fetchProducts = useCallback(async () => {
  try {
    const res = await api.get('/products', {
      params: { name: searchName, category: filterCategory }
    });
    setProducts(res.data);
    const cats = [...new Set(res.data.map(p => p.category))];
    setCategories(cats);
  } catch (err) {
    console.error(err);
  }
}, [searchName, filterCategory]);
  useEffect(() => {
    fetchProducts();
    setCurrentPage(1); // reset page on search/filter change
  }, [fetchProducts]);

  // Handle Add Product Modal
  const handleAddChange = (e) => {
    setNewProduct({ ...newProduct, [e.target.name]: e.target.value });
  };

  const handleAddProduct = async () => {
    try {
      await api.post('/products', newProduct);
      setShowAddModal(false);
      setNewProduct({ name: '', unit: '', category: '', brand: '', stock: 0, status: 'In Stock', image: '' });
      fetchProducts();
    } catch (err) {
      console.error(err);
      alert('Failed to add product');
    }
  };

  // Handle CSV import
  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      await api.post('/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchProducts();
    } catch (err) {
      console.error(err);
      alert('CSV import failed');
    }
  };

  // Export CSV
  const handleExportCSV = async () => {
    try {
      const res = await api.get('/products/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'products.csv');
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  // Open History Modal
  const handleViewHistory = async (productId, productName) => {
    try {
      const res = await api.get(`/products/${productId}/history`);
      setHistoryModal({ show: true, data: res.data, productName });
    } catch (err) {
      console.error(err);
      alert('Failed to fetch history');
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const paginatedProducts = products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ padding: '20px', backgroundColor: '#f9fafb', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ marginBottom: '20px', textAlign: 'center', color: '#333' }}>Inventory Management</h1>

      {/* Controls */}
      <div style={{
        marginBottom: '15px',
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        <button onClick={() => setShowAddModal(true)}
          style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Add Product
        </button>
        <button onClick={handleExportCSV}
          style={{ padding: '8px 16px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Export CSV
        </button>
        <label style={{
          padding: '8px 16px',
          backgroundColor: '#FF9800',
          color: 'white',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'inline-block'
        }}>
          Import CSV
          <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
        </label>
        <input type="text" placeholder="Search by name" value={searchName} onChange={(e) => setSearchName(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '150px' }} />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', minWidth: '150px' }}>
          <option value="">All Categories</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {/* Product Table */}
      <ProductTable products={paginatedProducts} refreshProducts={fetchProducts} onViewHistory={handleViewHistory} />

      {/* Pagination */}
      <div style={{
        marginTop: '15px',
        display: 'flex',
        gap: '5px',
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
          style={{ padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Prev</button>
        {Array.from({ length: totalPages }, (_, i) => (
          <button key={i} onClick={() => setCurrentPage(i + 1)}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              fontWeight: currentPage === i + 1 ? 'bold' : 'normal',
              cursor: 'pointer'
            }}>{i + 1}</button>
        ))}
        <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
          disabled={currentPage === totalPages}
          style={{ padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Next</button>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '10px'
        }}>
          <div style={{
            backgroundColor: 'white', padding: '20px', borderRadius: '8px',
            width: '100%', maxWidth: '400px'
          }}>
            <h2 style={{ marginBottom: '15px', textAlign: 'center' }}>Add Product</h2>
            <input name="name" placeholder="Name" value={newProduct.name} onChange={handleAddChange} style={{ width: '100%', margin: '5px 0', padding: '6px' }} />
            <input name="unit" placeholder="Unit" value={newProduct.unit} onChange={handleAddChange} style={{ width: '100%', margin: '5px 0', padding: '6px' }} />
            <input name="category" placeholder="Category" value={newProduct.category} onChange={handleAddChange} style={{ width: '100%', margin: '5px 0', padding: '6px' }} />
            <input name="brand" placeholder="Brand" value={newProduct.brand} onChange={handleAddChange} style={{ width: '100%', margin: '5px 0', padding: '6px' }} />
            <input name="stock" type="number" placeholder="Stock" value={newProduct.stock} onChange={handleAddChange} style={{ width: '100%', margin: '5px 0', padding: '6px' }} />
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={handleAddProduct} style={{ backgroundColor: '#4CAF50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 999, padding: '10px'
        }}>
          <div style={{
            backgroundColor: 'white', padding: '20px', borderRadius: '8px',
            width: '100%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ textAlign: 'center', marginBottom: '15px' }}>Inventory History - {historyModal.productName}</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', minWidth: '500px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#eee' }}>
                    <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Old Qty</th>
                    <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>New Qty</th>
                    <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Change Date</th>
                  </tr>
                </thead>
                <tbody>
                  {historyModal.data.map(h => (
                    <tr key={h.id}>
                      <td style={{ padding: '10px' }}>{h.old_quantity}</td>
                      <td style={{ padding: '10px' }}>{h.new_quantity}</td>
                      <td style={{ padding: '10px' }}>{new Date(h.change_date).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '15px', textAlign: 'right' }}>
              <button onClick={() => setHistoryModal({ show: false, data: [], productName: '' })}
                style={{
                  padding: '6px 12px', borderRadius: '4px', backgroundColor: '#f44336',
                  color: 'white', border: 'none', cursor: 'pointer'
                }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
