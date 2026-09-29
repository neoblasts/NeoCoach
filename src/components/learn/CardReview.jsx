import AIFormattedText from "@/components/AIFormattedText";
import { useEffect, useState } from "react";
import { localClient } from "@/api/localStorageClient";
import { extractTextFromFile } from "@/libs/fileTextParser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/libs/utils";
import { logLearningEvent } from "@/libs/learningEvents";
import { nextDifficulty, processCardReview } from "@/libs/mastery";
import { subscribeGeneration, startBackgroundCardGen, clearJobState } from "@/libs/backgroundGenerationManager";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Brain,
  Send,
  MessageCircle,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
  X,
  Sparkles,
  Shuffle,
  Dices,
  Maximize2,
  Minimize2,
  Upload,
  FileText,
} from "lucide-react";

const SESSION_KEY = "lifeos_adaptive_learning_session";

const RANDOM_TOPICS = [
  "Mole Concept & Stoichiometry",
  "Newton's Laws of Motion & Friction",
  "Aldehydes, Ketones & Carboxylic Acids",
  "Limits, Continuity & Differentiability",
  "Electromagnetic Induction & Faraday's Law",
  "Cellular Respiration & ATP Cycle",
  "Binary Search Trees & Graph Algorithms",
  "Thermodynamics & Heat Transfer",
];

