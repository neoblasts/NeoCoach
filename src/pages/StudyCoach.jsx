import { memo, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, useCallback } from "react";
import { localClient } from "@/api/localStorageClient";
import AIFormattedText from "@/components/AIFormattedText";
import { getStreamSafeText } from "@/libs/mathPipeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/libs/utils";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertCircle,
  BookOpen,
  Brain,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
  Eraser,
  ImagePlus,
  Layers,
  GraduationCap,
  Lightbulb,
  Zap,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Terminal,
  Cpu,
  CheckCircle2,
  Laptop
} from "lucide-react";
import { getAISettings, aiChatStream } from "@/libs/aiProviders";
import { getMinimalSubgraphForAI } from "@/libs/knowledgeGraph";

/* -------------------------------------------------------------------------- */
/* Constants & Quick Prompts                                                   */
/* -------------------------------------------------------------------------- */

const QUICK_ACTIONS = [
  { id: "explain", label: "Explain deeply", icon: Brain, prompt: "Explain this concept deeply with intuition, mathematical derivations, and examples:" },
  { id: "cards",   label: "Make Flashcards", icon: BookOpen, prompt: "Generate active recall flashcards from this material:" },
];

const SUGGESTED_PROMPTS = [
  { icon: Brain, title: "Deep Explanation", desc: "Derive formulas and break down tricky concepts step-by-step" },
  { icon: Lightbulb, title: "Solve from Screenshot", desc: "Attach or paste a photo of any diagram or question" },
  { icon: Laptop, title: "YouTube Video Lectures", desc: "Ask for JEE/Board one-shots or video explanations with direct player embed" },
  { icon: Zap, title: "Exam Strategy", desc: "Ask for shortcut tricks and common traps in JEE/Advanced problems" },
];

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function titleFromMessages(messages) {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const text = first.text?.trim().replace(/\s+/g, " ") || "Image question";
  return text.length > 36 ? text.slice(0, 36) + "…" : text;
}



