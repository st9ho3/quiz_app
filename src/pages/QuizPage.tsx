import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Clock, ArrowLeft, ArrowRight, FileText } from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  correct_answer: string;
}

const TIMER_SECONDS = 3600; // 1 hour, fixed

const fallbackModules = import.meta.glob('../*.json', { eager: true });
const fallbackQuestions: Question[] = (() => {
  for (const path in fallbackModules) {
    if (!path.includes('questions')) continue;
    const mod = fallbackModules[path] as { default?: Question[] };
    if (Array.isArray(mod.default) && mod.default.length > 0) return mod.default;
  }
  return [];
})();

function pad(n: number) { return n.toString().padStart(2, '0'); }
function formatMMSS(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${pad(m)}:${pad(sec)}`;
}

export default function QuizPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const incoming = location.state?.questions as Question[] | undefined;
  const source = (location.state?.source as string | undefined) || 'sample quiz';

  const questions = useMemo<Question[]>(
    () => (incoming && incoming.length > 0 ? incoming : fallbackQuestions),
    [incoming]
  );

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [seconds, setSeconds] = useState(TIMER_SECONDS);
  const [transitioning, setTransitioning] = useState(false);

  // Always finalize with the freshest answers map.
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  const secondsRef = useRef(seconds);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);

  // Timer
  useEffect(() => {
    if (questions.length === 0) return;
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          // auto-submit on timeout
          finalize(answersRef.current, 0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length]);

  const finalize = (finalAnswers: Record<number, string>, timeRemaining = secondsRef.current) => {
    navigate('/results', {
      state: { questions, answers: finalAnswers, timeRemaining, source },
    });
  };

  if (questions.length === 0) {
    return (
      <div className="quiz-empty">
        <style>{QUIZ_CSS}</style>
        <div className="card empty-card">
          <div className="empty-icon"><FileText size={20} strokeWidth={1.6} /></div>
          <h2 className="empty-title">No quiz loaded</h2>
          <p className="empty-sub">Upload a PDF or pick something from your library to get started.</p>
          <Link to="/upload" className="btn btn-primary btn-sm">
            Go to upload <ArrowRight size={13} strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const selected = answers[idx];
  const answeredCount = Object.keys(answers).length;
  const isLast = idx === questions.length - 1;
  const timerWarn = seconds < 60;

  const select = (opt: string) => setAnswers((a) => ({ ...a, [idx]: opt }));

  const advance = (delta: number) => {
    if (transitioning) return;
    const next = idx + delta;
    if (next < 0 || next >= questions.length) return;
    setTransitioning(true);
    window.setTimeout(() => {
      setIdx(next);
      setTransitioning(false);
    }, 160);
  };

  return (
    <div className="quiz-screen">
      <style>{QUIZ_CSS}</style>

      <div className="quiz-meta">
        <div className="src-chip">
          <span className="dot peach" />
          <span className="src-name">{source}</span>
          <span className="mono src-idx">{pad(idx + 1)} / {pad(questions.length)}</span>
        </div>
        <div className={`timer-pill ${timerWarn ? 'warn' : ''}`}>
          <Clock size={13} strokeWidth={1.8} />
          <span className="mono">{formatMMSS(seconds)}</span>
        </div>
      </div>

      <article className={`quiz-card ${transitioning ? 'fading' : 'showing'}`}>
        <div className="eyebrow coral">QUESTION {idx + 1}</div>
        <h2 className="q-text">{q.question}</h2>

        <div className="options">
          {q.options.map((opt, oi) => {
            const isSel = opt === selected;
            const key = String.fromCharCode(65 + oi);
            return (
              <button
                key={oi}
                type="button"
                className={`option ${isSel ? 'selected' : ''}`}
                onClick={() => select(opt)}
              >
                <span className="radio"><span className="radio-inner" /></span>
                <span className="opt-key mono">{key}</span>
                <span className="opt-text">{opt}</span>
              </button>
            );
          })}
        </div>

        <div className="quiz-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => advance(-1)}
            disabled={idx === 0}
          >
            <ArrowLeft size={14} strokeWidth={1.8} /> Previous
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => (isLast ? finalize(answers) : advance(1))}
            disabled={!selected}
          >
            {isLast ? 'Submit answers' : 'Next question'} <ArrowRight size={14} strokeWidth={1.8} />
          </button>
        </div>
      </article>

      <div className="quiz-footer">
        <span className="mono answered">{answeredCount} / {questions.length} ANSWERED</span>
        <div className="pips">
          {questions.map((_, i) => {
            const cls = i === idx ? 'current' : answers[i] ? 'answered' : 'pending';
            return <span key={i} className={`pip ${cls}`} />;
          })}
        </div>
        <button type="button" className="end-link" onClick={() => finalize(answers)}>end session early</button>
      </div>
    </div>
  );
}

const QUIZ_CSS = `
.quiz-screen { max-width: 720px; margin: 0 auto; padding: 40px 28px 80px; display: flex; flex-direction: column; gap: 22px; }
.quiz-meta { display: flex; justify-content: space-between; align-items: center; }

.src-chip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 12px; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-pill); font-size: 12.5px; color: var(--ink-2);
  max-width: 60%;
}
.src-chip .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.src-chip .dot.peach { background: var(--peach); }
.src-name { font-weight: 500; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.src-idx { color: var(--muted); flex-shrink: 0; }

.timer-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-pill); font-size: 12.5px;
  transition: all 0.2s ease;
}
.timer-pill.warn { background: var(--coral-soft); color: var(--coral); border-color: var(--coral); }

