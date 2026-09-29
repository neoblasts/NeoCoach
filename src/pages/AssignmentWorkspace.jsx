import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import katex from "katex";
import "katex/dist/katex.min.css";

import { localClient } from "@/api/localStorageClient";
import { useEntityList } from "@/hooks/useEntity";
import { getColor } from "@/libs/subjectColors";

import AIFormattedText from "@/components/AIFormattedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LifeOSBlockNoteEditor from "@/components/notes/LifeOSBlockNoteEditor";

import {
  PriorityBadge,
  SubjectBadge,
  TopicBadge,
  AssignmentStatusBadge,
  AssignmentTypeBadge,
} from "@/components/Badges";

import { dueLabel } from "@/libs/dates";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/libs/utils";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Code2,
  FileText,
  GripVertical,
  List,
  ListOrdered,
  Plus,
  Quote,
  Save,
  Sparkles,
  Trash2,
  Timer,
  BookOpen,
  ChevronDown,
  Heading1,
  Heading2,
  Heading3,
  Minus,
  Type,
  Bold,
  Italic,
  Underline,
  CheckSquare,
  Link2,
  Table2,
  Palette,
  Highlighter,
  Image,
  Pencil,
  Columns3,
  Rows3,
  X,
  Paintbrush,
  Maximize2,
  Minimize2,
  Send,
  RotateCcw,
  PlusCircle,
  Sigma,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const AUTOSAVE_DELAY = 700;

