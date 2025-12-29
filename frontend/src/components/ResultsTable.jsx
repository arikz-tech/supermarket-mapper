import React from 'react';
import { useLanguage } from '../context/LanguageContext';

const ResultsTable = ({ products, refresh }) => {
  const { t } = useLanguage();

  return (
    <div className="card shadow-sm">
      <div className="card-body pb-2">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="card-title mb-0">{t('resultsTitle')}</h5>
          <button onClick={refresh} className="btn btn-sm btn-outline-secondary">{t('refresh')}</button>
        </div>
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
            ) : (
              products.map((item, idx) => {
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
