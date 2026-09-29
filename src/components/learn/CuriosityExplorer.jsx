import { useState, useEffect } from "react";
import { localClient } from "@/api/localStorageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { logLearningEvent } from "@/libs/learningEvents";
import { cn } from "@/libs/utils";
import { Loader2, Compass, ArrowRight, RotateCcw } from "lucide-react";

const DIRECTIONS = [
  { value: "broader", label: "Broader", hint: "More general concept" },
  { value: "narrower", label: "Narrower", hint: "More specific" },
  { value: "related", label: "Related", hint: "Lateral connection" },
  { value: "application", label: "Application", hint: "Real-world use" },
];

export default function CuriosityExplorer({ open, onOpenChange, card, topicName }) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [direction, setDirection] = useState("broader");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState([]);

  useEffect(() => {
    if (open) {
      setTopic(card?.question || topicName || "");
      setResult(null);
      setPath([]);
    }
  }, [open, card?.id, topicName]);

  const explore = async (concept, dir) => {
    setLoading(true);
    try {
      const res = await localClient.functions.invoke("learningCoach", {
        operation: "exploreTopic",
        topic: concept,
        direction: dir,
        subject_id: card?.subject_id || null,
        topic_id: card?.topic_id || null,
      });
      setResult(res.data.result);
      setPath([...path, concept]);
      logLearningEvent({
        event_type: "curiosity_explored",
        topic_id: card?.topic_id || null,
        subject_id: card?.subject_id || null,
        detail: `${dir}: ${concept}`,
      });
    } catch (err) {
      toast({ title: "Exploration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const exploreConcept = (concept) => {
    setTopic(concept);
    explore(concept, direction);
  };

  const reset = () => {
    setResult(null);
    setPath([]);
    setTopic(card?.question || topicName || "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" /> Curiosity Mode
          </DialogTitle>
        </DialogHeader>

        {/* Path breadcrumb */}
        {path.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-2 text-xs text-muted-foreground scrollbar-thin">
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">Curiosity Path</span>
            {path.map((p, i) => (
              <span key={i} className="flex items-center gap-1">
                <ArrowRight className="h-3 w-3" />
                <span className="whitespace-nowrap">{p}</span>
              </span>
            ))}
          </div>
        )}

        {/* Direction selector */}
        <div className="flex flex-wrap gap-2">
          {DIRECTIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDirection(d.value)}
              disabled={loading}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                direction === d.value ? "border border-primary/25 bg-primary/15 text-primary" : "lifeos-pill"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Explore button */}
        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a topic to explore…"
            disabled={loading}
          />
          <Button onClick={() => explore(topic, direction)} disabled={loading || !topic.trim()} className="gap-1.5 shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
            Explore
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="max-h-[350px] space-y-3 overflow-y-auto scrollbar-thin">
            <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
              {result.return_note}
            </div>
            {result.concepts?.map((c, i) => (
              <button
                key={i}
                onClick={() => exploreConcept(c.name)}
                className="block w-full rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-accent/50"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">{c.name}</p>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-xs",
                    c.relationship === "broader" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : c.relationship === "narrower" ? "bg-primary/10 text-primary"
                      : c.relationship === "application" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  )}>
                    {c.relationship}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                {c.why_interesting && (
                  <p className="mt-1 text-xs italic text-muted-foreground/70">{c.why_interesting}</p>
                )}
              </button>
            ))}
            {path.length > 0 && (
              <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> Start over
              </Button>
            )}
          </div>
        )}

        {!result && !loading && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Explore beyond your current study path. Curiosity Mode won't modify your assignments — you can return anytime.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
