import { useState, useEffect } from "react";
import { localClient } from "@/api/localStorageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { logLearningEvent } from "@/libs/learningEvents";
import { cn } from "@/libs/utils";
import { Loader2, CheckCircle2, XCircle, ClipboardCheck } from "lucide-react";

export default function QuickCheckDialog({ open, onOpenChange, topicId, subjectId, topicName, focusSessionId }) {
  const { toast } = useToast();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open && topicId) {
      generate();
    }
    if (!open) {
      setQuestions([]);
      setAnswers({});
      setSubmitted(false);
    }
  }, [open, topicId]);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await localClient.functions.invoke("learningCoach", {
        operation: "generateQuickCheck",
        topic: topicName || "",
        topic_id: topicId,
        subject_id: subjectId,
        count: 3,
      });
      setQuestions(res.data.result.questions || []);
    } catch (err) {
      toast({ title: "Failed to generate", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const submit = () => {
    setSubmitted(true);
    const correct = questions.filter((q, i) => {
      if (q.type === "multiple_choice") return answers[i] === q.answer_index;
      return false; // SA self-graded
    }).length;
    questions.forEach((q, i) => {
      const isCorrect = q.type === "multiple_choice" ? answers[i] === q.answer_index : false;
      logLearningEvent({
        event_type: "quick_check",
        topic_id: topicId,
        subject_id: subjectId,
        focus_session_id: focusSessionId || null,
        is_correct: isCorrect,
        detail: q.question,
      });
    });
    toast({
      title: `Quick Check: ${correct}/${questions.filter(q => q.type === "multiple_choice").length} correct`,
      description: "Your learning signals have been updated.",
    });
  };

  const mcQuestions = questions.filter((q) => q.type === "multiple_choice");
  const correctCount = submitted ? mcQuestions.filter((q) => {
    const actualIndex = questions.indexOf(q);
    return answers[actualIndex] === q.answer_index;
  }).length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Quick Check
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Generating questions…</p>
            </div>
          </div>
        ) : questions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No questions generated.</p>
        ) : (
          <div className="max-h-[400px] space-y-4 overflow-y-auto scrollbar-thin">
            {submitted && (
              <div className="rounded-xl bg-primary/5 p-3 text-center text-sm font-medium">
                You got {correctCount} out of {mcQuestions.length} correct
              </div>
            )}
            {questions.map((q, i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <p className="text-sm font-medium">{i + 1}. {q.question}</p>
                {q.type === "multiple_choice" ? (
                  <div className="mt-3 space-y-1.5">
                    {q.options.map((opt, j) => (
                      <button
                        key={j}
                        onClick={() => !submitted && setAnswers({ ...answers, [i]: j })}
                        disabled={submitted}
                        className={cn(
                          "block w-full rounded-lg border p-2.5 text-left text-sm transition-colors",
                          !submitted && answers[i] === j && "border-primary bg-primary/5",
                          !submitted && answers[i] !== j && "hover:bg-accent",
                          submitted && j === q.answer_index && "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
                          submitted && answers[i] === j && j !== q.answer_index && "border-rose-500 bg-rose-50 dark:bg-rose-500/10",
                          submitted && answers[i] !== j && j !== q.answer_index && "opacity-50",
                        )}
                      >
                        <span className="mr-2 font-semibold">{String.fromCharCode(65 + j)}.</span>
                        {opt}
                        {submitted && j === q.answer_index && <CheckCircle2 className="ml-2 inline h-4 w-4 text-emerald-500" />}
                        {submitted && answers[i] === j && j !== q.answer_index && <XCircle className="ml-2 inline h-4 w-4 text-rose-500" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Input
                    value={answers[i] || ""}
                    onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                    disabled={submitted}
                    placeholder="Type your answer…"
                    className="mt-3"
                  />
                )}
                {submitted && q.explanation && (
                  <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && questions.length > 0 && (
          <DialogFooter>
            {!submitted ? (
              <Button onClick={submit} className="rounded-full">Submit answers</Button>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">Done</Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}