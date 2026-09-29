import AIFormattedText from "@/components/AIFormattedText";
import { useEffect, useState, useCallback, useMemo } from "react";
import { localClient } from "@/api/localStorageClient";
import { extractTextFromFile } from "@/libs/fileTextParser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/libs/utils";
import { logLearningEvent } from "@/libs/learningEvents";
import { classifyMistakeLocally, recordMistake, MISTAKE_TYPES } from "@/libs/mistakeEngine";
import { subscribeGeneration, startBackgroundQuizGen, clearJobState } from "@/libs/backgroundGenerationManager";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Brain,
  Send,
  RotateCw,
  CheckCircle2,
  XCircle,
  X,
  Sparkles,
  Dices,
  Upload,
  HelpCircle,
  Award,
  AlertCircle,
  ArrowRight,
  SkipForward,
  MessageCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  Check,
} from "lucide-react";

const QUIZ_CACHE_KEY = "lifeos_active_quiz_cache";

const RANDOM_QUIZ_TOPICS = [
  "Chemical Bonding & Hybridization",
  "Kinematics & Projectile Motion",
  "Derivatives & Chain Rule",
  "Organic Chemistry Reaction Mechanisms",
  "Electromagnetism & Magnetic Fields",
  "Data Structures & Time Complexity",
  "Cellular Biology & Genetics",
  "Thermodynamics & Entropy",
];

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];
const QUICK_COUNTS = [3, 5, 10, 15, 20];

/**
 * Parses question text and options to handle both structured options arrays
 * and questions where options were embedded in the prompt string.
 */
function parseQuestionData(q) {
  if (!q) return { questionText: "", options: [], raw: q };
  let questionText = q.question || q.prompt || "";
  let options = Array.isArray(q.options) && q.options.length > 0 ? [...q.options] : [];

  options = options.map((opt) => {
    if (typeof opt === "string") return opt.trim();
    if (opt && typeof opt === "object") return (opt.text || opt.label || JSON.stringify(opt)).trim();
    return String(opt || "");
  }).filter(Boolean);

  // If no options array was given, try extracting (A) ... (B) ... or A. ... B. ... from the question
  if (options.length === 0 && questionText) {
    const regexParen = /(?:^|\n|\s+)\(([A-Da-d1-4])\)\s+([^\n\(\)]+)/g;
    const regexDot = /(?:^|\n|\s+)([A-Da-d1-4])[\.\)]\s+([^\n\(\)]+)/g;
    
    let matches = [...questionText.matchAll(regexParen)];
    if (matches.length < 2) {
      matches = [...questionText.matchAll(regexDot)];
    }

    if (matches.length >= 2) {
      options = matches.map((m) => m[2].trim());
      const firstIdx = questionText.indexOf(matches[0][0]);
      if (firstIdx > 0) {
        questionText = questionText.slice(0, firstIdx).trim();
      }
    }
  }

  // Clean option labels like "A) " or "(A) " from option text for clean pill rendering
  const cleanedOptions = options.map((opt) => {
    return opt.replace(/^\(?[A-Da-d1-4]\)?[.:\-\s]+/, "").trim();
  });

  return {
    questionText,
    options: cleanedOptions.length >= 2 ? cleanedOptions : options,
    raw: q,
  };
}

/**
 * Checks if a specific option matches the expected answer
 */
function isOptionCorrect(optionText, optionIndex, expectedAnswer) {
  if (!expectedAnswer) return false;
  const exp = String(expectedAnswer).trim().toLowerCase();
  const opt = String(optionText).trim().toLowerCase();
  
  if (exp === opt) return true;
  
  const cleanExp = exp.replace(/^\(?[a-d1-6]\)?[.:\-\s]+/, "").trim();
  const cleanOpt = opt.replace(/^\(?[a-d1-6]\)?[.:\-\s]+/, "").trim();
  if (cleanExp && cleanExp === cleanOpt) return true;
  
  const letters = ["a", "b", "c", "d", "e", "f"];
  const letter = letters[optionIndex];
  if (
    exp === letter ||
    exp === `(${letter})` ||
    exp === `option ${letter}` ||
    exp.startsWith(`${letter})`) ||
    exp.startsWith(`${letter}.`)
  ) {
    return true;
  }

  if (cleanOpt.length > 2 && (cleanExp.includes(cleanOpt) || cleanOpt.includes(cleanExp))) {
    return true;
  }

  return false;
}