.quiz-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 36px 36px 32px;
  box-shadow: var(--sh-quiz);
  display: flex; flex-direction: column; gap: 18px;
  transition: opacity 0.16s ease;
}
.quiz-card.fading { opacity: 0.4; }
.quiz-card.showing { opacity: 1; animation: fadeUp 0.32s cubic-bezier(0.2, 0.8, 0.2, 1); }

.q-text { font-size: 22px; font-weight: 500; line-height: 1.35; letter-spacing: -0.015em; color: var(--ink); margin: 0; }

.options { display: flex; flex-direction: column; gap: 10px; }
.option {
  width: 100%; text-align: left;
  display: grid; grid-template-columns: auto auto 1fr; align-items: center; gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  padding: 16px 18px;
  transition: all 0.15s ease;
}
.option:hover { border-color: var(--border-strong); }
.option.selected {
  background: var(--peach-soft); border-color: var(--peach-deep);
  box-shadow: 0 0 0 2px rgba(232,153,104,0.18);
}
.radio {
  width: 18px; height: 18px; border-radius: 50%;
  border: 1.5px solid var(--border-strong); background: var(--surface-2);
  display: inline-flex; align-items: center; justify-content: center;
}
.option.selected .radio { border-color: var(--coral); background: var(--coral); }
.radio-inner { width: 0; height: 0; }
.option.selected .radio-inner { width: 6px; height: 6px; border-radius: 50%; background: var(--surface); }
.opt-key { font-size: 11px; color: var(--muted); width: 14px; }
.opt-text { font-size: 14.5px; line-height: 1.5; color: var(--ink); }

.quiz-actions {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 8px;
}

.quiz-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 0 4px;
}
.answered { font-size: 11px; color: var(--muted); letter-spacing: 0.04em; }
.pips { display: flex; gap: 4px; }
.pip { width: 18px; height: 4px; border-radius: 2px; background: var(--border); }
.pip.answered { background: var(--ink-2); }
.pip.current { background: var(--coral); }
.end-link {
  font-size: 12px; color: var(--muted); text-decoration: underline; text-underline-offset: 3px;
  background: none;
}
.end-link:hover { color: var(--ink-2); }

.quiz-empty { max-width: 720px; margin: 0 auto; padding: 80px 28px; }
.empty-card { padding: 36px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
.empty-icon { width: 44px; height: 44px; border-radius: var(--r-md); background: var(--peach-soft); color: var(--coral); display: inline-flex; align-items: center; justify-content: center; }
.empty-title { font-family: var(--font-serif); font-size: 26px; font-weight: 400; letter-spacing: -0.02em; }
.empty-sub { font-size: 14px; color: var(--muted); margin-bottom: 6px; }
`;
