import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileType, CheckCircle, AlertCircle, PlayCircle, Loader2, FileText, Brain, PenTool, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const stepsList = [
  { id: 1, title: 'Upload Document', desc: 'Sending PDF to server securely', icon: <UploadCloud size={20} /> },
  { id: 2, title: 'Text Extraction (OCR)', desc: 'Reading content and structure', icon: <FileText size={20} /> },
  { id: 3, title: 'AI Analysis', desc: 'Extracting academic concepts and facts', icon: <Brain size={20} /> },
  { id: 4, title: 'Quiz Generation', desc: 'Writing challenging multiple choice questions', icon: <PenTool size={20} /> },
  { id: 5, title: 'Finalizing', desc: 'Formatting and validating quiz data', icon: <Database size={20} /> },
];

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [resultData, setResultData] = useState<any>(null);
  const [modelName, setModelName] = useState('gemini-3.1-flash-lite-preview');
  const [currentStep, setCurrentStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>, t3: ReturnType<typeof setTimeout>, t4: ReturnType<typeof setTimeout>;
    
    if (status === 'uploading' || status === 'processing') {
      setCurrentStep(1); // Upload
      
      // Simulated progress since the backend does not stream events
      t1 = setTimeout(() => setCurrentStep(2), 2000); // OCR
      t2 = setTimeout(() => setCurrentStep(3), 8000); // AI Analysis
      t3 = setTimeout(() => setCurrentStep(4), 18000); // Quiz Generation
      t4 = setTimeout(() => setCurrentStep(5), 35000); // Finalizing
      
    } else if (status === 'success') {
      setCurrentStep(6);
    } else {
      setCurrentStep(0);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [status]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setStatus('idle');
      } else {
        setErrorMessage('Please upload a valid PDF file.');
        setStatus('error');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setStatus('idle');
      } else {
        setErrorMessage('Please upload a valid PDF file.');
        setStatus('error');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus('processing');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model_name', modelName);

    try {
      // We will point to the FastAPI backend running on port 8000
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setResultData(data);
      setStatus('success');
      
    } catch (error: any) {
      console.error("Upload error:", error);
      setErrorMessage(error.message || 'An error occurred during upload or processing.');
      setStatus('error');
    }
  };

  const downloadJson = () => {
    if (!resultData || !resultData.data) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(resultData.data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", file ? file.name.replace('.pdf', '_questions.json') : "generated_questions.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 className="title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Upload Course PDF</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Let AI generate a complete quiz from your study material.
        </p>
      </div>

      {!resultData && status !== 'processing' && status !== 'uploading' && (
        <div 
          className={`upload-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--primary-color)' : 'rgba(255,255,255,0.2)'}`,
            borderRadius: '16px',
            padding: '3rem',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDragging ? 'rgba(99, 102, 241, 0.1)' : 'rgba(0,0,0,0.2)',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".pdf" 
            style={{ display: 'none' }} 
          />
          
          {file ? (
            <>
              <FileType size={64} color="var(--primary-color)" style={{ marginBottom: '1rem' }} />
              <h3 style={{ margin: '0', color: 'var(--text-primary)' }}>{file.name}</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </>
          ) : (
            <>
              <UploadCloud size={64} color="var(--text-secondary)" style={{ marginBottom: '1rem' }} />
              <h3 style={{ margin: '0', color: 'var(--text-primary)' }}>Click or Drag and Drop</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>PDF files only</p>
            </>
          )}
        </div>
      )}

      {status === 'idle' && file && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Model</label>
            <select 
              value={modelName} 
              onChange={(e) => setModelName(e.target.value)}
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            >
              <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Flash Lite Preview</option>
              <option value="gemma-3-27b-it">Gemma 3 27B IT</option>
              <option value="gemma-3n-e4b-it">Gemma 3N E4B IT</option>
            </select>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '12px', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
          <AlertCircle color="#ef4444" />
          <p style={{ color: '#ef4444', margin: 0 }}>{errorMessage}</p>
        </div>
      )}

      {status === 'idle' && file && (
        <button 
          className="btn-primary" 
          onClick={handleUpload} 
          disabled={!file}
          style={{ width: '100%', padding: '1rem', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 600 }}
        >
          Generate Quiz
        </button>
      )}

      {(status === 'uploading' || status === 'processing') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '500px', margin: '0 auto', background: 'rgba(0,0,0,0.2)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>AI is processing your document</h3>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>This usually takes a few minutes for complete OCR and analysis.</p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {stepsList.map((step) => {
               const isActive = currentStep === step.id;
               const isCompleted = currentStep > step.id;
               const isPending = currentStep < step.id;
               
               return (
                 <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', opacity: isPending ? 0.4 : 1, transition: 'all 0.4s ease', transform: isActive ? 'scale(1.02)' : 'scale(1)' }}>
                   <div style={{ 
                     width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     background: isCompleted ? 'rgba(16, 185, 129, 0.2)' : isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.05)',
                     border: `2px solid ${isCompleted ? '#10b981' : isActive ? 'var(--primary-color)' : 'transparent'}`,
                     color: isCompleted ? '#10b981' : isActive ? 'var(--primary-color)' : 'var(--text-secondary)',
                     transition: 'all 0.3s ease'
                   }}>
                     {isCompleted ? <CheckCircle size={22} /> : isActive ? <Loader2 className="spinner" size={22} /> : step.icon}
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                     <h4 style={{ margin: 0, color: isCompleted ? '#10b981' : isActive ? 'var(--primary-color)' : 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 600 }}>{step.title}</h4>
                     <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{step.desc}</p>
                   </div>
                 </div>
               );
            })}
          </div>
        </div>
      )}

      {status === 'success' && resultData && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', animation: 'fadeIn 0.5s ease-out', background: 'rgba(16, 185, 129, 0.05)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '-0.5rem' }}>
            <CheckCircle size={48} color="#10b981" />
          </div>
          <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>Processing Complete!</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '1.1rem' }}>
            Successfully generated <strong style={{ color: '#10b981' }}>{resultData.data?.length || 0}</strong> questions from your document.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '0.5rem' }}>
            <button className="btn-primary" onClick={downloadJson} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: 'white' }}>
              Download JSON
            </button>
            <button className="btn-primary" onClick={() => navigate('/', { state: { questions: resultData.data } })} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#10b981', color: 'white' }}>
              <PlayCircle size={20} />
              Start Quiz Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

