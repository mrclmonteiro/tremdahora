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
  intervalNHtoMercado: number | null;
  intervalMercadotoNH: number | null;
  trechos: { estacao1: string; estacao2: string }[];
  aeromovel: { situation: string; reason: string } | null;
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
  sublabel?: string;
  color: string;
  integrated?: boolean;
};

const CONNECTIONS: Record<string, StationConnection> = {
  AP: { label: "Aeromóvel", sublabel: "Salgado Filho", color: "#34C759", integrated: true },
  MR: { label: "Terminal Hidroviário", color: "#5AC8FA", integrated: false },
};

type CitySection = {
  city: string;
  codes: string[];
  labelLines?: string[];
  paddingY?: number;
};

const CITY_SECTIONS: CitySection[] = [
  { city: "Novo Hamburgo", codes: ["NH", "FN", "IN"] },
  { city: "São Leopoldo", codes: ["SF", "RS", "SO", "UN"] },
  { city: "Sapucaia do Sul", codes: ["SC", "LP"], labelLines: ["Sapucaia", "do Sul"] },
  { city: "Esteio", codes: ["ES"], paddingY: 8 },
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
    intervalNHtoMercado: null,
    intervalMercadotoNH: null,
    trechos: [],
    aeromovel: null,
  };

  if (!payload || typeof payload !== "object") return fallback;
  const data = payload as Record<string, unknown>;
  const op = data.operacional as Record<string, unknown> | undefined;
  if (!op) return fallback;

  const aeroRaw = data.aeromovel as Record<string, unknown> | undefined;
  const aeromovel = aeroRaw ? {
    situation: String(aeroRaw["descricao-situacao-operacional"] ?? "Sem dados"),
    reason: (() => { const s = String(aeroRaw["motivo"] ?? ""); return s.charAt(0).toUpperCase() + s.slice(1); })(),
  } : null;

  const trechos = Array.isArray(op["trechos"])
    ? (op["trechos"] as { estacao1: string; estacao2: string }[])
    : [];

  const intervalos = Array.isArray(op["intervalos"]) ? op["intervalos"] as {"intervalo": number; "estacao-partida": string}[] : [];
  const ivNH = intervalos.find(i => i["estacao-partida"] === "Novo Hamburgo")?.intervalo ?? null;
  const ivMR = intervalos.find(i => i["estacao-partida"] === "Mercado")?.intervalo ?? null;

  return {
    situation: String(op["descricao-situacao-operacional"] ?? fallback.situation),
    reason: (() => { const s = String(op["motivo"] ?? "Operação sem observações no momento."); return s.charAt(0).toUpperCase() + s.slice(1); })(),
    currentIntervalMinutes: typeof op["intervalo-entre-trens"] === "number" ? op["intervalo-entre-trens"] : null,
    intervalNHtoMercado: ivNH,
    intervalMercadotoNH: ivMR,
    trechos,
    aeromovel,
  };
}

function isStationAffected(code: string, trechos: { estacao1: string; estacao2: string }[] | undefined): boolean {
  if (!trechos || trechos.length === 0) return false;
  return trechos.some(({ estacao1, estacao2 }) => {
    const s1 = STATIONS.find(s => s.name === estacao1);
    const s2 = STATIONS.find(s => s.name === estacao2);
    if (!s1 || !s2) return false;
    const minMin = Math.min(s1.minutesFromMercado, s2.minutesFromMercado);
    const maxMin = Math.max(s1.minutesFromMercado, s2.minutesFromMercado);
    const station = STATIONS.find(s => s.code === code);
    if (!station) return false;
    return station.minutesFromMercado >= minMin && station.minutesFromMercado <= maxMin;
  });
}

