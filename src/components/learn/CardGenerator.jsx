import { useState } from "react";
import { localClient } from "@/api/localStorageClient";
import { extractTextFromFile } from "@/libs/fileTextParser";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Sparkles, Brain, Upload, FileText, X } from "lucide-react";
import { computeMastery } from "@/libs/mastery";
import { startBackgroundCardGen } from "@/libs/backgroundGenerationManager";

const SESSION_KEY = "lifeos_adaptive_learning_session";
function clearActiveCards() {
  const cards = localClient.entities.LearningCard.list();
  cards.forEach((card) => {
    try { localClient.entities.LearningCard.delete(card.id); } catch {}
  });
}

export default function CardGenerator({ open, onOpenChange, onGenerated, subjects, topics, assignments, notes, prefill }) {
  const { toast } = useToast();
  const [subjectId, setSubjectId] = useState(prefill?.subjectId || "");
  const [topicId, setTopicId] = useState(prefill?.topicId || "");
  const [assignmentId, setAssignmentId] = useState(prefill?.assignmentId || "");
  const [noteId, setNoteId] = useState("");
  const [cardCount, setCardCount] = useState(5);
  const [sourceText, setSourceText] = useState("");
  const [fileMeta, setFileMeta] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const filteredTopics = subjectId ? topics.filter((t) => t.subject_id === subjectId) : [];
  const filteredAssignments = subjectId ? assignments.filter((a) => a.subject_id === subjectId) : [];
  const filteredNotes = subjectId ? notes.filter((n) => n.subject_id === subjectId) : [];

  const handleNoteSelect = (id) => {
    setNoteId(id);
    if (id) {
      const note = notes.find((n) => n.id === id);
      if (note?.content) setSourceText(note.content.slice(0, 6000));
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    try {
      const parsed = await extractTextFromFile(file);
      setSourceText(parsed.text.slice(0, 12000));
      setFileMeta({ name: parsed.name, length: parsed.length, type: parsed.type });
      toast({
        title: "File imported!",
        description: `Extracted ${parsed.length} characters from "${parsed.name}".`,
      });
    } catch (err) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setFileLoading(false);
      e.target.value = "";
    }
  };

  const generate = async () => {
    if (!sourceText.trim() && !noteId) {
      toast({ title: "Add study material", description: "Paste material, choose a note, or describe the topic you want to learn.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const events = localClient.entities.LearningEvent.list("-created_date", 500);
      const mastery = topicId ? computeMastery(events, topicId) : null;
      const majorTopic = filteredTopics.find((t) => t.id === topicId)?.name ||
        subjects.find((s) => s.id === subjectId)?.name ||
        sourceText.trim().slice(0, 160) || "General study";

      // A new generation request starts a fresh active learning session.
      // Historical LearningEvents are deliberately preserved for analytics/mastery.
      clearActiveCards();

      const session = {
        id: `als_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        majorTopic,
        sourceText: sourceText.trim().slice(0, 6000),
        subjectId: subjectId || null,
        topicId: topicId || null,
        assignmentId: assignmentId || null,
        mode: "learning",
        coveredSubtopics: [],
        estimatedLevel: mastery?.score >= 0.75 ? "advanced" : mastery?.score >= 0.45 ? "intermediate" : "beginner",
        chatSignals: [],
        cardNumber: 1,
      };

      const countToGenerate = Math.max(1, Math.min(Number(cardCount) || 5, 20));
      // Start the generation process in the background manager
      startBackgroundCardGen({
        topic: majorTopic,
        promptText: "",
        explicitCount: countToGenerate,
        sourceContent: session.sourceText,
        subjectId: session.subjectId,
        topicId: session.topicId,
        assignmentId: session.assignmentId,
        noteId,
        estimatedLevel: session.estimatedLevel,
        masteryScore: mastery?.score || 0,
        variationSeed: session.id,
        sessionData: session
      });

      toast({
        title: "Flashcard generation started!",
        description: `Your flashcards for ${majorTopic} are generating in the background. You can navigate away.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Failed to start", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Start adaptive learning</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border bg-primary/5 p-3 text-sm text-muted-foreground">
            <b className="text-foreground">Learning mode is automatic.</b> LifeOS will break the major topic into subtopics, teach one concept at a time, and adjust the next concept from your answers and AI chat. It generates only one card at a time.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">Subject</Label>
              <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(""); setAssignmentId(""); setNoteId(""); }} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="">Choose subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block">Topic (optional)</Label>
              <select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!subjectId} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm disabled:opacity-50">
                <option value="">No specific topic</option>
                {filteredTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block">Assignment (optional)</Label>
              <select value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)} disabled={!subjectId} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm disabled:opacity-50">
                <option value="">No assignment</option>
                {filteredAssignments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block">From note (optional)</Label>
              <select value={noteId} onChange={(e) => handleNoteSelect(e.target.value)} disabled={!subjectId} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm disabled:opacity-50">
                <option value="">No note</option>
                {filteredNotes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}
              </select>
            </div>
            <div>
              <Label className="mb-1.5 block">Number of Cards (Exact)</Label>
              <select value={cardCount} onChange={(e) => setCardCount(Number(e.target.value))} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-semibold">
                <option value={3}>3 Cards (Concise)</option>
                <option value={5}>5 Cards (Standard)</option>
                <option value={8}>8 Cards (In-Depth)</option>
                <option value={10}>10 Cards (Comprehensive)</option>
                <option value={15}>15 Cards (Full Chapter)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>What do you want to learn?</Label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="card-gen-file-input"
                  className="hidden"
                  accept=".pdf,.txt,.md,.json,.csv,.js,.py,.docx"
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 rounded-lg border-primary/30 text-primary hover:bg-primary/10 font-bold"
                  onClick={() => document.getElementById("card-gen-file-input")?.click()}
                  disabled={fileLoading || loading}
                >
                  {fileLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  <span>Import PDF / Text File</span>
                </Button>
              </div>
            </div>

            {fileMeta && (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-2 px-3 text-xs text-primary font-medium animate-fade-in">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate font-bold">{fileMeta.name}</span>
                  <span className="text-[10px] opacity-80">({fileMeta.length.toLocaleString()} chars extracted)</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setFileMeta(null); setSourceText(""); }}
                  className="text-muted-foreground hover:text-foreground text-xs p-1"
                  title="Remove file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <Textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={5}
              placeholder="Paste study material or import a PDF/text file above. Flashcards will be generated strictly based on this content."
              className="resize-none text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={generate} disabled={loading} className="gap-1.5 rounded-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Building your first lesson…" : "Start learning"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
