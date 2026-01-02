import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import { useLanguage } from '../context/LanguageContext';

const Upload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [message, setMessage] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [url, setUrl] = useState('');
  
  const { t } = useLanguage();
  const webcamRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleScrape = async () => {
    if (!url) return;
    
    setUploading(true);
    setMessage(t('upload.processing')); // Reusing processing message

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/scrape`, { url });
      setMessage(t('upload.uploadSuccess'));
      
      setUrl('');
      setShowUrlInput(false);
      onUploadSuccess();
      
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage(t('upload.uploadError') + ' ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const performScan = async (fileToScan) => {
    if (!fileToScan || !fileToScan.type.startsWith('image/')) return;
    
    setIsScanning(true);
    // Optional: setMessage(t('upload.scanning')); 
    
    const formData = new FormData();
    formData.append('receiptImage', fileToScan);

    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success && res.data.processedUrl) {
        // Construct full URL
        const baseUrl = import.meta.env.VITE_API_URL.replace(/\/$/, '');
        const finalUrl = `${baseUrl}${res.data.processedUrl}`;

        // Update preview to show the processed image
        setPreview(finalUrl + '?t=' + Date.now());

        // Fetch the processed image to update the 'file' state
        const imageRes = await fetch(finalUrl);
        const imageBlob = await imageRes.blob();
        const processedFile = new File([imageBlob], "processed_" + fileToScan.name, { type: "image/jpeg" });
        setFile(processedFile);
        setMessage(t('upload.scan') + ": Success"); // Or just clear message
      } else {
        // Fallback to original (already set)
        console.log("Scan failed, using original.");
        // setMessage("Auto-crop failed, using original.");
      }
    } catch (err) {
      console.error("Scan error:", err);
      // setMessage("Auto-crop error, using original.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      if (selected.type.startsWith('image/')) {
        setPreview(URL.createObjectURL(selected));
        // Trigger auto-scan
        performScan(selected);
      } else {
        setPreview('pdf');
      }
      setShowCamera(false);
      setMessage('');
    }
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      // Convert base64 to blob
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
          setFile(file);
          setPreview(imageSrc);
          setShowCamera(false);
          setMessage('');
          // Trigger auto-scan
          performScan(file);
        });
    }
  }, [webcamRef]);

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('receiptImage', file);

    setUploading(true);
    setMessage(t('upload.uploading'));

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessage(t('upload.uploadSuccess'));
      
      // Clear inputs
      setFile(null);
      setPreview(null);
      
      onUploadSuccess(); // Refresh parent
      
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage(t('upload.uploadError') + ' ' + (err.response?.data?.error || err.message));
    } finally {
      setUploading(false);
    }
  };

  const videoConstraints = {
    facingMode: "environment" // Use back camera on mobile
  };

  return (
    <div className="card shadow-sm mx-auto mb-3" style={{ width: '100%' }}>
      <div className="card-body text-center p-3">
        <h5 className="card-title mb-3">{t('uploadTitle')}</h5>
        
        {!showCamera && !preview && !showUrlInput && (
          <div className="mb-2">
             <button 
               className="btn btn-primary btn-sm w-100 mb-2 py-2" 
               onClick={() => setShowCamera(true)}
             >
               <i className="bi bi-camera-fill me-2"></i> {t('upload.openCamera')}
             </button>
             
             <input 
               type="file" 
               ref={fileInputRef}
               className="d-none" 
               accept="image/*,application/pdf" 
               onChange={handleFileChange} 
             />
             <button 
               className="btn btn-outline-primary btn-sm w-100 mb-2 py-2" 
               onClick={() => fileInputRef.current.click()}
             >
               <i className="bi bi-upload me-2"></i> {t('upload.selectFile')}
             </button>

             <button 
               className="btn btn-outline-secondary btn-sm w-100 py-2" 
               onClick={() => setShowUrlInput(true)}
             >
               <i className="bi bi-link-45deg me-2"></i> {t('upload.digitalUrl')}
             </button>
          </div>
        )}

        {showUrlInput && (
          <div className="mb-3">
            <label className="form-label">{t('upload.receiptUrl')}</label>
            <input 
              type="text" 
              className="form-control mb-2" 
              placeholder="https://..." 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <div className="d-flex justify-content-center gap-2">
              <button className="btn btn-secondary" onClick={() => setShowUrlInput(false)}>{t('upload.cancel')}</button>
              <button 
                className="btn btn-success" 
                onClick={handleScrape} 
                disabled={uploading || !url}
              >
                {uploading ? (
                  <span><span className="spinner-border spinner-border-sm me-2"></span>{t('upload.processing')}</span>
                ) : t('upload.scrapeSave')}
              </button>
            </div>
          </div>
        )}

        {showCamera && (
          <div className="mb-3 position-relative">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="img-fluid rounded border bg-dark"
              style={{ width: '100%', maxHeight: '400px' }}
            />
            <div className="mt-2 d-flex justify-content-center gap-2">
              <button className="btn btn-danger" onClick={() => setShowCamera(false)}>{t('upload.cancel')}</button>
              <button className="btn btn-success" onClick={capture}>{t('upload.capture')}</button>
            </div>
          </div>
        )}

        {preview && (
          <div className="mb-3">
            {preview === 'pdf' ? (
              <div className="text-center p-4 border rounded mb-3 bg-light">
                <i className="bi bi-file-earmark-pdf-fill" style={{ fontSize: '4rem', color: '#dc3545' }}></i>
                <p className="mt-2 mb-0 fw-bold">{file?.name}</p>
              </div>
            ) : (
              <div className="position-relative d-inline-block">
                <img 
                   src={preview} 
                   alt="Preview" 
                   className="img-fluid rounded border mb-3" 
                   style={{ maxHeight: '400px', opacity: isScanning ? 0.5 : 1 }} 
                />
                {isScanning && (
                  <div className="position-absolute top-50 start-50 translate-middle">
                     <div className="spinner-border text-primary" role="status">
                       <span className="visually-hidden">Scanning...</span>
                     </div>
                     <div className="fw-bold text-primary mt-2" style={{ textShadow: '0 0 3px white' }}>
                       {t('upload.scanning')}
                     </div>
                  </div>
                )}
              </div>
            )}
            <div className="d-flex justify-content-center gap-2 flex-wrap">
              <button className="btn btn-outline-secondary" onClick={() => { setFile(null); setPreview(null); }}>
                {t('upload.cancel')}
              </button>
              
              <button 
                className="btn btn-success" 
                onClick={handleUpload} 
                disabled={uploading || isScanning}
              >
                {uploading ? (
                  <span><span className="spinner-border spinner-border-sm me-2"></span>{t('upload.processing')}</span>
                ) : t('upload.confirmUpload')}
              </button>
            </div>
          </div>
        )}

        {message && (
          <div className={`mt-3 alert ${message.includes('Error') || message.includes('failed') ? 'alert-danger' : 'alert-success'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Upload;