const CALLOUT_COLORS = [
  {
    id: "blue",
    label: "Blue",
    bg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-200 dark:border-blue-500/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  {
    id: "green",
    label: "Green",
    bg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-200 dark:border-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  {
    id: "yellow",
    label: "Yellow",
    bg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-200 dark:border-amber-500/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  {
    id: "red",
    label: "Red",
    bg: "bg-rose-50 dark:bg-rose-500/10",
    border: "border-rose-200 dark:border-rose-500/30",
    text: "text-rose-700 dark:text-rose-300",
  },
  {
    id: "purple",
    label: "Purple",
    bg: "bg-violet-50 dark:bg-violet-500/10",
    border: "border-violet-200 dark:border-violet-500/30",
    text: "text-violet-700 dark:text-violet-300",
  },
  {
    id: "gray",
    label: "Gray",
    bg: "bg-muted",
    border: "border-border",
    text: "text-foreground",
  },
];

const TEXT_COLORS = [
  {
    id: "default",
    label: "Default",
    className: "text-foreground",
  },
  {
    id: "red",
    label: "Red",
    className: "text-red-500",
  },
  {
    id: "orange",
    label: "Orange",
    className: "text-orange-500",
  },
  {
    id: "yellow",
    label: "Yellow",
    className: "text-yellow-500",
  },
  {
    id: "green",
    label: "Green",
    className: "text-green-500",
  },
  {
    id: "blue",
    label: "Blue",
    className: "text-blue-500",
  },
  {
    id: "purple",
    label: "Purple",
    className: "text-purple-500",
  },
  {
    id: "pink",
    label: "Pink",
    className: "text-pink-500",
  },
];

const HIGHLIGHT_COLORS = [
  {
    id: "yellow",
    label: "Yellow",
    className: "bg-yellow-200 dark:bg-yellow-500/30",
  },
  {
    id: "green",
    label: "Green",
    className: "bg-green-200 dark:bg-green-500/30",
  },
  {
    id: "blue",
    label: "Blue",
    className: "bg-blue-200 dark:bg-blue-500/30",
  },
  {
    id: "pink",
    label: "Pink",
    className: "bg-pink-200 dark:bg-pink-500/30",
  },
  {
    id: "purple",
    label: "Purple",
    className: "bg-purple-200 dark:bg-purple-500/30",
  },
];

const BLOCK_TYPES = {
  paragraph: {
    label: "Text",
    description: "Start writing plain text",
    icon: Type,
  },

  heading_1: {
    label: "Heading 1",
    description: "Large section heading",
    icon: Heading1,
  },

  heading_2: {
    label: "Heading 2",
    description: "Medium section heading",
    icon: Heading2,
  },

  heading_3: {
    label: "Heading 3",
    description: "Small section heading",
    icon: Heading3,
  },

  bullet: {
    label: "Bulleted list",
    description: "Create a simple bullet point",
    icon: List,
  },

  numbered: {
    label: "Numbered list",
    description: "Create a numbered list",
    icon: ListOrdered,
  },

  todo: {
    label: "To-do",
    description: "Track something you need to do",
    icon: CheckSquare,
  },

  quote: {
    label: "Quote",
    description: "Highlight an important thought",
    icon: Quote,
  },

  callout: {
    label: "Callout",
    description: "Create a highlighted information box",
    icon: Sparkles,
  },

  code: {
    label: "Code",
    description: "Add a code snippet",
    icon: Code2,
  },

  table: {
    label: "Table",
    description: "Insert a table",
    icon: Table2,
  },

  link: {
    label: "Link",
    description: "Embed a link",
    icon: Link2,
  },

  divider: {
    label: "Divider",
    description: "Add a visual separator",
    icon: Minus,
  },

  image: {
    label: "Image",
    description: "Add an image by URL",
    icon: Image,
  },

  toggle: {
    label: "Toggle",
    description: "Collapsible section with nested blocks",
    icon: ChevronDown,
  },

  equation: {
    label: "Equation",
    description: "Display a LaTeX math equation",
    icon: Sigma,
  },

  text_color: {
    label: "Text color",
    description: "Change the color of selected text",
    icon: Palette,
  },

  highlight: {
    label: "Highlight",
    description: "Highlight selected text",
    icon: Highlighter,
  },

  bold: {
    label: "Bold",
    description: "Make selected text bold",
    icon: Bold,
  },

  italic: {
    label: "Italic",
    description: "Make selected text italic",
    icon: Italic,
  },

  underline: {
    label: "Underline",
    description: "Underline selected text",
    icon: Underline,
  },

  callout_color: {
    label: "Callout background",
    description: "Change the background of a callout",
    icon: Paintbrush,
  },
};

const SLASH_ITEMS = [
  "paragraph",
  "heading_1",
  "heading_2",
  "heading_3",
  "bullet",
  "numbered",
  "todo",
  "toggle",
  "quote",
  "callout",
  "code",
  "equation",
  "table",
  "link",
  "image",
  "divider",
  "bold",
  "italic",
  "underline",
  "callout_color",
  "text_color",
  "highlight",
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function createId(prefix = "block") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function createBlock(type = "paragraph", content = "") {
  return {
    id: createId(),
    type,
    content,
    checked: false,
    collapsed: false,       // for toggle blocks
    color: "blue",
    table: null,
    url: "",
    imageUrl: "",
    children: [],           // nested blocks inside callout / toggle
  };
}

function createTable(rows = 3, columns = 3) {
  return {
    rows: Array.from({ length: rows }, () =>
      Array.from({ length: columns }, () => "")
    ),
    headers: true,
  };
}

function coerceLatexText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => coerceLatexText(item))
      .filter((item) => item !== "")
      .join("");
  }
  if (typeof value === "object") {
    if (typeof value.latex === "string") return value.latex;
    if (typeof value.content === "string") return value.content;
    if (typeof value.text === "string") return value.text;
    if (typeof value.value === "string") return value.value;
    if (value.dom && typeof value.dom.textContent === "string") {
      return value.dom.textContent;
    }
    const nested = [];
    for (const key of ["content", "children", "nodes", "parts", "items", "marks", "text", "value"]) {
      const next = value[key];
      if (next != null) nested.push(coerceLatexText(next));
    }
    const joined = nested.filter((item) => item !== "").join("");
    if (joined) return joined;

    const objectText = Object.values(value)
      .map((item) => coerceLatexText(item))
      .filter((item) => item !== "")
      .join("");
    if (objectText) return objectText;
  }
  return "";
}

// Convert raw markdown inline syntax to HTML for contentEditable blocks.
// Only runs when the string has no HTML tags already (migration safety).
function migrateInlineMarkdown(str) {
  if (!str || /<[a-z][\s\S]*>/i.test(str)) return str;
  return str
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function normalizeBlocks(value) {
  if (Array.isArray(value)) {
    return value.map((block) => ({
      id: block?.id || createId(),
      type: BLOCK_TYPES[block?.type] ? block.type : "paragraph",
      content:
        block?.type === "equation"
          ? coerceLatexText(block?.content)
          : typeof block?.content === "string"
            ? migrateInlineMarkdown(block.content)
            : "",
      checked: Boolean(block?.checked),
      collapsed: Boolean(block?.collapsed),
      color: block?.color || "blue",
      table: block?.table || null,
      url: block?.url || "",
      imageUrl: block?.imageUrl || "",
      children: Array.isArray(block?.children)
        ? normalizeBlocks(block.children)
        : [],
    }));
  }

  if (typeof value === "string" && value.trim()) {
    return value.split(/\r?\n/).map((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return createBlock("paragraph", "");
      }

      if (/^###\s+/.test(trimmed)) {
        return createBlock(
          "heading_3",
          trimmed.replace(/^###\s+/, "")
        );
      }

      if (/^##\s+/.test(trimmed)) {
        return createBlock(
          "heading_2",
          trimmed.replace(/^##\s+/, "")
        );
      }

      if (/^#\s+/.test(trimmed)) {
        return createBlock(
          "heading_1",
          trimmed.replace(/^#\s+/, "")
        );
      }

      if (/^[-*]\s+/.test(trimmed)) {
        return createBlock(
          "bullet",
          trimmed.replace(/^[-*]\s+/, "")
        );
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        return createBlock(
          "numbered",
          trimmed.replace(/^\d+\.\s+/, "")
        );
      }

      if (/^\[\s?\]\s+/.test(trimmed)) {
        return createBlock(
          "todo",
          trimmed.replace(/^\[\s?\]\s+/, "")
        );
      }

      if (/^\[[xX]\]\s+/.test(trimmed)) {
        const block = createBlock(
          "todo",
          trimmed.replace(/^\[[xX]\]\s+/, "")
        );

        block.checked = true;
        return block;
      }

      if (/^>\s+/.test(trimmed)) {
        return createBlock(
          "quote",
          trimmed.replace(/^>\s+/, "")
        );
      }

      return createBlock("paragraph", line);
    });
  }

  return [createBlock()];
}

function stripHtml(value) {
  if (!value) return "";

  const temp = document.createElement("div");
  temp.innerHTML = value;

  return temp.textContent || temp.innerText || "";
}

function blocksToPlainText(blocks) {
  return blocks
    .map((block) => {
      if (block.type === "divider") return "";

      if (block.type === "table") {
        return (block.table?.rows || [])
          .map((row) => row.join(" | "))
          .join("\n");
      }

      if (block.type === "image") {
        return block.imageUrl || "";
      }

      if (block.type === "link") {
        return block.url
          ? `${stripHtml(block.content)} (${block.url})`
          : stripHtml(block.content);
      }

      if (block.type === "equation") {
        const latex = coerceLatexText(block.content);
        return latex ? `[Equation: ${latex}]` : "";
      }

      if (block.type === "toggle") {
        const heading = stripHtml(block.content || "");
        const children = (block.children || []).map((c) => `  ${stripHtml(c.content || "")}`).join("\n");
        return children ? `${heading}\n${children}` : heading;
      }

      if (block.type === "callout" && (block.children || []).length > 0) {
        return (block.children || []).map((c) => stripHtml(c.content || "")).join("\n");
      }

      const prefix =
        block.type === "bullet"
          ? "• "
          : block.type === "numbered"
          ? "1. "
          : block.type === "todo"
          ? block.checked
            ? "☑ "
            : "☐ "
          : block.type === "quote"
          ? "› "
          : "";

      return `${prefix}${stripHtml(block.content || "")}`;
    })
    .filter(Boolean)
    .join("\n");
}

function getBlockPlaceholder(type) {
  switch (type) {
    case "heading_1":
      return "Heading 1";

    case "heading_2":
      return "Heading 2";

    case "heading_3":
      return "Heading 3";

    case "toggle":
      return "Toggle heading...";

    case "equation":
      return "LaTeX equation...";

    case "bullet":
      return "List item";

    case "numbered":
      return "List item";

    case "todo":
      return "To-do item";

    case "quote":
      return "Write a quote...";

    case "callout":
      return "Write a callout...";

    case "code":
      return "Write code...";

    case "link":
      return "Link text...";

    default:
      return "Type '/' for commands...";
  }
}

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function AssignmentWorkspace({
  assignmentId,
  onBack,
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const noteEditorRef = useRef(null);

  const {
    data: assignments,
    loading: assignmentsLoading,
    reload: reloadAssignments,
  } = useEntityList(() =>
    localClient.entities.Assignment.list()
  );

  const { data: subjects } = useEntityList(() =>
    localClient.entities.Subject.list()
  );
  const { data: topics = [] } = useEntityList(() =>
    localClient.entities.Topic.list("name", 500)
  );

  const assignment = useMemo(
    () =>
      assignments.find(
        (item) => item.id === assignmentId
      ),
    [assignments, assignmentId]
  );

  const subject = useMemo(
    () =>
      subjects.find(
        (item) =>
          item.id === assignment?.subject_id
      ),
    [subjects, assignment]
  );

  const topic = useMemo(
    () => topics.find((t) => t.id === assignment?.topic_id),
    [topics, assignment]
  );

  const [blocks, setBlocks] = useState([
    createBlock(),
  ]);

  const [activeBlockId, setActiveBlockId] =
    useState(null);

  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState("saved");
  const [notesReady, setNotesReady] = useState(false);

  const [slashMenu, setSlashMenu] = useState(null);
  const [slashQuery, setSlashQuery] = useState("");

  const [activeSection, setActiveSection] =
    useState("notes");

  const [aiOpen, setAiOpen] = useState(true);
  const [fullscreenNotes, setFullscreenNotes] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const notesEditorAreaRef = useRef(null);

  const [checklist, setChecklist] = useState([]);
  const [newTask, setNewTask] = useState("");

  const [pageMeta, setPageMeta] = useState({
    cover: "",
    banner: "",
  });

  const [coverOpen, setCoverOpen] = useState(false);
  const [coverInput, setCoverInput] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const editorRefs = useRef({});
  const saveTimer = useRef(null);

  /* ------------------------------------------------------------------------ */
  /* Load                                                                    */
  /* ------------------------------------------------------------------------ */

  const loadedAssignmentIdRef = useRef(null);

  const getLatestBlocks = (currentBlocks = blocks) => {
    return (currentBlocks || []).map((block) => {
      const el = editorRefs.current[block.id];
      const content = el ? el.innerHTML : block.content;
      let children = block.children;
      if (Array.isArray(children) && children.length > 0) {
        children = children.map((child) => {
          const childEl = editorRefs.current[child.id];
          return childEl ? { ...child, content: childEl.innerHTML } : child;
        });
      }
      return {
        ...block,
        content,
        children,
      };
    });
  };

  useEffect(() => {
    if (!assignment) return;

    if (loadedAssignmentIdRef.current === assignment.id) {
      return;
    }
    loadedAssignmentIdRef.current = assignment.id;

    setBlocks(normalizeBlocks(assignment.notes));

    let savedChecklist = assignment.checklist;

    if (typeof savedChecklist === "string") {
      try {
        savedChecklist = JSON.parse(savedChecklist);
      } catch {
        savedChecklist = [];
      }
    }

    setChecklist(
      Array.isArray(savedChecklist)
        ? savedChecklist
        : []
    );

    let workspace = assignment.workspace_meta;

    if (typeof workspace === "string") {
      try {
        workspace = JSON.parse(workspace);
      } catch {
        workspace = {};
      }
    }

    setPageMeta({
      cover: workspace?.cover || "",
      banner: workspace?.banner || "",
    });

    // Only now is `blocks` guaranteed to hold the real saved notes.
    // Mounting the BlockNote editor before this point causes it to
    // hydrate with the default empty block and never re-hydrate.
    setNotesReady(true);
  }, [assignment]);

  useEffect(() => {
    setAiMessages([]);
    setAiInput("");
    setAiLoading(false);
    setActiveBlockId(null);
    setSlashMenu(null);
    setSlashQuery("");
    setFullscreenNotes(false);
    setNotesReady(false);
    loadedAssignmentIdRef.current = null;
  }, [assignmentId]);

  /* ------------------------------------------------------------------------ */
  /* Save                                                                    */
  /* ------------------------------------------------------------------------ */

  const saveWorkspace = async (
    showToast = false,
    blocksToSave = null,
    checklistToSave = checklist,
    metaToSave = pageMeta
  ) => {
    if (!assignment) return;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    const finalBlocks = blocksToSave || getLatestBlocks();
    setBlocks(finalBlocks);

    setSaving(true);
    setSaveState("saving");

    try {
      await localClient.entities.Assignment.update(
        assignment.id,
        {
          notes: finalBlocks,
          checklist: checklistToSave,
          workspace_meta: metaToSave,
        }
      );

      setSaveState("saved");

      if (showToast) {
        toast({
          title: "Saved",
          description:
            "Your assignment workspace has been saved.",
        });
      }

      reloadAssignments();
    } catch (error) {
      setSaveState("error");

      toast({
        title: "Could not save",
        description:
          error?.message ||
          "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const scheduleAutosave = (
    nextBlocks = blocks,
    nextChecklist = checklist,
    nextMeta = pageMeta
  ) => {
    setSaveState("unsaved");

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      saveWorkspace(
        false,
        nextBlocks,
        nextChecklist,
        nextMeta
      );
    }, AUTOSAVE_DELAY);
  };

  const latestStateRef = useRef({
    assignment,
    blocks,
    checklist,
    pageMeta,
    saveState,
  });

  useEffect(() => {
    latestStateRef.current = {
      assignment,
      blocks: getLatestBlocks(blocks),
      checklist,
      pageMeta,
      saveState,
    };
  }, [assignment, blocks, checklist, pageMeta, saveState]);

  useEffect(() => {
    const flushUnsaved = () => {
      const { assignment: curAssignment, checklist: curChecklist, pageMeta: curMeta, saveState: curSaveState } = latestStateRef.current;
      if (!curAssignment) return;
      const curBlocks = getLatestBlocks(latestStateRef.current.blocks);
      if (saveTimer.current || curSaveState === "unsaved") {
        if (saveTimer.current) {
          clearTimeout(saveTimer.current);
          saveTimer.current = null;
        }
        try {
          localClient.entities.Assignment.update(curAssignment.id, {
            notes: curBlocks,
            checklist: curChecklist,
            workspace_meta: curMeta,
          });
        } catch (e) {
          console.warn("[AssignmentWorkspace] Unmount save failed:", e);
        }
      }
    };

    window.addEventListener("beforeunload", flushUnsaved);
    window.addEventListener("visibilitychange", flushUnsaved);

    return () => {
      window.removeEventListener("beforeunload", flushUnsaved);
      window.removeEventListener("visibilitychange", flushUnsaved);
      flushUnsaved();
    };
  }, []);
  useEffect(() => {
    if (!fullscreenNotes) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setFullscreenNotes(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreenNotes]);


  /* ------------------------------------------------------------------------ */
  /* Blocks                                                                   */
  /* ------------------------------------------------------------------------ */

  const updateBlock = (id, changes) => {
    setBlocks((current) => {
      const updated = current.map((block) =>
        block.id === id
          ? {
              ...block,
              ...changes,
              ...(block.type === "equation" && changes?.content != null
                ? { content: coerceLatexText(changes.content) }
                : {}),
            }
          : block
      );

      scheduleAutosave(updated);

      return updated;
    });
  };

  const insertBlockAfter = (
    blockId,
    type = "paragraph"
  ) => {
    const newBlock = createBlock(type);

    setBlocks((current) => {
      const index = current.findIndex(
        (block) => block.id === blockId
      );

      if (index === -1) return current;

      const updated = [
        ...current.slice(0, index + 1),
        newBlock,
        ...current.slice(index + 1),
      ];

      scheduleAutosave(updated);

      return updated;
    });

    requestAnimationFrame(() => {
      focusBlock(newBlock.id);
    });
  };

  const deleteBlock = (blockId) => {
    setBlocks((current) => {
      if (current.length === 1) {
        const updated = [
          {
            ...current[0],
            type: "paragraph",
            content: "",
            checked: false,
          },
        ];

        scheduleAutosave(updated);
        return updated;
      }

      const index = current.findIndex(
        (block) => block.id === blockId
      );

      if (index === -1) return current;

      const updated = current.filter(
        (block) => block.id !== blockId
      );

      const target =
        updated[Math.max(0, index - 1)]?.id;

      requestAnimationFrame(() => {
        if (target) focusBlock(target);
      });

      scheduleAutosave(updated);

      return updated;
    });
  };

  /* ---------------------------------------------------------------------- */
  /* Child block helpers (callout / toggle nested blocks)                   */
  /* ---------------------------------------------------------------------- */

  const updateChildBlock = (parentId, childId, changes) => {
    setBlocks((current) => {
      const updated = current.map((block) => {
        if (block.id !== parentId) return block;
        return {
          ...block,
          children: (block.children || []).map((child) =>
            child.id === childId
              ? {
                  ...child,
                  ...changes,
                  ...(child.type === "equation" && changes?.content != null
                    ? { content: coerceLatexText(changes.content) }
                    : {}),
                }
              : child
          ),
        };
      });
      scheduleAutosave(updated);
      return updated;
    });
  };

  const insertChildBlockAfter = (parentId, childId) => {
    const newChild = createBlock("paragraph");
    setBlocks((current) => {
      const updated = current.map((block) => {
        if (block.id !== parentId) return block;
        const children = block.children || [];
        const idx = children.findIndex((c) => c.id === childId);
        const next = idx === -1
          ? [...children, newChild]
          : [...children.slice(0, idx + 1), newChild, ...children.slice(idx + 1)];
        return { ...block, children: next };
      });
      scheduleAutosave(updated);
      return updated;
    });
    requestAnimationFrame(() => focusBlock(newChild.id));
  };

  const deleteChildBlock = (parentId, childId) => {
    setBlocks((current) => {
      const updated = current.map((block) => {
        if (block.id !== parentId) return block;
        const children = block.children || [];
        if (children.length <= 1) {
          // Keep at least one empty paragraph inside
          return { ...block, children: [createBlock("paragraph", "")] };
        }
        return { ...block, children: children.filter((c) => c.id !== childId) };
      });
      scheduleAutosave(updated);
      return updated;
    });
  };

  const toggleCollapse = (blockId) => {
    setBlocks((current) => {
      const updated = current.map((block) =>
        block.id === blockId ? { ...block, collapsed: !block.collapsed } : block
      );
      scheduleAutosave(updated);
      return updated;
    });
  };

  const changeBlockType = (
    blockId,
    type
  ) => {
    if (type === "table") {
      updateBlock(blockId, {
        type: "table",
        table: createTable(),
        content: "",
      });
    } else {
      updateBlock(blockId, {
        type,
      });
    }

    setSlashMenu(null);
    setSlashQuery("");
  };

  /* ------------------------------------------------------------------------ */
  /* Document selection                                                       */
  /* ------------------------------------------------------------------------ */

  const selectEntireNotesDocument = (event, block) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "a") {
      return false;
    }

    // On Ctrl+A: select all content in the entire notes area unconditionally.
    // The browser's native "select block" fires first (before this handler
    // runs) on the first press. By the time this fires, the block is already
    // selected — so we immediately expand to the full document.
    event.preventDefault();
    event.stopPropagation();

    const target = notesEditorAreaRef.current;
    if (!target) return true;

    const selection = window.getSelection();
    if (!selection) return true;

    const range = document.createRange();
    range.selectNodeContents(target);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  };

  /* ------------------------------------------------------------------------ */
  /* Focus                                                                    */
  /* ------------------------------------------------------------------------ */

  const registerEditor = (
    id,
    element
  ) => {
    if (element) {
      editorRefs.current[id] = element;
    }
  };

  const focusBlock = (id) => {
    const element =
      editorRefs.current[id];

    if (!element) return;

    element.focus();

    const range =
      document.createRange();

    range.selectNodeContents(element);
    range.collapse(false);

    const selection =
      window.getSelection();

    if (!selection) return;

    selection.removeAllRanges();
    selection.addRange(range);
  };

  /* ------------------------------------------------------------------------ */
  /* Slash                                                                    */
  /* ------------------------------------------------------------------------ */

  const getSlashMatch = (query) => {
    if (!query) return null;

    const normalized =
      query.toLowerCase().trim();

    const aliases = {
      text: "paragraph",
      paragraph: "paragraph",

      h1: "heading_1",
      heading: "heading_1",
      "heading 1": "heading_1",

      h2: "heading_2",
      "heading 2": "heading_2",

      h3: "heading_3",
      "heading 3": "heading_3",

      bullet: "bullet",
      bullets: "bullet",
      "bullet list": "bullet",

      number: "numbered",
      numbered: "numbered",
      "numbered list": "numbered",

      todo: "todo",
      "to-do": "todo",
      checklist: "todo",

      quote: "quote",

      callout: "callout",
      note: "callout",

      code: "code",

      table: "table",

      link: "link",
      "embed link": "link",

      image: "image",

      divider: "divider",

      bold: "bold",
      italic: "italic",
      underline: "underline",

      color: "text_color",
      "text color": "text_color",
      highlight: "highlight",
      "callout color": "callout_color",
      "callout background": "callout_color",
    };

    return aliases[normalized] || null;
  };

  const filteredSlashItems =
    SLASH_ITEMS.filter((type) => {
      if (!slashQuery) return true;

      const item = BLOCK_TYPES[type];

      return (
        item.label
          .toLowerCase()
          .includes(
            slashQuery.toLowerCase()
          ) ||
        item.description
          .toLowerCase()
          .includes(
            slashQuery.toLowerCase()
          )
      );
    });

  const selectSlashItem = (type) => {
    if (!activeBlockId) return;

    const blockId = activeBlockId;

    // Formatting commands do not become visible text. The slash command
    // itself is removed from the editor before the command is applied.
    if (type === "bold" || type === "italic" || type === "underline") {
      const editor = editorRefs.current[blockId];
      if (!editor) return;

      editor.innerHTML = "";
      editor.focus();

      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      const commandMap = {
        bold: "bold",
        italic: "italic",
        underline: "underline",
      };

      // execCommand keeps the formatting state at the caret so the next
      // characters typed by the user use the requested formatting.
      document.execCommand(commandMap[type], false, null);

      setSlashMenu(null);
      setSlashQuery("");
      return;
    }

    if (type === "callout_color") {
      setSlashMenu({ blockId, submenu: "callout_color" });
      setSlashQuery("");
      return;
    }

    if (type === "text_color" || type === "highlight" || type === "link" || type === "image") {
      const editor = editorRefs.current[blockId];
      if (editor) {
        editor.innerHTML = "";
        editor.focus();
      }

      // Remove the slash command from persisted block content as well.
      setBlocks((current) => {
        const updated = current.map((item) =>
          item.id === blockId ? { ...item, content: "" } : item
        );
        scheduleAutosave(updated);
        return updated;
      });

      setSlashMenu({ blockId, submenu: type });
      setSlashQuery("");
      return;
    }

    const editor = editorRefs.current[blockId];
    if (editor) editor.innerHTML = "";

    setBlocks((current) => {
      const updated = current.map((item) => {
        if (item.id !== blockId) return item;

        if (type === "table") {
          return {
            ...item,
            type: "table",
            content: "",
            table: createTable(),
            children: [],
          };
        }

        if (type === "divider") {
          return {
            ...item,
            type: "divider",
            content: "",
            table: null,
            children: [],
          };
        }

        if (type === "toggle") {
          return {
            ...item,
            type: "toggle",
            content: "",
            collapsed: false,
            children: [createBlock("paragraph", "")],
          };
        }

        if (type === "callout") {
          return {
            ...item,
            type: "callout",
            content: "",
            color: "blue",
            children: [createBlock("paragraph", "")],
          };
        }

        return {
          ...item,
          type,
          content: "",
          table: null,
        };
      });

      scheduleAutosave(updated);
      return updated;
    });

    setSlashMenu(null);
    setSlashQuery("");

    requestAnimationFrame(() => {
      const nextEditor = editorRefs.current[blockId];
      if (!nextEditor || type === "table" || type === "divider") return;

      nextEditor.innerHTML = "";
      nextEditor.focus();

      const selection = window.getSelection();
      if (!selection) return;

      const range = document.createRange();
      range.selectNodeContents(nextEditor);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    });
  };

  const handleBlockKeyDown = (event, block, index) => {
    if (selectEntireNotesDocument(event, block)) return;

    if (event.key === "Escape") {
      setSlashMenu(null);
      setSlashQuery("");
      return;
    }

    // Arrow key navigation inside open slash menu
    if (slashMenu?.blockId === block.id && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const menuEl = document.querySelector("[data-slash-idx]")?.closest("[style]");
      if (!menuEl) return;
      const items = menuEl.querySelectorAll("[data-slash-idx]");
      if (!items.length) return;
      const current = Array.from(items).findIndex((el) => el.classList.contains("bg-muted"));
      const next = event.key === "ArrowDown"
        ? Math.min(current + 1, items.length - 1)
        : Math.max(current - 1, 0);
      // Highlight next item — find its type and fire selection via a simulated hover state
      // We do this by updating a ref the SlashMenuList reads
      items.forEach((el, i) => {
        el.classList.toggle("bg-muted", i === next);
        el.classList.toggle("bg-muted/60", i !== next);
      });
      items[next]?.scrollIntoView({ block: "nearest" });
      return;
    }

    // Enter while the slash menu is open executes the currently typed command.
    if (event.key === "Enter" && slashMenu?.blockId === block.id) {
      event.preventDefault();

      // Click the highlighted item in the slash menu
      const highlighted = document.querySelector("[data-slash-idx].bg-muted");
      if (highlighted) { highlighted.click(); return; }

      const editor = editorRefs.current[block.id];
      const rawText = editor?.textContent || block.content || "";
      const query = rawText.trim().startsWith("/")
        ? rawText.trim().slice(1).trim()
        : slashQuery.trim();
      const match = getSlashMatch(query);

      if (match) {
        setActiveBlockId(block.id);
        selectSlashItem(match);
      } else {
        setSlashMenu(null);
        setSlashQuery("");
      }
      return;
    }

    if (event.key === "/" && !slashMenu) {
      setActiveBlockId(block.id);
      setSlashMenu({ blockId: block.id });
      setSlashQuery("");
      return;
    }

    if (event.key === "Enter") {
      if (block.type === "code") return;
      if (block.type === "table" || block.type === "image" || block.type === "divider" || block.type === "equation") return;
      // Toggle: Enter creates a new top-level block after the toggle
      if (block.type === "toggle") {
        event.preventDefault();
        insertBlockAfter(block.id, "paragraph");
        return;
      }

      // Callout: Enter adds a new child block inside the callout, not outside
      if (block.type === "callout") {
        event.preventDefault();
        const children = block.children || [];
        const lastChild = children[children.length - 1];
        if (lastChild) {
          insertChildBlockAfter(block.id, lastChild.id);
        } else {
          // No children yet — add first one
          updateBlock(block.id, { children: [createBlock("paragraph", "")] });
        }
        return;
      }

      event.preventDefault();
      const content = stripHtml(block.content);

      if (block.type === "bullet" || block.type === "numbered" || block.type === "todo") {
        if (!content.trim()) {
          updateBlock(block.id, {
            type: "paragraph",
            content: "",
            checked: false,
          });
          return;
        }

        insertBlockAfter(block.id, block.type);
        return;
      }

      insertBlockAfter(block.id, "paragraph");
      return;
    }

    if (event.key === "Backspace") {
      // Callout: only delete the whole block if it has no children or one empty child
      if (block.type === "callout") {
        const children = block.children || [];
        const allEmpty = children.every((c) => !stripHtml(c.content || "").trim());
        if (allEmpty) {
          event.preventDefault();
          deleteBlock(block.id);
        }
        return;
      }
      const content = stripHtml(block.content);
      if (!content) {
        event.preventDefault();
        deleteBlock(block.id);
      }
    }

    if (event.key === "Tab" && (block.type === "bullet" || block.type === "numbered")) {
      event.preventDefault();
      updateBlock(block.id, {
        content: `&nbsp;&nbsp;&nbsp;&nbsp;${block.content}`,
      });
    }
  };

  const handleBlockInput = (event, block) => {
    // Callout blocks with children use ChildBlockEditor for all editing.
    // Input events from children bubble up here — ignore them entirely.
    if (block.type === "callout" && (block.children || []).length > 0) return;

    const html = event.currentTarget.innerHTML;
    const text = event.currentTarget.textContent || "";

    updateBlock(block.id, { content: html });
    setActiveBlockId(block.id);

    // Slash menu is shown only while the current block begins with '/'.
    // Once a command is selected, selectSlashItem clears the editor, so the
    // command text never remains visible in the document.
    if (text.startsWith("/")) {
      setSlashMenu({ blockId: block.id });
      setSlashQuery(text.slice(1).trim());
      return;
    }

    if (slashMenu?.blockId === block.id) {
      setSlashMenu(null);
      setSlashQuery("");
    }
  };

  const getSelectedEditors = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];

    const range = selection.getRangeAt(0);
    const selected = [];

    blocks.forEach((block) => {
      const editor = editorRefs.current[block.id];
      if (!editor) return;
      try {
        if (range.intersectsNode(editor)) selected.push(block.id);
      } catch {
        // Ignore detached DOM nodes while React is reconciling.
      }
    });

    return selected.length ? selected : activeBlockId ? [activeBlockId] : [];
  };

  const persistSelectedEditors = (ids) => {
    if (!ids.length) return;

    setBlocks((current) => {
      const updated = current.map((block) => {
        if (!ids.includes(block.id)) return block;
        const editor = editorRefs.current[block.id];
        return editor ? { ...block, content: editor.innerHTML } : block;
      });
      scheduleAutosave(updated);
      return updated;
    });
  };

  const applyFormatting = (command) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const ids = getSelectedEditors();
    if (!ids.length) return;

    document.execCommand(command, false, null);
    persistSelectedEditors(ids);

    setSlashMenu(null);
    setSlashQuery("");
  };

  const applyTextColor = (color) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const ids = getSelectedEditors();
    if (!ids.length) return;

    document.execCommand("foreColor", false, color);
    persistSelectedEditors(ids);

    setSlashMenu(null);
    setSlashQuery("");
  };

  const applyHighlight = (color) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const ids = getSelectedEditors();
    if (!ids.length) return;

    document.execCommand("hiliteColor", false, color);
    persistSelectedEditors(ids);

    setSlashMenu(null);
    setSlashQuery("");
  };

  function applyCalloutColor(color) {
    const blockId = activeBlockId;
    if (!blockId || !color) return;

    setBlocks((current) => {
      const updated = current.map((block) =>
        block.id === blockId
          ? { ...block, type: "callout", color }
          : block
      );

      scheduleAutosave(updated);
      return updated;
    });

    setSlashMenu(null);
    setSlashQuery("");

    requestAnimationFrame(() => {
      focusBlock(blockId);
    });
  }

  /* ------------------------------------------------------------------------ */
  /* Page Cover / Banner                                                      */
  /* ------------------------------------------------------------------------ */

  const savePageMeta = (nextMeta) => {
    setPageMeta(nextMeta);
    scheduleAutosave(blocks, checklist, nextMeta);
  };

  const setCover = () => {
    const url = coverInput.trim();
    if (!url) return;

    savePageMeta({
      ...pageMeta,
      cover: url,
    });

    setCoverInput("");
    setCoverOpen(false);
  };

  const removeCover = () => {
    savePageMeta({
      ...pageMeta,
      cover: "",
    });
  };

  const setBanner = () => {
    const url = coverInput.trim();
    if (!url) return;

    savePageMeta({
      ...pageMeta,
      banner: url,
    });

    setCoverInput("");
    setCoverOpen(false);
  };

  const removeBanner = () => {
    savePageMeta({
      ...pageMeta,
      banner: "",
    });
  };

  /* ------------------------------------------------------------------------ */
  /* Table                                                                    */
  /* ------------------------------------------------------------------------ */

  const updateTableCell = (blockId, rowIndex, columnIndex, value) => {
    setBlocks((current) => {
      const updated = current.map((block) => {
        if (block.id !== blockId) return block;

        const rows = block.table?.rows?.map((row) => [...row]) || [];
        if (!rows[rowIndex]) rows[rowIndex] = [];
        rows[rowIndex][columnIndex] = value;

        return {
          ...block,
          table: {
            ...block.table,
            rows,
          },
        };
      });

      scheduleAutosave(updated);
      return updated;
    });
  };

  const addTableRow = (blockId) => {
    setBlocks((current) => {
      const updated = current.map((block) => {
        if (block.id !== blockId) return block;

        const columns = block.table?.rows?.[0]?.length || 3;
        return {
          ...block,
          table: {
            ...block.table,
            rows: [
              ...(block.table?.rows || []),
              Array.from({ length: columns }, () => ""),
            ],
          },
        };
      });

      scheduleAutosave(updated);
      return updated;
    });
  };

  const addTableColumn = (blockId) => {
    setBlocks((current) => {
      const updated = current.map((block) => {
        if (block.id !== blockId) return block;

        return {
          ...block,
          table: {
            ...block.table,
            rows: (block.table?.rows || []).map((row) => [...row, ""]),
          },
        };
      });

      scheduleAutosave(updated);
      return updated;
    });
  };

  /* ------------------------------------------------------------------------ */
  /* Checklist                                                                */
  /* ------------------------------------------------------------------------ */

  const addTask = async () => {
    const title = newTask.trim();
    if (!title || !assignment) return;

    const updated = [
      ...checklist,
      {
        id: createId("task"),
        title,
        completed: false,
      },
    ];

    setChecklist(updated);
    setNewTask("");

    try {
      await localClient.entities.Assignment.update(assignment.id, {
        checklist: updated,
      });
      reloadAssignments();
    } catch (error) {
      toast({
        title: "Could not add task",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const toggleTask = async (taskId) => {
    const updated = checklist.map((task) =>
      task.id === taskId
        ? { ...task, completed: !task.completed }
        : task
    );

    setChecklist(updated);

    try {
      await localClient.entities.Assignment.update(assignment.id, {
        checklist: updated,
      });
      reloadAssignments();
    } catch (error) {
      toast({
        title: "Could not update task",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const deleteTask = async (taskId) => {
    const updated = checklist.filter((task) => task.id !== taskId);
    setChecklist(updated);

    try {
      await localClient.entities.Assignment.update(assignment.id, {
        checklist: updated,
      });
      reloadAssignments();
    } catch (error) {
      toast({
        title: "Could not delete task",
        description: error?.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  /* ------------------------------------------------------------------------ */
  /* ------------------------------------------------------------------------ */
  /* Stats                                                                    */
  /* ------------------------------------------------------------------------ */

  const plainNotes = useMemo(
    () =>
      blocksToPlainText(
        blocks
      ),
    [blocks]
  );

  const characterCount =
    plainNotes.length;

  const wordCount =
    plainNotes.trim()
      ? plainNotes
          .trim()
          .split(/\s+/).length
      : 0;

  const completedTasks =
    checklist.filter(
      (task) => task.completed
    ).length;

  const progress =
    checklist.length > 0
      ? Math.round(
          (completedTasks /
            checklist.length) *
            100
        )
      : 0;

  const startFocus = () => {
    navigate(
      `/focus?subjectId=${
        assignment.subject_id || ""
      }` +
      `&assignmentId=${assignment.id}` +
      `&label=${encodeURIComponent(
        assignment.title
      )}`
    );
  };

  /* ------------------------------------------------------------------------ */
  /* AI                                                                       */
  /* ------------------------------------------------------------------------ */

  const openGenerateCards = () => {
    toast({
      title: "Learning Cards",
      description:
        "The learning card generator is ready.",
    });
  };

  /* ------------------------------------------------------------------------ */
  /* Note AI assistant                                                        */
  /* ------------------------------------------------------------------------ */

  const resetNoteAi = () => {
    setAiMessages([]);
    setAiInput("");
    setAiLoading(false);
  };

  const insertAiResponse = (text) => {
    const raw = String(text || "").trim();
    if (!raw) return;
    if (noteEditorRef.current?.insertMarkdown) {
      noteEditorRef.current.insertMarkdown(raw);
      return;
    }
  };

  const sendNoteAiMessage = async () => {
    const message = aiInput.trim();
    if (!message || aiLoading) return;

    const history = aiMessages.map((item) => ({
      role: item.role,
      text: item.text,
    }));

    const userMessage = { role: "student", text: message };
    setAiMessages((current) => [...current, userMessage]);
    setAiInput("");
    setAiLoading(true);

    try {
      const api = window.electronAPI?.ai?.invoke;
      if (typeof api !== "function") {
        throw new Error("NeoCoach AI bridge is not available.");
      }

      const result = await api({
        operation: "chat",
        args: {
          message,
          history,
          context: {
            assignmentTitle: assignment.title,
            subject: subject?.name || "",
            notes: plainNotes.slice(0, 12000),
            instruction: "You are the private AI assistant for this note only. Help write, organize, explain, summarize, or improve these notes. If asked to write notes, make them ready to paste into the note. Do not retain this conversation outside the current renderer session.",
          },
        },
      });

      if (!result?.ok) throw new Error(result?.error || "AI request failed.");

      setAiMessages((current) => [
        ...current,
        { role: "assistant", text: result.result?.reply || "I couldn't generate a response." },
      ]);
    } catch (error) {
      setAiMessages((current) => [
        ...current,
        { role: "assistant", text: `Sorry — ${error?.message || "the AI request failed."}` },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Loading                                                                  */
  /* ------------------------------------------------------------------------ */

  if (assignmentsLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-8 h-[600px] animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground" />

        <h2 className="mt-4 text-xl font-semibold">
          Assignment not found
        </h2>

        <p className="mt-2 text-sm text-muted-foreground">
          This assignment may have been deleted.
        </p>

        <Button
          onClick={onBack}
          variant="outline"
          className="mt-6 gap-2 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to assignments
        </Button>
      </div>
    );
  }

  const color =
    getColor(subject?.color);

  const due =
    dueLabel(
      assignment.due_date
    );

  return (
    <div
      className={cn(
        fullscreenNotes
          ? "fixed inset-0 z-[100] overflow-hidden bg-background p-3 sm:p-6"
          : "mx-auto max-w-7xl pb-12"
      )}
      style={{ transition: "all 420ms cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      {/* Navigation */}

      {!fullscreenNotes && (
      <div className="mb-6 flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to assignments
        </button>

        <div className="flex items-center gap-2">
          <SaveStatus
            state={saveState}
          />

          <Button
            onClick={() =>
              saveWorkspace(true)
            }
            disabled={saving}
            variant="outline"
            className="gap-2 rounded-full"
          >
            {saving ? (
              <Clock3 className="h-4 w-4 animate-pulse" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            {saving
              ? "Saving…"
              : "Save"}
          </Button>
        </div>
      </div>
      )}

      {/* Cover */}

      {!fullscreenNotes && pageMeta.cover && (
        <div className="group relative mb-[-35px] h-52 overflow-hidden rounded-t-3xl">
          <img
            src={pageMeta.cover}
            alt=""
            className="h-full w-full object-cover"
          />

          <div className="absolute inset-0 bg-black/10" />

          <button
            onClick={removeCover}
            className="absolute right-4 top-4 rounded-lg bg-black/50 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Assignment Header */}

      {!fullscreenNotes && <div
        className={cn(
          "relative overflow-hidden rounded-3xl border bg-card shadow-sm",
          pageMeta.cover &&
            "rounded-t-none"
        )}
      >
        <div
          className={cn(
            "absolute right-0 top-0 h-44 w-44 rounded-bl-full opacity-70",
            color.soft
          )}
        />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {subject && (
                  <SubjectBadge
                    subject={subject}
                  />
                )}
                {topic && <TopicBadge topic={topic} />}
                <AssignmentTypeBadge type={assignment.type} />
                <AssignmentStatusBadge
                  status={
                    assignment.status
                  }
                />

                <PriorityBadge
                  priority={
                    assignment.priority
                  }
                />

                {due && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium",
                      due.tone ===
                        "overdue" &&
                        "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
                      due.tone === "today" &&
                        "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                    )}
                  >
                    <Clock3 className="h-3 w-3" />
                    {due.text}
                  </span>
                )}
              </div>

              <h1 className="max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {assignment.title}
              </h1>

              {assignment.description && (
                <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {assignment.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(true)}
                className="gap-2 rounded-full"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setCoverOpen(
                    true
                  )
                }
                className="gap-2 rounded-full"
              >
                <Image className="h-4 w-4" />
                Cover
              </Button>

              <Button
                onClick={startFocus}
                className="gap-2 rounded-full"
              >
                <Timer className="h-4 w-4" />
                Start Focus
              </Button>
            </div>
          </div>

          {coverOpen && (
            <div className="mt-6 rounded-2xl border bg-muted/40 p-4">
              <div className="flex gap-2">
                <Input
                  value={coverInput}
                  onChange={(event) =>
                    setCoverInput(
                      event.target.value
                    )
                  }
                  placeholder="Paste cover image URL..."
                  className="rounded-xl"
                />

                <Button
                  onClick={setCover}
                  className="rounded-xl"
                >
                  Set
                </Button>

                <Button
                  variant="ghost"
                  onClick={() =>
                    setCoverOpen(
                      false
                    )
                  }
                  className="rounded-xl"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>}

      {/* Workspace */}

      <div className={cn("grid gap-6", fullscreenNotes ? "h-full grid-cols-1" : "mt-6 lg:grid-cols-[minmax(0,1fr)_320px]")}>
        <main className={cn("min-w-0 rounded-3xl border bg-card shadow-sm", fullscreenNotes && "h-full overflow-hidden rounded-3xl transition-all duration-500 ease-out")}>
          {/* Tabs */}

          {!fullscreenNotes && (
            <div className="flex items-center gap-1 border-b px-3 py-2">
            <button
              onClick={() =>
                setActiveSection(
                  "notes"
                )
              }
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium",
                activeSection ===
                  "notes"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Workspace
              </span>
            </button>

            <button
              onClick={() =>
                setActiveSection(
                  "tasks"
                )
              }
              className={cn(
                "rounded-xl px-4 py-2 text-sm font-medium",
                activeSection ===
                  "tasks"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60"
              )}
            >
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Checklist

                {checklist.length >
                  0 && (
                  <span className="text-xs text-muted-foreground">
                    {completedTasks}/
                    {
                      checklist.length
                    }
                  </span>
                )}
              </span>
            </button>
            </div>
          )}

          {/* Workspace */}

          {activeSection ===
            "notes" && (
            <div className={cn("relative p-4 sm:p-6", fullscreenNotes && "h-full overflow-y-auto sm:p-6")}>
              {/* Header text — scrolls with content */}
              <div className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Assignment workspace
                </p>
                <h2 className="mt-0.5 font-display text-lg font-bold leading-tight">Study workspace</h2>
              </div>

              {/* Full screen toggle button — sticky at top right as user scrolls */}
              <div className="sticky top-0 z-30 flex justify-end pb-2 -mt-2">
                <button
                  type="button"
                  onClick={() => setFullscreenNotes((v) => !v)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-border bg-background/90 backdrop-blur-md px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted"
                  title={fullscreenNotes ? "Exit full screen (Esc)" : "Full screen"}
                >
                  {fullscreenNotes ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <>
                      <Maximize2 className="h-3.5 w-3.5" />
                      Full screen
                    </>
                  )}
                </button>
              </div>


              <div
                ref={notesEditorAreaRef}
                className={cn(
                  "lifeos-notes-document min-h-[560px]",
                  fullscreenNotes && "min-h-0"
                )}
              >
                {notesReady ? (
                  <LifeOSBlockNoteEditor
                    key={assignmentId}
                    ref={noteEditorRef}
                    assignmentId={assignmentId}
                    blocks={blocks}
                    onChange={(nextBlocks) => {
                      setBlocks(nextBlocks);
                      scheduleAutosave(nextBlocks);
                    }}
                  />
                ) : (
                  <div className="h-[560px] animate-pulse rounded-xl bg-muted" />
                )}
              </div>

              <NoteAIAssistant
                open={aiOpen}
                onToggle={() => setAiOpen((value) => !value)}
                messages={aiMessages}
                input={aiInput}
                setInput={setAiInput}
                loading={aiLoading}
                onSend={sendNoteAiMessage}
                onReset={resetNoteAi}
                onInsert={insertAiResponse}
              />

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>
                    {wordCount} words
                  </span>

                  <span>
                    {characterCount}{" "}
                    characters
                  </span>
                </div>

                <span className="inline-flex items-center gap-1.5">
                  {saveState ===
                  "saving" ? (
                    <>
                      <Clock3 className="h-3.5 w-3.5 animate-pulse" />
                      Saving...
                    </>
                  ) : saveState ===
                    "error" ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      Save failed
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Saved automatically
                    </>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Checklist */}

          {activeSection ===
            "tasks" && (
            <div className="p-5 sm:p-8">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Progress
                </p>

                <div className="mt-2 flex items-end justify-between">
                  <h2 className="font-display text-xl font-bold">
                    Assignment checklist
                  </h2>

                  <span className="text-sm font-semibold">
                    {progress}%
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {checklist.length ===
                0 ? (
                  <div className="rounded-2xl border border-dashed p-8 text-center">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/60" />

                    <p className="mt-3 font-medium">
                      No tasks yet
                    </p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Break this assignment into small actionable steps.
                    </p>
                  </div>
                ) : (
                  checklist.map(
                    (task) => (
                      <div
                        key={
                          task.id
                        }
                        className={cn(
                          "group flex items-center gap-3 rounded-xl border p-3",
                          task.completed &&
                            "bg-muted/40"
                        )}
                      >
                        <button
                          onClick={() =>
                            toggleTask(
                              task.id
                            )
                          }
                        >
                          {task.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </button>

                        <span
                          className={cn(
                            "min-w-0 flex-1 text-sm",
                            task.completed &&
                              "text-muted-foreground line-through"
                          )}
                        >
                          {
                            task.title
                          }
                        </span>

                        <button
                          onClick={() =>
                            deleteTask(
                              task.id
                            )
                          }
                          className="rounded-lg p-1.5 text-muted-foreground opacity-0 hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  )
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <Input
                  value={newTask}
                  onChange={(event) =>
                    setNewTask(
                      event.target.value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      event.preventDefault();
                      addTask();
                    }
                  }}
                  placeholder="Add a task..."
                  className="rounded-xl"
                />

                <Button
                  onClick={addTask}
                  disabled={
                    !newTask.trim()
                  }
                  className="rounded-xl"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
          )}
        </main>

        {/* Sidebar */}

        {!fullscreenNotes && (
          <aside className="space-y-4">
          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <h3 className="font-semibold">
              Assignment details
            </h3>

            <div className="mt-4 space-y-4">
              <DetailRow
                icon={BookOpen}
                label="Subject"
                value={
                  subject?.name ||
                  "Unknown subject"
                }
              />

              <DetailRow
                icon={Clock3}
                label="Due"
                value={
                  assignment.due_date
                    ? new Date(
                        assignment.due_date
                      ).toLocaleDateString(
                        undefined,
                        {
                          month:
                            "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )
                    : "No due date"
                }
              />

              <DetailRow
                icon={Timer}
                label="Estimated time"
                value={
                  assignment.estimated_hours
                    ? `${assignment.estimated_hours} hours`
                    : "Not specified"
                }
              />
            </div>
          </section>

          {/* AI */}

          <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
            <button
              onClick={() =>
                setAiOpen(
                  (value) =>
                    !value
                )
              }
              className="flex w-full items-center justify-between p-5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>

                <div>
                  <h3 className="font-semibold">
                    AI Study Tools
                  </h3>

                  <p className="text-xs text-muted-foreground">
                    Learn this assignment faster
                  </p>
                </div>
              </div>

              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  aiOpen &&
                    "rotate-180"
                )}
              />
            </button>

            {aiOpen && (
              <div className="border-t px-4 pb-4 pt-3">
                <button
                  onClick={
                    openGenerateCards
                  }
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted"
                >
                  <BookOpen className="h-4 w-4" />

                  <div>
                    <p className="text-sm font-medium">
                      Generate learning cards
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Turn your workspace into flashcards
                    </p>
                  </div>
                </button>

                <button
                  onClick={() =>
                    toast({
                      title:
                        "Coming next",
                      description:
                        "Quick Check will use this assignment's workspace.",
                    })
                  }
                  className="mt-1 flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-muted"
                >
                  <Sparkles className="h-4 w-4" />

                  <div>
                    <p className="text-sm font-medium">
                      Quick Check
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Test your understanding
                    </p>
                  </div>
                </button>
              </div>
            )}
          </section>

          <section className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                Progress
              </h3>

              <span className="text-sm font-bold">
                {progress}%
              </span>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              {completedTasks} of{" "}
              {checklist.length}{" "}
              tasks completed
            </p>
          </section>
          </aside>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Block Editor                                                               */
/* -------------------------------------------------------------------------- */

function BlockEditor({
  block,
  index,
  numberedIndex,
  registerEditor,
  onFocus,
  onInput,
  onKeyDown,
  onDelete,
  slashOpen,
  slashQuery,
  slashItems,
  slashSubmenu,
  onSlashSelect,
  onTextColor,
  onHighlight,
  onUpdateBlock,
  onUpdateTableCell,
  onAddTableRow,
  onAddTableColumn,
  onCalloutColor,
  onUpdateChildBlock,
  onInsertChildBlockAfter,
  onDeleteChildBlock,
  onToggleCollapse,
}) {
  const editorRef =
    useRef(null);

  useEffect(() => {
    if (!editorRef.current)
      return;

    const current =
      editorRef.current.innerHTML;

    if (
      current !==
      (block.content || "")
    ) {
      editorRef.current.innerHTML =
        block.content || "";
    }
  }, [block.content]);

  const setEditor = (
    element
  ) => {
    editorRef.current =
      element;

    registerEditor(
      block.id,
      element
    );
  };

  if (
    block.type === "divider"
  ) {
    return (
      <div className="group relative flex items-center py-4">
        <div className="w-full border-t" />

        <button
          onClick={onDelete}
          className="absolute right-0 rounded-lg bg-background p-1.5 opacity-0 shadow-sm group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (
    block.type === "table"
  ) {
    return (
      <TableBlock
        block={block}
        onUpdateCell={
          onUpdateTableCell
        }
        onAddRow={
          onAddTableRow
        }
        onAddColumn={
          onAddTableColumn
        }
        onDelete={onDelete}
      />
    );
  }

  if (
    block.type === "image"
  ) {
    return (
      <ImageBlock
        block={block}
        onUpdateBlock={
          onUpdateBlock
        }
        onDelete={onDelete}
      />
    );
  }

  // ── Toggle block ─────────────────────────────────────────────────────────
  if (block.type === "toggle") {
    return (
      <div
        data-note-block-id={block.id}
        data-note-block-type="toggle"
        className="group relative -ml-2 rounded-lg px-2 py-1"
      >
        <div className="flex items-start gap-1.5">
          <button
            onClick={() => onToggleCollapse(block.id)}
            className="mt-1 shrink-0 rounded p-0.5 text-muted-foreground transition-transform hover:bg-muted hover:text-foreground"
            style={{ transform: block.collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            title={block.collapsed ? "Expand" : "Collapse"}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <div
            ref={setEditor}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onFocus={onFocus}
            onInput={onInput}
            onKeyDown={onKeyDown}
            data-placeholder="Toggle heading..."
            className="min-w-0 flex-1 text-[15px] font-semibold leading-7 outline-none empty:before:pointer-events-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/45 selection:bg-primary/20"
          />
          <button
            onClick={onDelete}
            className="mt-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {!block.collapsed && (
          <div className="ml-5 mt-1 border-l-2 border-border pl-3">
            {(block.children || [{ ...createBlock("paragraph") }]).map((child) => (
              <ChildBlockEditor
                key={child.id}
                child={child}
                parentId={block.id}
                onUpdate={(changes) => onUpdateChildBlock(block.id, child.id, changes)}
                onInsertAfter={() => onInsertChildBlockAfter(block.id, child.id)}
                onDelete={() => onDeleteChildBlock(block.id, child.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Equation block ───────────────────────────────────────────────────────
  if (block.type === "equation") {
    return (
      <EquationBlock
        block={block}
        onUpdateBlock={onUpdateBlock}
        onDelete={onDelete}
      />
    );
  }

  const commonProps = {
    ref: setEditor,
    contentEditable: true,
    suppressContentEditableWarning:
      true,
    spellCheck: true,
    onFocus,
    onInput,
    onKeyDown,
    "data-placeholder":
      getBlockPlaceholder(
        block.type
      ),
    className: cn(
      "min-w-0 flex-1 outline-none",
      "empty:before:pointer-events-none",
      "empty:before:content-[attr(data-placeholder)]",
      "empty:before:text-muted-foreground/45",
      "selection:bg-primary/20",

      block.type ===
        "heading_1" &&
        "font-display text-3xl font-bold leading-tight",

      block.type ===
        "heading_2" &&
        "font-display text-2xl font-bold leading-tight",

      block.type ===
        "heading_3" &&
        "font-display text-xl font-semibold leading-tight",

      block.type ===
        "paragraph" &&
        "text-[15px] leading-7",

      block.type ===
        "bullet" &&
        "text-[15px] leading-7",

      block.type ===
        "numbered" &&
        "text-[15px] leading-7",

      block.type ===
        "quote" &&
        "border-l-2 border-primary/40 pl-4 text-[15px] italic leading-7 text-muted-foreground",

      block.type ===
        "code" &&
        "rounded-xl bg-muted p-4 font-mono text-sm leading-6",

      block.type ===
        "callout" &&
        "rounded-xl px-4 py-3 text-[15px] leading-7"
    ),
  };

  const callout =
    CALLOUT_COLORS.find(
      (item) =>
        item.id === block.color
    ) ||
    CALLOUT_COLORS[0];

  return (
    <div
      data-note-block-id={block.id}
      data-note-block-type={block.type}
      className={cn(
        "group relative -ml-2 flex min-h-[38px] items-start gap-2 rounded-lg px-2 py-1",
        block.type ===
          "callout" &&
          `${callout.bg} ${callout.border} border`
      )}
    >
      <div className="absolute -left-9 top-1 hidden items-center gap-0.5 group-hover:flex" style={{ pointerEvents: "none", userSelect: "none" }}>
        <button
          className="cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted"
          title="Drag block"
          style={{ pointerEvents: "auto" }}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      {block.type ===
        "todo" && (
        <button
          onClick={() =>
            onUpdateBlock(
              block.id,
              {
                checked:
                  !block.checked,
              }
            )
          }
          className="mt-1 shrink-0"
        >
          {block.checked ? (
            <CheckSquare className="h-5 w-5 text-primary" />
          ) : (
            <SquareIcon />
          )}
        </button>
      )}

      {block.type ===
        "bullet" && (
        <span className="mt-2.5 shrink-0 select-none text-muted-foreground" style={{ pointerEvents: "none" }}>
          •
        </span>
      )}

      {block.type ===
        "numbered" && (
        <span className="mt-2.5 w-5 shrink-0 select-none text-right text-sm text-muted-foreground" style={{ pointerEvents: "none" }}>
          {numberedIndex}.
        </span>
      )}

      {block.type ===
        "callout" && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onCalloutColor(block.color || "blue")}
          className={cn("mt-1 shrink-0 rounded-lg p-1 hover:bg-background/70", callout.text)}
          title="Change callout background"
        >
          <Paintbrush className="h-4 w-4" />
        </button>
      )}

      {/* Callout: render nested child blocks */}
      {block.type === "callout" ? (
        <div className="relative min-w-0 flex-1 py-1">
          {(block.children || []).length > 0
            ? (block.children || []).map((child) => (
                <ChildBlockEditor
                  key={child.id}
                  child={child}
                  parentId={block.id}
                  onUpdate={(changes) => onUpdateChildBlock(block.id, child.id, changes)}
                  onInsertAfter={() => onInsertChildBlockAfter(block.id, child.id)}
                  onDelete={() => onDeleteChildBlock(block.id, child.id)}
                />
              ))
            : (
              // Fallback: legacy callout with plain content
              <div {...commonProps} />
            )
          }
          {slashOpen && (
            <SlashMenu
              query={slashQuery}
              items={slashItems}
              submenu={slashSubmenu}
              onSelect={onSlashSelect}
              onTextColor={onTextColor}
              onHighlight={onHighlight}
              onCalloutColor={onCalloutColor}
              onUpdateBlock={onUpdateBlock}
              block={block}
            />
          )}
        </div>
      ) : (
        <div className="relative min-w-0 flex-1">
          <div
            {...commonProps}
          />

          {slashOpen && (
            <SlashMenu
              query={slashQuery}
              items={slashItems}
              submenu={
                slashSubmenu
              }
              onSelect={
                onSlashSelect
              }
              onTextColor={
                onTextColor
              }
              onHighlight={
                onHighlight
              }
              onCalloutColor={onCalloutColor}
              onUpdateBlock={
                onUpdateBlock
              }
              block={block}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ChildBlockEditor — nested blocks inside callout / toggle                  */
/* Supports: all text types, bullet, numbered, todo, table, image via /cmd  */
/* -------------------------------------------------------------------------- */

// Supported child block types — all non-container types
const CHILD_BLOCK_TYPES = [
  "paragraph","heading_1","heading_2","heading_3",
  "bullet","numbered","todo","quote","code",
  "bold","italic","underline","text_color","highlight",
];

function ChildBlockEditor({ child, parentId, onUpdate, onInsertAfter, onDelete }) {
  const editorRef  = useRef(null);
  const [slashOpen,  setSlashOpen]  = useState(false);
  const [slashQuery, setSlashQuery] = useState("");

  // Sync external content changes without clobbering cursor
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== (child.content || "")) {
      editorRef.current.innerHTML = child.content || "";
    }
  }, [child.content]);

  // Close slash menu on outside click
  useEffect(() => {
    if (!slashOpen) return;
    const close = (e) => {
      if (!editorRef.current?.contains(e.target)) setSlashOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [slashOpen]);

  // Apply a slash-selected block type to this child
  const applyType = (type) => {
    const editor = editorRef.current;
    if (editor) editor.innerHTML = "";
    setSlashOpen(false);
    setSlashQuery("");

    if (type === "bold" || type === "italic" || type === "underline") {
      onUpdate({ content: "", type: "paragraph" });
      requestAnimationFrame(() => {
        editorRef.current?.focus();
        document.execCommand(type, false, null);
      });
      return;
    }
    if (type === "text_color" || type === "highlight") return; // skip in children for now
    onUpdate({ type, content: "" });
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const handleInput = (e) => {
    // Stop bubbling so the callout's outer onInput handler never fires
    e.stopPropagation();
    const html  = e.currentTarget.innerHTML;
    const text  = e.currentTarget.textContent || "";
    onUpdate({ content: html });
    if (text.startsWith("/")) {
      setSlashOpen(true);
      setSlashQuery(text.slice(1).trim());
    } else if (slashOpen) {
      setSlashOpen(false);
      setSlashQuery("");
    }
  };

  const handleKeyDown = (e) => {
    // Stop all key events from bubbling to the parent block's keydown handler
    e.stopPropagation();

    if (e.key === "Escape") { setSlashOpen(false); setSlashQuery(""); return; }

    // Arrow navigation in slash menu
    if (slashOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const items = Array.from(document.querySelectorAll("[data-child-slash-item]"));
      if (!items.length) return;
      const cur = items.findIndex((el) => el.getAttribute("data-active") === "true");
      const next = e.key === "ArrowDown" ? Math.min(cur + 1, items.length - 1) : Math.max(cur - 1, 0);
      items.forEach((el, i) => el.setAttribute("data-active", String(i === next)));
      items[next]?.scrollIntoView({ block: "nearest" });
      return;
    }

    // Enter confirms slash command or inserts new child
    if (e.key === "Enter" && !e.shiftKey) {
      if (slashOpen) {
        e.preventDefault();
        const active = document.querySelector("[data-child-slash-item][data-active='true']");
        if (active) { active.click(); return; }
        // Fallback: use first item
        const first = document.querySelector("[data-child-slash-item]");
        if (first) { first.click(); return; }
        setSlashOpen(false);
        return;
      }
      if (child.type === "code") return; // allow literal newlines in code
      e.preventDefault();
      onInsertAfter();
      return;
    }

    if (e.key === "Backspace") {
      const text = e.currentTarget.textContent || "";
      if (!text) { e.preventDefault(); onDelete(); }
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const editor = editorRef.current;
      if (!editor) return;
      document.execCommand("insertHTML", false, "&nbsp;&nbsp;&nbsp;&nbsp;");
    }
  };

  // Filtered slash items for child editor
  const filteredChildItems = CHILD_BLOCK_TYPES.filter((t) => {
    const item = BLOCK_TYPES[t];
    if (!item) return false;
    if (!slashQuery) return true;
    return (
      item.label.toLowerCase().includes(slashQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(slashQuery.toLowerCase())
    );
  });

  // Type-based styling
  const typeClass = cn(
    "min-w-0 flex-1 outline-none empty:before:pointer-events-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 selection:bg-primary/20 text-[14px] leading-6",
    child.type === "heading_1"  && "text-2xl font-bold leading-tight",
    child.type === "heading_2"  && "text-xl font-bold leading-tight",
    child.type === "heading_3"  && "text-lg font-semibold leading-tight",
    child.type === "code"       && "rounded bg-muted px-2 py-1 font-mono text-sm",
    child.type === "quote"      && "border-l-2 border-primary/40 pl-3 italic text-muted-foreground",
  );

  return (
    <div className="group relative flex min-h-[28px] items-start gap-1.5 py-0.5">
      {child.type === "bullet"   && <span className="mt-2 shrink-0 text-sm text-muted-foreground">•</span>}
      {child.type === "numbered" && <span className="mt-1.5 shrink-0 text-sm text-muted-foreground">1.</span>}
      {child.type === "todo" && (
        <button onClick={() => onUpdate({ checked: !child.checked })} className="mt-1 shrink-0">
          {child.checked
            ? <CheckSquare className="h-4 w-4 text-primary" />
            : <div className="h-4 w-4 rounded border border-muted-foreground/50" />}
        </button>
      )}

      <div className="relative min-w-0 flex-1">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          data-placeholder={slashOpen ? "" : "Type '/' for commands…"}
          className={typeClass}
        />

        {/* Slash menu for child blocks */}
        {slashOpen && (
          <div className="absolute left-0 top-full z-[100] mt-1 w-[260px] overflow-y-auto rounded-xl border bg-popover p-1 shadow-xl" style={{ maxHeight: "240px" }}>
            {filteredChildItems.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">No matches for "{slashQuery}"</p>
            ) : (
              filteredChildItems.map((type, idx) => {
                const item = BLOCK_TYPES[type];
                const Icon = item?.icon;
                return (
                  <button
                    key={type}
                    data-child-slash-item
                    data-active={String(idx === 0)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyType(type)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted data-[active=true]:bg-muted"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded border bg-background">
                      {Icon && <Icon className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{item?.label}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* EquationBlock — LaTeX math display                                        */
/* -------------------------------------------------------------------------- */

function EquationBlock({ block, onUpdateBlock, onDelete }) {
  // Always coerce to a plain string — guard against object/array content
  // that can appear if block data was serialized improperly.
  const safeLatex = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.map((i) => (typeof i === "string" ? i : i?.text || "")).join("");
    if (typeof v === "object") return v.latex || v.content || v.text || v.value || "";
    return String(v);
  };

  const normalizedLatex = safeLatex(block.content);
  const [editing, setEditing] = useState(!normalizedLatex);
  const [latex, setLatex] = useState(normalizedLatex);

  useEffect(() => {
    const next = safeLatex(block.content);
    setLatex(next);
    setEditing(!next);
  }, [block.content, block.id]);

  const save = () => {
    onUpdateBlock(block.id, { content: safeLatex(latex) });
    setEditing(false);
  };

  // --- KaTeX rendering ---
  const latexText = safeLatex(latex);
  let renderedHtml = "";
  let renderError = "";
  try {
    renderedHtml = latexText
      ? katex.renderToString(latexText, {
          throwOnError: false,
          displayMode: true,
          trust: false,
        })
      : "";
  } catch (e) {
    renderError = e?.message || "Invalid LaTeX";
  }

  if (editing) {
    return (
      <div className="group relative -ml-2 rounded-xl border bg-muted/30 px-4 py-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">LaTeX equation</p>
        <textarea
          autoFocus
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
            if (e.key === "Escape") save();
          }}
          rows={3}
          placeholder="e.g. E = mc^2  or  \int_a^b f(x)\,dx"
          className="w-full resize-none rounded-lg bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-ring"
        />
        {/* Live preview while editing */}
        {latex && (
          <div className="mt-3 rounded-lg bg-background/60 p-3">
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Preview</p>
            {renderedHtml ? (
              <div
                className="overflow-x-auto text-lg"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Invalid equation</p>
            )}
            {renderError && <p className="mt-1 text-xs text-rose-500">{renderError}</p>}
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <button onClick={save} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            Save (Ctrl+Enter)
          </button>
          <button onClick={() => setEditing(false)} className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative -ml-2 cursor-pointer rounded-xl border bg-muted/20 px-4 py-3 text-center hover:bg-muted/40"
      onClick={() => setEditing(true)}
    >
      {latexText ? (
        <>
          <div
            className="overflow-x-auto text-lg [&_.katex-display]:m-0"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
          {renderError && <p className="mt-2 text-xs text-rose-500">{renderError}</p>}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Click to enter equation…</p>
      )}
      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Note AI Assistant                                                          */
/* -------------------------------------------------------------------------- */

function NoteAIAssistant({
  open,
  onToggle,
  messages,
  input,
  setInput,
  loading,
  onSend,
  onReset,
  onInsert,
}) {
  return (
    <div className="fixed bottom-5 right-5 z-[90] w-[min(380px,calc(100vw-2rem))]">
      {!open ? (
        <button
          onClick={onToggle}
          className="ml-auto flex items-center gap-2 rounded-full border bg-card px-4 py-3 text-sm font-medium shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Note AI
        </button>
      ) : (
        <div className="overflow-hidden rounded-3xl border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Note AI</p>
                <p className="text-[10px] text-muted-foreground">Temporary memory • this note only</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onReset} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Clear chat">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button onClick={onToggle} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground" title="Minimize">
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[330px] space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
                Ask me to write notes, explain something in this note, summarize it, make it cleaner, or help you study.
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={cn("rounded-2xl p-3 text-sm", message.role === "assistant" ? "bg-muted/60" : "ml-6 bg-primary text-primary-foreground")}>
                  {message.role === "assistant" ? (
                    <div className="text-[13px]">
                      <AIFormattedText className="[&_.katex]{font-size:1em}">
                        {message.text}
                      </AIFormattedText>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap leading-6">{message.text}</div>
                  )}
                  {message.role === "assistant" && (
                    <button
                      onClick={() => onInsert(message.text)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Insert into note
                    </button>
                  )}
                </div>
              ))
            )}
            {loading && <div className="rounded-2xl bg-muted/60 p-3 text-sm text-muted-foreground">Thinking…</div>}
          </div>

          <div className="border-t p-3">
            <div className="flex items-end gap-2 rounded-2xl border bg-background p-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    onSend();
                  }
                }}
                rows={2}
                placeholder="Ask your note assistant…"
                className="min-h-[44px] flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
              />
              <button
                onClick={onSend}
                disabled={!input.trim() || loading}
                className="rounded-xl bg-primary p-2.5 text-primary-foreground disabled:opacity-40"
                title="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Slash Menu                                                                 */
/* -------------------------------------------------------------------------- */

function SlashMenu({
  query,
  items,
  submenu,
  onSelect,
  onTextColor,
  onHighlight,
  onUpdateBlock,
  onCalloutColor,
  block,
}) {
  if (submenu === "callout_color") {
    return (
      <div className="absolute left-0 top-full z-50 mt-2 w-[280px] rounded-2xl border bg-popover p-2 shadow-xl">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Callout background
        </p>
        <div className="grid grid-cols-3 gap-1">
          {CALLOUT_COLORS.map((color) => (
            <button
              key={color.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onCalloutColor(color.id)}
              className={cn("rounded-xl border p-2 text-xs font-medium transition-transform hover:scale-[1.02]", color.bg, color.border, color.text)}
            >
              {color.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (submenu === "text_color") {
    return (
      <div className="absolute left-0 top-full z-50 mt-2 w-[280px] rounded-2xl border bg-popover p-2 shadow-xl">
        <div className="mb-2 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Text color
          </p>
        </div>

        <div className="grid grid-cols-4 gap-1">
          {TEXT_COLORS.map(
            (color) => (
              <button
                key={color.id}
                onMouseDown={(e) =>
                  e.preventDefault()
                }
                onClick={() => {
                  const map = {
                    default:
                      "#111827",
                    red: "#ef4444",
                    orange:
                      "#f97316",
                    yellow:
                      "#eab308",
                    green:
                      "#22c55e",
                    blue:
                      "#3b82f6",
                    purple:
                      "#a855f7",
                    pink:
                      "#ec4899",
                  };

                  onTextColor(
                    map[color.id]
                  );
                }}
                className="rounded-lg p-2 text-xs hover:bg-muted"
              >
                <span
                  className={cn(
                    "font-medium",
                    color.className
                  )}
                >
                  Aa
                </span>
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  if (
    submenu === "highlight"
  ) {
    return (
      <div className="absolute left-0 top-full z-50 mt-2 w-[280px] rounded-2xl border bg-popover p-2 shadow-xl">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Highlight
        </p>

        <div className="grid grid-cols-5 gap-1">
          {HIGHLIGHT_COLORS.map(
            (color) => {
              const map = {
                yellow:
                  "#fde68a",
                green:
                  "#bbf7d0",
                blue:
                  "#bfdbfe",
                pink:
                  "#fbcfe8",
                purple:
                  "#ddd6fe",
              };

              return (
                <button
                  key={color.id}
                  onMouseDown={(e) =>
                    e.preventDefault()
                  }
                  onClick={() =>
                    onHighlight(
                      map[color.id]
                    )
                  }
                  className="rounded-lg p-2 hover:bg-muted"
                >
                  <span
                    className={cn(
                      "block h-6 rounded",
                      color.className
                    )}
                  />
                </button>
              );
            }
          )}
        </div>
      </div>
    );
  }

  if (
    submenu === "link"
  ) {
    return (
      <LinkCommand
        block={block}
        onUpdateBlock={
          onUpdateBlock
        }
      />
    );
  }

  if (
    submenu === "image"
  ) {
    return (
      <ImageCommand
        block={block}
        onUpdateBlock={
          onUpdateBlock
        }
      />
    );
  }

  return (
    <SlashMenuList query={query} items={items} onSelect={onSelect} />
  );
}

/* -------------------------------------------------------------------------- */
/* Slash Menu Item List — with keyboard navigation + grouped categories      */
/* -------------------------------------------------------------------------- */

const SLASH_GROUPS = [
  { label: "Text",    items: ["paragraph", "heading_1", "heading_2", "heading_3", "quote", "code", "equation"] },
  { label: "Lists",   items: ["bullet", "numbered", "todo", "toggle"] },
  { label: "Layout",  items: ["callout", "table", "divider", "image", "link"] },
  { label: "Format",  items: ["bold", "italic", "underline", "text_color", "highlight", "callout_color"] },
];

function SlashMenuList({ query, items, onSelect }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef(null);

  // Build a flat ordered list of matching items respecting group order
  const ordered = SLASH_GROUPS.flatMap((g) => g.items).filter((t) => items.includes(t));

  // Reset active index when query changes
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Keyboard navigation from parent is handled by the keyDown handler in BlockEditor
  // Here we expose scroll-into-view behaviour
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-slash-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  if (ordered.length === 0) {
    return (
      <div className="absolute left-0 top-full z-50 mt-2 w-[300px] rounded-2xl border bg-popover px-3 py-4 text-sm text-muted-foreground shadow-xl">
        No blocks match "{query}"
      </div>
    );
  }

  // Group the ordered matches
  const visibleGroups = SLASH_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((t) => ordered.includes(t)) }))
    .filter((g) => g.items.length > 0);

  let globalIdx = 0;
  return (
    <div
      ref={listRef}
      className="absolute left-0 top-full z-50 mt-2 w-[300px] overflow-hidden overflow-y-auto rounded-2xl border bg-popover p-1.5 shadow-xl"
      style={{ maxHeight: "320px" }}
    >
      {visibleGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {group.label}
          </p>
          {group.items.map((type) => {
            const item = BLOCK_TYPES[type];
            const Icon = item?.icon;
            const idx  = globalIdx++;
            return (
              <button
                key={type}
                data-slash-idx={idx}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(type)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                  idx === activeIdx ? "bg-muted" : "hover:bg-muted/60"
                )}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-background">
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item?.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{item?.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Link Command                                                               */
/* -------------------------------------------------------------------------- */

function LinkCommand({
  block,
  onUpdateBlock,
}) {
  const [text, setText] =
    useState(
      stripHtml(
        block.content
      )
    );

  const [url, setUrl] =
    useState(block.url || "");

  const submit = () => {
    if (!url.trim())
      return;

    onUpdateBlock(
      block.id,
      {
        type: "link",
        content:
          text ||
          url,
        url:
          url.trim(),
      }
    );
  };

  return (
    <div className="absolute left-0 top-full z-50 mt-2 w-[340px] rounded-2xl border bg-popover p-3 shadow-xl">
      <p className="mb-3 text-xs font-semibold">
        Embed link
      </p>

      <Input
        value={text}
        onChange={(e) =>
          setText(
            e.target.value
          )
        }
        placeholder="Link text"
        className="mb-2 rounded-xl"
      />

      <Input
        value={url}
        onChange={(e) =>
          setUrl(
            e.target.value
          )
        }
        placeholder="https://..."
        className="rounded-xl"
      />

      <Button
        onClick={submit}
        className="mt-2 w-full rounded-xl"
      >
        Add link
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Image Command                                                              */
/* -------------------------------------------------------------------------- */

function ImageCommand({
  block,
  onUpdateBlock,
}) {
  const [url, setUrl] =
    useState(
      block.imageUrl || ""
    );

  const submit = () => {
    if (!url.trim())
      return;

    onUpdateBlock(
      block.id,
      {
        type: "image",
        imageUrl:
          url.trim(),
      }
    );
  };

  return (
    <div className="absolute left-0 top-full z-50 mt-2 w-[340px] rounded-2xl border bg-popover p-3 shadow-xl">
      <p className="mb-3 text-xs font-semibold">
        Image
      </p>

      <Input
        value={url}
        onChange={(e) =>
          setUrl(
            e.target.value
          )
        }
        placeholder="Paste image URL..."
        className="rounded-xl"
      />

      <Button
        onClick={submit}
        className="mt-2 w-full rounded-xl"
      >
        Insert image
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

function TableBlock({
  block,
  onUpdateCell,
  onAddRow,
  onAddColumn,
  onDelete,
}) {
  const rows =
    block.table?.rows || [];

  // Strip any residual markdown syntax from cell display values
  const cleanCell = (str) =>
    String(str || "")
      .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1");

  return (
    <div className="group relative my-4 overflow-x-auto rounded-2xl border">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {rows.map(
            (row, rowIndex) => (
              <tr
                key={rowIndex}
                className={
                  rowIndex === 0
                    ? "bg-muted/60"
                    : ""
                }
              >
                {row.map(
                  (
                    cell,
                    columnIndex
                  ) => (
                    <td
                      key={
                        columnIndex
                      }
                      className="min-w-[140px] border p-0"
                    >
                      <input
                        value={
                          cleanCell(cell)
                        }
                        onChange={(
                          e
                        ) =>
                          onUpdateCell(
                            block.id,
                            rowIndex,
                            columnIndex,
                            e.target
                              .value
                          )
                        }
                        className={cn(
                          "w-full bg-transparent px-3 py-2 outline-none",
                          rowIndex ===
                            0 &&
                            "font-semibold"
                        )}
                        placeholder={
                          rowIndex ===
                            0
                            ? "Header"
                            : "Cell"
                        }
                      />
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>

      <div className="flex items-center gap-2 border-t bg-muted/20 p-2">
        <button
          onClick={() =>
            onAddRow(
              block.id
            )
          }
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Rows3 className="h-3.5 w-3.5" />
          Add row
        </button>

        <button
          onClick={() =>
            onAddColumn(
              block.id
            )
          }
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Columns3 className="h-3.5 w-3.5" />
          Add column
        </button>

        <button
          onClick={onDelete}
          className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Image Block                                                                */
/* -------------------------------------------------------------------------- */

function ImageBlock({
  block,
  onUpdateBlock,
  onDelete,
}) {
  if (!block.imageUrl) {
    return null;
  }

  return (
    <div className="group relative my-4 overflow-hidden rounded-2xl border">
      <img
        src={block.imageUrl}
        alt=""
        className="max-h-[600px] w-full object-contain"
      />

      <button
        onClick={onDelete}
        className="absolute right-3 top-3 rounded-lg bg-black/60 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Save Status                                                                */
/* -------------------------------------------------------------------------- */

function SaveStatus({
  state,
}) {
  if (state === "saving") {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <Clock3 className="h-3.5 w-3.5 animate-pulse" />
        Saving...
      </span>
    );
  }

  if (
    state === "unsaved"
  ) {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Unsaved changes
      </span>
    );
  }

  if (state === "error") {
    return (
      <span className="hidden items-center gap-1.5 text-xs text-rose-500 sm:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        Save failed
      </span>
    );
  }

  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
      <Check className="h-3.5 w-3.5" />
      Saved
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail Row                                                                 */
/* -------------------------------------------------------------------------- */

function DetailRow({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          {label}
        </p>

        <p className="mt-0.5 truncate text-sm font-medium">
          {value}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Square Icon                                                                */
/* -------------------------------------------------------------------------- */

function SquareIcon() {
  return (
    <span className="block h-5 w-5 rounded-md border-2 border-muted-foreground/50" />
  );
}
