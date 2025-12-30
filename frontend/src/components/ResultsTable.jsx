import React, { useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';

const ResultsTable = ({ products, refresh }) => {
  const { t } = useLanguage();

  // 1. Calculate unique stores from the full product list
  const uniqueStores = useMemo(() => {
    const stores = new Set();
    products.forEach(p => {
      if (p.entries) {
        p.entries.forEach(e => stores.add(e.store));
      }
    });
    return Array.from(stores);
  }, [products]);

  // 2. Filter products that exist in ALL unique stores
  const filteredProducts = useMemo(() => {
    if (uniqueStores.length === 0) return [];
    
    return products.filter(p => {
      if (!p.entries) return false;
      const productStores = new Set(p.entries.map(e => e.store));
      // strict intersection: must be present in every store found in the dataset
      return uniqueStores.every(s => productStores.has(s));
    });
  }, [products, uniqueStores]);

  return (
    <div className="card shadow-sm">
      <div className="card-body pb-2">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="card-title mb-0">{t('resultsTitle')}</h5>
          <button onClick={refresh} className="btn btn-sm btn-outline-secondary">{t('refresh')}</button>
        </div>
        {uniqueStores.length > 1 && (
          <div className="alert alert-info py-2 px-3 small mb-2">
            <i className="bi bi-info-circle me-2"></i>
            {t('showingCommonProducts').replace('{count}', uniqueStores.length)} <strong>{uniqueStores.join(', ')}</strong>
          </div>
        )}
      </div>
      <div className="table-responsive">
        <table className="table table-hover mb-0">
          <thead className="table-light">
            <tr>
              <th>{t('productName')}</th>
              <th>{t('pricesFound')}</th>
              <th>{t('bestPrice')}</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan="3" className="text-center py-4 text-muted">
                  {t('noData')}
                </td>
              </tr>
            ) : filteredProducts.length === 0 ? (
              <tr>
                 <td colSpan="3" className="text-center py-4 text-muted">
                    {t('noCommonProducts')}
                 </td>
              </tr>
            ) : (
              filteredProducts.map((item, idx) => {
                const prices = item.entries.map(e => e.price);
                const minPrice = Math.min(...prices);
                
                return (
                  <tr key={idx}>
                    <td className="fw-medium">{item.name}</td>
                    <td>
                      <ul className="list-unstyled mb-0 small">
                        {item.entries.map((entry, eIdx) => (
                          <li key={eIdx} className={entry.price === minPrice ? "text-success fw-bold" : ""}>
                            {entry.price.toFixed(2)} - {entry.store}
                            <span className="text-muted ms-2" style={{fontSize: '0.8em'}}>
                              ({new Date(entry.date).toLocaleDateString()})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="text-success fw-bold">
                      {minPrice.toFixed(2)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsTable;