function speakText(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const clean = String(text || "").replace(/[*#`$\\]/g, "").slice(0, 260);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  } catch (e) {}
}

/* -------------------------------------------------------------------------- */
/* Session persistence helpers                                                */
/* -------------------------------------------------------------------------- */

function loadSessions() {
  const all = localClient.entities.AIInteraction.list("-updated_at", 200);
  const legacy = all.find((item) => item.type === "study_coach_chat");
  if (legacy?.messages?.length) {
    localClient.entities.AIInteraction.update(legacy.id, {
      type: "study_coach_session",
      title: titleFromMessages(legacy.messages),
    });
  } else if (legacy) {
    localClient.entities.AIInteraction.update(legacy.id, { type: "study_coach_session_empty" });
  }

  return localClient.entities.AIInteraction
    .list("-updated_at", 200)
    .filter((item) => item.type === "study_coach_session");
}

function createSession(firstTitle = "New chat") {
  return localClient.entities.AIInteraction.create({
    type: "study_coach_session",
    title: firstTitle,
    messages: [],
  });
}

function persistSession(id, messages, title) {
  try {
    localClient.entities.AIInteraction.update(id, {
      messages,
      title,
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

function deleteSession(id) {
  try { localClient.entities.AIInteraction.delete(id); } catch {}
}

/* -------------------------------------------------------------------------- */
/* MessageBubble                                                              */
/* -------------------------------------------------------------------------- */

const MessageBubble = memo(function MessageBubble({ message, onSpeak }) {
  const isUser = message.role === "user";
  const isStreaming = Boolean(message.streaming);

  const displayText = useMemo(() => {
    if (!isStreaming || !message.text) return message.text;
    return getStreamSafeText(message.text);
  }, [message.text, isStreaming]);

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("relative", isUser ? "max-w-[85%] sm:max-w-[78%]" : "w-full max-w-[960px]")}>
        {isUser ? (
          <div className="rounded-2xl rounded-br-md bg-primary px-5 py-3.5 text-sm leading-relaxed text-primary-foreground shadow-md">
            {message.imageDataUrl && (
              <img
                src={message.imageDataUrl}
                alt="Attached question"
                className="mb-2.5 max-h-80 max-w-full rounded-xl border border-primary-foreground/20 object-contain shadow-sm"
              />
            )}
            {message.text && (
              <div className="whitespace-pre-wrap break-words text-[15px]">{message.text}</div>
            )}
            {message.createdAt && (
              <div className="mt-1.5 text-right text-[10px] text-primary-foreground/70 font-mono">{formatTime(message.createdAt)}</div>
            )}
          </div>
        ) : (
          <div className="group rounded-2xl border border-border/50 bg-card/70 p-5 sm:p-6 shadow-sm backdrop-blur-sm">
            <div className="mb-3.5 flex items-center justify-between border-b border-border/30 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-inner">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-bold tracking-wide text-foreground">AI Assistant & Coach</span>
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">AI TUTOR</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSpeak?.(displayText)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Speak answer out loud"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
                {message.createdAt && (
                  <span className="text-[10px] font-mono text-muted-foreground/60">{formatTime(message.createdAt)}</span>
                )}
              </div>
            </div>

            <AIFormattedText
              className="text-[15px] leading-relaxed text-foreground"
              streaming={isStreaming}
            >
              {displayText}
            </AIFormattedText>
          </div>
        )}
      </div>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* ChatSessionsPanel                                                          */
/* -------------------------------------------------------------------------- */

function ChatSessionsPanel({ sessions, activeId, onSelect, onCreate, onRename, onDelete }) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renamingId, setRenamingId]  = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpenId) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpenId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  const commitRename = () => {
    if (renamingId && renameValue.trim()) onRename(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  return (
    <div className="flex h-full flex-col min-h-0">
      <div className="p-1 pb-3">
        <Button
          onClick={onCreate}
          className="w-full justify-center gap-2 rounded-xl bg-primary text-primary-foreground shadow-sm hover:opacity-95 font-semibold text-xs h-9"
        >
          <MessageSquarePlus className="h-4 w-4" /> New Chat
        </Button>
      </div>

      <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>History</span>
        <span>{sessions.length}</span>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto pr-1 min-h-0 mt-1">
        {sessions.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground italic">No past chats yet</p>
        )}
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              "group relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all cursor-pointer select-none",
              session.id === activeId
                ? "bg-primary/15 font-semibold text-foreground border border-primary/25 shadow-2xs"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            onClick={() => onSelect(session.id)}
          >
            {renamingId === session.id ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  { e.preventDefault(); commitRename(); }
                  if (e.key === "Escape") { setRenamingId(null); }
                }}
                className="min-w-0 flex-1 rounded-md bg-background px-2 py-1 text-xs outline-none ring-1 ring-primary/50"
                autoFocus
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-left" title={session.title}>
                {session.title || "New chat"}
              </span>
            )}

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpenId(menuOpenId === session.id ? null : session.id);
                }}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted text-muted-foreground hover:text-foreground",
                  menuOpenId === session.id ? "opacity-100 bg-muted" : "opacity-0 group-hover:opacity-100"
                )}
                title="Options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {menuOpenId === session.id && (
                <div
                  ref={menuRef}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1 z-50 min-w-[130px] rounded-xl border border-border/80 bg-popover/95 p-1 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(null);
                      setRenamingId(session.id);
                      setRenameValue(session.title || "");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Rename
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(null);
                      onDelete(session.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete Chat
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
const ChatComposer = memo(forwardRef(function ChatComposer({
  loading,
  imageDataUrl,
  onAttach,
  onRemoveImage,
  onSend,
  placeholder,
}, ref) {
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedMicId, setSelectedMicId] = useState("");
  const [showMicDropdown, setShowMicDropdown] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [micDiagnostic, setMicDiagnostic] = useState(null);

  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getValue: () => draft,
    setValue: (v) => setDraft(v),
    clear: () => setDraft(""),
    focus: () => textareaRef.current?.focus(),
  }), [draft]);

  // Enumerate available microphone devices on mount
  useEffect(() => {
    async function loadDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter((d) => d.kind === "audioinput");
        setAudioDevices(inputs);
        if (inputs.length > 0 && !selectedMicId) {
          setSelectedMicId(inputs[0].deviceId);
        }
      } catch (e) {}
    }
    loadDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", loadDevices);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", loadDevices);
  }, []);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [partialTranscript, setPartialTranscript] = useState("");

  // Listen to Python transcriber events
  useEffect(() => {
    if (!window.electronAPI?.voiceTranscriber) return;
    const cleanup = window.electronAPI.voiceTranscriber.onEvent((event) => {
      if (event.type === 'partial') {
        setPartialTranscript(event.text);
      } else if (event.type === 'transcript') {
        setPartialTranscript("");
        setDraft((prev) => (prev ? prev.trim() + ' ' : '') + event.text);
      } else if (event.type === 'error') {
        setMicDiagnostic("Voice error: " + event.message);
      } else if (event.type === 'stopped') {
        setIsListening(false);
      } else if (event.type === 'listening') {
        setAudioLevel(prev => (prev === 0 ? 50 : 80)); // Mock audio level jump when speaking
      } else if (event.type === 'silence') {
        setAudioLevel(10);
      }
    });
    return cleanup;
  }, []);

  const toggleMic = async () => {
    setMicDiagnostic(null);

    if (isListening) {
      if (window.electronAPI?.voiceTranscriber) {
        window.electronAPI.voiceTranscriber.stop();
      }
      setIsListening(false);
      setAudioLevel(0);
      return;
    }

    if (window.electronAPI?.voiceTranscriber) {
      try {
        const res = await window.electronAPI.voiceTranscriber.start({ model: 'base' });
        if (res.status === 'started' || res.status === 'already_running') {
          setIsListening(true);
          setAudioLevel(10); // Base level to show it's active
        } else {
          setMicDiagnostic("Failed to start voice transcriber");
        }
      } catch (e) {
        setMicDiagnostic("Error: " + e.message);
      }
    } else {
      setMicDiagnostic("Desktop voice transcription not available.");
    }
  };

  const submit = useCallback(() => {
    const text = draft.trim();
    if ((!text && !imageDataUrl && !recordedAudioUrl) || loading) return;
    onSend(text, recordedAudioUrl);
    setDraft("");
    setRecordedAudioUrl(null);
  }, [draft, imageDataUrl, recordedAudioUrl, loading, onSend]);

  return (
    <div className="w-full">
      {imageDataUrl && (
        <div className="mb-2.5 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-2.5 backdrop-blur-sm animate-in fade-in">
          <img src={imageDataUrl} alt="Question preview" className="h-14 w-14 rounded-lg border object-cover shadow-inner" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-foreground">Attached Question Image</div>
            <div className="text-[11px] text-muted-foreground">AI vision will extract text, equations, and diagrams automatically.</div>
          </div>
          <button type="button" onClick={onRemoveImage} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Remove image">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Voice Recording Pill UI & Transcribe Options */}
      {recordedAudioUrl && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 backdrop-blur-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Mic className="h-3 w-3" />
            </div>
            <span>Voice Recording Ready</span>
            {isTranscribing && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400/80 font-normal">
                <Loader2 className="h-3 w-3 animate-spin text-emerald-400" /> Transcribing voice into text...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => transcribeAudioBlob(recordedAudioUrl)}
              disabled={isTranscribing}
              className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
            >
              Re-transcribe Voice
            </button>
            <button
              type="button"
              onClick={submit}
              className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 shadow-sm hover:bg-emerald-400 transition-colors"
            >
              Send Voice Command
            </button>
            <button
              type="button"
              onClick={() => setRecordedAudioUrl(null)}
              className="text-emerald-400/70 hover:text-emerald-300 p-1"
              title="Discard audio"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mic Diagnostic Front-End Log Alert */}
      {micDiagnostic && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 backdrop-blur-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{micDiagnostic}</span>
          </div>
          <button type="button" onClick={() => setMicDiagnostic(null)} className="text-amber-400/70 hover:text-amber-300">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Live Recording Volume Level Meter */}
      {isListening && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 backdrop-blur-sm">
          <div className="flex items-center gap-2 font-mono">
            <div className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            <span className="font-semibold">RECORDING LIVE AUDIO</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-rose-300/80 font-mono">Mic Level: {audioLevel}%</span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-rose-950/50 border border-rose-500/30">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-emerald-400 transition-all duration-75"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="relative flex items-end gap-1.5 rounded-2xl border border-border/60 bg-background/80 p-2 shadow-sm backdrop-blur-md focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/40 transition-all">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onAttach}
          disabled={loading}
          className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Attach or upload question image"
        >
          <ImagePlus className="h-5 w-5" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={2}
          placeholder={isListening ? "Listening to your voice command..." : placeholder}
          className="min-h-[52px] max-h-[160px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 leading-relaxed"
        />

        <Button
          onClick={submit}
          disabled={loading || (!draft.trim() && !imageDataUrl)}
          size="sm"
          className="h-10 shrink-0 gap-1.5 rounded-xl px-4 font-semibold shadow-sm"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>
    </div>
  );
}));

