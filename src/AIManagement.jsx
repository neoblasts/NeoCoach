import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/libs/utils";
import { getAISettings, PROVIDERS } from "@/libs/aiProviders";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Cpu,
  Database,
  ExternalLink,
  Gauge,
  RefreshCw,
  Server,
  TriangleAlert,
  Zap,
} from "lucide-react";

const ORDER = ["gemini", "groq"];
const nf = new Intl.NumberFormat();
const fmt = (n) => nf.format(Number(n || 0));
const usd = (n) => `$${Number(n || 0).toFixed(5)}`;

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ProviderCard({ provider, data, configuredModel }) {
  const rate = data?.observedRateLimits;
  const modelRows = Object.entries(data?.models || {}).sort((a, b) => b[1].tokens - a[1].tokens);
  const healthy = data?.circuit !== "open" && !data?.lastErrorType;
  const rpdKnown = Number.isFinite(rate?.requestsPerDayRemaining);
  const tpmKnown = Number.isFinite(rate?.tokensPerMinuteRemaining);

  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-bold">{PROVIDERS[provider]?.name || provider}</h2>
            <p className="text-xs text-muted-foreground">{provider}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs">
          <span className={cn("h-2 w-2 rounded-full", healthy ? "bg-emerald-500" : "bg-amber-500")} />
          {data?.circuit === "open" ? "Temporarily unavailable" : healthy ? "Healthy" : "Needs attention"}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Server} label="Selected model" value={configuredModel || data?.model || "—"} />
        <Stat icon={Activity} label="Requests today" value={fmt(data?.requestsToday)} sub={`${fmt(data?.successToday)} success · ${fmt(data?.failuresToday)} failed`} />
        <Stat icon={Zap} label="Tokens today" value={fmt(data?.totalTokensToday)} sub={`${fmt(data?.inputTokensToday)} input · ${fmt(data?.outputTokensToday)} output`} />
        <Stat icon={CircleDollarSign} label="Estimated cost" value={usd(data?.estimatedCostUsdToday)} sub="Local estimate; billing is provider-authoritative" />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2 font-semibold text-sm"><Gauge className="h-4 w-4 text-primary" /> Provider quota signals</div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Daily requests remaining</span><b>{rpdKnown ? fmt(rate.requestsPerDayRemaining) : "Not exposed"}</b></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Tokens/minute remaining</span><b>{tpmKnown ? fmt(rate.tokensPerMinuteRemaining) : "Not exposed"}</b></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Daily token quota</span><b>Not invented</b></div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            LifeOS does not pretend a provider quota is 1M/1.5M/etc. If the API exposes rate-limit headers, LifeOS records them locally; otherwise it shows that the provider did not expose the value.
          </p>
        </div>

        <div className="rounded-2xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2 font-semibold text-sm"><Database className="h-4 w-4 text-primary" /> Local accounting</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-muted-foreground">All-time requests</span><div className="mt-1 font-semibold">{fmt(data?.requestsAllTime)}</div></div>
            <div><span className="text-muted-foreground">All-time tokens</span><div className="mt-1 font-semibold">{fmt(data?.tokensAllTime)}</div></div>
            <div><span className="text-muted-foreground">Quota errors</span><div className="mt-1 font-semibold">{fmt(data?.quotaErrorsAllTime)}</div></div>
            <div><span className="text-muted-foreground">Last latency</span><div className="mt-1 font-semibold">{data?.avgLatencyMs ? `${Math.round(data.avgLatencyMs)} ms avg` : "—"}</div></div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold text-sm"><BarChart3 className="h-4 w-4 text-primary" /> Models actually used</div>
          <span className="text-[11px] text-muted-foreground">No fake quota numbers</span>
        </div>
        {modelRows.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No requests recorded for this provider yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b text-muted-foreground"><tr><th className="pb-2 pr-4">Model</th><th className="pb-2 pr-4">Requests</th><th className="pb-2 pr-4">Tokens</th><th className="pb-2 pr-4">Cost</th><th className="pb-2">Latency</th></tr></thead>
              <tbody>
                {modelRows.map(([model, m]) => (
                  <tr key={model} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{model}</td>
                    <td className="py-2 pr-4">{fmt(m.requests)}</td>
                    <td className="py-2 pr-4">{fmt(m.tokens)}</td>
                    <td className="py-2 pr-4">{usd(m.cost)}</td>
                    <td className="py-2">{m.avgLatencyMs ? `${Math.round(m.avgLatencyMs)} ms` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data?.lastError && (
        <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs">
          <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <div><div className="font-medium">Latest provider error</div><div className="mt-1 break-words text-muted-foreground">{data.lastError}</div></div>
        </div>
      )}
    </section>
  );
}

export default function AIManagement() {
  const [metrics, setMetrics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [m, s] = await Promise.all([
        window.electronAPI?.ai?.getMetrics?.(),
        getAISettings(),
      ]);
      setMetrics(m || null);
      setSettings(s || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const providers = useMemo(() => ORDER.map((p) => [p, metrics?.providers?.[p]]), [metrics]);
  const active = settings?.provider && settings.provider !== "offline" ? settings.provider : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Management"
        subtitle="A local control center for providers, models, token usage, cost estimates, and quota signals."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/study-coach" className="rounded-xl border bg-card px-3 py-2 text-sm hover:bg-accent">Back to Study Coach</Link>
            <Button variant="outline" onClick={refresh} disabled={loading} className="gap-2 rounded-xl"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh</Button>
          </div>
        }
      />

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Active provider</div>
            <div className="mt-1 flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{active ? PROVIDERS[active]?.name || active : "Offline"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Active model</div>
            <div className="mt-1 font-semibold">{active ? settings?.models?.[active] || metrics?.providers?.[active]?.model || "—" : "—"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Today's local token usage</div>
            <div className="mt-1 font-semibold">{fmt(metrics?.tokensUsedToday)} tokens</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Estimated spend today</div>
            <div className="mt-1 font-semibold">{usd(metrics?.billing?.estimatedTodayUsd)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Activity} label="Requests today" value={fmt(metrics?.today?.requests)} sub={`${fmt(metrics?.today?.success)} successful`} />
        <Stat icon={Database} label="Tokens today" value={fmt(metrics?.tokensUsedToday)} sub="Tracked locally from each request" />
        <Stat icon={CircleDollarSign} label="Estimated spend" value={usd(metrics?.billing?.estimatedTodayUsd)} sub="Not provider billing" />
        <Stat icon={Clock3} label="Average latency" value={metrics?.providerStats ? `${Math.round(Object.values(metrics.providerStats).reduce((a, s) => a + Number(s.avgLatencyMs || 0), 0) / Math.max(1, Object.keys(metrics.providerStats).length))} ms` : "—"} sub="Across tracked providers" />
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <div className="flex gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /><div><b>Quota tracking is now honest.</b><p className="mt-1 text-muted-foreground">LifeOS no longer displays a fake 1,000,000-token daily budget. It tracks actual local token usage and stores any provider rate-limit headers that are actually returned. Some providers do not expose remaining daily token quota through their API, so the UI explicitly says “Not exposed” instead of guessing.</p></div></div>
      </div>

      {providers.map(([provider, data]) => (
        <ProviderCard key={provider} provider={provider} data={data || {}} configuredModel={settings?.models?.[provider]} />
      ))}

      <div className="rounded-2xl border bg-card p-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground"><ExternalLink className="h-4 w-4" /> What the numbers mean</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><b>Tokens today</b> = local accounting from provider-reported usage when available, otherwise a conservative character-based estimate.</li>
          <li><b>Estimated cost</b> = LifeOS's local pricing estimate, not an invoice.</li>
          <li><b>Quota signals</b> = only values actually exposed by the provider response; they are never fabricated.</li>
          <li><b>Models actually used</b> = the model attached to each completed request, so fallback traffic is visible instead of being hidden behind the currently selected model.</li>
        </ul>
      </div>
    </div>
  );
}
