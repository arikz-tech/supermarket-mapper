import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ReceiptManager = ({ onUpdate, refreshSignal }) => {
  const [receipts, setReceipts] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  const fetchReceipts = async () => {
    try {
      const res = await axios.get('/api/receipts');
      setReceipts(res.data);
    } catch (err) {
      console.error("Error fetching receipts", err);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [onUpdate, refreshSignal]); // Refresh when parent triggers update

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this receipt? This will remove all associated products.")) return;

    try {
      await axios.delete(`/api/receipts/${id}`);
      fetchReceipts();
      onUpdate(); // Tell parent to refresh products table
    } catch (err) {
      alert("Failed to delete");
    }
  };

  // Helper to determine image source
  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.includes('mock_image')) return null; // Or handle local sample files if served
    return `/api/uploads/${path}`; 
  };

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Uploaded Receipts</h5>
        <button onClick={fetchReceipts} className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-clockwise"></i> Refresh
        </button>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Date</th>
                <th>Store</th>
                <th>Total</th>
                <th>Preview</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-3 text-muted">No receipts uploaded yet.</td>
                </tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.date_time).toLocaleDateString()}</td>
                    <td>{r.store_name}</td>
                    <td>${r.total_price.toFixed(2)}</td>
                    <td>
                      {getImageUrl(r.image_path) ? (
                        <img 
                          src={getImageUrl(r.image_path)} 
                          alt="Receipt" 
                          className="rounded border"
                          style={{ height: '50px', width: 'auto', objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => setSelectedImage(getImageUrl(r.image_path))}
                        />
                      ) : (
                        <span className="text-muted small">No Image</span>
                      )}
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-outline-danger" 
                        onClick={() => handleDelete(r.id)}
                        title="Delete Receipt"
                      >
                        <i className="bi bi-trash"></i> Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="modal fade show d-block" tabIndex="-1" onClick={() => setSelectedImage(null)} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Receipt Preview</h5>
                <button type="button" className="btn-close" onClick={() => setSelectedImage(null)}></button>
              </div>
              <div className="modal-body text-center p-0 bg-light">
                <img src={selectedImage} alt="Receipt Full" className="img-fluid" style={{ maxHeight: '80vh' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptManager;
