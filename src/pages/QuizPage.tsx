import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import '../App.css';

interface Question {
  question: string;
  options: string[];
  correct_answer: string;
}

const modules = import.meta.glob('../*.json', { eager: true });
const allQuizGroups: Record<string, Question[]> = {};

for (const path in modules) {
  const name = path.replace('../', '').replace('.json', '').replace(/_/g, ' ');
  // Filter out package.json or tsconfig.json if they accidentally got here
  if (path.includes('questions') || (Array.isArray((modules[path] as any).default) && (modules[path] as any).default.length > 0)) {
    allQuizGroups[name] = (modules[path] as any).default as Question[];
  }
}

const MAX_TIME = 3600; // 1 hour in seconds
const MAX_SCORE = 10;

function QuizPage() {
  const location = useLocation();
  const uploadedQuestions = location.state?.questions as Question[] | undefined;

  const availableGroups = uploadedQuestions 
    ? { 'Uploaded Quiz': uploadedQuestions, ...allQuizGroups }
    : allQuizGroups;
    
  const availableGroupNames = Object.keys(availableGroups);

  const [selectedGroup, setSelectedGroup] = useState<string>(
    uploadedQuestions ? 'Uploaded Quiz' : (availableGroupNames[0] || '')
  );

  useEffect(() => {
    if (uploadedQuestions) {
      setSelectedGroup('Uploaded Quiz');
    } else if (!availableGroupNames.includes(selectedGroup)) {
      setSelectedGroup(availableGroupNames[0] || '');
    }
  }, [uploadedQuestions]);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'results' | 'review'>('start');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(MAX_TIME);

  const questions = availableGroups[selectedGroup] || [];
  const WEIGHT_PER_QUESTION = questions.length > 0 ? MAX_SCORE / questions.length : 0;

  useEffect(() => {
    let timer: number;
    if (gameState === 'playing' && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState('results');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => window.clearInterval(timer);
  }, [gameState, timeLeft]);

  const handleStart = () => {
    setGameState('playing');
    setTimeLeft(MAX_TIME);
    setCurrentQuestionIdx(0);
    setSelectedAnswers({});
  };

  const handleAnswerSelect = (option: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestionIdx]: option
    }));
  };

  const handleNext = () => {
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      setGameState('results');
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIdx > 0) {
      setCurrentQuestionIdx(prev => prev - 1);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const calculateScore = () => {
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct_answer) {
        correctCount++;
      }
    });
    return correctCount * WEIGHT_PER_QUESTION;
  };

  return (
    <div className="glass-card quiz-container">
      
      {gameState === 'start' && (
        <div className="start-screen">
          <h1 className="title">IT Management Quiz</h1>
          
          {availableGroupNames.length > 0 ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '400px', margin: '0 auto' }}>
                <label htmlFor="quiz-select" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Select Quiz Group:</label>
                <select 
                  id="quiz-select"
                  value={selectedGroup} 
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'var(--text-primary)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontSize: '1.1rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {availableGroupNames.map(name => (
                    <option key={name} value={name} style={{ background: '#1e293b' }}>
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <p>
                Test your knowledge with these {questions.length} questions.
                You have a maximum of 1 hour to complete the quiz. 
                Each question contributes {WEIGHT_PER_QUESTION.toFixed(2)} points towards a maximum score of {MAX_SCORE}.
              </p>
              <button className="btn-primary" onClick={handleStart} disabled={questions.length === 0}>
                Start Quiz
              </button>
            </>
          ) : (
            <p>No question files found in the source directory.</p>
          )}
        </div>
      )}

      {gameState === 'playing' && (
        <>
          <div className="header">
            <h1 className="title">Quiz</h1>
            <div className={`timer ${timeLeft < 300 ? 'warning' : ''}`}>
              ⏱ {formatTime(timeLeft)}
            </div>
          </div>

          <div className="question-section">
            <div className="question-count">
              <span>Question {currentQuestionIdx + 1}</span>/{questions.length}
            </div>
            <div className="question-text">
              {questions[currentQuestionIdx].question}
            </div>
          </div>

          <div className="options-section">
            {questions[currentQuestionIdx].options.map((option, index) => {
              const isSelected = selectedAnswers[currentQuestionIdx] === option;
              return (
                <button
                  key={index}
                  className={`option-button ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleAnswerSelect(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>

          <div className="controls" style={{ justifyContent: currentQuestionIdx > 0 ? 'space-between' : 'flex-end' }}>
            {currentQuestionIdx > 0 && (
              <button className="btn-primary" onClick={handlePrevious} style={{ background: 'rgba(255,255,255,0.1)' }}>
                Previous
              </button>
            )}
            <button 
              className="btn-primary" 
              onClick={handleNext}
              disabled={!selectedAnswers[currentQuestionIdx]}
            >
              {currentQuestionIdx === questions.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </>
      )}

      {gameState === 'results' && (() => {
        const score = calculateScore();
        const percentage = (score / MAX_SCORE) * 100;
        return (
          <div className="results-section">
            <h1 className="title">Quiz Completed!</h1>
            
            <div className="score-circle" style={{ '--percentage': `${percentage}%` } as React.CSSProperties}>
              <div className="score-text">
                <span className="score-value">{score.toFixed(1)}</span>
                <span className="score-max">/ {MAX_SCORE}</span>
              </div>
            </div>

            <div className="results-details">
              <p>You answered <strong>{score / WEIGHT_PER_QUESTION}</strong> out of <strong>{questions.length}</strong> questions correctly.</p>
              <p>Time remaining: <strong>{formatTime(timeLeft)}</strong></p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn-primary" onClick={() => setGameState('review')} style={{ background: 'rgba(255,255,255,0.1)' }}>
                Review Answers
              </button>
              <button className="btn-primary" onClick={handleStart}>
                Restart Quiz
              </button>
            </div>
          </div>
        );
      })()}

      {gameState === 'review' && (
        <div className="review-container" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
          <div className="review-header">
            <h1 className="title" style={{ fontSize: '2rem' }}>Review Answers</h1>
            <button className="btn-primary" onClick={() => setGameState('results')} style={{ padding: '0.5rem 1rem', fontSize: '1rem', background: 'rgba(255,255,255,0.1)' }}>
              Back to Results
            </button>
          </div>
          
          <div className="review-section">
            {questions.map((q, idx) => {
              const userAnswer = selectedAnswers[idx];
              
              return (
                <div key={idx} className="review-item">
                  <div className="review-question">
                    {q.question}
                  </div>
                  
                  {!userAnswer && (
                    <div className="review-answer missed" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                      ⚠️ No answer provided
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {q.options.map((option, optIdx) => {
                      const isSelected = option === userAnswer;
                      const isCorrect = option === q.correct_answer;
                      
                      let optionClass = 'neutral';
                      let icon = '⚪';
                      
                      if (isCorrect) {
                        optionClass = 'correct';
                        icon = '✅';
                      } else if (isSelected) {
                        optionClass = 'wrong';
                        icon = '❌';
                      }

                      return (
                        <div key={optIdx} className={`review-answer ${optionClass}`}>
                          {icon} {option} {isSelected && !isCorrect ? '(Your Answer)' : ''} {isCorrect && isSelected ? '(Your Answer)' : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="review-controls">
            <button className="btn-primary" onClick={handleStart}>
              Restart Quiz
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
}

export default QuizPage;
