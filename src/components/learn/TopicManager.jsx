import { useState } from "react";
import { localClient } from "@/api/localStorageClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Brain, GraduationCap, Compass, Layers } from "lucide-react";
import MasteryBar from "./MasteryBar";
import { computeMastery } from "@/libs/mastery";

export default function TopicManager({ subjects, topics, events, onReload, onReviewTopic, onTeachTopic, onExploreTopic }) {
  const { toast } = useToast();
  const [selectedSubject, setSelectedSubject] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [adding, setAdding] = useState(false);

  const filteredTopics = selectedSubject
    ? topics.filter((t) => t.subject_id === selectedSubject)
    : [];

  const handleAdd = async () => {
    if (!newTopic.trim() || !selectedSubject) return;
    setAdding(true);
    try {
      await localClient.entities.Topic.create({
        name: newTopic.trim(),
        subject_id: selectedSubject,
      });
      setNewTopic("");
      toast({ title: "Topic added" });
      onReload?.();
    } catch (err) {
      toast({ title: "Failed to add", description: err.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (topic) => {
    await localClient.entities.Topic.delete(topic.id);
    toast({ title: "Topic removed" });
    onReload?.();
  };

  return (
    <div className="space-y-4">
      {/* Subject selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-secondary/35 px-3 py-1 text-sm text-foreground outline-none transition hover:border-primary/25 focus:border-ring"
        >
          <option value="">Choose a subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {selectedSubject && (
        <>
          {/* Add topic */}
          <div className="flex gap-2">
            <Input
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Add a topic — e.g. Nucleophilic Addition"
              disabled={adding}
            />
            <Button onClick={handleAdd} disabled={adding || !newTopic.trim()} size="icon" className="shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Topic list */}
          {filteredTopics.length === 0 ? (
            <div className="lifeos-surface rounded-lg py-12 text-center">
              <Brain className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">No topics yet. Add one above to start tracking mastery.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTopics.map((topic) => {
                const mastery = computeMastery(events, topic.id);
                return (
                  <div key={topic.id} className="lifeos-surface group rounded-lg p-4 transition-colors hover:border-primary/25">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{topic.name}</p>
                        {topic.description && <p className="mt-0.5 text-sm text-muted-foreground">{topic.description}</p>}
                      </div>
                      <button
                        onClick={() => handleDelete(topic)}
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-3">
                      <MasteryBar
                        score={mastery.score}
                        confidence={mastery.confidence}
                        accuracy={mastery.accuracy}
                        attempts={mastery.attempts}
                        lastReviewed={mastery.lastReviewed}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-lg"
                        onClick={() => onReviewTopic?.(topic)}
                      >
                        <Layers className="h-3.5 w-3.5" /> Review cards
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-lg"
                        onClick={() => onTeachTopic?.(topic)}
                      >
                        <GraduationCap className="h-3.5 w-3.5" /> Teach me
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 rounded-lg"
                        onClick={() => onExploreTopic?.(topic)}
                      >
                        <Compass className="h-3.5 w-3.5" /> Explore
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
