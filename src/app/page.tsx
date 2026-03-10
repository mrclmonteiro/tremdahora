"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MetroStation = {
  code: string;
  name: string;
  minutesFromMercado: number;
};

type StatusInfo = {
  situation: string;
  reason: string;
  currentIntervalMinutes: number | null;
};

const POLL_MS = 30_000;

const STATIONS: MetroStation[] = [
  { code: "NH", name: "Novo Hamburgo", minutesFromMercado: 53 },
  { code: "FN", name: "Fenac", minutesFromMercado: 50 },
  { code: "IN", name: "Industrial / Tintas Killing", minutesFromMercado: 48 },
  { code: "SF", name: "Santo Afonso", minutesFromMercado: 46 },
  { code: "RS", name: "Rio dos Sinos", minutesFromMercado: 44 },
  { code: "SO", name: "São Leopoldo", minutesFromMercado: 41 },
  { code: "UN", name: "Unisinos", minutesFromMercado: 36 },
  { code: "SC", name: "Sapucaia", minutesFromMercado: 34 },
  { code: "LP", name: "Luiz Pasteur", minutesFromMercado: 31 },
  { code: "ES", name: "Esteio", minutesFromMercado: 28 },
  { code: "PB", name: "Petrobras", minutesFromMercado: 25 },
  { code: "SL", name: "São Luís / Ulbra", minutesFromMercado: 23 },
  { code: "MV", name: "Mathias Velho", minutesFromMercado: 21 },
  { code: "CN", name: "Canoas", minutesFromMercado: 19 },
  { code: "FT", name: "Fátima", minutesFromMercado: 16 },
  { code: "NT", name: "Niterói", minutesFromMercado: 13 },
  { code: "AN", name: "Anchieta", minutesFromMercado: 11 },
  { code: "AP", name: "Aeroporto", minutesFromMercado: 10 },
  { code: "FR", name: "Farrapos", minutesFromMercado: 7 },
  { code: "SP", name: "São Pedro", minutesFromMercado: 4 },
  { code: "RD", name: "Rodoviária", minutesFromMercado: 2 },
  { code: "MR", name: "Mercado", minutesFromMercado: 0 },
];

function firstString(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = firstString(item);
      if (candidate) return candidate;
    }
  }

  if (value && typeof value === "object") {
    for (const objectValue of Object.values(value)) {
      const candidate = firstString(objectValue);
      if (candidate) return candidate;
    }
  }

  return "";
}

function firstNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = firstNumber(item);
      if (candidate !== null) return candidate;
    }
  }

  if (value && typeof value === "object") {
    for (const objectValue of Object.values(value)) {
      const candidate = firstNumber(objectValue);
      if (candidate !== null) return candidate;
    }
  }

  return null;
}

function extractStatus(payload: unknown): StatusInfo {
  const fallback: StatusInfo = {
    situation: "Sem dados",
    reason: "Não foi possível obter o status operacional.",
    currentIntervalMinutes: null,
  };
  if (!payload || typeof payload !== "object") return fallback;
  const op = (payload as Record<string, unknown>).operacional as Record<string, unknown> | undefined;
  if (!op) return fallback;
  return {
    situation: String(op["descricao-situacao-operacional"] ?? fallback.situation),
    reason: String(op["motivo"] ?? "Operação sem observações no momento."),
    currentIntervalMinutes: typeof op["intervalo-entre-trens"] === "number" ? op["intervalo-entre-trens"] : null,
  };
}
}

export default function Home() {
  const [status, setStatus] = useState<StatusInfo>({
    situation: "Carregando...",
    reason: "Consultando operação da linha.",
    currentIntervalMinutes: null,
  });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sortedStations = useMemo(
    () => [...STATIONS].sort((a, b) => b.minutesFromMercado - a.minutesFromMercado),
    []
  );

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Falha HTTP ${response.status}`);
      }

      const data = (await response.json()) as unknown;
      setStatus(extractStatus(data));
      setLastUpdate(new Date());
    } catch {
      setStatus({
        situation: "Indisponível",
        reason: "Não foi possível atualizar o status operacional agora.",
        currentIntervalMinutes: null,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const timer = window.setInterval(loadStatus, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 py-8 text-white sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(48,84,255,0.28),transparent_35%),radial-gradient(circle_at_80%_18%,rgba(0,194,255,0.2),transparent_28%),radial-gradient(circle_at_50%_110%,rgba(170,170,170,0.12),transparent_45%)]" />

      <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-[0_12px_48px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/60">Status operacional</p>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Trem da Hora</h1>
            </div>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/75">
              {isLoading ? "Atualizando" : "Online"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">Situação</p>
              <p className="mt-2 text-lg font-medium text-white">{status.situation}</p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">Motivo</p>
              <p className="mt-2 text-sm leading-relaxed text-white/85">{status.reason}</p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-black/30 p-4 sm:col-span-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">Intervalo atual</p>
              <p className="mt-2 text-sm text-white/90">
                {status.currentIntervalMinutes !== null
                  ? `${status.currentIntervalMinutes} min`
                  : "Sem informação de intervalo"}
              </p>
            </article>
          </div>

          <p className="mt-4 text-xs text-white/45">
            Última atualização:{" "}
            {lastUpdate ? lastUpdate.toLocaleTimeString("pt-BR") : "aguardando primeira leitura"}
          </p>
        </section>

        <section className="rounded-3xl border border-white/15 bg-white/8 p-5 shadow-[0_12px_48px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-6">
          <header className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">Linha Trensurb</h2>
            <p className="mt-1 text-sm text-white/60">Novo Hamburgo → Mercado</p>
          </header>

          <div className="relative mx-auto max-w-2xl pb-2 pt-1">
            <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-gradient-to-b from-cyan-200/50 via-cyan-100/70 to-cyan-200/50" />

            {/* TODO: Renderizar os trens em tempo real sobre a linha vertical. */}

            <ul className="space-y-3">
              {sortedStations.map(station => (
                <li key={station.code} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-white/90">{station.name}</p>
                  </div>

                  <div className="relative flex h-7 w-7 items-center justify-center rounded-full border border-cyan-100/60 bg-cyan-200/20 backdrop-blur-sm">
                    <span className="h-2 w-2 rounded-full bg-cyan-100" />
                  </div>

                  <p className="text-xs text-white/55">{station.minutesFromMercado} min</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

