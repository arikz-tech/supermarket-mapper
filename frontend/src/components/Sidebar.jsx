import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';
import { useLanguage } from '../context/LanguageContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { t } = useLanguage();

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${isOpen ? 'show' : ''}`} 
        onClick={onClose}
      ></div>

      {/* Sidebar Component */}
      <nav className={`sidebar ${isOpen ? 'mobile-show' : ''}`}>
        <div className="sidebar-header d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
             <div className="bg-primary text-white rounded p-1 me-2 d-flex justify-content-center align-items-center" style={{width: '35px', height: '35px'}}>
                <i className="bi bi-basket2-fill fs-5"></i>
             </div>
             <div>
               <h5 className="mb-0 fw-bold">ReceiptMap</h5>
             </div>
          </div>
          {/* Close button for mobile inside sidebar */}
          <button className="btn btn-link text-white d-md-none" onClick={onClose}>
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="py-3">
          <ul className="list-unstyled components mb-0">
            <li className="mb-1">
              <NavLink 
                to="/" 
                className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <i className="bi bi-speedometer2"></i>
                {t('sidebar.dashboard')}
              </NavLink>
            </li>
            <li className="mb-1">
              <NavLink 
                to="/receipts" 
                className={({ isActive }) => `nav-link-custom ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <i className="bi bi-receipt"></i>
                {t('sidebar.receipts')}
              </NavLink>
            </li>
          </ul>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;