import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { BrainCircuit, Upload } from 'lucide-react';
import QuizPage from './pages/QuizPage';
import UploadPage from './pages/UploadPage';
import './App.css';

function Navigation() {
  const location = useLocation();
  
  return (
    <nav style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '2rem',
      padding: '1.5rem',
      position: 'relative',
      zIndex: 10
    }}>
      <Link 
        to="/" 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: location.pathname === '/' ? 'var(--primary-color)' : 'var(--text-secondary)',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '1.1rem',
          padding: '0.5rem 1rem',
          borderRadius: '12px',
          background: location.pathname === '/' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
          transition: 'all 0.2s ease'
        }}
      >
        <BrainCircuit size={24} />
        Quiz App
      </Link>
      
      <Link 
        to="/upload" 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: location.pathname === '/upload' ? 'var(--primary-color)' : 'var(--text-secondary)',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '1.1rem',
          padding: '0.5rem 1rem',
          borderRadius: '12px',
          background: location.pathname === '/upload' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
          transition: 'all 0.2s ease'
        }}
      >
        <Upload size={24} />
        Upload PDF
      </Link>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="app-container">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        
        <Navigation />

        <div style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={<QuizPage />} />
            <Route path="/upload" element={<UploadPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