/* -------------------------------------------------------------------------- */
/* Main page: StudyCoach (AI Assistant & Study Coach)                        */
/* -------------------------------------------------------------------------- */

export default function StudyCoach() {
  const { toast } = useToast();

  const [settings, setSettings] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [notes, setNotes] = useState([]);

  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);

  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [imageName, setImageName] = useState("");
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);

  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");

  const [confirmClear, setConfirmClear] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const imageInputRef = useRef(null);
  const chatComposerRef = useRef(null);

  useEffect(() => {
    if (!messagesEndRef.current) return;
    const isCurrentlyStreaming = messages.some((m) => m.streaming);
    if (isCurrentlyStreaming) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
    } else {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading]);

  useEffect(() => {
    try {
      const s = getAISettings();
      setSettings(s);
      setSubjects(localClient.entities.Subject.list("name") || []);
      setTopics(localClient.entities.Topic.list("name") || []);
      setNotes(localClient.entities.Note.list("-created_date", 50) || []);

      const savedSessions = loadSessions();
      if (savedSessions.length === 0) {
        const initial = createSession("New chat");
        setSessions([initial]);
        setActiveId(initial.id);
        setMessages([]);
      } else {
        setSessions(savedSessions);
        setActiveId(savedSessions[0].id);
        setMessages(savedSessions[0].messages || []);
      }
    } catch {}
  }, []);

  const selectedSubjectName = subjects.find((s) => s.id === selectedSubject)?.name || "";
  const filteredTopics      = topics.filter((t) => !selectedSubject || t.subject_id === selectedSubject);
  const selectedTopicName   = topics.find((t) => t.id === selectedTopic)?.name   || "";

  const context = useMemo(() => {
    if (selectedTopic) return getMinimalSubgraphForAI(selectedTopic);
    return {
      selectedSubject: selectedSubjectName || null,
      subjects: subjects.slice(0, 8).map((s) => s.name),
      recentTopics: topics.slice(0, 10).map((t) => t.name),
    };
  }, [selectedSubjectName, selectedTopic, subjects, topics]);

  const reloadSessions = () => {
    const fresh = loadSessions();
    setSessions(fresh);
    return fresh;
  };

  const switchSession = (id) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    setActiveId(id);
    setMessages(session.messages || []);
    setImageDataUrl(null);
    setImageName("");
    setConfirmClear(false);
  };

  const handleNewChat = () => {
    const session = createSession("New chat");
    const fresh = reloadSessions();
    setSessions([session, ...fresh.filter((s) => s.id !== session.id)]);
    setActiveId(session.id);
    setMessages([]);
    setImageDataUrl(null);
    setImageName("");
    setConfirmClear(false);
  };

  const handleRename = (id, newTitle) => {
    try { localClient.entities.AIInteraction.update(id, { title: newTitle }); } catch {}
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: newTitle } : s));
  };

  const handleDelete = (id) => {
    deleteSession(id);
    const remaining = sessions.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      const fresh = createSession("New chat");
      setSessions([fresh]);
      setActiveId(fresh.id);
      setMessages([]);
      setImageDataUrl(null);
      setImageName("");
    } else {
      setSessions(remaining);
      if (activeId === id) {
        const next = remaining[0];
        setActiveId(next.id);
        setMessages(next.messages || []);
      }
    }
    setConfirmClear(false);
  };

  const handleClearMessages = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    setMessages([]);
    setImageDataUrl(null);
    setImageName("");
    setConfirmClear(false);
    if (activeId) persistSession(activeId, [], "New chat");
    setSessions((prev) => prev.map((s) => s.id === activeId ? { ...s, messages: [], title: "New chat" } : s));
    toast({ title: "Chat cleared" });
  };

  const handleImageFile = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast({ title: "Unsupported image", description: "Use PNG, JPG/JPEG, or WebP.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(String(reader.result || ""));
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleImageInput = (event) => {
    handleImageFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const sendMessage = useCallback(async (overrideText, overrideAudioUrl) => {
    const text = String(overrideText ?? "").trim();
    const attachedMedia = overrideAudioUrl || imageDataUrl;
    if ((!text && !attachedMedia) || loading) return;

    const userMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "user",
      text: text || (overrideAudioUrl ? "Voice command audio attached." : "Solve the question in this image."),
      imageDataUrl: attachedMedia || null,
      imageName: imageName || (overrideAudioUrl ? "Voice Recording.webm" : null),
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage];

    let currentWorkingMessages = [...nextMessages];

    // Deprecated synchronous hardcoded logic (now handled by AI)
    // const jarvisIntent = detectJarvisIntent(text);
    // ...

    const liveAssistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setMessages([...currentWorkingMessages, { id: liveAssistantId, role: "assistant", text: "", streaming: true, createdAt: new Date().toISOString() }]);
    setImageDataUrl(null);
    setImageName("");
    setLoading(true);

    let streamedText = "";
    let animationFrameId = null;
    let pendingStreamText = "";

    const flushStreamUpdate = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (pendingStreamText) {
        const liveAssistant = {
          id: liveAssistantId,
          role: "assistant",
          text: pendingStreamText,
          streaming: true,
          createdAt: nextMessages[nextMessages.length - 1]?.createdAt || new Date().toISOString(),
        };
        setMessages([...nextMessages, liveAssistant]);
      }
    };

    try {
      const result = await aiChatStream(
        text || "Solve the question in this image.",
        messages,
        context,
        attachedMedia || null,
        {
          onChunk: (chunk) => {
            if (chunk?.text) {
              streamedText += String(chunk.text);
              pendingStreamText = streamedText;

              if (chunk.route?.intent || chunk.provider || chunk.model) {
                setRouteInfo((prev) => ({
                  ...(prev || {}),
                  category: chunk.route?.intent || prev?.category,
                  provider: chunk.provider || prev?.provider,
                  model: chunk.model || prev?.model,
                  phase: chunk.phase || "generating",
                }));
              }

              if (!animationFrameId) {
                animationFrameId = requestAnimationFrame(() => {
                  animationFrameId = null;
                  flushStreamUpdate();
                });
              }
            }
          },
          onDone: (data) => {
            flushStreamUpdate();
            if (data?.provider) {
              setRouteInfo({
                category: data.route?.intent,
                provider: data.provider,
                model: data.model,
                notice: data.notice || null,
                phase: "complete",
              });
            }
          },
        }
      );

      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      
      let reply = result?.reply || streamedText || "I couldn't generate a response. Try again.";
      
      let complete = [...nextMessages];
      if (reply) {
        complete.push({ id: liveAssistantId, role: "assistant", text: reply || "I couldn't generate a response.", createdAt: new Date().toISOString() });
      }
      
      setMessages(complete);
      if (isVoiceMode) {
        if (reply) speakText(reply);
      }

      const currentSession = sessions.find((s) => s.id === activeId);
      const newTitle = (!currentSession?.title || currentSession.title === "New chat")
        ? titleFromMessages(complete)
        : currentSession.title;
      if (activeId) persistSession(activeId, complete, newTitle);
      setSessions((prev) =>
        prev.map((s) => s.id === activeId ? { ...s, messages: complete, title: newTitle, updated_at: new Date().toISOString() } : s)
      );

      if (isVoiceMode) speakText(reply);
    } catch (error) {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      toast({ title: "AI Assistant error", description: error.message, variant: "destructive" });
    } finally {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      setLoading(false);
    }
  }, [activeId, context, imageDataUrl, imageName, isVoiceMode, loading, messages, sessions, toast]);

  const runAction = async (id) => {
    if (id === "explain") {
      const concept = selectedTopicName || selectedSubjectName || (chatComposerRef.current?.getValue() || "").trim();
      if (!concept) {
        toast({ title: "Select a topic", description: "Choose a subject/topic above or type a concept into the box." });
        return;
      }
      sendMessage(`Explain ${concept} deeply with mathematical derivations, intuition, and solved JEE problems.`);
    }

    if (id === "cards") {
      const source = (chatComposerRef.current?.getValue() || "").trim() ||
        notes.filter((n) => !selectedSubject || n.subject_id === selectedSubject)
             .slice(0, 3).map((n) => `${n.title}\n${n.content || ""}`).join("\n\n");
      sendMessage(`Generate 6 high-yield active recall flashcards with detailed answers for ${selectedTopicName || selectedSubjectName || source.slice(0, 100)}.`);
    }
  };

  return (
    <div className={cn(
      "flex flex-1 min-h-0 h-full flex-col gap-3 overflow-hidden p-1 sm:p-2",
      expanded && "fixed inset-0 z-50 bg-background p-3 sm:p-4"
    )}>
      {/* ── Top Unified Header Bar ── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/60 p-3 sm:px-5 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-base sm:text-lg font-bold tracking-tight">AI Assistant & Study Coach</h1>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                AI Engine Active
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">Ask questions, solve doubts from screenshots, watch embedded video lectures, and get intelligent study help.</p>
          </div>
        </div>

        {/* Controls: Context Picker */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Study Context Selectors */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background/60 p-1 backdrop-blur-sm">
            <select
              value={selectedSubject}
              onChange={(e) => { setSelectedSubject(e.target.value); setSelectedTopic(""); }}
              className="h-7 rounded-lg bg-transparent px-2 text-xs font-medium text-foreground outline-none cursor-pointer"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <span className="text-muted-foreground/40">•</span>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="h-7 rounded-lg bg-transparent px-2 text-xs font-medium text-foreground outline-none cursor-pointer"
            >
              <option value="">All Topics</option>
              {filteredTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* Clear & Fullscreen */}
          <div className="flex items-center gap-1">
            {confirmClear ? (
              <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-xl text-xs">
                <span className="text-rose-400 font-medium">Clear?</span>
                <button onClick={handleClearMessages} className="text-rose-400 font-bold hover:underline">Yes</button>
                <button onClick={() => setConfirmClear(false)} className="text-muted-foreground hover:underline ml-1">No</button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearMessages}
                title="Clear current chat"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <Eraser className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Exit fullscreen" : "Fullscreen"}
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Sidebar + Maximized Chat Container ── */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* LEFT: Sessions Sidebar */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md p-3 shadow-sm min-h-0">
          <ChatSessionsPanel
            sessions={sessions}
            activeId={activeId}
            onSelect={switchSession}
            onCreate={handleNewChat}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        </aside>

        {/* CENTER: Main Chat Box (MAXIMIZED AREA) */}
        <main className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/50 bg-card/60 backdrop-blur-md shadow-sm overflow-hidden relative">
          <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 space-y-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center max-w-lg mx-auto py-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary mb-4 shadow-inner">
                  <WandSparkles className="h-8 w-8" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">How can I assist you today?</h2>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Use voice or text commands to open apps, control your laptop, solve questions from photos, or get step-by-step derivations.
                </p>

                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                  {SUGGESTED_PROMPTS.map((prompt, idx) => {
                    const Icon = prompt.icon;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (idx === 0) chatComposerRef.current?.setValue("Derive and explain the key formulas for ");
                          if (idx === 1) imageInputRef.current?.click();
                          if (idx === 2) sendMessage("Open VS Code");
                          if (idx === 3) chatComposerRef.current?.setValue("What are the most common traps and high-yield shortcuts for ");
                          chatComposerRef.current?.focus();
                        }}
                        className="group flex items-start gap-2.5 rounded-xl border border-border/50 bg-background/50 p-3 hover:border-primary/40 hover:bg-accent/40 cursor-pointer transition-all shadow-2xs"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{prompt.title}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{prompt.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto w-full space-y-6">
                {messages.map((msg, i) => (
                  <MessageBubble key={msg.id || `${msg.createdAt}-${i}`} message={msg} onSpeak={speakText} />
                ))}
              </div>
            )}

            {loading && (
              <div className="max-w-4xl mx-auto w-full flex justify-start">
                <div className="flex items-center gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-3.5 text-xs font-medium text-foreground backdrop-blur-sm shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Thinking & processing response…</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Composer Area */}
          <div className="shrink-0 border-t border-border/40 bg-background/40 p-3 sm:p-4 backdrop-blur-md">
            <div className="max-w-4xl mx-auto w-full">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageInput}
                className="hidden"
              />

              <ChatComposer
                ref={chatComposerRef}
                loading={loading}
                imageDataUrl={imageDataUrl}
                onAttach={() => imageInputRef.current?.click()}
                onRemoveImage={() => { setImageDataUrl(null); setImageName(""); }}
                onSend={sendMessage}
                placeholder={imageDataUrl ? "Ask anything about the question in this image..." : "Ask any study question, attach a problem image, or request YouTube lecture video..."}
              />

              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span>Type study question or attach problem image · AI Multimodal Active</span>
                <span className="hidden sm:inline font-mono text-[10px]">Groq & Gemini Multimodal Active</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