function getCachedQuiz() {
  try {
    const raw = localStorage.getItem(QUIZ_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCachedQuiz(data) {
  try {
    if (!data) {
      localStorage.removeItem(QUIZ_CACHE_KEY);
    } else {
      localStorage.setItem(QUIZ_CACHE_KEY, JSON.stringify(data));
    }
  } catch {}
}

export default function QuizReview({ initialQuestions = [], onQuizFinished }) {
  const [cachedData] = useState(() => getCachedQuiz());

  const [questions, setQuestions] = useState(() => {
    if (initialQuestions && initialQuestions.length > 0) return initialQuestions;
    return cachedData?.questions || [];
  });

  const [currentTopic, setCurrentTopic] = useState(() => cachedData?.topic || "");
  const [currentIndex, setCurrentIndex] = useState(() => cachedData?.currentIndex || 0);
  const [answersMap, setAnswersMap] = useState(() => cachedData?.answersMap || {});

  const [isFlipped, setIsFlipped] = useState(false);
  const [studentAnswer, setStudentAnswer] = useState("");
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [isAnsweredOrSkipped, setIsAnsweredOrSkipped] = useState(false);

  // AI Doubt Chatbot state
  const [showDoubtCoach, setShowDoubtCoach] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [doubtInput, setDoubtInput] = useState("");
  const [doubtMessages, setDoubtMessages] = useState([]);
  const [doubtLoading, setDoubtLoading] = useState(false);

  // Attached file & deck generation state
  const [attachedFile, setAttachedFile] = useState(null);
  const [genLoading, setGenLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [notice, setNotice] = useState(null);

  // Subscribe to persistent background generation state
  useEffect(() => {
    const unsub = subscribeGeneration((allJobs) => {
      const qJob = allJobs.quiz;
      if (qJob.status === "generating") {
        setGenLoading(true);
      } else if (qJob.status === "completed" && qJob.result) {
        setGenLoading(false);
        setQuestions(qJob.result);
        setCurrentTopic(qJob.topic);
        setCurrentIndex(0);
        setAnswersMap({});
        setStudentAnswer("");
        setSelectedOptionIdx(null);
        setEvaluation(null);
        setIsAnsweredOrSkipped(false);
        setIsFlipped(false);
        setNotice(`Generated ${qJob.result.length} questions for "${qJob.topic.slice(0, 40)}"!`);
        clearJobState("quiz");
      } else if (qJob.status === "error") {
        setGenLoading(false);
        setNotice(`Quiz generation error: ${qJob.error}`);
        clearJobState("quiz");
      }
    });
    return unsub;
  }, []);

  // Sync state whenever initialQuestions changes
  useEffect(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      setQuestions(initialQuestions);
      setCurrentIndex(0);
      setAnswersMap({});
      setStudentAnswer("");
      setSelectedOptionIdx(null);
      setEvaluation(null);
      setIsAnsweredOrSkipped(false);
      setIsFlipped(false);
    }
  }, [initialQuestions]);

  const currentQuestion = questions[currentIndex] || questions[0] || null;

  // Parsed question and option data with KaTeX math compatibility
  const parsedData = useMemo(() => {
    return parseQuestionData(currentQuestion);
  }, [currentQuestion]);

  const hasOptions = parsedData.options && parsedData.options.length >= 2;

  // Restore question-specific state on index change
  useEffect(() => {
    const saved = answersMap[currentIndex];
    if (saved) {
      setStudentAnswer(saved.studentAnswer || "");
      setSelectedOptionIdx(saved.selectedOptionIdx ?? null);
      setEvaluation(saved.evaluation || null);
      setIsAnsweredOrSkipped(Boolean(saved.isAnsweredOrSkipped));
      setIsFlipped(Boolean(saved.isFlipped));
    } else {
      setStudentAnswer("");
      setSelectedOptionIdx(null);
      setEvaluation(null);
      setIsAnsweredOrSkipped(false);
      setIsFlipped(false);
    }
    setDoubtMessages([]);
    setShowDoubtCoach(false);
  }, [currentIndex, answersMap]);

  // Persist current session into single active cache
  const updateActiveCache = useCallback((updatedFields = {}) => {
    const sessionToSave = {
      topic: updatedFields.topic ?? currentTopic,
      questions: updatedFields.questions ?? questions,
      currentIndex: updatedFields.currentIndex ?? currentIndex,
      answersMap: updatedFields.answersMap ?? answersMap,
      updatedAt: Date.now(),
    };
    saveCachedQuiz(sessionToSave);
  }, [currentTopic, questions, currentIndex, answersMap]);

  const startNewQuizPrompt = () => {
    saveCachedQuiz(null);
    setQuestions([]);
    setCurrentTopic("");
    setCurrentIndex(0);
    setAnswersMap({});
    setStudentAnswer("");
    setSelectedOptionIdx(null);
    setEvaluation(null);
    setIsAnsweredOrSkipped(false);
    setIsFlipped(false);
    setAttachedFile(null);
    setCustomPrompt("");
  };

  const sendDoubtMessage = async (overrideText) => {
    const text = String(overrideText || doubtInput).trim();
    if (!text || doubtLoading || !currentQuestion) return;
    const userMsg = { role: "user", text };
    const history = [...doubtMessages, userMsg];
    setDoubtMessages(history);
    setDoubtInput("");
    setDoubtLoading(true);

    try {
      const res = await localClient.functions.invoke("learningCoach", {
        operation: "chat",
        message: text,
        history: history.slice(-6),
        context: {
          currentQuestionNumber: currentIndex + 1,
          topic: currentTopic || "Quiz Topic",
          questionText: parsedData.questionText || currentQuestion.question,
          options: parsedData.options || [],
          studentResponse: studentAnswer || (evaluation?.skipped ? "(Student skipped question)" : "No answer provided"),
          expectedAnswer: currentQuestion.answer || currentQuestion.explanation,
          aiEvaluationFeedback: evaluation?.feedback || "",
          missingPoints: evaluation?.missing_points || [],
          correctnessScore: evaluation?.correctness ?? "Not scored",
          studentDoubt: text,
        },
      });
      const reply = res.data?.result?.reply || res.data?.result?.text || "Focus on the core conceptual derivation and problem breakdown.";
      setDoubtMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setDoubtMessages((prev) => [...prev, { role: "assistant", text: `AI Coach response error: ${err.message}` }]);
    } finally {
      setDoubtLoading(false);
    }
  };

  // Handle generating a new quiz set in background
  const handleGenerateQuiz = async (overridePrompt = "", defaultTopicName = "", explicitCount = null) => {
    const promptText = customPrompt.trim();

    let countToGen = explicitCount || 5;
    if (!explicitCount && promptText) {
      const countMatch = promptText.match(/\b(\d+)\s*(?:questions?|mcqs?|quiz questions?|quiz|problems?|items?)\b/i) ||
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
        sourceContent = promptText || RANDOM_QUIZ_TOPICS[Math.floor(Math.random() * RANDOM_QUIZ_TOPICS.length)];
      }
    }

    const topicToGenerate = defaultTopicName || (attachedFile ? (promptText || attachedFile.name.replace(/\.[^/.]+$/, "")) : (promptText || sourceContent.slice(0, 100)));
    setGenLoading(true);
    setNotice("Generating quiz in background...");

    setCustomPrompt("");
    setAttachedFile(null);

    try {
      await startBackgroundQuizGen({
        topic: topicToGenerate,
        promptText,
        explicitCount: countToGen,
        sourceContent,
      });
    } catch (err) {
      setNotice(`Quiz generation error: ${err.message}`);
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
      setNotice(`Attached "${parsed.name}" (${parsed.length} chars). Add custom instructions or click Generate Quiz.`);
    } catch (err) {
      setNotice(`File import error: ${err.message}`);
    } finally {
      e.target.value = "";
    }
  };

  // Option selection handler
  const handleSelectOption = (optText, optIdx) => {
    if (isAnsweredOrSkipped || evaluating) return;
    setSelectedOptionIdx(optIdx);
    setStudentAnswer(optText);
  };

  // Submit student answer for evaluation
  const handleSubmitAnswer = async (overrideOptionText, overrideOptionIdx) => {
    const answerToSubmit = (overrideOptionText ?? studentAnswer).trim();
    const optIdxToUse = overrideOptionIdx ?? selectedOptionIdx;

    if (!answerToSubmit || evaluating || !currentQuestion) return;
    setEvaluating(true);

    try {
      let evalData = null;
      let isCorrect = false;

      if (hasOptions) {
        // Fast direct MCQ match
        const isMatched = isOptionCorrect(answerToSubmit, optIdxToUse, currentQuestion.answer);
        isCorrect = isMatched;
        evalData = {
          correctness: isCorrect ? 1.0 : 0.0,
          rating: isCorrect ? "easy" : "again",
          feedback: isCorrect
            ? `Correct! Option (${OPTION_LETTERS[optIdxToUse] || ""}) is the right answer.`
            : `Incorrect choice. You selected Option (${OPTION_LETTERS[optIdxToUse] || ""}), but the correct answer is: ${currentQuestion.answer}.`,
          missing_points: isCorrect ? [] : ["Review the underlying conceptual derivation and formula below."],
          model_answer: currentQuestion.explanation || currentQuestion.answer,
        };
      } else {
        // AI written evaluation
        const res = await localClient.functions.invoke("learningCoach", {
          operation: "evaluateCardAnswer",
          question: parsedData.questionText || currentQuestion.question,
          expectedAnswer: currentQuestion.answer,
          explanation: currentQuestion.explanation,
          studentAnswer: answerToSubmit,
          difficulty: currentQuestion.difficulty || "medium",
        });

        if (res.data?.error) throw new Error(res.data.error);
        evalData = res.data?.result || {};
        isCorrect = (evalData.correctness || 0.75) >= 0.6;
      }

      setEvaluation(evalData);
      setIsAnsweredOrSkipped(true);
      setIsFlipped(true); // Flip card to show solution & score

      const newAnswers = {
        ...answersMap,
        [currentIndex]: {
          studentAnswer: answerToSubmit,
          selectedOptionIdx: optIdxToUse,
          evaluation: evalData,
          isAnsweredOrSkipped: true,
          isFlipped: true,
        },
      };
      setAnswersMap(newAnswers);
      updateActiveCache({ answersMap: newAnswers, currentIndex });

      logLearningEvent({
        event_type: "quiz_answered",
        question_id: currentQuestion.id,
        topic_name: currentTopic || currentQuestion.title || "Quiz Topic",
        rating: evalData.rating || (isCorrect ? "good" : "again"),
        is_correct: isCorrect,
      });

      if (!isCorrect) {
        const localClass = classifyMistakeLocally({
          question: parsedData.questionText || currentQuestion.question,
          expectedAnswer: currentQuestion.answer || currentQuestion.explanation,
          studentAnswer: answerToSubmit,
          missingPoints: evalData.missing_points || [],
        });
        recordMistake({
          topicName: currentTopic || currentQuestion.title || "Quiz Topic",
          mistakeType: localClass.type || MISTAKE_TYPES.CONCEPTUAL,
          rationale: localClass.rationale || "Student selected an incorrect option.",
          question: parsedData.questionText || currentQuestion.question,
          studentAnswer: answerToSubmit,
          expectedAnswer: currentQuestion.answer,
        });
      }
    } catch (err) {
      const fallbackEval = {
        correctness: 0.75,
        rating: "good",
        feedback: "Answer recorded! Review the model solution and key principles below.",
        missing_points: [],
        model_answer: currentQuestion.answer || currentQuestion.explanation,
      };
      setEvaluation(fallbackEval);
      setIsAnsweredOrSkipped(true);
      setIsFlipped(true);

      const newAnswers = {
        ...answersMap,
        [currentIndex]: {
          studentAnswer: answerToSubmit,
          selectedOptionIdx: optIdxToUse,
          evaluation: fallbackEval,
          isAnsweredOrSkipped: true,
          isFlipped: true,
        },
      };
      setAnswersMap(newAnswers);
      updateActiveCache({ answersMap: newAnswers, currentIndex });
    } finally {
      setEvaluating(false);
    }
  };

  // Skip answering this question immediately
  const handleSkipQuestion = () => {
    if (!currentQuestion) return;
    const skipEval = {
      correctness: 0,
      rating: "again",
      feedback: "Question skipped. Review the model answer and step-by-step solution below.",
      missing_points: [],
      model_answer: currentQuestion.answer || currentQuestion.explanation,
      skipped: true,
    };
    setEvaluation(skipEval);
    setIsAnsweredOrSkipped(true);
    setIsFlipped(true);

    const newAnswers = {
      ...answersMap,
      [currentIndex]: {
        studentAnswer: "(skipped)",
        selectedOptionIdx: null,
        evaluation: skipEval,
        isAnsweredOrSkipped: true,
        isFlipped: true,
      },
    };
    setAnswersMap(newAnswers);
    updateActiveCache({ answersMap: newAnswers, currentIndex });

    logLearningEvent({
      event_type: "quiz_answered",
      question_id: currentQuestion.id,
      topic_name: currentTopic || currentQuestion.title || "Quiz Topic",
      rating: "again",
      is_correct: false,
    });

    recordMistake({
      topicName: currentTopic || currentQuestion.title || "Quiz Topic",
      mistakeType: MISTAKE_TYPES.MEMORY,
      rationale: "Question was skipped by student.",
      question: parsedData.questionText || currentQuestion.question,
      studentAnswer: "(skipped)",
      expectedAnswer: currentQuestion.answer,
    });
  };

  const handleNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      updateActiveCache({ currentIndex: nextIdx });
    } else {
      onQuizFinished?.();
    }
  };

  const handlePrevQuestion = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      updateActiveCache({ currentIndex: prevIdx });
    }
  };

  const handleJumpToQuestion = (targetIdx) => {
    if (targetIdx >= 0 && targetIdx < questions.length) {
      setCurrentIndex(targetIdx);
      updateActiveCache({ currentIndex: targetIdx });
    }
  };

  // Keyboard shortcuts (A, B, C, D or 1, 2, 3, 4 for MCQ options; Enter to submit)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable ||
        evaluating ||
        !currentQuestion
      ) {
        return;
      }

      if (hasOptions && !isAnsweredOrSkipped) {
        const key = e.key.toUpperCase();
        let optIdx = -1;
        if (["1", "2", "3", "4", "5", "6"].includes(e.key)) {
          optIdx = parseInt(e.key, 10) - 1;
        } else if (["A", "B", "C", "D", "E", "F"].includes(key)) {
          optIdx = key.charCodeAt(0) - 65;
        }

        if (optIdx >= 0 && optIdx < parsedData.options.length) {
          e.preventDefault();
          handleSelectOption(parsedData.options[optIdx], optIdx);
          return;
        }
      }

      if (e.key === "Enter" && !isAnsweredOrSkipped && (studentAnswer || selectedOptionIdx !== null)) {
        e.preventDefault();
        handleSubmitAnswer();
      } else if (e.code === "Space" && isAnsweredOrSkipped) {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.key === "ArrowRight" && isAnsweredOrSkipped) {
        e.preventDefault();
        handleNextQuestion();
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        e.preventDefault();
        handlePrevQuestion();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasOptions, isAnsweredOrSkipped, studentAnswer, selectedOptionIdx, evaluating, currentQuestion, parsedData.options, currentIndex]);

  const totalQuestions = questions.length;
  const progressPercent = Math.round(((currentIndex + 1) / Math.max(1, totalQuestions)) * 100);
  const answeredCount = Object.keys(answersMap).length;

  return (
    <div className="flex flex-col items-center space-y-5 max-w-3xl mx-auto py-1 relative">
      {/* Quick Quiz Generator Bar */}
      <div className="w-full lifeos-surface rounded-2xl border p-3 flex flex-col gap-2.5 shadow-sm">
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
                handleGenerateQuiz();
              }
            }}
            placeholder={attachedFile ? `Instructions for "${attachedFile.name}"... (e.g. 14 questions, hard level)` : "Type topic & count... (e.g. 14 questions on Colligative Properties, 21 mcqs)"}
            className="h-9 text-xs flex-1"
          />
          <input
            type="file"
            id="quiz-file-upload"
            className="hidden"
            accept=".pdf,.txt,.md,.json,.csv,.js,.py,.docx"
            onChange={handleFileUploadInBar}
          />
          
          <div className="flex items-center gap-2 w-full sm:w-auto">            <Button
              size="sm"
              className="h-9 text-xs gap-1.5 rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 flex-1 sm:flex-none"
              onClick={() => handleGenerateQuiz()}
              disabled={genLoading}
            >
              {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>Generate Quiz</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-9 text-xs gap-1.5 rounded-xl font-bold transition-all",
                attachedFile ? "border-primary bg-primary/10 text-primary" : "border-primary/30 text-primary hover:bg-primary/10"
              )}
              onClick={() => document.getElementById("quiz-file-upload")?.click()}
              disabled={genLoading}
              title="Attach PDF or Text file for quiz generation"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{attachedFile ? "Change File" : "Import"}</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs gap-1.5 rounded-xl font-bold border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => {
                const pick = RANDOM_QUIZ_TOPICS[Math.floor(Math.random() * RANDOM_QUIZ_TOPICS.length)];
                setCustomPrompt(pick);
              }}
              disabled={genLoading}
              title="Fill input with a random sample topic"
            >
              <Dices className="h-3.5 w-3.5" />
            </Button>

            {questions.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-xs gap-1 rounded-xl text-muted-foreground hover:text-foreground"
                onClick={startNewQuizPrompt}
                title="Clear current quiz and start new"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {!currentQuestion ? (
        <div className="w-full lifeos-surface rounded-2xl border p-10 flex flex-col items-center justify-center space-y-5 text-center my-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
            <HelpCircle className="h-7 w-7" />
          </div>
          
          <div className="space-y-1.5 max-w-md">
            <h3 className="text-xl font-bold text-foreground tracking-tight">Create Your Quiz</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Type any topic or number of questions (e.g. <i>"14 questions on Thermodynamics"</i>), select a question count, or attach a PDF/text file.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 max-w-lg">
            {RANDOM_QUIZ_TOPICS.slice(0, 5).map((topic, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCustomPrompt(topic)}
                className="text-[11px] px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/15 text-primary font-medium transition-all"
              >
                + {topic}
              </button>
            ))}
          </div>

          <div className="pt-2 flex items-center gap-3">
            <Button
              onClick={() => document.getElementById("quiz-file-upload")?.click()}
              variant="outline"
              disabled={genLoading}
              className="gap-2 rounded-xl text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10"
            >
              <Upload className="h-4 w-4" />
              <span>Import PDF / Text File</span>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {notice && (
            <div className="w-full text-center text-xs font-semibold text-primary bg-primary/10 border border-primary/30 rounded-xl py-1.5 px-3 animate-fade-in flex items-center justify-between">
              <span>{notice}</span>
              <button onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">×</button>
            </div>
          )}

      {/* Top Progress & Question Selector Header */}
      <div className="w-full space-y-2.5">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground px-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground truncate max-w-[200px] sm:max-w-xs">
              {currentTopic || "Practice Quiz"}
            </span>
            <span>·</span>
            <span className="text-primary font-semibold">Question {currentIndex + 1} of {totalQuestions}</span>
            <span className="text-muted-foreground text-[11px]">({answeredCount} answered)</span>
          </div>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase tracking-wider">
            {currentQuestion.difficulty || "medium"}
          </span>
        </div>

        {/* Question Bubble Indicator Navigator */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {questions.map((q, idx) => {
            const isCurr = idx === currentIndex;
            const isAns = Boolean(answersMap[idx]);
            const isAnsCorrect = answersMap[idx]?.evaluation?.correctness >= 0.6;
            return (
              <button
                key={idx}
                onClick={() => handleJumpToQuestion(idx)}
                className={cn(
                  "h-7 min-w-[28px] px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center",
                  isCurr
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30 scale-105"
                    : isAns
                    ? isAnsCorrect
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50"
                )}
                title={`Question ${idx + 1}${isAns ? (isAnsCorrect ? " (Correct)" : " (Incorrect/Skipped)") : ""}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-indigo-500 transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main 3D JS Animated Quiz Flashcard Container */}
      <div
        className="w-full relative select-none"
        style={{ perspective: "1000px" }}
      >
        <div
          className="w-full min-h-[420px] sm:min-h-[460px] relative transition-transform duration-500 ease-in-out transform-gpu"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* FRONT FACE: Question & Student Option Selection or Written Answer */}
          <div
            className={cn(
              "absolute inset-0 rounded-2xl border p-5 sm:p-7 flex flex-col justify-between shadow-xl border-primary/30 bg-gradient-to-b from-card via-card/95 to-primary-950/10 shadow-primary/5 backface-hidden",
              isFlipped && "pointer-events-none"
            )}
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="flex items-center justify-between border-b pb-2.5 mb-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold bg-primary/20 text-primary">
                  <HelpCircle className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-foreground truncate max-w-[240px]">
                  {currentTopic || "Quiz Question"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] font-extrabold tracking-wider uppercase">
                  {hasOptions ? "Multiple Choice" : "Written Response"}
                </span>
              </div>
            </div>

            {/* Question Text with KaTeX Math Support */}
            <div className="flex-1 flex flex-col justify-between py-1 space-y-3 overflow-y-auto max-h-[340px] pr-1">
              <div className="text-base sm:text-lg font-bold leading-relaxed text-foreground">
                <AIFormattedText className="[&_.katex]:text-lg [&_.katex-display]:my-2">{parsedData.questionText || currentQuestion.question}</AIFormattedText>
              </div>

              {/* Multiple Choice Options Grid */}
              {hasOptions ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground px-0.5">
                    <span>Select the correct option:</span>
                    {isAnsweredOrSkipped && (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="h-3 w-3" /> Answer Locked
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {parsedData.options.map((optText, optIdx) => {
                      const isSelected = selectedOptionIdx === optIdx || (studentAnswer && studentAnswer.trim() === optText.trim());
                      const isCorrectChoice = isAnsweredOrSkipped && isOptionCorrect(optText, optIdx, currentQuestion.answer);
                      const isWrongChoice = isAnsweredOrSkipped && isSelected && !isCorrectChoice;
                      const letter = OPTION_LETTERS[optIdx] || String(optIdx + 1);

                      return (
                        <div
                          key={optIdx}
                          onClick={() => handleSelectOption(optText, optIdx)}
                          className={cn(
                            "relative group flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all select-none",
                            !isAnsweredOrSkipped && isSelected && "border-primary bg-primary/15 text-primary shadow-md shadow-primary/10 ring-1 ring-primary/40",
                            !isAnsweredOrSkipped && !isSelected && "border-border/80 bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 text-foreground",
                            isCorrectChoice && "border-emerald-500/70 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40 font-semibold",
                            isWrongChoice && "border-rose-500/70 bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/40 font-semibold",
                            isAnsweredOrSkipped && !isCorrectChoice && !isWrongChoice && "opacity-50 border-border/50 bg-secondary/20",
                            (isAnsweredOrSkipped || evaluating) && "cursor-default"
                          )}
                        >
                          <div
                            className={cn(
                              "h-6 w-6 rounded-lg text-[11px] font-black flex items-center justify-center shrink-0 transition-colors mt-0.5",
                              !isAnsweredOrSkipped && isSelected && "bg-primary text-primary-foreground",
                              !isAnsweredOrSkipped && !isSelected && "bg-secondary text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary",
                              isCorrectChoice && "bg-emerald-500 text-white",
                              isWrongChoice && "bg-rose-500 text-white",
                              isAnsweredOrSkipped && !isCorrectChoice && !isWrongChoice && "bg-secondary text-muted-foreground"
                            )}
                          >
                            {letter}
                          </div>

                          <div className="flex-1 min-w-0 pr-1 text-xs leading-relaxed text-foreground">
                            <AIFormattedText className="[&_p]:mb-0 [&_p]:inline [&_.katex]:text-sm break-words">{optText}</AIFormattedText>
                          </div>

                          {isCorrectChoice && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5 ml-auto" />
                          )}
                          {isWrongChoice && (
                            <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5 ml-auto" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Written Answer Input for Non-MCQ Questions */
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>Type your written answer / derivation:</span>
                    {isAnsweredOrSkipped && (
                      <span className="text-emerald-400 font-bold">✓ Answer Evaluated</span>
                    )}
                  </div>
                  <Textarea
                    value={studentAnswer}
                    onChange={(e) => setStudentAnswer(e.target.value)}
                    disabled={evaluating || isAnsweredOrSkipped}
                    rows={4}
                    placeholder="Explain your answer or derivation step-by-step..."
                    className="resize-none text-xs rounded-xl"
                  />
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-3 border-t mt-2.5 flex items-center justify-between text-xs gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevQuestion}
                disabled={currentIndex === 0 || evaluating}
                className="h-9 px-3 gap-1 text-xs font-semibold"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>

              <div className="flex items-center gap-2">
                {!isAnsweredOrSkipped ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSkipQuestion}
                      disabled={evaluating}
                      className="h-9 px-3.5 gap-1.5 rounded-xl border-dashed border-muted-foreground/40 text-muted-foreground hover:text-foreground font-semibold"
                    >
                      <SkipForward className="h-3.5 w-3.5" /> Skip
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => handleSubmitAnswer()}
                      disabled={(!studentAnswer.trim() && selectedOptionIdx === null) || evaluating}
                      className="h-9 px-4 gap-1.5 rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 shadow-md shadow-primary/20"
                    >
                      {evaluating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking...
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" /> Submit Answer
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsFlipped(true)}
                      className="h-9 px-3.5 gap-1.5 rounded-xl font-bold border-primary/40 text-primary hover:bg-primary/10"
                    >
                      <RotateCw className="h-3.5 w-3.5" /> View Solution
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleNextQuestion}
                      className="h-9 px-4 gap-1.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                    >
                      <span>{currentIndex < questions.length - 1 ? "Next" : "Finish Quiz"}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* BACK FACE: AI Evaluation, Explanation & Model Solution */}
          <div
            className={cn(
              "absolute inset-0 rounded-2xl border p-5 sm:p-7 flex flex-col justify-between shadow-2xl border-emerald-500/40 bg-gradient-to-b from-card via-card/95 to-emerald-950/20 shadow-emerald-500/5 backface-hidden",
              !isFlipped && "pointer-events-none"
            )}
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="flex items-center justify-between border-b pb-2.5 mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-foreground truncate max-w-[220px]">
                  Solution & Explanation
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] font-extrabold tracking-wider uppercase">
                Back · Solution
              </span>
            </div>

            {/* Scrollable Evaluation Body */}
            <div className="flex-1 overflow-y-auto max-h-[360px] py-1 pr-1.5 space-y-3.5">
              
              {/* Score / Rating Banner */}
              {evaluation && (
                <div
                  className={cn(
                    "rounded-xl border p-3 flex items-center justify-between",
                    evaluation.correctness >= 0.6
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {evaluation.correctness >= 0.6 ? (
                      <Award className="h-5 w-5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider">
                        {evaluation.skipped
                          ? "Skipped"
                          : evaluation.correctness >= 0.6
                          ? "Correct Choice (+100%)"
                          : "Incorrect Choice (0%)"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {hasOptions && selectedOptionIdx !== null && (
                          <span>Your answer: <b>Option ({OPTION_LETTERS[selectedOptionIdx]})</b> · </span>
                        )}
                        Rating: <span className="font-bold text-foreground uppercase">{evaluation.rating || "good"}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-primary hover:text-primary/80 p-1"
                    onClick={() => setIsFlipped(false)}
                  >
                    View Question
                  </Button>
                </div>
              )}

              {/* AI Feedback */}
              {evaluation?.feedback && (
                <div className="space-y-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Feedback</span>
                  <div className="text-xs leading-relaxed text-foreground/90 bg-secondary/40 border p-3 rounded-xl">
                    <AIFormattedText>{evaluation.feedback}</AIFormattedText>
                  </div>
                </div>
              )}

              {/* Model Answer & Step-by-Step Derivation */}
              <div className="space-y-1.5 pt-1 border-t border-emerald-500/20">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                  Model Answer & Conceptual Derivation
                </span>
                <div className="text-sm font-medium leading-relaxed text-foreground/95 bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl space-y-2">
                  <AIFormattedText className="[&_.katex]:text-base [&_.katex-display]:my-2">
                    {evaluation?.model_answer || currentQuestion.explanation || currentQuestion.answer}
                  </AIFormattedText>
                </div>
              </div>

              {/* Doubt clearance button on card back */}
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs gap-1.5 rounded-xl border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-bold"
                  onClick={() => setShowDoubtCoach(true)}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>Clear Doubts about this Question with AI Tutor</span>
                </Button>
              </div>
            </div>

            {/* Back Action Bar */}
            <div className="pt-3 border-t mt-2 flex items-center justify-between text-xs text-muted-foreground/70 shrink-0">
              <button
                onClick={() => setIsFlipped(false)}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
              >
                <RotateCw className="h-3.5 w-3.5" /> Flip to Front
              </button>

              <Button
                size="sm"
                onClick={handleNextQuestion}
                className="h-9 px-4 gap-1.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
              >
                <span>{currentIndex < questions.length - 1 ? "Next Question" : "Finish Quiz"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contextual AI Doubt Solver Trigger (Visible when answer has been evaluated/skipped) */}
      {isAnsweredOrSkipped && (
        <div className="w-full">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 gap-2 text-xs rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/10 font-bold shadow-sm"
            onClick={() => setShowDoubtCoach(true)}
          >
            <Brain className="h-4 w-4 text-primary" />
            <span>Have a Doubt? Ask AI Assistant about Question {currentIndex + 1} & Your Response</span>
          </Button>
        </div>
      )}

      {/* Fixed Right-Side Contextual Quiz Doubt Solver Drawer */}
      {showDoubtCoach && (
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
                <div className="text-xs font-bold text-foreground">Quiz Doubt Assistant</div>
                <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{currentTopic || "Quiz Question"}</div>
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
                onClick={() => setShowDoubtCoach(false)}
                title="Close panel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 text-xs">
            <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-[11px] text-primary space-y-1">
              <span className="font-bold flex items-center gap-1"><Sparkles className="h-3 w-3" /> Question & Response Reference</span>
              <p className="text-muted-foreground leading-relaxed">
                The AI knows the exact question, your selected option, and the evaluation. Ask any doubt!
              </p>
              {studentAnswer && (
                <div className="mt-1 p-1.5 rounded-lg bg-background/50 border text-[10px] text-foreground/80 truncate">
                  <span className="font-semibold text-muted-foreground">Your answer: </span>
                  {hasOptions && selectedOptionIdx !== null ? `Option (${OPTION_LETTERS[selectedOptionIdx]}): ` : ""}{studentAnswer}
                </div>
              )}
            </div>

            {doubtMessages.map((m, i) => (
              <div key={i} className={cn("p-3 rounded-xl text-xs leading-relaxed", m.role === "user" ? "bg-primary text-primary-foreground ml-6 shadow-sm" : "bg-muted/70 border border-border mr-4")}>
                <AIFormattedText>{m.text}</AIFormattedText>
              </div>
            ))}

            {doubtLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>AI Tutor explaining doubt...</span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t space-y-2.5 shrink-0">
            <div className="flex flex-wrap gap-1">
              {["Why was my answer wrong?", "Explain the derivation step-by-step", "What formula should I use?", "Give a similar practice problem"].map((p) => (
                <button
                  key={p}
                  onClick={() => sendDoubtMessage(p)}
                  disabled={doubtLoading}
                  className="rounded-lg border bg-secondary/60 hover:bg-secondary px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-all"
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Textarea
                value={doubtInput}
                onChange={(e) => setDoubtInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendDoubtMessage();
                  }
                }}
                placeholder="Ask about this question, derivation or your response..."
                className="resize-none text-xs min-h-[42px] h-[42px] py-2.5 rounded-xl"
              />
              <Button size="sm" onClick={() => sendDoubtMessage()} disabled={!doubtInput.trim() || doubtLoading} className="h-[42px] px-3.5 rounded-xl font-bold">
                {doubtLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
