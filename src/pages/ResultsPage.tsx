import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Check, X, RotateCcw, Plus, ArrowRight } from 'lucide-react';

interface Question {
  question: string;
  options: string[];
  correct_answer: string;
}

type State = {
  questions?: Question[];
  answers?: Record<number, string>;
  source?: string;
};

const RING_R = 50;
const RING_C = 2 * Math.PI * RING_R;

export default function ResultsPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { questions = [], answers = {}, source = 'sample quiz' } = (state || {}) as State;

  if (!questions || questions.length === 0) {
    return (
      <div className="results-empty">
        <style>{RES_CSS}</style>
        <div className="card empty-card">
          <h2 className="empty-title">No results to show</h2>
          <p className="empty-sub">Take a quiz first.</p>
          <Link to="/upload" className="btn btn-primary btn-sm">Upload a PDF <ArrowRight size={13} strokeWidth={1.8} /></Link>
        </div>
      </div>
    );
  }

  const total = questions.length;
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  questions.forEach((q, i) => {
    const a = answers[i];
    if (!a) skipped++;
    else if (a === q.correct_answer) correct++;
    else incorrect++;
  });
  const finalPct = Math.round((correct / total) * 100);

  // Animate ring
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setPct(finalPct), 60);
    return () => window.clearTimeout(t);
  }, [finalPct]);

  const heading =
    finalPct >= 75 ? 'Nicely done.' :
    finalPct >= 50 ? 'Solid attempt.' :
                     'Worth another pass.';

  const offset = RING_C * (1 - pct / 100);

  const retake = () => navigate('/quiz', { state: { questions, source } });
  const newQuiz = () => navigate('/upload');

  return (
    <div className="results-screen">
      <style>{RES_CSS}</style>

      <section className="card hero">
        <div>
          <div className="eyebrow coral">SESSION COMPLETE</div>
          <h1 className="hero-heading">{heading}</h1>
          <p className="hero-sub">
            You answered <strong>{correct}</strong> of <strong>{total}</strong> correctly. Review each question below.
          </p>
        </div>
        <div className="ring-wrap">
          <svg width="116" height="116" viewBox="0 0 116 116" className="score-ring">
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F4B795" />
                <stop offset="100%" stopColor="#E07856" />
              </linearGradient>
            </defs>
            <circle cx="58" cy="58" r={RING_R} stroke="var(--border)" strokeWidth="6" fill="none" />
            <circle
              cx="58" cy="58" r={RING_R}
              stroke="url(#scoreGrad)" strokeWidth="6" fill="none"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={offset}
              transform="rotate(-90 58 58)"
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
            />
          </svg>
          <div className="ring-text">
            <div className="ring-num mono">{pct}</div>
            <div className="ring-label mono">% SCORE</div>
          </div>
        </div>
      </section>

      <section className="stats-row">
        <Stat label="CORRECT" value={correct} total={total} color="var(--correct)" />
        <Stat label="INCORRECT" value={incorrect} total={total} color="var(--coral)" />
        <Stat label="SKIPPED" value={skipped} total={total} color="var(--ink)" />
      </section>

      <section className="review">
        <div className="review-head">
          <span className="review-title">Question review</span>
          <span className="eyebrow">{total} ITEMS</span>
        </div>

        <div className="review-list">
          {questions.map((q, qi) => {
            const a = answers[qi];
            const isSkipped = !a;
            const isCorrect = a === q.correct_answer;
            const verdict: 'correct' | 'incorrect' | 'skipped' =
              isSkipped ? 'skipped' : isCorrect ? 'correct' : 'incorrect';

            return (
              <article
                key={qi}
                className={`q-card v-${verdict} fade-up`}
                style={{ animationDelay: `${0.12 + qi * 0.04}s` }}
              >
                <header className="q-head">
                  <span className="q-num mono">Q{String(qi + 1).padStart(2, '0')}</span>
                  <span className={`badge b-${verdict} mono`}>
                    {verdict === 'correct' && (<><Check size={10} strokeWidth={2.4} /> CORRECT</>)}
                    {verdict === 'incorrect' && (<><X size={10} strokeWidth={2.4} /> INCORRECT</>)}
                    {verdict === 'skipped' && (<>SKIPPED</>)}
                  </span>
                </header>
                <p className="q-text-r">{q.question}</p>
                <ul className="q-opts">
                  {q.options.map((opt, oi) => {
                    const userPicked = opt === a;
                    const isRight = opt === q.correct_answer;
                    let kind: 'base' | 'correctChosen' | 'correctUnchosen' | 'wrongChosen' = 'base';
                    if (userPicked && isRight) kind = 'correctChosen';
                    else if (!userPicked && isRight) kind = 'correctUnchosen';
                    else if (userPicked && !isRight) kind = 'wrongChosen';

                    const key = String.fromCharCode(65 + oi);
                    return (
                      <li key={oi} className={`q-opt k-${kind}`}>
                        <span className="opt-mark">
                          {kind === 'correctChosen' || kind === 'correctUnchosen' ? <Check size={12} strokeWidth={2.4} /> :
                            kind === 'wrongChosen' ? <X size={12} strokeWidth={2.4} /> : null}
                        </span>
                        <span className="opt-key mono">{key}</span>
                        <span className="opt-text">{opt}</span>
                        {kind === 'wrongChosen' && <span className="opt-tag mono">YOUR ANSWER</span>}
                        {kind === 'correctUnchosen' && <span className="opt-tag mono">CORRECT ANSWER</span>}
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={retake}>
          <RotateCcw size={14} strokeWidth={1.8} /> Retake this quiz
        </button>
        <button type="button" className="btn btn-primary" onClick={newQuiz}>
          <Plus size={14} strokeWidth={1.8} /> New quiz from PDF
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div className="stat card">
      <div className="stat-num mono" style={{ color }}>
        {value}<span className="stat-total mono"> / {total}</span>
      </div>
      <div className="eyebrow">{label}</div>
    </div>
  );
}

const RES_CSS = `
.results-screen { max-width: 760px; margin: 0 auto; padding: 48px 28px 80px; display: flex; flex-direction: column; gap: 22px; }

.hero {
  padding: 32px 36px;
  display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center;
}
.hero-heading { font-family: var(--font-serif); font-size: 32px; font-weight: 400; letter-spacing: -0.02em; line-height: 1.15; margin: 8px 0 8px; color: var(--ink); }
.hero-sub { font-size: 14.5px; color: var(--muted); line-height: 1.5; }
.hero-sub strong { color: var(--ink-2); font-weight: 600; }

.ring-wrap { position: relative; width: 116px; height: 116px; }
.ring-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; }
.ring-num { font-size: 30px; font-weight: 500; color: var(--ink); line-height: 1; }
.ring-label { font-size: 9px; color: var(--muted); margin-top: 4px; letter-spacing: 0.08em; }

.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.stat { padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
.stat-num { font-size: 22px; font-weight: 500; line-height: 1; }
.stat-total { font-size: 14px; color: var(--muted); font-weight: 400; }

.review { display: flex; flex-direction: column; gap: 12px; }
.review-head { display: flex; justify-content: space-between; align-items: baseline; }
.review-title { font-size: 13px; font-weight: 500; color: var(--ink); }
.review-list { display: flex; flex-direction: column; gap: 10px; }

.q-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  border-left-width: 3px;
  padding: 16px 18px;
  display: flex; flex-direction: column; gap: 10px;
}
.q-card.v-correct  { border-left-color: var(--correct); border-color: #C8DDCB; }
.q-card.v-incorrect{ border-left-color: var(--coral); border-color: var(--coral-soft); }
.q-card.v-skipped  { border-left-color: var(--border-strong); }

.q-head { display: flex; justify-content: space-between; align-items: center; }
.q-num { font-size: 11px; color: var(--muted); letter-spacing: 0.04em; }
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-radius: var(--r-pill);
  font-size: 10.5px; font-weight: 500; letter-spacing: 0.04em;
}
.badge.b-correct  { background: var(--correct-soft); color: var(--correct); }
.badge.b-incorrect{ background: var(--coral-soft); color: var(--coral); }
.badge.b-skipped  { background: var(--surface-2); color: var(--muted); border: 1px solid var(--border); }

.q-text-r { font-size: 14.5px; color: var(--ink); line-height: 1.5; font-weight: 500; }

.q-opts { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.q-opt {
  display: grid; grid-template-columns: auto auto 1fr auto; align-items: center; gap: 10px;
  background: var(--surface-2); color: var(--muted);
  border: 1px solid transparent;
  border-radius: var(--r-sm);
  padding: 9px 12px;
  font-size: 13px;
}
.q-opt .opt-mark {
  width: 16px; height: 16px; border-radius: 50%;
  border: 1px solid var(--border-strong);
  display: inline-flex; align-items: center; justify-content: center;
}
.q-opt .opt-key { color: var(--muted); width: 12px; }
.q-opt .opt-text { color: inherit; }
.q-opt .opt-tag { font-size: 9.5px; color: var(--muted); letter-spacing: 0.06em; }

.q-opt.k-correctChosen { background: var(--correct-soft); color: var(--ink); }
.q-opt.k-correctChosen .opt-mark { background: var(--correct); border-color: var(--correct); color: #fff; }
.q-opt.k-correctUnchosen { background: var(--surface); color: var(--correct); border: 1px dashed var(--correct); }
.q-opt.k-correctUnchosen .opt-mark { background: var(--correct); border-color: var(--correct); color: #fff; }
.q-opt.k-correctUnchosen .opt-tag { color: var(--correct); }
.q-opt.k-wrongChosen { background: var(--coral-soft); color: var(--ink); }
.q-opt.k-wrongChosen .opt-mark { background: var(--coral); border-color: var(--coral); color: #fff; }
.q-opt.k-wrongChosen .opt-tag { color: var(--coral); }

.actions { display: flex; justify-content: center; gap: 10px; margin-top: 10px; }

.results-empty { max-width: 720px; margin: 0 auto; padding: 80px 28px; }
.empty-card { padding: 36px; display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
.empty-title { font-family: var(--font-serif); font-size: 26px; font-weight: 400; letter-spacing: -0.02em; }
.empty-sub { font-size: 14px; color: var(--muted); margin-bottom: 6px; }
`;
