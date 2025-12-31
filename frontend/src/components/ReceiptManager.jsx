import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';

const ReceiptManager = ({ onUpdate, refreshSignal }) => {
  const { t } = useLanguage();
  const [receipts, setReceipts] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [editingReceipt, setEditingReceipt] = useState(null);
  const [loading, setLoading] = useState(false);

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
  }, [onUpdate, refreshSignal]); 

  const handleDelete = async (id) => {
    if (!window.confirm(t('receiptMgr.deleteConfirm'))) return;

    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/receipts/${id}`);
      fetchReceipts();
      onUpdate(); 
    } catch (err) {
      alert("Failed to delete");
    }
  };

  const handleEdit = async (id) => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/receipts/${id}`);
      setEditingReceipt(res.data);
    } catch (err) {
      console.error("Error fetching receipt details", err);
      alert("Failed to load receipt details.");
    } finally {
      setLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editingReceipt) return;

    setLoading(true);
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/receipts/${editingReceipt.id}`, editingReceipt);
      setEditingReceipt(null);
      fetchReceipts();
      onUpdate();
    } catch (err) {
      console.error("Error updating receipt", err);
      alert("Failed to update receipt.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to determine image source
  const getImageUrl = (path) => {
    if (!path) return null;
    if (path.includes('mock_image')) return null; 
    return `${import.meta.env.VITE_API_URL}/api/uploads/${path}`; 
  };

  // Edit Handlers
  const handleReceiptChange = (field, value) => {
    setEditingReceipt(prev => ({ ...prev, [field]: value }));
  };

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...editingReceipt.products];
    updatedProducts[index][field] = value;
    setEditingReceipt(prev => ({ ...prev, products: updatedProducts }));
  };

  const removeProduct = (index) => {
    const updatedProducts = editingReceipt.products.filter((_, i) => i !== index);
    setEditingReceipt(prev => ({ ...prev, products: updatedProducts }));
  };

  const addProduct = () => {
    setEditingReceipt(prev => ({
      ...prev,
      products: [...prev.products, { name: "", price: 0 }]
    }));
  };

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <h5 className="mb-0">{t('receiptMgr.title')}</h5>
        <button onClick={fetchReceipts} className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-clockwise"></i> {t('refresh')}
        </button>
      </div>
      <div className="card-body p-0">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>{t('receiptMgr.date')}</th>
                <th>{t('receiptMgr.store')}</th>
                <th>{t('receiptMgr.total')}</th>
                <th>{t('receiptMgr.preview')}</th>
                <th>{t('receiptMgr.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-3 text-muted">{t('receiptMgr.noReceipts')}</td>
                </tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.date_time).toLocaleDateString()}</td>
                    <td>{r.store_name}</td>
                    <td>₪{r.total_price.toFixed(2)}</td>
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
                      <div className="d-flex gap-2">
                        <button 
                          className="btn btn-sm btn-outline-primary" 
                          onClick={() => handleEdit(r.id)}
                          title={t('receiptMgr.edit')}
                          disabled={loading}
                        >
                          <i className="bi bi-pencil"></i> {t('receiptMgr.edit')}
                        </button>
                        <button 
                          className="btn btn-sm btn-outline-danger" 
                          onClick={() => handleDelete(r.id)}
                          title={t('receiptMgr.delete')}
                        >
                          <i className="bi bi-trash"></i> {t('receiptMgr.delete')}
                        </button>
                      </div>
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
                <h5 className="modal-title">{t('receiptMgr.previewTitle')}</h5>
                <button type="button" className="btn-close" onClick={() => setSelectedImage(null)}></button>
              </div>
              <div className="modal-body text-center p-0 bg-light">
                <img src={selectedImage} alt="Receipt Full" className="img-fluid" style={{ maxHeight: '80vh' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Receipt Modal */}
      {editingReceipt && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{t('receiptMgr.editModalTitle')}</h5>
                <button type="button" className="btn-close" onClick={() => setEditingReceipt(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label">{t('receiptMgr.storeName')}</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={editingReceipt.store_name || ''} 
                      onChange={(e) => handleReceiptChange('store_name', e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">{t('receiptMgr.modalDate')}</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={editingReceipt.date_time || ''} 
                      onChange={(e) => handleReceiptChange('date_time', e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">{t('receiptMgr.totalPrice')}</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={editingReceipt.total_price || 0} 
                      onChange={(e) => handleReceiptChange('total_price', parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                <h6 className="mb-3 border-bottom pb-2">{t('receiptMgr.products')}</h6>
                {editingReceipt.products && editingReceipt.products.map((prod, idx) => (
                  <div className="row g-2 mb-2 align-items-center" key={idx}>
                    <div className="col-md-7">
                      <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder={t('productName')}
                        value={prod.name}
                        onChange={(e) => handleProductChange(idx, 'name', e.target.value)}
                      />
                    </div>
                    <div className="col-md-3">
                      <input 
                        type="number" 
                        className="form-control form-control-sm" 
                        placeholder={t('bestPrice')}
                        value={prod.price}
                        onChange={(e) => handleProductChange(idx, 'price', e.target.value)}
                      />
                    </div>
                    <div className="col-md-2 text-end">
                      <button className="btn btn-sm btn-outline-danger" onClick={() => removeProduct(idx)}>
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>
                  </div>
                ))}
                
                <button className="btn btn-sm btn-outline-primary mt-2" onClick={addProduct}>
                  <i className="bi bi-plus-lg"></i> {t('receiptMgr.addProduct')}
                </button>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingReceipt(null)} disabled={loading}>{t('receiptMgr.cancel')}</button>
                <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      {t('receiptMgr.saving')}
                    </>
                  ) : t('receiptMgr.saveChanges')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptManager;
