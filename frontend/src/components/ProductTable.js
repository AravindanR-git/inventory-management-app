import React, { useState } from 'react';
import api from '../api';

const ProductTable = ({ products, refreshProducts, onViewHistory }) => {
  const [editRowId, setEditRowId] = useState(null);
  const [formData, setFormData] = useState({});

  const handleEditClick = (product) => {
    setEditRowId(product.id);
    setFormData(product);
  };

  const handleCancel = () => {
    setEditRowId(null);
    setFormData({});
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      await api.put(`/products/${editRowId}`, formData);
      setEditRowId(null);
      setFormData({});
      refreshProducts();
    } catch (err) {
      console.error(err);
      alert('Failed to update product');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      refreshProducts();
    } catch (err) {
      console.error(err);
      alert('Failed to delete product');
    }
  };

  const getStockLabelStyle = (status) => {
    if (status.toLowerCase() === 'in stock') return { color: 'green', fontWeight: 'bold' };
    if (status.toLowerCase() === 'out of stock') return { color: 'red', fontWeight: 'bold' };
    return {};
  };

  return (
    <div style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'center' }}>
            <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Name</th>
            <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Unit</th>
            <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Category</th>
            <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Brand</th>
            <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Stock</th>
            <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Status</th>
            <th style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ textAlign: 'center', borderBottom: '1px solid #eee' }}>
              <td>{editRowId === p.id ? <input name="name" value={formData.name} onChange={handleChange} /> : p.name}</td>
              <td>{editRowId === p.id ? <input name="unit" value={formData.unit} onChange={handleChange} /> : p.unit}</td>
              <td>{editRowId === p.id ? <input name="category" value={formData.category} onChange={handleChange} /> : p.category}</td>
              <td>{editRowId === p.id ? <input name="brand" value={formData.brand} onChange={handleChange} /> : p.brand}</td>
              <td>{editRowId === p.id ? <input name="stock" type="number" value={formData.stock} onChange={handleChange} /> : p.stock}</td>
              <td style={getStockLabelStyle(p.status)}>
                {editRowId === p.id ? <input name="status" value={formData.status} onChange={handleChange} /> : p.status}
              </td>
              <td>
                {editRowId === p.id ? (
                  <>
                    <button onClick={handleSave} style={actionBtnStyle}>Save</button>
                    <button onClick={handleCancel} style={actionBtnStyle}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleEditClick(p)} style={actionBtnStyle}>Edit</button>
                    <button onClick={() => handleDelete(p.id)} style={actionBtnStyle}>Delete</button>
                    <button onClick={() => onViewHistory(p.id, p.name)} style={actionBtnStyle}>History</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        /* Responsive table: scroll horizontally on small screens */
        @media (max-width: 768px) {
          table {
            min-width: 600px;
          }
        }

        input {
          width: 90%;
          padding: 4px;
          border-radius: 4px;
          border: 1px solid #ccc;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

// Reusable button style
const actionBtnStyle = {
  padding: '4px 8px',
  margin: '2px',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  backgroundColor: '#2196F3',
  color: 'white'
};

export default ProductTable;
