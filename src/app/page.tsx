"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

type TrainDirection = "southbound" | "northbound";

type TrainPosition = {
  id: string;
  direction: TrainDirection;
  topPercent: number;
};

const POLL_MS = 30_000;
const TRAIN_TICK_MS = 10_000;
const DEFAULT_HEADWAY_MINUTES = 12;
const SERVICE_START_MINUTES = 5 * 60;
const ONE_WAY_TRAVEL_MINUTES = 53;
const TERMINAL_DWELL_MINUTES = 5;
const CYCLE_MINUTES = 116;

const STATIONS: MetroStation[] = [
  { code: "NH", name: "Novo Hamburgo", minutesFromMercado: 53 },
  { code: "FN", name: "Fenac", minutesFromMercado: 50 },
  { code: "IN", name: "Industrial", minutesFromMercado: 48 },
  { code: "SF", name: "Santo Afonso", minutesFromMercado: 46 },
  { code: "RS", name: "Rio dos Sinos", minutesFromMercado: 44 },
  { code: "SO", name: "São Leopoldo", minutesFromMercado: 41 },
  { code: "UN", name: "Unisinos", minutesFromMercado: 36 },
  { code: "SC", name: "Sapucaia", minutesFromMercado: 34 },
  { code: "LP", name: "Luiz Pasteur", minutesFromMercado: 31 },
  { code: "ES", name: "Esteio", minutesFromMercado: 28 },
  { code: "PB", name: "Petrobras", minutesFromMercado: 25 },
  { code: "SL", name: "São Luís", minutesFromMercado: 23 },
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

type StationConnection = {
  label: string;
  color: string;
};

const CONNECTIONS: Record<string, StationConnection> = {
  AP: { label: "Aeromóvel", color: "#34C759" },
  MR: { label: "Terminal Hidroviário", color: "#5AC8FA" },
};

type CitySection = {
  city: string;
  codes: string[];
  labelLines?: string[];
};

const CITY_SECTIONS: CitySection[] = [
  { city: "Novo Hamburgo", codes: ["NH", "FN", "IN"] },
  { city: "São Leopoldo", codes: ["SF", "RS", "SO", "UN"] },
  { city: "Sapucaia do Sul", codes: ["SC", "LP"], labelLines: ["Sapucaia", "do Sul"] },
  { city: "Esteio", codes: ["ES"] },
  { city: "Canoas", codes: ["PB", "SL", "MV", "CN", "FT"] },
  { city: "Porto Alegre", codes: ["NT", "AN", "AP", "FR", "SP", "RD", "MR"] },
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

export default function Home() {
  const [status, setStatus] = useState<StatusInfo>({
    situation: "Carregando...",
    reason: "Consultando operação da linha.",
    currentIntervalMinutes: null,
  });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [headerVisible, setHeaderVisible] = useState(true);

  useEffect(() => {
    function onScroll() {
      setHeaderVisible(window.scrollY < 24);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => { setNow(new Date()); }, []);

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, TRAIN_TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  const trainPositions = useMemo<TrainPosition[]>(() => {
    const headway = Math.max(1, Math.round(status.currentIntervalMinutes ?? DEFAULT_HEADWAY_MINUTES));
    if (!now) return [];
    const minutesNow = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const elapsedSinceStart = minutesNow - SERVICE_START_MINUTES;

    if (elapsedSinceStart < 0) return [];

    const firstDeparture = Math.floor((elapsedSinceStart - CYCLE_MINUTES) / headway);
    const lastDeparture = Math.floor(elapsedSinceStart / headway);
    const positions: TrainPosition[] = [];

    for (let departureIndex = firstDeparture; departureIndex <= lastDeparture; departureIndex += 1) {
      const elapsed = elapsedSinceStart - departureIndex * headway;

      if (elapsed < 0 || elapsed > CYCLE_MINUTES) continue;

      if (elapsed <= ONE_WAY_TRAVEL_MINUTES) {
        const progress = elapsed / ONE_WAY_TRAVEL_MINUTES;
        positions.push({
          id: `s-${departureIndex}`,
          direction: "southbound",
          topPercent: progress * 100,
        });
        continue;
      }

      if (elapsed <= ONE_WAY_TRAVEL_MINUTES + TERMINAL_DWELL_MINUTES) {
        positions.push({
          id: `m-${departureIndex}`,
          direction: "southbound",
          topPercent: 100,
        });
        continue;
      }

      if (elapsed <= ONE_WAY_TRAVEL_MINUTES + TERMINAL_DWELL_MINUTES + ONE_WAY_TRAVEL_MINUTES) {
        const progressFromMercado =
          (elapsed - (ONE_WAY_TRAVEL_MINUTES + TERMINAL_DWELL_MINUTES)) / ONE_WAY_TRAVEL_MINUTES;
        positions.push({
          id: `n-${departureIndex}`,
          direction: "northbound",
          topPercent: (1 - progressFromMercado) * 100,
        });
        continue;
      }

      positions.push({
        id: `h-${departureIndex}`,
        direction: "northbound",
        topPercent: 0,
      });
    }

    return positions;
  }, [now, status.currentIntervalMinutes]);

  const modalRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState<"hidden" | "open" | "resting">("hidden");
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setModalOpen("open"), 400);
    const t2 = setTimeout(() => setModalOpen("resting"), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const isDragging = dragStart !== null;

  function handleModalDragStart(e: React.TouchEvent | React.MouseEvent) {
    setDragOffset(0);
    setDragStart("touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY);
  }
  function handleModalDragMove(e: React.TouchEvent | React.MouseEvent) {
    if (dragStart === null) return;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDragOffset(dragStart - clientY);
  }
  function handleModalDragEnd() {
    if (dragOffset > 60) setModalOpen("open");
    else if (dragOffset < -40) setModalOpen("resting");
    setDragStart(null);
    setDragOffset(0);
  }

  return (
    <main
      suppressHydrationWarning
      className="relative min-h-[100dvh] w-full overflow-hidden bg-transparent text-slate-900"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      {/* Header fixo estilo goes-to */}
      {/* Header fixo padrão goes-to */}
      <div
        style={{
          position: "fixed",
          left: 16,
          top: "max(env(safe-area-inset-top), 52px)",
          zIndex: 20,
          pointerEvents: "none",
          width: "100vw",
          opacity: headerVisible ? 1 : 0,
          transition: "opacity 0.35s ease",
        }}
      >
        <h1
          className="text-3xl font-bold leading-tight"
          style={{
            color: "#1C1C1E",
            margin: 0,
            textAlign: "left",
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            textShadow: "0 1px 12px rgba(255,255,255,0.10)",
          }}
        >
          Mapa da linha
        </h1>
        <p
          className="text-sm mt-1"
          style={{
            color: "rgba(60,60,67,0.45)",
            margin: 0,
            textAlign: "left",
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          Novo Hamburgo ↔ Mercado
        </p>
      </div>

      {/* Mapa da linha ocupa a tela toda */}
      <div
        className="relative flex flex-col items-center justify-center select-none pointer-events-none z-0 px-3 pb-32 w-full min-h-[100dvh]"
        style={{
          boxSizing: "border-box",
          paddingTop: "calc(max(env(safe-area-inset-top), 52px) + 3.5em)",
        }}
      >
        {/* --- MAPA DA LINHA --- */}
        <section className="relative w-full max-w-2xl">
          <div className="relative mx-auto">
            {/* Linha principal azul Trensurb */}
            <div
              className="pointer-events-none absolute bottom-0 left-1/2 top-0 -translate-x-1/2 rounded-full"
              style={{ width: 6, backgroundColor: "#007AFF", zIndex: 1 }}
            />
            {/* Marcadores de posição dos trens */}
            {trainPositions.map(train => (
              <img
                key={train.id}
                src={train.direction === "southbound" ? "/assets/trem-sul.png" : "/assets/trem-norte.png"}
                alt={train.direction === "southbound" ? "Trem sentido sul" : "Trem sentido norte"}
                className="pointer-events-none absolute left-1/2"
                style={{
                  top: `${train.topPercent}%`,
                  width: "12px",
                  transform: "translateX(-50%) translateY(-50%)",
                  zIndex: 30,
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
                }}
              />
            ))}
            {CITY_SECTIONS.map((section, sectionIndex) => (
              <div
                key={section.city}
                className="relative"
                style={{
                  zIndex: 5,
                  borderTop: sectionIndex > 0 ? "1px solid rgba(60,60,67,0.1)" : undefined,
                }}
              >
                {/* Label da cidade — vertical, lado esquerdo */}
                <div
                  className="pointer-events-none absolute bottom-0 left-0 top-0 flex items-center justify-center"
                  style={{ width: 24 }}
                >
                  <span
                    style={{
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      textAlign: "center",
                      color: "rgba(60,60,67,0.35)",
                    }}
                  >
                    {section.labelLines
                      ? section.labelLines.map((line, i, arr) => (
                          <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                        ))
                      : section.city}
                  </span>
                </div>
                {/* Estações */}
                <ul>
                  {section.codes.map(code => {
                    const station = STATIONS.find(s => s.code === code)!;
                    const conn = CONNECTIONS[code];
                    return (
                      <li key={code} className="grid grid-cols-[1fr_32px_1fr] items-center">
                        {/* Nome + conexão */}
                        <div className="flex flex-col items-end py-3 pl-7 pr-3">
                          <p className="text-[12px] font-medium leading-snug" style={{ color: "#1C1C1E" }}>
                            {station.name}
                          </p>
                          {conn && (
                            <span className="mt-0.5 text-[10px] font-semibold" style={{ color: conn.color }}>
                              {conn.label}
                            </span>
                          )}
                        </div>
                        {/* Bolinha da estação */}
                        <div className="flex items-center justify-center">
                          <div
                            className="rounded-full"
                            style={{
                              width: 14,
                              height: 14,
                              backgroundColor: "#FF3B30",
                              boxShadow: "0 0 0 2.5px #f5f7fb, 0 0 0 4px rgba(255,59,48,0.22)",
                              position: "relative",
                              zIndex: 10,
                            }}
                          />
                        </div>
                        {/* Minutos */}
                        <div className="py-3 pl-3">
                          <p className="text-xs" style={{ color: "rgba(60,60,67,0.5)" }}>
                            {station.minutesFromMercado === 0 ? "Terminal" : `${station.minutesFromMercado} min`}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {/* Legenda de sentido */}
          <div
            className="mt-6 flex items-center justify-center gap-6 text-xs"
            style={{ color: "rgba(60,60,67,0.6)" }}
          >
            <span className="inline-flex items-center gap-2">
              <span style={{ display: "inline-block", height: 40, width: 40, flexShrink: 0 }}>
                <img src="/assets/trem-sul.png" alt="" aria-hidden="true" style={{ height: 40, width: 40, objectFit: "contain", transform: "rotate(90deg)" }} />
              </span>
              Sentido Sul
            </span>
            <span className="inline-flex items-center gap-2">
              <span style={{ display: "inline-block", height: 40, width: 40, flexShrink: 0 }}>
                <img src="/assets/trem-norte.png" alt="" aria-hidden="true" style={{ height: 40, width: 40, objectFit: "contain", transform: "rotate(90deg)" }} />
              </span>
              Sentido Norte
            </span>
          </div>
        </section>
      </div>

      {/* Bottom modal fixo, estilo goes-to */}
      <div
        ref={modalRef}
        className="fixed left-0 right-0 bottom-0 z-50"
        style={{
          transform: isDragging
            ? `translateY(${-dragOffset}px) translateY(82vh)`
            : modalOpen === "hidden"
              ? "translateY(100vh)"
              : modalOpen === "open"
                ? "translateY(55vh)"
                : "translateY(82vh)",
          transition: isDragging ? "none" : "transform 0.7s cubic-bezier(0.68, -0.55, 0.27, 1.55)",
          touchAction: "none",
        }}
      >
        <div className="mx-auto mb-2 mt-2 flex h-1.5 w-10 items-center justify-center rounded-full bg-slate-300/80 shadow-sm" />
        <section className="rounded-t-3xl rounded-b-xl p-5 pb-8 backdrop-blur-xl border border-slate-200 shadow-[0_8px_32px_0_rgba(60,60,67,0.12)] bg-white/80" style={{ boxShadow: "0 8px 32px 0 rgba(60,60,67,0.12), 0 1.5px 0 0 #e5e7eb" }}>
          {/* --- STATUS, MOTIVO, INTERVALO, ETC --- */}
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-600">Status operacional</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Trem da Hora</h1>
            </div>
            <span className="rounded-full border border-slate-300 bg-white/70 px-3 py-1 text-xs text-slate-700">
              {isLoading ? "Atualizando" : "Online"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="card rounded-2xl bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Situação</p>
              <p className="mt-2 text-lg font-medium text-slate-900">{status.situation}</p>
            </article>
            <article className="card rounded-2xl bg-white/80 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Motivo</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{status.reason}</p>
            </article>
            <article className="card rounded-2xl bg-white/80 p-4 sm:col-span-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Intervalo atual</p>
              <p className="mt-2 text-sm text-slate-800">
                {status.currentIntervalMinutes !== null
                  ? `${status.currentIntervalMinutes} min`
                  : "Sem informação de intervalo"}
              </p>
            </article>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Última atualização: {lastUpdate ? lastUpdate.toLocaleTimeString("pt-BR") : "aguardando primeira leitura"}
          </p>
        </section>
      </div>
    </main>
  );
}