export default function Home() {
  const [status, setStatus] = useState<StatusInfo>({
    situation: "Carregando...",
    reason: "Consultando operação da linha.",
    currentIntervalMinutes: null,
    intervalNHtoMercado: null,
    intervalMercadotoNH: null,
    trechos: [],
    aeromovel: null,
  });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [distanceFrom, setDistanceFrom] = useState<"mercado" | "nh">("mercado");
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
        intervalNHtoMercado: null,
        intervalMercadotoNH: null,
        trechos: [],
        aeromovel: null,
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
  const [modalOpen, setModalOpen] = useState<"hidden" | "peek" | "open" | "resting">("hidden");
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragOffsetRef = useRef(0);
  const dragBaseRef = useRef(0);

  useEffect(() => {
    const t1 = setTimeout(() => setModalOpen("peek"), 400);
    const t2 = setTimeout(() => setModalOpen("resting"), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    function onMove(e: TouchEvent | MouseEvent) {
      if (dragStart === null) return;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const raw = dragStart - clientY;
      const maxOffset = modalRef.current ? modalRef.current.offsetHeight - 56 : 999;
      const offset = Math.min(raw, maxOffset);
    dragOffsetRef.current = offset;
    setDragOffset(offset);
    }
    function onEnd() {
      if (dragStart === null) return;
      handleModalDragEnd();
    }
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("mousemove", onMove as EventListener);
    window.addEventListener("mouseup", onEnd);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("mousemove", onMove as EventListener);
      window.removeEventListener("mouseup", onEnd);
    };
  }, [dragStart]);

  const isDragging = dragStart !== null;

  function handleModalDragStart(e: React.TouchEvent | React.MouseEvent) {
    const modalH = modalRef.current?.offsetHeight ?? 0;
    const windowH = window.innerHeight;
    // posição atual do topo do modal em px a partir do topo da tela
    const currentTop = modalOpen === "open" ? windowH - modalH : windowH - 56;
    dragBaseRef.current = windowH - currentTop; // quanto do modal está visível
    setDragOffset(0);
    setDragStart("touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY);
  }
  function handleModalDragMove(e: React.TouchEvent | React.MouseEvent) {
    if (dragStart === null) return;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const offset = dragStart - clientY;
    dragOffsetRef.current = offset;
    setDragOffset(offset);
  }
  function handleModalDragEnd() {
    if (dragOffsetRef.current > 60) setModalOpen("open");
    else if (dragOffsetRef.current < -40) setModalOpen("resting");
    setDragStart(null);
    setDragOffset(0);
  }

  return (
    <main
      suppressHydrationWarning
      className="relative min-h-[100dvh] w-full bg-transparent text-slate-900"
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
          left: 0,
          right: 0,
          top: 0,
          zIndex: 20,
          paddingTop: "max(env(safe-area-inset-top), 48px)",
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: 12,
          background: "rgba(245,247,251,0.75)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          opacity: headerVisible ? 1 : 0,
          transform: headerVisible ? "translateY(0)" : "translateY(-8px)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
          pointerEvents: headerVisible ? "auto" : "none",
        }}
      >
        <div
          className="p-1 flex items-center rounded-full w-full"
          style={{ background: "rgba(60,60,67,0.10)", cursor: "pointer" }}
          onClick={() => setDistanceFrom(d => d === "mercado" ? "nh" : "mercado")}
        >
          <span className="flex-1 text-center text-sm py-2 font-semibold rounded-full transition-all" style={{ background: distanceFrom === "mercado" ? "rgba(255,255,255,0.95)" : "transparent", color: distanceFrom === "mercado" ? "#1C1C1E" : "rgba(60,60,67,0.45)", boxShadow: distanceFrom === "mercado" ? "0 1px 6px rgba(0,0,0,0.10)" : "none" }}>↓ Mercado</span>
          <span className="flex-1 text-center text-sm py-2 font-semibold rounded-full transition-all" style={{ background: distanceFrom === "nh" ? "rgba(255,255,255,0.95)" : "transparent", color: distanceFrom === "nh" ? "#1C1C1E" : "rgba(60,60,67,0.45)", boxShadow: distanceFrom === "nh" ? "0 1px 6px rgba(0,0,0,0.10)" : "none" }}>↑ Novo Hamburgo</span>
        </div>
      </div>

      {/* Mapa da linha ocupa a tela toda */}
      <div
        className="relative flex flex-col items-center justify-center select-none pointer-events-none z-0 px-3 pb-32 w-full min-h-[100dvh]"
        style={{
          boxSizing: "border-box",
          paddingTop: "calc(max(env(safe-area-inset-top), 48px) + 72px)",
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
                  paddingTop: section.paddingY,
                  paddingBottom: section.paddingY,
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

                        </div>
                        {/* Bolinha da estação */}
                        <div className="flex items-center justify-center">
                          <div
                            className="rounded-full"
                            style={{
                              width: 14,
                              height: 14,
                              backgroundColor: isStationAffected(code, status.trechos) ? "#FF9500" : "#FF3B30",
                              boxShadow: isStationAffected(code, status.trechos)
                                ? "0 0 0 2.5px #f5f7fb, 0 0 0 4px rgba(255,149,0,0.35)"
                                : "0 0 0 2.5px #f5f7fb, 0 0 0 4px rgba(255,59,48,0.22)",
                              position: "relative",
                              zIndex: 10,
                            }}
                          />
                        </div>
                        {/* Minutos + branch de conexão */}
                        <div className="py-3 pl-3">
                          {conn?.integrated ? (
                            /* Aeromóvel: branch diagonal saindo da bolinha */
                            <div className="flex flex-col" style={{ marginLeft: -16 }}>
                              <div className="flex items-end gap-0">
                                {/* SVG diagonal */}
                                <svg width="32" height="28" viewBox="0 0 32 28" fill="none" style={{ flexShrink: 0, overflow: "visible" }}>
                                  <line x1="0" y1="28" x2="28" y2="4" stroke={conn.color} strokeWidth="3" strokeLinecap="round"/>
                                  <circle cx="28" cy="4" r="5" fill={conn.color} stroke="white" strokeWidth="2"/>
                                </svg>
                                <div className="mb-0.5 flex flex-col" style={{ marginLeft: 4 }}>
                                  <span className="text-[10px] font-bold leading-tight" style={{ color: conn.color }}>{conn.label}</span>
                                  {conn.sublabel && <span className="text-[9px] leading-tight" style={{ color: "rgba(60,60,67,0.5)" }}>{conn.sublabel}</span>}
                                </div>
                              </div>
                              <p className="text-xs" style={{ color: "rgba(60,60,67,0.5)" }}>
                                {distanceFrom === "mercado"
                                  ? `${station.minutesFromMercado} min`
                                  : `${ONE_WAY_TRAVEL_MINUTES - station.minutesFromMercado} min`}
                              </p>
                            </div>
                          ) : conn ? (
                            /* Terminal Hidroviário: badge externo, não integrado */
                            <div className="flex flex-col gap-0.5">
                              <p className="text-xs" style={{ color: "rgba(60,60,67,0.5)" }}>Terminal</p>
                              <span
                                className="text-[9px] font-semibold leading-tight px-1.5 py-0.5 rounded"
                                style={{
                                  color: conn.color,
                                  border: `1px solid ${conn.color}`,
                                  display: "inline-block",
                                  width: "fit-content",
                                  whiteSpace: "nowrap",
                                  opacity: 0.8,
                                }}
                              >
                                {conn.label}
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs" style={{ color: "rgba(60,60,67,0.5)" }}>
                              {station.minutesFromMercado === 0 ? "Terminal" : distanceFrom === "mercado" ? `${station.minutesFromMercado} min` : `${ONE_WAY_TRAVEL_MINUTES - station.minutesFromMercado} min`}
                            </p>
                          )}
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
        className="fixed left-0 right-0 bottom-0 z-50 overflow-hidden rounded-t-3xl"
        style={{
          transform: isDragging
            ? `translateY(calc(100% - ${dragBaseRef.current + dragOffset}px))`
            : modalOpen === "hidden"
              ? "translateY(100%)"
              : modalOpen === "open"
                ? "translateY(0%)"
                : modalOpen === "peek"
                  ? "translateY(calc(100% - 96px))"
                  : "translateY(calc(100% - 56px))",
          transition: isDragging ? "none" : "transform 0.45s cubic-bezier(0.32, 0.72, 0, 1)",
          touchAction: "none",
        }}
      >
        <div
          onMouseDown={handleModalDragStart}
          onTouchStart={handleModalDragStart}
          onMouseMove={handleModalDragMove}
          onTouchMove={handleModalDragMove}
          onMouseUp={handleModalDragEnd}
          onTouchEnd={handleModalDragEnd}
          style={{ cursor: "grab", padding: "12px 0" }}
        >
          <div className="mx-auto flex h-1.5 w-10 rounded-full bg-slate-300/80 shadow-sm" />
        </div>
        <section
          className="rounded-t-3xl rounded-b-xl px-5 pt-4 pb-8 backdrop-blur-2xl border border-white/40"
          style={{
            background: "var(--lg-bg)",
            boxShadow: "var(--lg-shadow)",
          }}
        >
          {/* Título: situação + indicador */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span style={{ position: "relative", display: "inline-flex", width: 12, height: 12, flexShrink: 0 }}>
                <span style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  backgroundColor: status.situation.toLowerCase().includes("normal") ? "#34C759" : "#FF9500",
                  opacity: 0.5,
                  animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                }} />
                <span style={{
                  position: "relative",
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: status.situation.toLowerCase().includes("normal") ? "#34C759" : "#FF9500",
                  boxShadow: status.situation.toLowerCase().includes("normal")
                    ? "0 0 8px rgba(52,199,89,0.6)"
                    : "0 0 8px rgba(255,149,0,0.6)",
                }} />
              </span>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 leading-tight">{status.situation}</h2>
            </div>

          </div>

          <div className="flex flex-col gap-4">
            {/* Intervalo */}
            {(status.intervalNHtoMercado ?? status.currentIntervalMinutes) !== null && (
              <div className="flex flex-col gap-1.5">
                <p className="text-base font-semibold text-slate-500">Intervalo entre partidas</p>
                {status.intervalNHtoMercado !== null && status.intervalMercadotoNH !== null && status.intervalNHtoMercado !== status.intervalMercadotoNH ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-slate-900">{status.intervalNHtoMercado} min</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#007AFF", color: "white", letterSpacing: "0.06em" }}>NOVO HAMBURGO</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-slate-900">{status.intervalMercadotoNH} min</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#007AFF", color: "white", letterSpacing: "0.06em" }}>MERCADO</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-slate-900">{status.intervalNHtoMercado ?? status.currentIntervalMinutes} min</span>
                    <span className="text-sm text-slate-500">entre trens</span>
                  </div>
                )}
              </div>
            )}
            {/* Motivo */}
            <div>
              <p className="text-base font-semibold text-slate-500">Motivo</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{status.reason}</p>
            </div>

            {/* Trecho afetado */}
            {status.trechos.length > 0 && (
              <div>
                <p className="text-base font-semibold text-slate-500">Trecho afetado</p>
                {status.trechos.map((t, i) => (
                  <p key={i} className="mt-0.5 text-sm text-slate-700">
                    <span style={{ color: "#FF9500" }}>● </span>{t.estacao1} → {t.estacao2}
                  </p>
                ))}
              </div>
            )}

            {/* Aeromóvel */}
            {status.aeromovel && (
              <div>
                <h3 className="mb-2 mt-1 text-base font-semibold text-slate-800">Aeromóvel</h3>
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flexShrink: 0,
                      backgroundColor: status.aeromovel.situation.toLowerCase().includes("normal") ? "#34C759" : "#FF3B30",
                      boxShadow: status.aeromovel.situation.toLowerCase().includes("normal")
                        ? "0 0 0 2px rgba(52,199,89,0.25)"
                        : "0 0 0 2px rgba(255,59,48,0.25)",
                    }}
                  />
                  <p className="text-base font-semibold text-slate-500">Situação</p>
                </div>
                <p className="mt-0.5 text-sm text-slate-700">{status.aeromovel.situation}</p>
                {status.aeromovel.reason && (
                  <p className="mt-0.5 text-sm text-slate-700">{status.aeromovel.reason}</p>
                )}
              </div>
            )}
          </div>

          <p className="mt-4 text-[11px] text-slate-400">
            Atualizado às {lastUpdate ? lastUpdate.toLocaleTimeString("pt-BR") : "—"}
          </p>

          {/* Footer — dentro do section pra herdar o backdrop */}
          <div className="-mx-5 -mb-8 mt-5 px-5 py-5" style={{ background: "rgba(60,60,67,0.06)", borderTop: "1px solid rgba(60,60,67,0.09)" }}>
          <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(60,60,67,0.4)" }}>
            A posição dos trens é estimada com base nos horários oficiais da Trensurb e pode não refletir a localização exata em tempo real. Dados operacionais fornecidos pela própria Trensurb.
          </p>
          <p className="text-xs leading-relaxed mb-4" style={{ color: "rgba(60,60,67,0.4)" }}>
            O <span style={{ color: "rgba(60,60,67,0.65)" }}>Trem da Hora</span> é um app desenvolvido por{" "}
            <span style={{ color: "rgba(60,60,67,0.65)" }}>Marcelo Monteiro</span> com auxílio da{" "}
            <span style={{ color: "rgba(60,60,67,0.65)" }}>Claude</span>.
          </p>
          <div className="flex gap-4">
            {[
              { href: "https://x.com/mrclmonteiro", label: "X", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.26 5.636zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
              { href: "https://www.instagram.com/mrclmonteiro/", label: "Instagram", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg> },
              { href: "https://github.com/mrclmonteiro/tremdahora", label: "GitHub", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg> },
            ].map(({ href, label, svg }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center"
                style={{ color: "rgba(60,60,67,0.35)", lineHeight: 0 }}>
                {svg}
              </a>
            ))}
          </div>
          </div>
        </section>
      </div>
    </main>
  );
}
