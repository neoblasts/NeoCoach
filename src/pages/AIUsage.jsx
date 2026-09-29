import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/libs/utils";
import { Activity, BarChart3, Brain, CircleDollarSign, Cpu, Database, Gauge, RefreshCw, Server, TriangleAlert, Zap } from "lucide-react";

const labels = { gemini: "Google Gemini", groq: "Groq" };
const fmt = (n) => new Intl.NumberFormat().format(Number(n || 0));
const usd = (n) => `$${Number(n || 0).toFixed(4)}`;
const ago = (ts) => !ts ? "—" : `${Math.max(0, Math.round((Date.now() - Number(ts)) / 1000))}s ago`;

function Stat({ icon: Icon, label, value, sub }) {
  return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4" />{label}</div><div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>{sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}</div>;
}

function ProviderCard({ provider, data }) {
  const used = data.totalTokensToday || 0;
  const budget = data.dailyTokenBudget;
  const remaining = data.tokensRemainingToday;
  const pct = budget ? Math.min(100, (used / budget) * 100) : 0;
  const health = data.circuit === "closed" && !data.lastErrorType ? "Healthy" : data.circuit === "open" ? "Circuit open" : data.lastErrorType ? `Last error: ${data.lastErrorType}` : "Ready";
  return <section className="rounded-3xl border bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Cpu className="h-5 w-5" /></div><div><h2 className="font-bold">{data.providerName || labels[provider] || provider}</h2><p className="text-xs text-muted-foreground">{provider}</p></div></div></div>
      <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"><span className={cn("h-2 w-2 rounded-full", data.circuit === "open" ? "bg-rose-500" : data.lastErrorType ? "bg-amber-500" : "bg-emerald-500")} />{health}</div>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat icon={Server} label="Current model" value={data.model || "—"} />
      <Stat icon={BarChart3} label="Requests today" value={fmt(data.requestsToday)} sub={`${fmt(data.successToday)} successful · ${fmt(data.failuresToday)} failed`} />
      <Stat icon={Zap} label="Tokens today" value={fmt(used)} sub={`${fmt(data.inputTokensToday)} input · ${fmt(data.outputTokensToday)} output`} />
      <Stat icon={CircleDollarSign} label="Estimated cost" value={usd(data.estimatedCostUsdToday)} sub="Provider billing is authoritative" />
    </div>
    <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
      <div className="flex items-center justify-between text-xs"><span className="font-medium">Daily token budget</span><span>{budget ? `${fmt(used)} / ${fmt(budget)}` : "No NeoCoach budget configured"}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>{budget ? `${fmt(remaining)} estimated tokens remaining` : "Provider quota not exposed by API"}</span><span>{budget ? `${pct.toFixed(1)}% used` : "—"}</span></div>
    </div>
    <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
      <div className="rounded-xl border p-3"><span className="text-muted-foreground">Latency</span><div className="mt-1 font-semibold">{data.avgLatencyMs ? `${Math.round(data.avgLatencyMs)} ms` : "—"}</div></div>
      <div className="rounded-xl border p-3"><span className="text-muted-foreground">Last request</span><div className="mt-1 font-semibold">{ago(data.lastRequestAt)}</div></div>
      <div className="rounded-xl border p-3"><span className="text-muted-foreground">Vision</span><div className="mt-1 font-semibold">{data.visionCapable ? "Supported" : "Not configured"}</div></div>
    </div>
    {data.lastError && <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs"><TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" /><div><div className="font-medium">Latest provider error</div><div className="mt-1 break-words text-muted-foreground">{data.lastError}</div></div></div>}
  </section>;
}

export default function AIUsage() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { setLoading(true); try { const m = await window.electronAPI?.ai?.getMetrics?.(); if (m) setMetrics(m); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return () => clearInterval(id); }, [refresh]);
  const providers = useMemo(() => Object.entries(metrics?.providers || {}), [metrics]);
  return <div className="space-y-5">
    <PageHeader title="AI Usage & API Center" subtitle="See which providers and models NeoCoach is using, token usage, estimated cost, health, and vision capability." actions={<button onClick={refresh} disabled={loading} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm hover:bg-accent disabled:opacity-50"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh</button>} />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Stat icon={Activity} label="Requests today" value={fmt(metrics?.today?.requests)} sub={`${fmt(metrics?.today?.success)} successful`} />
      <Stat icon={Database} label="Tokens used" value={fmt(metrics?.tokensUsedToday)} sub={metrics?.tokensRemainingToday != null ? `${fmt(metrics.tokensRemainingToday)} NeoCoach budget remaining` : "Provider quota unavailable"} />
      <Stat icon={CircleDollarSign} label="Estimated spend" value={usd(metrics?.billing?.estimatedTodayUsd)} sub="USD · estimated" />
      <Stat icon={Gauge} label="Cache entries" value={fmt(metrics?.cacheEntries)} sub={`${fmt(metrics?.inflight)} requests in flight`} />
    </div>
    <div className="rounded-2xl border bg-muted/20 p-4 text-xs text-muted-foreground"><div className="flex gap-2"><Brain className="h-4 w-4 shrink-0 text-primary" /><span>Token and cost figures are based on provider-reported usage when available, otherwise NeoCoach estimates them. Actual billing and provider quotas remain authoritative.</span></div></div>
    <div className="space-y-4">{providers.map(([provider, data]) => <ProviderCard key={provider} provider={provider} data={{...data, avgLatencyMs: metrics?.providers?.[provider]?.avgLatencyMs || 0, dailyTokenBudget: metrics?.dailyTokenBudget, tokensRemainingToday: metrics?.tokensRemainingToday}} />)}</div>
  </div>;
}
