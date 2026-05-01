import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Shell from './components/Shell';
import UploadPage from './pages/UploadPage';
import QuizPage from './pages/QuizPage';
import ResultsPage from './pages/ResultsPage';

export default function App() {
  return (
    <Router>
      <Shell>
        <Routes>
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/quiz" element={<QuizPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="*" element={<Navigate to="/upload" replace />} />
        </Routes>
      </Shell>
    </Router>
  );
}
