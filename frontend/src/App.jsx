import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Routes, Route } from 'react-router-dom';
import Upload from './components/Upload';
import ReceiptManager from './components/ReceiptManager';
import ResultsTable from './components/ResultsTable';
import Sidebar from './components/Sidebar';
import BestSupermarket from './components/BestSupermarket';
import Settings from './components/Settings';
import { useLanguage } from './context/LanguageContext';

function App() {
  const [products, setProducts] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  
  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/products`);
      setProducts(res.data);
    } catch (err) {
      console.error("Error fetching products", err);
    }
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    fetchProducts();
  }, [refreshTrigger]);

  return (
    <div className="d-flex min-vh-100 bg-light">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Wrapper */}
      <div className="flex-grow-1" id="main-content">
         
         {/* Top Navbar for Mobile/Desktop */}
         <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm sticky-top">
            <div className="container-fluid px-4">
               {/* Mobile Toggle Button */}
               <button 
                 className="btn btn-outline-primary d-lg-none me-3" 
                 onClick={() => setIsSidebarOpen(true)}
               >
                 <i className="bi bi-list fs-5"></i>
               </button>

               <span className="navbar-brand fw-bold d-lg-none">{t('appTitle')}</span>
               
               <div className="ms-auto d-flex align-items-center">
                  {/* Language and Notification removed */}
               </div>
            </div>
         </nav>

         <div className="container-fluid px-3 px-md-4 py-4">
             <Routes>
               <Route path="/" element={
                 <div className="row justify-content-center">
                   <div className="col-12 col-xl-10">
                     <div className="row"> {/* Main row for two-column layout */}
                       <div className="col-12 col-xl-6"> {/* Left column for Upload and Results Table */}
                         <section className="mb-4">
                           <Upload onUploadSuccess={triggerRefresh} />
                         </section>
                         <section className="mb-4">
                           <ResultsTable products={products} refresh={triggerRefresh} />
                         </section>
                       </div>
                       <div className="col-12 col-xl-6"> {/* Right column for Best Supermarket */}
                         <section className="mb-4">
                           <BestSupermarket products={products} />
                         </section>
                       </div>
                     </div>
                   </div>
                 </div>
               } />

               <Route path="/receipts" element={
                 <div className="row justify-content-center">
                   <div className="col-12 col-xl-10">
                      <h2 className="fw-bold text-dark mb-4">{t('receiptManagement')}</h2>
                      <ReceiptManager onUpdate={triggerRefresh} refreshSignal={refreshTrigger} />
                   </div>
                 </div>
               } />

               <Route path="/settings" element={
                 <div className="row justify-content-center">
                   <div className="col-12 col-xl-10">
                      <Settings />
                   </div>
                 </div>
               } />
             </Routes>
         </div>
      </div>
      
      <style>{`
        #main-content {
           transition: margin-left 0.3s, margin-right 0.3s;
        }
        @media (min-width: 992px) {
           #main-content {
              margin-left: 260px; /* Match sidebar width */
           }
           [dir="rtl"] #main-content {
              margin-left: 0;
              margin-right: 260px;
           }
        }
      `}</style>
    </div>
  );
}

export default App;