import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { localClient } from "@/api/localStorageClient";
import { useEntityList } from "@/hooks/useEntity";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/libs/utils";
import { sortCardsByPriority } from "@/libs/mastery";
import CardReview from "@/components/learn/CardReview";
import QuizReview from "@/components/learn/QuizReview";
import CardGenerator from "@/components/learn/CardGenerator";
import TeachMeDialog from "@/components/learn/TeachMeDialog";
import CuriosityExplorer from "@/components/learn/CuriosityExplorer";
import { Layers, HelpCircle, Plus, Sparkles } from "lucide-react";

const TABS = [
  { value: "cards", label: "Cards", icon: Layers },
  { value: "quiz", label: "Quiz", icon: HelpCircle },
];

export default function Learn() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "quiz" ? "quiz" : "cards";
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const qTab = searchParams.get("tab");
    if (qTab && (qTab === "quiz" || qTab === "cards") && qTab !== tab) {
      setTab(qTab);
    }
  }, [searchParams]);

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setSearchParams({ tab: newTab });
  };
  const [subjectFilter, setSubjectFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [teachCard, setTeachCard] = useState(null);
  const [exploreCard, setExploreCard] = useState(null);

  const { data: subjects } = useEntityList(() => localClient.entities.Subject.list());
  const { data: topics, reload: reloadTopics } = useEntityList(() => localClient.entities.Topic.list());
  const { data: cards, loading: cardsLoading, reload: reloadCards } = useEntityList(
    () => localClient.entities.LearningCard.list("-created_date", 200)
  );
  const { data: events, reload: reloadEvents } = useEntityList(
    () => localClient.entities.LearningEvent.list("-created_date", 500)
  );
  const { data: notes } = useEntityList(() => localClient.entities.Note.list());
  const { data: assignments } = useEntityList(() => localClient.entities.Assignment.list());

  const filteredTopics = subjectFilter ? topics.filter((t) => t.subject_id === subjectFilter) : [];

  const filteredCards = useMemo(() => {
    let result = cards;
    if (subjectFilter) result = result.filter((c) => c.subject_id === subjectFilter);
    if (topicFilter) result = result.filter((c) => c.topic_id === topicFilter);
    return sortCardsByPriority(result, events);
  }, [cards, subjectFilter, topicFilter]);

  const handleRate = () => {
    reloadEvents();
  };

  const handleGenerated = () => {
    reloadCards();
    reloadEvents();
  };

  const handleSessionChanged = () => {
    reloadCards();
    reloadEvents();
  };

  return (
    <div>
      <PageHeader
        title="Adaptive Learning"
        subtitle="NeoCoach learns how you learn — cards, theory revision, practice quizzes, and AI tutoring."
        actions={
          <Button onClick={() => setGeneratorOpen(true)} className="gap-1.5 rounded-full">
            <Plus className="h-4 w-4" /> Generate cards
          </Button>
        }
      />

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => handleTabChange(t.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                active ? "border border-primary/25 bg-primary/18 text-primary shadow-[0_10px_28px_rgba(32,199,201,0.14)]" : "lifeos-pill"
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Cards tab */}
      {tab === "cards" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={subjectFilter}
              onChange={(e) => { setSubjectFilter(e.target.value); setTopicFilter(""); }}
              className="flex h-9 rounded-md border border-input bg-secondary/35 px-3 py-1 text-sm text-foreground outline-none transition hover:border-primary/25 focus:border-ring"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {subjectFilter && (
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-secondary/35 px-3 py-1 text-sm text-foreground outline-none transition hover:border-primary/25 focus:border-ring"
              >
                <option value="">All topics</option>
                {filteredTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <span className="ml-auto text-sm text-muted-foreground">
              {filteredCards.length} card{filteredCards.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Card review */}
          {cardsLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          ) : filteredCards.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No cards yet"
              description="Generate learning cards from your notes, assignments, or any topic to start studying."
              action={
                <Button onClick={() => setGeneratorOpen(true)} className="gap-1.5 rounded-full">
                  <Sparkles className="h-4 w-4" /> Generate cards
                </Button>
              }
            />
          ) : (
            <CardReview
              cards={filteredCards}
              onRate={handleRate}
              onTeachMe={(card) => setTeachCard(card)}
              onExplore={(card) => setExploreCard(card)}
              onSessionChanged={handleSessionChanged}
            />
          )}
        </div>
      )}

      {/* Quiz tab */}
      {tab === "quiz" && (
        <QuizReview onQuizFinished={() => setTab("cards")} />
      )}

      {/* Dialogs */}
      <CardGenerator
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        onGenerated={handleGenerated}
        subjects={subjects}
        topics={topics}
        assignments={assignments}
        notes={notes}
      />
      <TeachMeDialog
        open={!!teachCard}
        onOpenChange={(v) => !v && setTeachCard(null)}
        card={teachCard}
      />
      <CuriosityExplorer
        open={!!exploreCard}
        onOpenChange={(v) => !v && setExploreCard(null)}
        card={exploreCard}
      />
    </div>
  );
}
