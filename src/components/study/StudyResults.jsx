import { useState } from "react";
import { Check, X, ChevronDown, ChevronRight, Lightbulb, Brain, Layers, CalendarClock, Sparkles } from "lucide-react";

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="mb-3 flex items-center gap-2 text-primary">
        <Icon className="h-4 w-4" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Quiz({ questions }) {
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});

  const choose = (qi, oi) => setAnswers((a) => ({ ...a, [qi]: oi }));
  const reveal = (qi) => setRevealed((r) => ({ ...r, [qi]: true }));

  return (
    <div className="space-y-4">
      {questions.map((q, qi) => {
        const picked = answers[qi];
        const shown = revealed[qi];
        return (
          <div key={qi} className="rounded-xl border p-4">
            <p className="mb-3 font-medium">{qi + 1}. {q.question}</p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => {
                const isAnswer = oi === q.answer_index;
                const isPicked = picked === oi;
                let cls = "border bg-background hover:bg-muted/50";
                if (shown) {
                  if (isAnswer) cls = "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10";
                  else if (isPicked) cls = "border-rose-500 bg-rose-50 dark:bg-rose-500/10";
                  else cls = "border bg-muted/30 opacity-60";
                } else if (isPicked) {
                  cls = "border-primary bg-primary/5";
                }
                return (
                  <button
                    key={oi}
                    onClick={() => !shown && choose(qi, oi)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${cls}`}
                  >
                    <span>{opt}</span>
                    {shown && isAnswer && <Check className="h-4 w-4 text-emerald-500" />}
                    {shown && isPicked && !isAnswer && <X className="h-4 w-4 text-rose-500" />}
                  </button>
                );
              })}
            </div>
            {shown && q.explanation && (
              <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Explanation: </span>{q.explanation}
              </p>
            )}
            {!shown && (
              <button onClick={() => reveal(qi)} disabled={picked === undefined} className="mt-3 text-sm font-medium text-primary disabled:opacity-40">
                Check answer
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Flashcards({ cards }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[idx];

  const next = () => { setFlipped(false); setIdx((i) => (i + 1) % cards.length); };
  const prev = () => { setFlipped(false); setIdx((i) => (i - 1 + cards.length) % cards.length); };

  return (
    <div>
      <div
        onClick={() => setFlipped((f) => !f)}
        className="relative flex h-48 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed bg-card p-6 text-center transition-colors hover:border-primary"
      >
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{flipped ? "Answer" : "Prompt"}</p>
          <p className="font-display text-lg font-semibold">{flipped ? card.back : card.front}</p>
          <p className="mt-3 text-xs text-muted-foreground">Tap to flip</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button onClick={prev} className="rounded-full p-2 hover:bg-muted"><ChevronDown className="h-4 w-4 rotate-90" /></button>
        <span className="text-sm text-muted-foreground">{idx + 1} / {cards.length}</span>
        <button onClick={next} className="rounded-full p-2 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default function StudyResult({ mode, result }) {
  if (!result) return null;

  switch (mode) {
    case "summarize":
      return (
        <div className="space-y-4">
          <Section icon={Lightbulb} title="Overview">
            <p className="text-sm leading-relaxed">{result.overview}</p>
          </Section>
          {result.key_points?.length > 0 && (
            <Section icon={Layers} title="Key Points">
              <ul className="space-y-2">
                {result.key_points.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm"><span className="text-primary">•</span><span>{p}</span></li>
                ))}
              </ul>
            </Section>
          )}
          {result.glossary?.length > 0 && (
            <Section icon={Brain} title="Glossary">
              <dl className="space-y-2">
                {result.glossary.map((g, i) => (
                  <div key={i} className="text-sm"><dt className="font-medium">{g.term}</dt><dd className="text-muted-foreground">{g.definition}</dd></div>
                ))}
              </dl>
            </Section>
          )}
          {result.questions_to_review?.length > 0 && (
            <Section icon={Sparkles} title="Questions to Review">
              <ul className="space-y-1.5">
                {result.questions_to_review.map((q, i) => <li key={i} className="text-sm text-muted-foreground">— {q}</li>)}
              </ul>
            </Section>
          )}
        </div>
      );

    case "quiz":
      return <Quiz questions={result.questions} />;

    case "flashcards":
      return <Flashcards cards={result.cards} />;

    case "explain":
      return (
        <div className="space-y-4">
          <Section icon={Lightbulb} title="Explanation">
            <p className="text-sm leading-relaxed">{result.summary}</p>
          </Section>
          {result.analogy && (
            <Section icon={Brain} title="Analogy">
              <p className="text-sm leading-relaxed">{result.analogy}</p>
            </Section>
          )}
          {result.steps?.length > 0 && (
            <Section icon={Layers} title="Step by Step">
              <ol className="space-y-2">
                {result.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm"><span className="font-semibold text-primary">{i + 1}.</span><span>{s}</span></li>
                ))}
              </ol>
            </Section>
          )}
          {result.example && (
            <Section icon={Sparkles} title="Example">
              <p className="text-sm leading-relaxed">{result.example}</p>
            </Section>
          )}
        </div>
      );

    case "plan":
      return (
        <div className="space-y-4">
          <Section icon={CalendarClock} title="Study Plan">
            <p className="text-sm font-medium">{result.goal}</p>
            {result.total_days && <p className="mt-1 text-xs text-muted-foreground">{result.total_days} day plan</p>}
          </Section>
          <div className="space-y-3">
            {result.sessions?.map((s, i) => (
              <div key={i} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Day {s.day}: {s.focus}</p>
                  {s.duration_minutes && <span className="text-xs text-muted-foreground">{s.duration_minutes} min</span>}
                </div>
                <ul className="mt-2 space-y-1">
                  {s.activities?.map((a, j) => <li key={j} className="text-sm text-muted-foreground">• {a}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return <p className="text-sm">{result.text || JSON.stringify(result)}</p>;
  }
}