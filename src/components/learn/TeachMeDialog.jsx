import { useState, useRef, useEffect } from "react";
import { localClient } from "@/api/localStorageClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { logLearningEvent } from "@/libs/learningEvents";
import { Loader2, GraduationCap, Send, CheckCircle2 } from "lucide-react";
import { cn } from "@/libs/utils";

export default function TeachMeDialog({ open, onOpenChange, card }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const scrollRef = useRef(null);

  const concept = card?.question || "";

  useEffect(() => {
    if (open && card && messages.length === 0) {
      startTeach();
    }
    if (!open) {
      setMessages([]);
      setUserInput("");
      setComplete(false);
    }
  }, [open, card?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const startTeach = async () => {
    setLoading(true);
    try {
      const res = await localClient.functions.invoke("learningCoach", {
        operation: "teachStep",
        concept,
        step: 0,
        subject_id: card?.subject_id || null,
        topic_id: card?.topic_id || null,
      });
      setMessages([{ role: "ai", ...res.data.result }]);
    } catch (err) {
      toast({ title: "Failed to start", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sendResponse = async () => {
    if (!userInput.trim() || loading) return;
    const userMsg = { role: "user", text: userInput };
    const history = [...messages, userMsg];
    setMessages(history);
    setUserInput("");
    setLoading(true);

    logLearningEvent({
      event_type: "teach_response",
      card_id: card?.id || null,
      topic_id: card?.topic_id || null,
      subject_id: card?.subject_id || null,
      detail: userInput,
    });

    try {
      const conversationText = history
        .map((m) => `${m.role === "ai" ? "Tutor" : "Student"}: ${m.text || m.follow_up_question || ""}`)
        .join("\n");
      const res = await localClient.functions.invoke("learningCoach", {
        operation: "teachStep",
        concept,
        step: history.filter((m) => m.role === "user").length,
        userResponse: userInput,
        conversationHistory: conversationText,
        subject_id: card?.subject_id || null,
        topic_id: card?.topic_id || null,
      });
      setMessages([...history, { role: "ai", ...res.data.result }]);
      if (res.data.result.is_complete) {
        setComplete(true);
        toast({ title: "Great work!", description: "You've demonstrated understanding of this concept." });
      }
    } catch (err) {
      toast({ title: "Something went wrong", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" /> Teach Me: {concept.slice(0, 50)}
          </DialogTitle>
        </DialogHeader>

        <div ref={scrollRef} className="max-h-[400px] space-y-3 overflow-y-auto scrollbar-thin">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {m.role === "ai" ? (
                  <div className="space-y-2">
                    {m.evaluation && <p className="font-medium">{m.evaluation}</p>}
                    {m.correct_points?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Correct:</p>
                        <ul className="ml-3 list-disc text-xs">
                          {m.correct_points.map((p, j) => <li key={j}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {m.missing_points?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">⚠ Missing:</p>
                        <ul className="ml-3 list-disc text-xs">
                          {m.missing_points.map((p, j) => <li key={j}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {m.explanation && <p className="text-xs">{m.explanation}</p>}
                    {m.follow_up_question && (
                      <p className="mt-2 border-t border-border/50 pt-2 font-medium">
                        {m.follow_up_question}
                      </p>
                    )}
                  </div>
                ) : (
                  <p>{m.text}</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </div>
            </div>
          )}
          {complete && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" /> Concept mastered! You can close this dialog.
            </div>
          )}
        </div>

        {!complete && (
          <div className="flex gap-2">
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendResponse(); } }}
              rows={2}
              placeholder="Type your response…"
              className="resize-none"
              disabled={loading}
            />
            <Button onClick={sendResponse} disabled={loading || !userInput.trim()} size="icon" className="h-auto">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}