const RATINGS = [
  { value: "again", label: "Again", className: "border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20" },
  { value: "hard", label: "Hard", className: "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" },
  { value: "good", label: "Good", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" },
  { value: "easy", label: "Easy", className: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20" },
];

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
function saveSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }

export default function CardReview({ cards = [], onRate, onSessionChanged }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [notice, setNotice] = useState(null);
  const [session, setSession] = useState(getSession());

  const currentCard = cards[currentIndex] || cards[0] || null;

  useEffect(() => {
    setIsFlipped(false);
    setChatMessages([]);
  }, [currentIndex, currentCard?.id]);

  useEffect(() => {
    if (currentCard) {
      logLearningEvent({
        event_type: "card_viewed",
        card_id: currentCard.id,
        topic_id: currentCard.topic_id || null,
        subject_id: currentCard.subject_id || null,
      });
    }
  }, [currentCard?.id]);

  // Keyboard navigation shortcuts (Space to flip, Left/Right arrows)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNextCard();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrevCard();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, cards.length]);

  const recordAnswer = (rating, isCorrect) => {
    if (!currentCard) return;
    logLearningEvent({
      event_type: "card_answered",
      card_id: currentCard.id,
      topic_id: currentCard.topic_id || null,
      subject_id: currentCard.subject_id || null,
      rating,
      is_correct: isCorrect,
    });
    onRate?.(currentCard, rating);
  };

  const handleRateCard = (rating) => {
    if (!currentCard) return;
    const score = rating === "easy" ? 0.95 : rating === "good" ? 0.75 : rating === "hard" ? 0.45 : 0.15;
    const nextDiff = nextDifficulty(currentCard.difficulty || "medium", score, rating);

    recordAnswer(rating, score >= 0.6);

    try {
      localClient.entities.LearningCard.update(currentCard.id, {
        difficulty: nextDiff,
        mastery_score: Math.round(score * 100),
        last_reviewed_at: new Date().toISOString(),
        review_count: Number(currentCard.review_count || 0) + 1,
      });
      processCardReview(currentCard, rating);
    } catch {}

    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      generateNextAdaptiveCard();
    }
  };

  const handlePrevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleNextCard = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      generateNextAdaptiveCard();
    }
  };

  const [attachedFile, setAttachedFile] = useState(null);

  // Validate that a generated card is rich theory and not an MCQ
  function validateTheoryCard(card) {
    if (!card || typeof card !== "object") return false;
    const title = card.title || card.subtopic;
    const subtopic = card.subtopic || card.title;
    const front = card.front || card.question || card.active_recall_prompt;
    const back = card.back || card.learning_content || card.answer;
    if (!title || !subtopic || !front || !back || back.trim().length < 15) return false;
    if (Array.isArray(card.options) || Array.isArray(card.choices) || card.a || card.b) return false;
    return true;
  }

  // Subscribe to persistent background generation state for cards
  useEffect(() => {
    const unsub = subscribeGeneration((allJobs) => {
      const cJob = allJobs.cards;
      if (cJob.status === "generating") {
        setGenLoading(true);
      } else if (cJob.status === "completed" && cJob.result) {
        setGenLoading(false);
        setNotice(`Generated ${cJob.result.length} flashcards from "${cJob.topic.slice(0, 40)}"!`);
        if (cJob.result[0]) {
          onSessionChanged?.(cJob.result[0]);
        }
        clearJobState("cards");
      } else if (cJob.status === "error") {
        setGenLoading(false);
        setNotice(`Flashcard generation error: ${cJob.error}`);
        clearJobState("cards");
      }
    });
    return unsub;
  }, [onSessionChanged]);

  // Generate a new custom or random flashcard deck directly inside Adaptive Learning
  const handleGenerateCustomDeck = async (overridePrompt = "", defaultTopicName = "", explicitCount = null) => {
    const promptText = customPrompt.trim();
    
    let countToGen = explicitCount || 5;
    if (!explicitCount && promptText) {
      const countMatch = promptText.match(/\b(\d+)\s*(?:cards?|flashcards?|items?)\b/i) ||
                         promptText.match(/(?:generate|give|create|make|want)\s*(\d+)/i);
      if (countMatch) {
        countToGen = Math.max(1, Math.min(parseInt(countMatch[1], 10), 50));
      }
    }

    let sourceContent = overridePrompt || "";
    if (!sourceContent) {
      if (attachedFile) {
        sourceContent = attachedFile.text + (promptText ? `\n\nStudent Instructions: ${promptText}` : "");
      } else {
        sourceContent = promptText || RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)];
      }
    }

    const topicToGenerate = defaultTopicName || (attachedFile ? (promptText || attachedFile.name.replace(/\.[^/.]+$/, "")) : (promptText || sourceContent.slice(0, 100)));

    setGenLoading(true);
    setNotice("Generating flashcards in background...");
    setCustomPrompt("");
    setAttachedFile(null);

    try {
      await startBackgroundCardGen({
        topic: topicToGenerate,
        promptText,
        explicitCount: countToGen,
        sourceContent,
      });
    } catch (err) {
      setNotice(`Generation error: ${err.message}`);
      setGenLoading(false);
    }
  };

  const handleFileUploadInBar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNotice(null);
    try {
      const parsed = await extractTextFromFile(file);
      setAttachedFile({ name: parsed.name, text: parsed.text, length: parsed.length });
      setNotice(`Attached "${parsed.name}" (${parsed.length} chars). Add custom instructions or click Generate Deck.`);
    } catch (err) {
      setNotice(`File import error: ${err.message}`);
    } finally {
      e.target.value = "";
    }
  };

  const generateNextAdaptiveCard = async () => {
    if (nextLoading) return;
    setNextLoading(true);
    try {
      const current = getSession() || session || {};
      const covered = [...new Set([...(current.coveredSubtopics || []), currentCard?.subtopic].filter(Boolean))].slice(-20);

      const res = await localClient.functions.invoke("learningCoach", {
        operation: "generateCards",
        sourceText: String(current.sourceText || "").slice(0, 6000),
        count: 1,
        mode: "learning",
        subject_id: current.subjectId || currentCard?.subject_id || null,
        topic_id: current.topicId || currentCard?.topic_id || null,
        topic: current.majorTopic || currentCard?.major_topic || "General study",
        majorTopic: current.majorTopic || currentCard?.major_topic || "General study",
        coveredSubtopics: covered,
        studentLevel: current.estimatedLevel || "beginner",
      });

      if (res.data?.error) throw new Error(res.data.error);
      const nextCardData = res.data?.result?.cards?.[0];
      if (!nextCardData || !validateTheoryCard(nextCardData)) throw new Error("No further valid theory card generated.");

      const saved = localClient.entities.LearningCard.create({
        ...nextCardData,
        card_type: "learning",
        learning_session_id: current.id || null,
        card_number: (cards.length || 0) + 1,
        created_date: new Date().toISOString(),
      });

      const updated = {
        ...current,
        coveredSubtopics: [...new Set([...covered, saved.subtopic].filter(Boolean))],
        cardNumber: (current.cardNumber || 1) + 1,
      };
      setSession(updated);
      saveSession(updated);
      onSessionChanged?.(saved);
      setCurrentIndex(cards.length);
    } catch (err) {
      console.warn("Card expansion warning:", err);
    } finally {
      setNextLoading(false);
    }
  };

  const sendTutorMessage = async (overrideText) => {
    const text = String(overrideText || chatInput).trim();
    if (!text || chatLoading || !currentCard) return;
    const userMsg = { role: "user", text };
    const history = [...chatMessages, userMsg];
    setChatMessages(history);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await localClient.functions.invoke("learningCoach", {
        operation: "chat",
        message: text,
        history: history.slice(-6),
        context: {
          cardTitle: currentCard.title || currentCard.subtopic,
          subtopic: currentCard.subtopic || currentCard.title,
          theoryContent: currentCard.back || currentCard.learning_content || currentCard.answer,
          keyPoints: currentCard.key_points || [],
          studentQuestion: text,
        },
      });
      const reply = res.data?.result?.reply || res.data?.result?.text || "Focus on the core theoretical principles and mechanisms.";
      setChatMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: "assistant", text: `AI Coach response error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!currentCard) return null;

  const totalCards = cards.length;
  const progressPercent = Math.round(((currentIndex + 1) / Math.max(1, totalCards)) * 100);

  const cardSubtopic = currentCard.subtopic || currentCard.title || "Subtopic";
  const cardTopic = currentCard.major_topic || session?.majorTopic || "Adaptive Learning";
  const cardPrompt = currentCard.front || currentCard.question || currentCard.active_recall_prompt || currentCard.title || "Revision Prompt";
  const cardTheory = currentCard.back || currentCard.learning_content || currentCard.answer || currentCard.explanation || "";

  return (
    <div className="flex flex-col items-center space-y-5 max-w-3xl mx-auto py-1 relative">

      {/* Quick Flashcard Generator Bar */}
      <div className="w-full lifeos-surface rounded-2xl border p-3 flex flex-col gap-2">
        {attachedFile && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-3 py-1.5 text-xs text-primary animate-fade-in">
            <div className="flex items-center gap-2 truncate">
              <Upload className="h-3.5 w-3.5 shrink-0" />
              <span className="font-bold truncate">{attachedFile.name}</span>
              <span className="text-[11px] text-muted-foreground shrink-0">({attachedFile.length} chars)</span>
            </div>
            <button
              type="button"
              onClick={() => setAttachedFile(null)}
              className="text-muted-foreground hover:text-rose-400 p-0.5 rounded transition-colors ml-2"
              title="Remove attached file"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <Input
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleGenerateCustomDeck();
              }
            }}
            placeholder={attachedFile ? `Add instructions for "${attachedFile.name}"... (e.g. 8 cards on formulas)` : "Type any topic or concept... (e.g. Mole Concept, Newton's 2nd Law, 8 cards)"}
            className="h-9 text-xs flex-1"
          />
          <input
            type="file"
            id="bar-file-upload"
            className="hidden"
            accept=".pdf,.txt,.md,.json,.csv,.js,.py,.docx"
            onChange={handleFileUploadInBar}
          />
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              className="h-9 text-xs gap-1.5 rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 flex-1 sm:flex-none"
              onClick={() => handleGenerateCustomDeck()}
              disabled={genLoading}
            >
              {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>Generate Deck</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-9 text-xs gap-1.5 rounded-xl font-bold transition-all",
                attachedFile ? "border-primary bg-primary/10 text-primary" : "border-primary/30 text-primary hover:bg-primary/10"
              )}
              onClick={() => document.getElementById("bar-file-upload")?.click()}
              disabled={genLoading}
              title="Attach PDF or Text file to generate flashcards strictly from file content"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{attachedFile ? "Change File" : "Import PDF/Text"}</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs gap-1.5 rounded-xl font-bold border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => handleGenerateCustomDeck(RANDOM_TOPICS[Math.floor(Math.random() * RANDOM_TOPICS.length)])}
              disabled={genLoading}
              title="Generate cards from a random topic"
            >
              <Dices className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Random Topic</span>
            </Button>
          </div>
        </div>
      </div>

      {notice && (
        <div className="w-full text-center text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl py-1.5 px-3 animate-fade-in flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">×</button>
        </div>
      )}

      {/* Top Deck Progress Header */}
      <div className="w-full space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground truncate max-w-[200px] sm:max-w-xs">{cardTopic}</span>
            <span>·</span>
            <span className="text-primary font-semibold">Card {currentIndex + 1} of {totalCards}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
              {currentCard.difficulty || "medium"}
            </span>
            <span className="hidden sm:inline-block text-[11px] text-muted-foreground/70">
              Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Space</kbd> to flip
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main 3D JS/CSS Animated Card Flip Container */}
      <div
        className="w-full relative select-none cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setIsFlipped((prev) => !prev)}
      >
        <div
          className="w-full min-h-[380px] sm:min-h-[420px] relative transition-transform duration-500 ease-in-out transform-gpu"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* FRONT FACE */}
          <div
            className="absolute inset-0 rounded-2xl border p-6 sm:p-8 flex flex-col justify-between shadow-xl border-primary/30 bg-card hover:border-primary/50 backface-hidden"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold bg-primary/20 text-primary">
                  <Brain className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-foreground">
                  {cardSubtopic}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] font-extrabold tracking-wider uppercase">
                Front · Revision Prompt
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center py-2 space-y-4">
              <div className="text-lg sm:text-xl font-bold leading-relaxed text-foreground">
                <AIFormattedText>{cardPrompt}</AIFormattedText>
              </div>
              {currentCard.title && currentCard.title !== cardSubtopic && (
                <div className="text-xs text-muted-foreground/90 font-medium leading-relaxed border-l-2 border-primary/30 pl-3">
                  Topic Focus: <AIFormattedText>{currentCard.title}</AIFormattedText>
                </div>
              )}
            </div>

            <div className="pt-3 border-t mt-3 flex items-center justify-between text-xs text-muted-foreground/70">
              <button
                onClick={(e) => { e.stopPropagation(); handlePrevCard(); }}
                disabled={currentIndex === 0}
                className="flex items-center gap-1 hover:text-foreground disabled:opacity-30 text-xs font-semibold"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>

              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <RotateCw className="h-3.5 w-3.5 text-primary" />
                <span>Click or press <kbd className="rounded border px-1 py-0.5 text-[10px] font-mono">Space</kbd> to flip card</span>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handleNextCard(); }}
                className="flex items-center gap-1 hover:text-foreground text-xs font-semibold text-primary"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* BACK FACE (Detailed Theory Revision Card) */}
          <div
            className="absolute inset-0 rounded-2xl border p-6 sm:p-7 flex flex-col justify-between shadow-2xl border-emerald-500/40 bg-card backface-hidden"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="flex items-center justify-between border-b pb-3 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-foreground truncate max-w-[240px]">
                  {cardSubtopic}
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold tracking-wider uppercase">
                Theory Revision Note
              </span>
            </div>

            {/* Scrollable Content Body for Full Un-truncated Theory */}
            <div className="flex-1 overflow-y-auto max-h-[380px] py-2 pr-1.5 space-y-4">
              <div className="text-sm sm:text-base font-medium leading-relaxed text-foreground/95">
                <AIFormattedText>{cardTheory}</AIFormattedText>
              </div>

              {currentCard.key_points && currentCard.key_points.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-emerald-500/20">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">High-Yield Takeaways</span>
                  <div className="grid gap-1.5">
                    {currentCard.key_points.map((pt, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-foreground/90 font-medium">
                        <span className="text-emerald-400 font-bold">•</span>
                        <AIFormattedText>{pt}</AIFormattedText>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(currentCard.common_confusion || currentCard.why_it_matters) && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90 space-y-1">
                  <span className="font-extrabold uppercase tracking-wider text-amber-400 text-[10px] block">Common Misconception & Exception</span>
                  <AIFormattedText>{currentCard.common_confusion || currentCard.why_it_matters}</AIFormattedText>
                </div>
              )}
            </div>

            <div className="pt-3 border-t mt-2 flex items-center justify-between text-xs text-muted-foreground/70 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); handlePrevCard(); }}
                disabled={currentIndex === 0}
                className="flex items-center gap-1 hover:text-foreground disabled:opacity-30 text-xs font-semibold"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>

              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <RotateCw className="h-3.5 w-3.5" />
                <span>Click or press <kbd className="rounded border px-1 py-0.5 text-[10px] font-mono">Space</kbd> to flip back</span>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); handleNextCard(); }}
                className="flex items-center gap-1 hover:text-foreground text-xs font-semibold text-primary"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Answer Rating Bar ("Know the answer?") */}
      <div className="w-full lifeos-surface rounded-2xl border p-4 space-y-3 text-center">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Know the theory?
        </p>

        {/* Primary Binary Buttons: No / Yes */}
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
          <Button
            size="lg"
            variant="outline"
            className="h-11 gap-2 rounded-xl border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 font-bold"
            onClick={() => handleRateCard("again")}
          >
            <ThumbsDown className="h-4 w-4" /> No
          </Button>

          <Button
            size="lg"
            className="h-11 gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/20"
            onClick={() => handleRateCard("good")}
          >
            <ThumbsUp className="h-4 w-4" /> Yes
          </Button>
        </div>

        {/* Fine-tuned Spaced Repetition Pills */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              onClick={() => handleRateCard(r.value)}
              className={cn("rounded-lg border px-3 py-1 text-xs font-bold transition-all hover:scale-105", r.className)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contextual AI Tutor Trigger Bar */}
      <div className="w-full">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 gap-2 text-xs rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/10 font-bold"
          onClick={() => setShowCoach(true)}
        >
          <MessageCircle className="h-4 w-4 text-primary" />
          <span>Ask AI Coach about {cardSubtopic} (Opens Side Panel)</span>
        </Button>
      </div>

      {/* Fixed Right-Side Contextual Tutor Drawer */}
      {showCoach && (
        <div
          className={cn(
            "fixed top-0 right-0 h-full bg-card/95 backdrop-blur-md border-l shadow-2xl z-50 p-4 flex flex-col justify-between transition-all duration-300 ease-in-out",
            isChatExpanded ? "w-full max-w-2xl sm:w-[580px] md:w-[680px]" : "w-80 sm:w-96"
          )}
        >
          <div className="flex items-center justify-between border-b pb-3 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">AI Concept Tutor</div>
                <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{cardSubtopic}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setIsChatExpanded((prev) => !prev)}
                title={isChatExpanded ? "Collapse panel width" : "Extend panel width"}
              >
                {isChatExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => setShowCoach(false)}
                title="Close panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 text-xs">
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-[11px] text-primary space-y-1">
              <span className="font-bold">Contextual AI Assistant</span>
              <p className="text-muted-foreground">Ask anything about <b className="text-foreground">{cardSubtopic}</b> without leaving your current card.</p>
            </div>

            {chatMessages.map((m, i) => (
              <div key={i} className={cn("p-3 rounded-xl text-xs leading-relaxed", m.role === "user" ? "bg-primary text-primary-foreground ml-6 shadow-sm" : "bg-muted/70 border border-border mr-4")}>
                <AIFormattedText>{m.text}</AIFormattedText>
              </div>
            ))}

            {chatLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>AI Tutor thinking...</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t space-y-2.5 shrink-0">
            <div className="flex flex-wrap gap-1">
              {["Explain this simpler", "Why does this happen?", "Give me an example", "What should I remember?"].map((p) => (
                <button
                  key={p}
                  onClick={() => sendTutorMessage(p)}
                  disabled={chatLoading}
                  className="rounded-lg border bg-secondary/60 hover:bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all"
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendTutorMessage();
                  }
                }}
                placeholder="Ask about this concept..."
                className="resize-none text-xs min-h-[42px] h-[42px] py-2.5 rounded-xl"
              />
              <Button size="sm" onClick={() => sendTutorMessage()} disabled={!chatInput.trim() || chatLoading} className="h-[42px] px-3.5 rounded-xl font-bold">
                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
