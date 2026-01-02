import React, { useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../context/LanguageContext';

const Settings = () => {
  const { language, setLanguage, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const apiBaseUrl = import.meta.env.VITE_API_URL || '';

  const handleDeleteAll = async () => {
    if (!window.confirm(t('settings.deleteAllConfirm'))) return;

    setLoading(true);
    try {
      await axios.delete(`${apiBaseUrl}/api/receipts`);
      alert(t('settings.deleteSuccess'));
    } catch (err) {
      console.error("Error deleting all receipts", err);
      alert(t('settings.deleteError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid">
      <h2 className="fw-bold text-dark mb-4">{t('settings.title')}</h2>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="mb-4">
            <h5 className="card-title mb-3">{t('settings.language')}</h5>
            <div className="d-flex align-items-center">
              <select 
                className="form-select w-auto" 
                value={language} 
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">English</option>
                <option value="he">עברית</option>
              </select>
            </div>
          </div>

          <hr className="my-4" />

          <div>
            <h5 className="card-title text-danger mb-3">{t('settings.dangerZone')}</h5>
            <p className="text-muted small mb-3">{t('settings.deleteAllConfirm')}</p>
            <button 
              className="btn btn-outline-danger" 
              onClick={handleDeleteAll}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  {t('upload.processing')}
                </>
              ) : (
                <>
                  <i className="bi bi-trash3-fill me-2"></i>
                  {t('settings.deleteAllReceipts')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
