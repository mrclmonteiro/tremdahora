"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MetroStation = {
  code: string;
  name: string;
  minutesFromMercado: number;
  municipality: string;
  address: string;
  lat: number;
  lng: number;
  position: "Elevada" | "Superfície";
  distKmToNext: number | null;
  distMinToNext: number | null;
  escadaRolante: boolean;
  elevador: boolean;
  biblioteca: boolean;
  bicicletario: boolean;
  caixaEletronico: boolean;
  farmacia: boolean;
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

type HeadwayPeriod = {
  startMinutes: number;
  headwayNH: number;
  headwayMR: number;
};

const POLL_MS = 30_000;
const TRAIN_TICK_MS = 10_000;
const DEFAULT_HEADWAY_MINUTES = 12;
const SERVICE_START_MINUTES = 5 * 60;
const ONE_WAY_TRAVEL_MINUTES = 53;
const TERMINAL_DWELL_MINUTES = 5;
const CYCLE_MINUTES = 116;

const STATIONS: MetroStation[] = [
  { code: "NH", name: "Novo Hamburgo", minutesFromMercado: 53, municipality: "Novo Hamburgo", address: "Avenida Nações Unidas, 2050 - Centro - Novo Hamburgo", lat: -29.686667, lng: -51.132778, position: "Elevada", distKmToNext: 1.6, distMinToNext: 3, escadaRolante: true, elevador: true, biblioteca: true, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "FN", name: "Fenac", minutesFromMercado: 50, municipality: "Novo Hamburgo", address: "Av. Nações Unidas, 3790 - Rio Branco - Novo Hamburgo", lat: -29.701111, lng: -51.135, position: "Elevada", distKmToNext: 1.7, distMinToNext: 2, escadaRolante: true, elevador: true, biblioteca: true, bicicletario: true, caixaEletronico: false, farmacia: false },
  { code: "IN", name: "Industrial", minutesFromMercado: 48, municipality: "Novo Hamburgo", address: "R. Primeiro de Março, 3595 - Centro - Novo Hamburgo", lat: -29.715556, lng: -51.134722, position: "Elevada", distKmToNext: 1.6, distMinToNext: 2, escadaRolante: true, elevador: true, biblioteca: false, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "SF", name: "Santo Afonso", minutesFromMercado: 46, municipality: "Novo Hamburgo", address: "R. Primeiro de Março, 5268 - Santo Afonso - Novo Hamburgo", lat: -29.729722, lng: -51.140278, position: "Elevada", distKmToNext: 2.1, distMinToNext: 2, escadaRolante: true, elevador: true, biblioteca: false, bicicletario: true, caixaEletronico: true, farmacia: false },
  { code: "RS", name: "Rio dos Sinos", minutesFromMercado: 44, municipality: "São Leopoldo", address: "Av. Mauá, 5100 - Santos Dumont - São Leopoldo", lat: -29.748889, lng: -51.145, position: "Elevada", distKmToNext: 2.4, distMinToNext: 3, escadaRolante: true, elevador: true, biblioteca: false, bicicletario: true, caixaEletronico: true, farmacia: false },
  { code: "SO", name: "São Leopoldo", minutesFromMercado: 41, municipality: "São Leopoldo", address: "Av. João Corrêa, 669 - Centro - São Leopoldo", lat: -29.768889, lng: -51.141111, position: "Elevada", distKmToNext: 1.9, distMinToNext: 5, escadaRolante: true, elevador: true, biblioteca: true, bicicletario: false, caixaEletronico: true, farmacia: false },
  { code: "UN", name: "Unisinos", minutesFromMercado: 36, municipality: "São Leopoldo", address: "Av. Mauá, 3503 - Padre Reus - São Leopoldo", lat: -29.786667, lng: -51.140278, position: "Superfície", distKmToNext: 5.1, distMinToNext: 2, escadaRolante: true, elevador: true, biblioteca: false, bicicletario: false, caixaEletronico: false, farmacia: true },
  { code: "SC", name: "Sapucaia", minutesFromMercado: 34, municipality: "Sapucaia do Sul", address: "Av. Sapucaia, 2073 - Centro - Sapucaia do Sul", lat: -29.823056, lng: -51.148889, position: "Superfície", distKmToNext: 1.9, distMinToNext: 3, escadaRolante: true, elevador: false, biblioteca: false, bicicletario: true, caixaEletronico: false, farmacia: false },
  { code: "LP", name: "Luiz Pasteur", minutesFromMercado: 31, municipality: "Sapucaia do Sul", address: "Av. Luíz Pasteur, 1399 - Tres Portos - Sapucaia do Sul", lat: -29.8325, lng: -51.165278, position: "Superfície", distKmToNext: 2.6, distMinToNext: 3, escadaRolante: true, elevador: false, biblioteca: false, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "ES", name: "Esteio", minutesFromMercado: 28, municipality: "Esteio", address: "R. Maurício Cardoso, 802 - Centro - Esteio", lat: -29.851944, lng: -51.179444, position: "Superfície", distKmToNext: 2.8, distMinToNext: 3, escadaRolante: true, elevador: true, biblioteca: true, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "PB", name: "Petrobras", minutesFromMercado: 25, municipality: "Canoas", address: "Av. Guilherme Schell, 2425 - Industrial - Canoas", lat: -29.876667, lng: -51.180833, position: "Superfície", distKmToNext: 1.2, distMinToNext: 2, escadaRolante: true, elevador: true, biblioteca: false, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "SL", name: "São Luís", minutesFromMercado: 23, municipality: "Canoas", address: "Av. Getúlio Vargas, 8835 - São José - Canoas", lat: -29.8875, lng: -51.179444, position: "Superfície", distKmToNext: 1.9, distMinToNext: 2, escadaRolante: true, elevador: true, biblioteca: false, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "MV", name: "Mathias Velho", minutesFromMercado: 21, municipality: "Canoas", address: "Av. Guilherme Schell, 7434 - Mathias Velho - Canoas", lat: -29.903889, lng: -51.178889, position: "Superfície", distKmToNext: 1.7, distMinToNext: 2, escadaRolante: true, elevador: true, biblioteca: false, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "CN", name: "Canoas", minutesFromMercado: 19, municipality: "Canoas", address: "R. Tiradentes, 345 - Centro - Canoas", lat: -29.918889, lng: -51.181944, position: "Superfície", distKmToNext: 2.2, distMinToNext: 3, escadaRolante: true, elevador: true, biblioteca: false, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "FT", name: "Fátima", minutesFromMercado: 16, municipality: "Canoas", address: "Av. Guilherme Schell, 3368 - Rio Branco - Canoas", lat: -29.937778, lng: -51.177222, position: "Superfície", distKmToNext: 1.9, distMinToNext: 3, escadaRolante: true, elevador: false, biblioteca: false, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "NT", name: "Niterói", minutesFromMercado: 13, municipality: "Canoas", address: "Av. Guilherme Schell, 1686 - Rio Branco - Canoas", lat: -29.955, lng: -51.176389, position: "Superfície", distKmToNext: 2.5, distMinToNext: 2, escadaRolante: true, elevador: true, biblioteca: false, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "AN", name: "Anchieta", minutesFromMercado: 11, municipality: "Porto Alegre", address: "Av. dos Estados, 215 - Humaitá - Porto Alegre", lat: -29.976667, lng: -51.178611, position: "Superfície", distKmToNext: 1.2, distMinToNext: 1, escadaRolante: true, elevador: false, biblioteca: false, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "AP", name: "Aeroporto", minutesFromMercado: 10, municipality: "Porto Alegre", address: "Av. dos Estados, 1380 - São João - Porto Alegre", lat: -29.987778, lng: -51.182222, position: "Superfície", distKmToNext: 1.9, distMinToNext: 3, escadaRolante: true, elevador: false, biblioteca: false, bicicletario: false, caixaEletronico: false, farmacia: false },
  { code: "FR", name: "Farrapos", minutesFromMercado: 7, municipality: "Porto Alegre", address: "Av. A. J. Renner, 25 - Humaitá - Porto Alegre", lat: -29.997222, lng: -51.1975, position: "Superfície", distKmToNext: 1.8, distMinToNext: 3, escadaRolante: true, elevador: false, biblioteca: false, bicicletario: false, caixaEletronico: true, farmacia: false },
  { code: "SP", name: "São Pedro", minutesFromMercado: 4, municipality: "Porto Alegre", address: "R. Voluntários da Pátria, 3100 - São Geraldo - Porto Alegre", lat: -30.006111, lng: -51.209167, position: "Superfície", distKmToNext: 2.1, distMinToNext: 2, escadaRolante: true, elevador: true, biblioteca: false, bicicletario: false, caixaEletronico: true, farmacia: false },
  { code: "RD", name: "Rodoviária", minutesFromMercado: 2, municipality: "Porto Alegre", address: "Largo Vespasiano Júlio Veppo, 70 - Centro Histórico - Porto Alegre", lat: -30.0225, lng: -51.219722, position: "Superfície", distKmToNext: 0.9, distMinToNext: 2, escadaRolante: true, elevador: true, biblioteca: false, bicicletario: false, caixaEletronico: true, farmacia: false },
  { code: "MR", name: "Mercado", minutesFromMercado: 0, municipality: "Porto Alegre", address: "Av. Mauá, 1267 - Centro Histórico - Porto Alegre", lat: -30.026389, lng: -51.228056, position: "Superfície", distKmToNext: null, distMinToNext: null, escadaRolante: true, elevador: true, biblioteca: true, bicicletario: true, caixaEletronico: true, farmacia: false },
];

type StationConnection = {
  label: string;
  sublabel?: string;
  color: string;
  integrated?: boolean;
};

const CONNECTIONS: Record<string, StationConnection> = {
  AP: { label: "Aeromóvel", sublabel: "Salgado Filho", color: "#34C759", integrated: true },
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
  { city: "Canoas", codes: ["PB", "SL", "MV", "CN", "FT", "NT"] },
  { city: "Porto Alegre", codes: ["AN", "AP", "FR", "SP", "RD", "MR"] },
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
  const aeroSit = String(aeroRaw?.["descricao-situacao-operacional"] ?? "Sem dados");
  const aeroReason = String(aeroRaw?.["motivo"] ?? "");
  const aeromovel = aeroRaw ? {
    situation: aeroSit,
    reason: (() => {
      // Combina situação + motivo pra detectar o texto completo horrível da API
      const full = `${aeroSit} ${aeroReason}`.trim().toLowerCase();
      if (full.includes("enchentes") || full.includes("inoperante")) {
        return "Fora de operação devido às enchentes de maio de 2024";
      }
      const r = aeroReason;
      return r ? r.charAt(0).toUpperCase() + r.slice(1) : "";
    })(),
  } : null;

  const trechos = Array.isArray(op["trechos"])
    ? (op["trechos"] as { estacao1: string; estacao2: string }[])
    : [];

  const intervalos = Array.isArray(op["intervalos"]) ? op["intervalos"] as {"intervalo": number; "estacao-partida": string}[] : [];
  const ivNH = intervalos.find(i => i["estacao-partida"] === "Novo Hamburgo")?.intervalo ?? null;
  const ivMR = intervalos.find(i => i["estacao-partida"] === "Mercado")?.intervalo ?? null;

  // Normaliza textos vindos da API
  function normalizeSituation(s: string): string {
    const map: Record<string, string> = {
      "operação com alterações de serviço": "Operando com alterações",
    };
    return map[s.toLowerCase()] ?? s;
  }
  function normalizeReason(s: string): string {
    const map: Record<string, string> = {
      "recuperação do sistema de energia dos trens": "O sistema de energia dos trens está sendo recuperado",
    };
    const key = s.trim().toLowerCase().replace(/\.$/, "");
    const mapped = map[key];
    if (mapped) return mapped;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function normalizeAeroSituation(s: string): string {
    // Remove o "Fora de Operação" duplicado que vem junto com a descrição
    const map: Record<string, string> = {
      "fora de operação enchentes aeromovel inoperante": "Fora de operação devido às enchentes de maio de 2024",
      "enchentes aeromovel inoperante": "Fora de operação devido às enchentes de maio de 2024",
      "fora de operação": "Fora de operação",
    };
    return map[s.trim().toLowerCase()] ?? s;
  }

  return {
    situation: normalizeSituation(String(op["descricao-situacao-operacional"] ?? fallback.situation)),
    reason: normalizeReason(String(op["motivo"] ?? "Operação sem observações no momento.")),
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

function minutesToHHMM(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = Math.floor(m % 60);
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function getStationTrainTimes(
  minutesFromMercado: number,
  now: Date | null,
  periods: HeadwayPeriod[],
  fallbackSouth: number,
  fallbackNorth: number
): {
  southbound: { last: string | null; next1: string | null; next1Arriving: boolean; next2: string | null };
  northbound: { last: string | null; next1: string | null; next1Arriving: boolean; next2: string | null };
} {
  const empty = { last: null, next1: null, next1Arriving: false, next2: null };
  if (!now) return { southbound: empty, northbound: empty };
  const minutesNow = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  const fallback: HeadwayPeriod[] = [{ startMinutes: SERVICE_START_MINUTES, headwayNH: fallbackSouth, headwayMR: fallbackNorth }];
  const ps = periods.length > 0 ? periods : fallback;

  function timesForDir(deps: number[], travelFromTerminal: number) {
    const arrivals = deps.map(d => d + travelFromTerminal);
    const past = arrivals.filter(t => t <= minutesNow);
    const future = arrivals.filter(t => t > minutesNow);
    const lastPast = past.length > 0 ? past[past.length - 1] : null;
    const soonest = future.length > 0 ? future[0] : null;
    const justPassed = lastPast !== null && minutesNow - lastPast <= 2;
    const aboutToArrive = soonest !== null && soonest - minutesNow <= 1;
    if (justPassed && !aboutToArrive) {
      return {
        last: past.length > 1 ? minutesToHHMM(past[past.length - 2]) : null,
        next1: minutesToHHMM(lastPast!),
        next1Arriving: true,
        next2: soonest ? minutesToHHMM(soonest) : null,
      };
    }
    if (aboutToArrive) {
      return {
        last: lastPast ? minutesToHHMM(lastPast) : null,
        next1: minutesToHHMM(soonest!),
        next1Arriving: true,
        next2: future.length > 1 ? minutesToHHMM(future[1]) : null,
      };
    }
    return {
      last: lastPast ? minutesToHHMM(lastPast) : null,
      next1: soonest ? minutesToHHMM(soonest) : null,
      next1Arriving: false,
      next2: future.length > 1 ? minutesToHHMM(future[1]) : null,
    };
  }

  const depsNH = buildDepartures(SERVICE_START_MINUTES, ps, p => p.headwayNH, minutesNow + 60);
  const depsMR = buildDepartures(SERVICE_START_MINUTES, ps, p => p.headwayMR, minutesNow + 60);

  return {
    southbound: timesForDir(depsNH, ONE_WAY_TRAVEL_MINUTES - minutesFromMercado),
    northbound: timesForDir(depsMR, minutesFromMercado),
  };
}


const TREM_TOUR_STEPS_MOBILE = [
  { msg: "Arraste para cima para conferir o status e os intervalos de partidas entre trens", anchor: "modal" as const },
  { msg: "Escolha entre a visualização dos terminais Mercado e Novo Hamburgo", anchor: "header" as const },
  { msg: "Toque em uma estação para conferir os próximos horários previstos", anchor: "station" as const },
]
const TREM_TOUR_STEPS_DESKTOP = [
  { msg: "Aqui você acompanha o status da operação e os intervalos entre trens em tempo real", anchor: "sidebar" as const },
  { msg: "Alterne entre a perspectiva do Mercado e de Novo Hamburgo com esse toggle", anchor: "toggle" as const },
  { msg: "Clique em uma estação para ver os próximos horários previstos", anchor: "station" as const },
]
const TREM_TOUR_STEPS = TREM_TOUR_STEPS_MOBILE
type TremTourAnchor = "modal" | "header" | "station" | "sidebar" | "toggle"

function TremTour({
  step, onAdvance, modalRef, headerRef, stationRef, sidebarRef, toggleRef,
}: {
  step: number
  onAdvance: () => void
  modalRef: React.RefObject<HTMLDivElement | null>
  headerRef: React.RefObject<HTMLDivElement | null>
  stationRef: React.RefObject<HTMLLIElement | null>
  sidebarRef: React.RefObject<HTMLElement | null>
  toggleRef: React.RefObject<HTMLDivElement | null>
}) {
  const [isDesktop, setIsDesktop] = React.useState(false)
  const [visible, setVisible] = React.useState(false)
  const [bubblePos, setBubblePos] = React.useState<{
    left: number; top?: number; bottom?: number; width: number
    tailX: number; tailSide: "top" | "bottom"
  } | null>(null)

  // Detect desktop on mount
  React.useEffect(() => {
    setIsDesktop(window.innerWidth >= 768)
  }, [])

  React.useEffect(() => {
    let raf1 = 0, raf2 = 0
    let mounted = true
    setVisible(false)
    setBubblePos(null)
    raf1 = requestAnimationFrame(() => {
      if (!mounted) return
      const W = window.innerWidth
      const desktop = W >= 768
      setIsDesktop(desktop)
      const BW = 260
      const steps = desktop ? TREM_TOUR_STEPS_DESKTOP : TREM_TOUR_STEPS_MOBILE
      const anchor = steps[step]?.anchor
      let pos: typeof bubblePos = null

      if (anchor === "modal" && modalRef.current) {
        const r = modalRef.current.getBoundingClientRect()
        const bl = Math.max(16, W / 2 - BW / 2)
        pos = { left: bl, bottom: window.innerHeight - r.top + 12, width: BW, tailX: W / 2 - bl - 8, tailSide: "bottom" }
      } else if (anchor === "header" && headerRef.current) {
        const r = headerRef.current.getBoundingClientRect()
        const bl = Math.max(16, W / 2 - BW / 2)
        pos = { left: bl, top: r.bottom + 12, width: BW, tailX: W / 2 - bl - 8, tailSide: "top" }
      } else if (anchor === "sidebar" && sidebarRef.current) {
        // Bubble below the top of sidebar, in the map area
        const r = sidebarRef.current.getBoundingClientRect()
        const bl = r.right + 20
        const safeLeft = Math.min(bl, W - BW - 16)
        pos = { left: safeLeft, top: r.top + 20, width: BW, tailX: 16, tailSide: "top" }
      } else if (anchor === "toggle" && toggleRef.current) {
        const r = toggleRef.current.getBoundingClientRect()
        const bl = r.right + 20
        const safeLeft = Math.min(bl, W - BW - 16)
        pos = { left: safeLeft, top: r.top + r.height / 2 - 20, width: BW, tailX: 16, tailSide: "top" }
      } else if (anchor === "station" && stationRef.current) {
        const r = stationRef.current.getBoundingClientRect()
        if (desktop) {
          const bl = Math.min(r.left + 40, W - BW - 16)
          pos = { left: bl, top: r.bottom + 10, width: BW, tailX: 24, tailSide: "top" }
        } else {
          const bl = Math.max(16, W / 2 - BW / 2)
          pos = { left: bl, top: r.bottom + 10, width: BW, tailX: W / 2 - bl - 8, tailSide: "top" }
        }
      }

      if (mounted) setBubblePos(pos)
      raf2 = requestAnimationFrame(() => { if (mounted) setVisible(true) })
    })
    return () => { mounted = false; cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [step, isDesktop]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeSteps = isDesktop ? TREM_TOUR_STEPS_DESKTOP : TREM_TOUR_STEPS_MOBILE
  if (!bubblePos) return null
  const isLast = step === activeSteps.length - 1

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: visible ? "rgba(0,0,0,0.38)" : "rgba(0,0,0,0)",
        backdropFilter: "blur(2px)",
        transition: "background 0.25s ease",
        pointerEvents: visible ? "auto" : "none",
      }}
      onClick={onAdvance}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "fixed",
          left: bubblePos.left,
          top: bubblePos.top,
          bottom: bubblePos.bottom,
          width: bubblePos.width,
          background: "white",
          borderRadius: 18,
          padding: "14px 16px 12px",
          color: "#0a0a0f",
          fontSize: 14,
          lineHeight: 1.5,
          fontWeight: 500,
          boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.9) translateY(6px)",
          transition: "opacity 0.25s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          pointerEvents: visible ? "auto" : "none",
        }}
      >
        {/* Tail */}
        <div style={{
          position: "absolute", width: 0, height: 0,
          ...(bubblePos.tailSide === "top"
            ? { top: -9, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderBottom: "10px solid white" }
            : { bottom: -9, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "10px solid white" }),
          left: bubblePos.tailX,
        }} />

        <p style={{ margin: 0, marginBottom: 12 }}>{activeSteps[step]?.msg}</p>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {activeSteps.map((_, i) => (
              <div key={i} style={{
                height: 5, width: i === step ? 14 : 5, borderRadius: 3,
                background: i === step ? "#007AFF" : "rgba(0,0,0,0.15)",
                transition: "width 0.3s ease, background 0.3s ease",
              }} />
            ))}
          </div>
          <button
            onClick={onAdvance}
            style={{
              background: "#007AFF", color: "white", border: "none", borderRadius: 99,
              cursor: "pointer", padding: "6px 14px", fontSize: 13, fontWeight: 700,
              boxShadow: "0 2px 8px rgba(0,122,255,0.4)",
            }}
          >
            {isLast ? "Entendido!" : "Próximo →"}
          </button>
        </div>
      </div>
    </div>
  )
}

function buildDepartures(
  serviceStart: number,
  periods: HeadwayPeriod[],
  getHw: (p: HeadwayPeriod) => number,
  maxMinutes: number
): number[] {
  const sorted = [...periods].sort((a, b) => a.startMinutes - b.startMinutes);
  const deps: number[] = [];
  let t = serviceStart;
  while (t <= maxMinutes) {
    deps.push(t);
    let hw = getHw(sorted[0]);
    for (const p of sorted) {
      if (p.startMinutes <= t) hw = getHw(p);
    }
    t += hw;
  }
  return deps;
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
  const [selectedStationCode, setSelectedStationCode] = useState<string | null>(null);
  const [stationModalOpen, setStationModalOpen] = useState(false);
  const [stationDragOffset, setStationDragOffset] = useState(0);
  const [stationDragStart, setStationDragStart] = useState<number | null>(null);
  const stationDragOffsetRef = useRef(0);
  const stationModalRef = useRef<HTMLDivElement>(null);
  const [distanceFrom, setDistanceFrom] = useState<"mercado" | "nh">("mercado");
  const [headerVisible, setHeaderVisible] = useState(true);
  const headerRef = useRef<HTMLDivElement>(null);
  const stationTourRef = useRef<HTMLLIElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);
  const [tourStep, setTourStep] = useState(-1);
  type Announcement = { id: number; title: string; body: string; link: string | null; link_label: string | null; storage_key: string; };
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [headwayPeriods, setHeadwayPeriods] = useState<HeadwayPeriod[]>([]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/headway-history");
      const raw = await res.json() as { recorded_at: string; headway_nh: number; headway_mr: number }[];
      const periods: HeadwayPeriod[] = raw.map(r => ({
        startMinutes: (() => {
          const d = new Date(r.recorded_at);
          return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
        })(),
        headwayNH: r.headway_nh,
        headwayMR: r.headway_mr,
      }));
      // Garante período desde o início do serviço com o headway mais antigo conhecido
      if (periods.length > 0) {
        periods.unshift({ startMinutes: SERVICE_START_MINUTES, headwayNH: periods[0].headwayNH, headwayMR: periods[0].headwayMR });
      }
      setHeadwayPeriods(periods);
    } catch {}
  }, []);

  useEffect(() => {
    // No mount: carrega status primeiro, depois history — evita competição de rede
    loadStatus().then(() => fetchHistory());
    const t = window.setInterval(fetchHistory, POLL_MS);
    return () => window.clearInterval(t);
  }, [fetchHistory]); // loadStatus é chamado via .then, não precisa ser dependência


  // Fetch announcements — mostra o primeiro ativo que o usuário ainda não viu
  useEffect(() => {
    async function fetchAnnouncements() {
      try {
        const res = await fetch("/api/announcements");
        const data = await res.json() as { id: number; title: string; body: string; link: string | null; link_label: string | null; storage_key: string }[];
        const unseen = data.find(a => {
          try { return !localStorage.getItem(`announcement_seen_${a.storage_key}`); } catch { return true; }
        });
        if (unseen) setAnnouncement(unseen);
      } catch {}
    }
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    function onScroll() {
      setHeaderVisible(window.scrollY < 24);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      if (!localStorage.getItem("trem_tour_done")) {
        setTimeout(() => setTourStep(0), 900);
      }
    } catch (_) {}
  }, []);

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => { setNow(new Date()); }, []);

  const lastHeadwayKeyRef = useRef<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Falha HTTP ${response.status}`);
      }

      const data = (await response.json()) as unknown;
      const newStatus = extractStatus(data);
      setStatus(newStatus);
      setLastUpdate(new Date());

      // Se o headway mudou desde a última chamada, busca histórico imediatamente
      const key = `${newStatus.intervalNHtoMercado}-${newStatus.intervalMercadotoNH}`;
      if (lastHeadwayKeyRef.current !== null && lastHeadwayKeyRef.current !== key) {
        fetchHistory();
      }
      lastHeadwayKeyRef.current = key;
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
  }, [fetchHistory]);

  useEffect(() => {
    // loadStatus inicial já é chamado pelo useEffect do fetchHistory (via .then)
    const timer = window.setInterval(loadStatus, POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadStatus]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, TRAIN_TICK_MS);

    return () => window.clearInterval(timer);
  }, []);

  const headwaySouth = Math.max(1, Math.round(status.intervalNHtoMercado ?? status.currentIntervalMinutes ?? DEFAULT_HEADWAY_MINUTES));
  const headwayNorth = Math.max(1, Math.round(status.intervalMercadotoNH ?? status.currentIntervalMinutes ?? DEFAULT_HEADWAY_MINUTES));

  const trainPositions = useMemo<TrainPosition[]>(() => {
  if (!now) return [];
  const minutesNow = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  const fallbackPeriods: HeadwayPeriod[] = [{
    startMinutes: SERVICE_START_MINUTES,
    headwayNH: headwaySouth,
    headwayMR: headwayNorth,
  }];
  const periods = headwayPeriods.length > 0 ? headwayPeriods : fallbackPeriods;

  const depsNH = buildDepartures(SERVICE_START_MINUTES, periods, p => p.headwayNH, minutesNow);
  const depsMR = buildDepartures(SERVICE_START_MINUTES, periods, p => p.headwayMR, minutesNow);

  const positions: TrainPosition[] = [];

  for (const dep of depsNH) {
    const elapsed = minutesNow - dep;
    if (elapsed < 0) continue;
    if (elapsed <= ONE_WAY_TRAVEL_MINUTES) {
      positions.push({ id: `s-${dep}`, direction: "southbound", topPercent: (elapsed / ONE_WAY_TRAVEL_MINUTES) * 100 });
    } else if (elapsed <= ONE_WAY_TRAVEL_MINUTES + TERMINAL_DWELL_MINUTES) {
      positions.push({ id: `m-${dep}`, direction: "southbound", topPercent: 100 });
    }
  }

  for (const dep of depsMR) {
    const elapsed = minutesNow - dep;
    if (elapsed < 0) continue;
    if (elapsed <= ONE_WAY_TRAVEL_MINUTES) {
      positions.push({ id: `n-${dep}`, direction: "northbound", topPercent: (1 - elapsed / ONE_WAY_TRAVEL_MINUTES) * 100 });
    } else if (elapsed <= ONE_WAY_TRAVEL_MINUTES + TERMINAL_DWELL_MINUTES) {
      positions.push({ id: `h-${dep}`, direction: "northbound", topPercent: 0 });
    }
  }

  return positions;
}, [now, headwayPeriods, headwaySouth, headwayNorth]);

  const modalRef = useRef<HTMLDivElement>(null);
  const restingAnchorRef = useRef<HTMLParagraphElement>(null);
  const [restingHeight, setRestingHeight] = useState(180);
  const [modalOpen, setModalOpen] = useState<"hidden" | "peek" | "resting" | "mid" | "open">("hidden");
  const [hintBump, setHintBump] = useState(0); // px extra pra cima no hint do mid
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragOffsetRef = useRef(0);
  const dragBaseRef = useRef(0);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openStationModal(code: string) {
    setSelectedStationCode(code);
    setStationDragOffset(0);
    stationDragOffsetRef.current = 0;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setStationModalOpen(true));
    });
  }
  function closeStationModal() {
    setStationModalOpen(false);
    setStationDragOffset(0);
    stationDragOffsetRef.current = 0;
    setTimeout(() => setSelectedStationCode(null), 400);
  }
  function handleStationDragStart(e: React.TouchEvent | React.MouseEvent) {
    setStationDragStart("touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY);
    stationDragOffsetRef.current = 0;
    setStationDragOffset(0);
  }
  function handleStationDragMove(e: React.TouchEvent | React.MouseEvent) {
    if (stationDragStart === null) return;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const offset = Math.max(0, clientY - stationDragStart);
    stationDragOffsetRef.current = offset;
    setStationDragOffset(offset);
  }
  function handleStationDragEnd() {
    if (stationDragOffsetRef.current > 100) closeStationModal();
    else { setStationDragOffset(0); stationDragOffsetRef.current = 0; }
    setStationDragStart(null);
  }

  // Intro: peek → resting
  useEffect(() => {
    const t1 = setTimeout(() => setModalOpen("peek"), 400);
    const t2 = setTimeout(() => setModalOpen("resting"), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Mede altura até "Atualizado às" pra saber onde parar no mid
  useEffect(() => {
    function measure() {
      if (!restingAnchorRef.current || !modalRef.current) return;
      const anchorBottom = restingAnchorRef.current.getBoundingClientRect().bottom;
      const modalTop = modalRef.current.getBoundingClientRect().top;
      // Divide pela escala pra compensar o transform: o modal está em scale(0.95) quando medido
      setRestingHeight(Math.round((anchorBottom - modalTop + 32) / 0.95));
    }
    const t = setTimeout(measure, 600);
    return () => clearTimeout(t);
  }, [status, lastUpdate]);

  // Drag global listeners
  useEffect(() => {
    function onMove(e: TouchEvent | MouseEvent) {
      if (dragStart === null) return;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const raw = dragStart - clientY;
      const maxOffset = modalRef.current ? modalRef.current.offsetHeight - 56 : 999;
      dragOffsetRef.current = Math.min(raw, maxOffset);
      setDragOffset(dragOffsetRef.current);
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
  }, [dragStart]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDragging = dragStart !== null;

  function getModalScale(): number {
    const SCALE_RESTING = 0.95;
    if (!isDragging) return modalOpen === "open" ? 1 : SCALE_RESTING;
    const modalH = modalRef.current?.offsetHeight ?? 400;
    const restingVisible = 68;
    const currentVisible = Math.max(restingVisible, dragBaseRef.current + dragOffset);
    const progress = Math.min(1, Math.max(0, (currentVisible - restingVisible) / (modalH - restingVisible)));
    return SCALE_RESTING + (1 - SCALE_RESTING) * progress;
  }

  function getModalTransform(): string {
    const scale = getModalScale();
    if (isDragging) {
      return `translateY(calc(100% - ${Math.max(0, dragBaseRef.current + dragOffset)}px)) scale(${scale.toFixed(4)})`;
    }
    switch (modalOpen) {
      case "hidden":  return `translateY(100%) scale(${scale.toFixed(4)})`;
      case "peek":    return `translateY(calc(100% - 120px)) scale(${scale.toFixed(4)})`;
      case "resting": return `translateY(calc(100% - 100px)) scale(${scale.toFixed(4)})`;
      case "mid":     return `translateY(calc(100% - ${restingHeight + hintBump}px)) scale(${scale.toFixed(4)})`;
      case "open":    return `translateY(0%) scale(1)`;
    }
  }

  function doHintBounce() {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    // Espera a transição pro mid terminar (450ms) aí sobe 28px e volta
    hintTimerRef.current = setTimeout(() => {
      setHintBump(72);
      hintTimerRef.current = setTimeout(() => setHintBump(0), 500);
    }, 450);
  }

  function handleModalDragStart(e: React.TouchEvent | React.MouseEvent) {
    // Cancela hint em andamento se o usuário arrastar
    if (hintTimerRef.current) { clearTimeout(hintTimerRef.current); hintTimerRef.current = null; }
    setHintBump(0);
    const modalH = modalRef.current?.offsetHeight ?? 0;
    const windowH = window.innerHeight;
    const visibleNow =
      modalOpen === "open" ? modalH :
      modalOpen === "mid" ? restingHeight :
      80;
    dragBaseRef.current = visibleNow;
    setDragOffset(0);
    setDragStart("touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY);
  }
  function handleModalDragMove(e: React.TouchEvent | React.MouseEvent) {
    if (dragStart === null) return;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    dragOffsetRef.current = dragStart - clientY;
    setDragOffset(dragOffsetRef.current);
  }
  function handleModalDragEnd() {
    const offset = dragOffsetRef.current;
    if (offset > 50) {
      if (modalOpen === "resting" || modalOpen === "peek") {
        setModalOpen("mid");
        doHintBounce();
      } else {
        setModalOpen("open");
      }
    } else if (offset < -50) {
      if (modalOpen === "open") setModalOpen("mid");
      else setModalOpen("resting");
    }
    setDragStart(null);
    setDragOffset(0);
  }
  const isClosed = status.situation.toLowerCase().includes("fechado");
  const isStationsClosing = !isClosed && new Date().getHours() >= 23;

  return (
    <div className="md:flex md:flex-row md:h-screen md:overflow-hidden">
    <main
      suppressHydrationWarning
      className="relative min-h-[100dvh] w-full bg-transparent text-slate-900 md:flex-1 md:overflow-y-auto md:min-h-0 md:h-screen"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      }}
    >
      {/* Header fixo estilo goes-to — hidden no desktop */}
      {/* Header fixo padrão goes-to */}
      <div
        className="md:hidden"
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
          ref={headerRef}
          className="p-1 flex items-center rounded-full w-full"
          style={{ background: "rgba(60,60,67,0.10)", cursor: "pointer", position: "relative" }}
          onClick={() => setDistanceFrom(d => d === "mercado" ? "nh" : "mercado")}
        >
          {/* Indicator deslizante */}
          <div style={{
            position: "absolute",
            top: 4, bottom: 4,
            left: 4,
            width: "calc(50% - 4px)",
            background: "rgba(255,255,255,0.95)",
            borderRadius: 99,
            boxShadow: "0 1px 6px rgba(0,0,0,0.10)",
            transform: distanceFrom === "nh" ? "translateX(100%)" : "translateX(0%)",
            transition: "transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)",
            pointerEvents: "none",
          }} />
          <span className="flex-1 text-center text-sm py-2 font-semibold rounded-full relative z-10 transition-colors duration-200" style={{ color: distanceFrom === "mercado" ? "#1C1C1E" : "rgba(60,60,67,0.45)" }}>↓ Mercado</span>
          <span className="flex-1 text-center text-sm py-2 font-semibold rounded-full relative z-10 transition-colors duration-200" style={{ color: distanceFrom === "nh" ? "#1C1C1E" : "rgba(60,60,67,0.45)" }}>↑ Novo Hamburgo</span>
        </div>
      </div>

      {/* Mapa da linha ocupa a tela toda */}
      <div
        className="relative flex flex-col items-center justify-center select-none pointer-events-none z-0 px-3 md:px-8 pb-32 w-full min-h-[100dvh]"
        style={{
          boxSizing: "border-box",
          paddingTop: "calc(max(env(safe-area-inset-top), 48px) + 72px)",
        }}
      >
        {/* --- MAPA DA LINHA --- */}
        <section className="relative w-full max-w-2xl md:[zoom:1.35]">
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
                      <li key={code} ref={code === "SC" ? stationTourRef : undefined} className="grid grid-cols-[1fr_32px_1fr] items-center">
                        {/* Nome — clicável */}
                        <div className="flex flex-col items-end py-3 pl-7 pr-3" style={{ pointerEvents: "auto" }}>
                          <button onClick={() => openStationModal(code)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "right" }}>
                            <p className="text-[12px] font-medium leading-snug" style={{ color: "#1C1C1E" }}>{station.name}</p>
                          </button>
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
                        <div className="py-3 pl-8">
                          {conn?.integrated ? (
  <div style={{ position: "relative" }}>
    <svg
      width="30" height="16"
      style={{ overflow: "visible", position: "absolute", left: -48, top: "100%", transform: "translateY(-50%)", pointerEvents: "none", zIndex: 20, display: "block" }}
      fill="none"
    >
      <rect x="-9" y="-9" width="36" height="18" rx="9" fill="white" stroke="#007AFF" strokeWidth="2.5"/>
      <circle cx="0" cy="0" r="7" fill="#FF3B30" stroke="white" strokeWidth="1.5"/>
      <circle cx="18" cy="0" r="7" fill="#FF3B30" stroke="white" strokeWidth="1.5"/>
      <text x="18" y="3.5" fontSize="8" textAnchor="middle" fill="white">✈</text>
      <line x1="24" y1="-5" x2="86" y2="-46" stroke={conn.color} strokeWidth="3" strokeLinecap="round"/>
      <circle cx="86" cy="-46" r="7" fill={conn.color} stroke="white" strokeWidth="2"/>
      <path id="aero-path" d="M 28,-8 L 84,-44" fill="none"/>
      <text fontSize="8" fontWeight="700" fill={conn.color}>
        <textPath href="#aero-path" startOffset="10%" stroke="rgba(245,247,251,0.9)" strokeWidth="3" paintOrder="stroke">Aeromóvel</textPath>
      </text>
      <text x="98" y="-42" fontSize="9" fontWeight="600" fill="#1C1C1E">Salgado Filho</text>
    </svg>
    <p className="text-xs" style={{ color: "rgba(60,60,67,0.5)" }}>
      {distanceFrom === "mercado"
        ? `${station.minutesFromMercado} min`
        : `${ONE_WAY_TRAVEL_MINUTES - station.minutesFromMercado} min`}
    </p>
  </div>
) : conn ? (
                            /* Terminal Hidroviário: badge externo, não integrado */
                            <div className="flex flex-col gap-0.5">
                              <p className="text-xs" style={{ color: "rgba(60,60,67,0.5)" }}>
  {distanceFrom === "nh" ? "53 min" : "Terminal"}
</p>
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
                              {distanceFrom === "mercado"
                                ? (station.minutesFromMercado === 0 ? "Terminal" : `${station.minutesFromMercado} min`)
                                : (station.minutesFromMercado === ONE_WAY_TRAVEL_MINUTES ? "Terminal" : `${ONE_WAY_TRAVEL_MINUTES - station.minutesFromMercado} min`)}
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

      {/* Bottom modal fixo — hidden no desktop */}
      <div
        ref={modalRef}
        className="md:hidden fixed left-0 right-0 bottom-0 z-50"
        style={{
          transform: getModalTransform(),
          transformOrigin: "bottom center",
          transition: isDragging ? "none" : "transform 0.45s cubic-bezier(0.32, 0.72, 0, 1)",
          touchAction: "none",
          willChange: "transform",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <section
          className="rounded-t-3xl rounded-b-xl px-5 pb-8 border border-white/40"
          style={{
            position: "relative",
            background: "rgba(242,244,248,0.92)",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.12), 0 -1px 0 rgba(255,255,255,0.8)",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, borderRadius: "inherit", backdropFilter: "blur(32px) saturate(200%)", WebkitBackdropFilter: "blur(32px) saturate(200%)", pointerEvents: "none", zIndex: 0 }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              onMouseDown={handleModalDragStart}
              onTouchStart={handleModalDragStart}
              onMouseMove={handleModalDragMove}
              onTouchMove={handleModalDragMove}
              onMouseUp={handleModalDragEnd}
              onTouchEnd={handleModalDragEnd}
              style={{ cursor: "grab", padding: "12px 0 8px", display: "flex", justifyContent: "center", touchAction: "none" }}
            >
              <div style={{ width: 40, height: 5, borderRadius: 99, background: "rgba(60,60,67,0.18)" }} />
            </div>
          {/* Título: situação + indicador */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span style={{ position: "relative", display: "inline-flex", width: 12, height: 12, flexShrink: 0 }}>
                <span style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                backgroundColor: isClosed ? "#8E8E93" : status.situation.toLowerCase().includes("normal") ? "#34C759" : "#FF9500",
                opacity: 0.5,
                animation: isClosed ? "none" : "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                }} />
                <span style={{
                position: "relative",
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: isClosed ? "#8E8E93" : status.situation.toLowerCase().includes("normal") ? "#34C759" : "#FF9500",
                boxShadow: isClosed ? "none" : status.situation.toLowerCase().includes("normal") ? "0 0 8px rgba(52,199,89,0.6)" : "0 0 8px rgba(255,149,0,0.6)",
                }} />
              </span>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 leading-tight">{status.situation}</h2>
            </div>
            {isStationsClosing && (
              <p style={{ fontSize: 12, color: "#FF9500", fontWeight: 600, marginTop: 4 }}>
                Estações fechadas. Últimos trens em circulação.
              </p>
            )}
            {isClosed && (
              <p style={{ fontSize: 12, color: "rgba(60,60,67,0.45)", fontWeight: 500, marginTop: 4 }}>
                Operação encerrada. Retorno às 5h.
              </p>
            )}

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
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#FF3B30", color: "white", letterSpacing: "0.06em" }}>NOVO HAMBURGO</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-slate-900">{status.intervalMercadotoNH} min</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#007AFF", color: "white", letterSpacing: "0.06em" }}>MERCADO</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold text-slate-900">{status.intervalNHtoMercado ?? status.currentIntervalMinutes} min</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#FF3B30", color: "white", letterSpacing: "0.06em" }}>NOVO HAMBURGO</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#007AFF", color: "white", letterSpacing: "0.06em" }}>MERCADO</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Motivo */}
            {!isClosed && (
              <div>
              <p className="text-base font-semibold text-slate-500">Motivo</p>
              <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{status.reason}</p>
              </div>
            )}

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

          <p ref={restingAnchorRef} className="mt-4 text-[11px] text-slate-400">
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
            Agradecimento especial a{" "}
            <a href="https://www.linkedin.com/in/pchgab/" target="_blank" rel="noopener noreferrer"
  style={{ color: "rgba(60,60,67,0.65)", textDecoration: "none", borderBottom: "1px solid rgba(60,60,67,0.25)" }}>
  Gabrielle Pacheco
</a>
            , que teve a brilhante ideia de fazer um nome <i>bem da hora</i> para o app.
          </p>
          <div className="flex gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
            {[
              { href: "https://x.com/mrclmonteiro", label: "X", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.26 5.636zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
              { href: "https://www.instagram.com/mrclmonteiro/", label: "Instagram", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg> },
              { href: "https://www.linkedin.com/in/mrclmonteiro/", label: "LinkedIn", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg> },
              { href: "https://github.com/mrclmonteiro/tremdahora", label: "GitHub", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg> },
              
            ].map(({ href, label, svg }) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center"
                style={{ color: "rgba(60,60,67,0.35)", lineHeight: 0 }}>
                {svg}
              </a>
            ))}
            </div>
            <div className="flex items-center gap-2">
    <span style={{ fontSize: 11, color: "rgba(60,60,67,0.4)" }}>Gostou?</span>
    <a href="https://www.buymeacoffee.com/mrclmonteiro" target="_blank" rel="noopener noreferrer"
      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#3c3c43", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, padding: "5px 12px", textDecoration: "none" }}>
      <span style={{ fontSize: 13 }}>☕</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "white", whiteSpace: "nowrap" }}>Me apoia um café</span>
    </a>
  </div>
          </div>
          </div>
          </div>
        </section>
      </div>
    </main>

      {/* ── LEFT PANELS CONTAINER — desktop only ── */}
      <div className="hidden md:flex flex-row h-screen shrink-0 p-3 z-10 order-first" style={{ position: "relative", overflow: "visible" }}>

        {/* Status sidebar */}
        <aside ref={sidebarRef} className="flex flex-col h-full overflow-y-auto rounded-2xl" style={{ width: 340, background: "rgba(245,247,251,0.82)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,0.55)", boxShadow: "0 8px 40px rgba(0,0,0,0.13)" }}>
          <div style={{ padding: "20px 20px 0", flex: 1 }}>
            <div ref={toggleRef} className="p-1 flex items-center rounded-full w-full mb-6" style={{ background: "rgba(60,60,67,0.10)", cursor: "pointer", position: "relative" }} onClick={() => setDistanceFrom(d => d === "mercado" ? "nh" : "mercado")}>
              <div style={{ position: "absolute", top: 4, bottom: 4, left: 4, width: "calc(50% - 4px)", background: "rgba(255,255,255,0.95)", borderRadius: 99, boxShadow: "0 1px 6px rgba(0,0,0,0.10)", transform: distanceFrom === "nh" ? "translateX(100%)" : "translateX(0%)", transition: "transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)", pointerEvents: "none" }} />
              <span className="flex-1 text-center text-sm py-2 font-semibold rounded-full relative z-10" style={{ color: distanceFrom === "mercado" ? "#1C1C1E" : "rgba(60,60,67,0.45)" }}>↓ Mercado</span>
              <span className="flex-1 text-center text-sm py-2 font-semibold rounded-full relative z-10" style={{ color: distanceFrom === "nh" ? "#1C1C1E" : "rgba(60,60,67,0.45)" }}>↑ Novo Hamburgo</span>
            </div>
            <div className="flex items-center gap-2.5 mb-2">
              <span style={{ position: "relative", display: "inline-flex", width: 12, height: 12, flexShrink: 0 }}>
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: isClosed ? "#8E8E93" : status.situation.toLowerCase().includes("normal") ? "#34C759" : "#FF9500", opacity: 0.5, animation: isClosed ? "none" : "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
                <span style={{ position: "relative", display: "inline-block", width: 12, height: 12, borderRadius: "50%", backgroundColor: isClosed ? "#8E8E93" : status.situation.toLowerCase().includes("normal") ? "#34C759" : "#FF9500", boxShadow: isClosed ? "none" : status.situation.toLowerCase().includes("normal") ? "0 0 8px rgba(52,199,89,0.6)" : "0 0 8px rgba(255,149,0,0.6)" }} />
              </span>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900 leading-tight">{status.situation}</h2>
            </div>
            {isStationsClosing && <p style={{ fontSize: 12, color: "#FF9500", fontWeight: 600, marginBottom: 12 }}>Estações fechadas. Últimos trens em circulação.</p>}
            {isClosed && <p style={{ fontSize: 12, color: "rgba(60,60,67,0.45)", fontWeight: 500, marginBottom: 12 }}>Operação encerrada. Retorno às 5h.</p>}
            <div className="flex flex-col gap-4 mt-4">
              {(status.intervalNHtoMercado ?? status.currentIntervalMinutes) !== null && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-base font-semibold text-slate-500">Intervalo entre partidas</p>
                  {status.intervalNHtoMercado !== null && status.intervalMercadotoNH !== null && status.intervalNHtoMercado !== status.intervalMercadotoNH ? (
                    <>
                      <div className="flex items-center gap-2"><span className="text-base font-semibold text-slate-900">{status.intervalNHtoMercado} min</span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#FF3B30", color: "white" }}>NOVO HAMBURGO</span></div>
                      <div className="flex items-center gap-2"><span className="text-base font-semibold text-slate-900">{status.intervalMercadotoNH} min</span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#007AFF", color: "white" }}>MERCADO</span></div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-slate-900">{status.intervalNHtoMercado ?? status.currentIntervalMinutes} min</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#FF3B30", color: "white" }}>NOVO HAMBURGO</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#007AFF", color: "white" }}>MERCADO</span>
                    </div>
                  )}
                </div>
              )}
              {!isClosed && <div><p className="text-base font-semibold text-slate-500">Motivo</p><p className="mt-0.5 text-sm leading-relaxed text-slate-700">{status.reason}</p></div>}
              {status.trechos.length > 0 && <div><p className="text-base font-semibold text-slate-500">Trecho afetado</p>{status.trechos.map((t, i) => <p key={i} className="mt-0.5 text-sm text-slate-700"><span style={{ color: "#FF9500" }}>● </span>{t.estacao1} → {t.estacao2}</p>)}</div>}
              {status.aeromovel && (
                <div>
                  <h3 className="mb-2 mt-1 text-base font-semibold text-slate-800">Aeromóvel</h3>
                  <div className="flex items-center gap-2"><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", flexShrink: 0, backgroundColor: status.aeromovel.situation.toLowerCase().includes("normal") ? "#34C759" : "#FF3B30" }} /><p className="text-base font-semibold text-slate-500">Situação</p></div>
                  <p className="mt-0.5 text-sm text-slate-700">{status.aeromovel.situation}</p>
                  {status.aeromovel.reason && <p className="mt-0.5 text-sm text-slate-700">{status.aeromovel.reason}</p>}
                </div>
              )}
            </div>
          </div>

          {/* footer */}
          <div style={{ padding: "16px 20px 20px", borderTop: "1px solid rgba(60,60,67,0.09)", background: "rgba(60,60,67,0.04)" }}>
            <p style={{ fontSize: 10, color: "rgba(60,60,67,0.3)", lineHeight: 1.5, marginBottom: 12 }}>
            A posição dos trens é estimada com base nos horários oficiais da Trensurb e pode não refletir a localização exata em tempo real. Dados operacionais fornecidos pela própria Trensurb.
          </p>
            <p style={{ fontSize: 10, color: "rgba(60,60,67,0.3)", lineHeight: 1.5, marginBottom: 12 }}>
              O <span style={{ color: "rgba(60,60,67,0.65)" }}>Trem da Hora</span> é um app desenvolvido por{" "}
              <span style={{ color: "rgba(60,60,67,0.65)" }}>Marcelo Monteiro</span> com auxílio da{" "}
              <span style={{ color: "rgba(60,60,67,0.65)" }}>Claude</span>.
              Agradecimento especial a{" "}
              <a href="https://www.linkedin.com/in/pchgab/" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(60,60,67,0.65)", textDecoration: "none", borderBottom: "1px solid rgba(60,60,67,0.25)" }}>Gabrielle Pacheco</a>
              , que teve a brilhante ideia de fazer um nome <i>bem da hora</i> para o app.
            </p>
            <div className="flex items-center justify-between">
              <div className="flex gap-4 items-center">
                {[
                  { href: "https://x.com/mrclmonteiro", label: "X", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.26 5.636zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
                  { href: "https://www.instagram.com/mrclmonteiro/", label: "Instagram", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg> },
                  { href: "https://www.linkedin.com/in/mrclmonteiro/", label: "LinkedIn", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg> },
                  { href: "https://github.com/mrclmonteiro/tremdahora", label: "GitHub", svg: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg> },
                ].map(({ href, label, svg }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(60,60,67,0.35)", lineHeight: 0 }}>{svg}</a>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 11, color: "rgba(60,60,67,0.4)" }}>Gostou?</span>
                <a href="https://www.buymeacoffee.com/mrclmonteiro" target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#3c3c43", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 99, padding: "5px 12px", textDecoration: "none" }}>
                  <span style={{ fontSize: 13 }}>☕</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "white", whiteSpace: "nowrap" }}>Me apoia um café</span>
                </a>
              </div>
            </div>
          </div>
        </aside>

        {/* Station panel — aparece ao lado da sidebar de status */}
        {selectedStationCode && (() => {
          const st = STATIONS.find(s => s.code === selectedStationCode)!;
          const conn = CONNECTIONS[selectedStationCode];
          const times = getStationTrainTimes(st.minutesFromMercado, now, headwayPeriods, headwaySouth, headwayNorth);
          const facilities: { label: string; active: boolean }[] = [
            { label: "Escada rolante", active: st.escadaRolante },
            { label: "Elevador", active: st.elevador },
            { label: "Biblioteca", active: st.biblioteca },
            { label: "Bicicletário", active: st.bicicletario },
            { label: "Caixa eletrônico", active: st.caixaEletronico },
            { label: "Farmácia", active: st.farmacia },
          ];
          const activeFacilities = facilities.filter(f => f.active);
          return (
            <aside key={selectedStationCode} className="flex flex-col w-92 overflow-y-auto rounded-2xl" style={{ position: "absolute", left: "calc(100% - 12px + 8px)", top: "12px", bottom: "12px", background: "rgba(245,247,251,0.82)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,0.55)", boxShadow: "0 8px 40px rgba(0,0,0,0.13)", transform: stationModalOpen ? "translateX(0) scale(1)" : "translateX(-8px) scale(0.97)", opacity: stationModalOpen ? 1 : 0, transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1), opacity 0.25s ease", pointerEvents: stationModalOpen ? "auto" : "none" }}>
              <div style={{ padding: "20px 20px 40px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1C1C1E" }}>{st.name}</h2>
                  <button onClick={closeStationModal} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(60,60,67,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="rgba(60,60,67,0.55)" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "rgba(60,60,67,0.45)", marginBottom: 20, fontWeight: 500 }}>{st.municipality} · {st.position}</p>
                {isClosed ? (
                  <div style={{ marginBottom: 20, padding: "16px", borderRadius: 16, background: "rgba(60,60,67,0.06)", textAlign: "center" }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(60,60,67,0.45)" }}>Operação encerrada.</p>
                    <p style={{ fontSize: 13, color: "rgba(60,60,67,0.35)", marginTop: 4 }}>Retorno às 5h.</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                    {([{ dir: "northbound" as const, label: "Novo Hamburgo", color: "#FF3B30" }, { dir: "southbound" as const, label: "Mercado", color: "#007AFF" }] as const).filter(({ dir }) => { if (st.code === "NH") return dir === "southbound"; if (st.code === "MR") return dir === "northbound"; return true; }).map(({ dir, label, color }) => {
                      const t = times[dir];
                      return (
                        <div key={dir} style={{ background: "rgba(60,60,67,0.06)", borderRadius: 16, padding: "14px 14px 12px" }}>
                          <span style={{ display: "inline-block", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "white", background: color, borderRadius: 6, padding: "2px 6px", marginBottom: 10 }}>{label}</span>
                          {t.last && <div style={{ marginBottom: 6 }}><p style={{ fontSize: 9, color: "rgba(60,60,67,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>Último</p><p style={{ fontSize: 18, fontWeight: 700, color: "rgba(60,60,67,0.4)", lineHeight: 1 }}>{t.last}</p></div>}
                          {t.next1 && <div style={{ marginBottom: 4 }}><p style={{ fontSize: 9, color: "rgba(60,60,67,0.45)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>Próximo</p><div style={{ display: "flex", alignItems: "center", gap: 7 }}><p style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1E", lineHeight: 1 }}>{t.next1}</p>{t.next1Arriving && (<span style={{ position: "relative", display: "inline-flex", width: 10, height: 10, flexShrink: 0 }}><span style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: "#FF3B30", opacity: 0.5, animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }} /><span style={{ position: "relative", display: "inline-block", width: 10, height: 10, borderRadius: "50%", backgroundColor: "#FF3B30", boxShadow: "0 0 6px rgba(255,59,48,0.6)" }} /></span>)}</div></div>}
                          {t.next2 && <div><p style={{ fontSize: 9, color: "rgba(60,60,67,0.45)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>Seguinte</p><p style={{ fontSize: 16, fontWeight: 600, color: "rgba(60,60,67,0.55)", lineHeight: 1 }}>{t.next2}</p></div>}
                          {!t.next1 && <p style={{ fontSize: 12, color: "rgba(60,60,67,0.3)" }}>Sem previsão</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {conn && (
                  <div style={{ marginBottom: 16 }}>
                    <p className="text-base font-semibold text-slate-500" style={{ marginBottom: 8 }}>Conexão disponível</p>
                    {conn.integrated ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <svg width="60" height="24" viewBox="-2 0 56 24" fill="none" style={{ flexShrink: 0 }}><rect x="0" y="1" width="52" height="22" rx="11" fill="white" stroke="#007AFF" strokeWidth="2.5"/><circle cx="11" cy="12" r="8" fill="#FF3B30" stroke="white" strokeWidth="1.5"/><circle cx="41" cy="12" r="8" fill="#FF3B30" stroke="white" strokeWidth="1.5"/><text x="41" y="16" fontSize="10" textAnchor="middle" fill="white">✈</text></svg>
                        <div><div style={{ fontSize: 13, fontWeight: 700, color: conn.color }}>{conn.label}</div>{conn.sublabel && <div style={{ fontSize: 12, color: "rgba(60,60,67,0.5)", marginTop: 2 }}>{conn.sublabel}</div>}</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: "50%", background: conn.color, flexShrink: 0 }} /><span style={{ fontSize: 13, fontWeight: 600, color: conn.color }}>{conn.label}</span>{conn.sublabel && <span style={{ fontSize: 12, color: "rgba(60,60,67,0.5)" }}>· {conn.sublabel}</span>}</div>
                    )}
                  </div>
                )}
                <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(60,60,67,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <p style={{ fontSize: 13, color: "rgba(60,60,67,0.6)", lineHeight: 1.4 }}>{st.address}</p>
                </div>
                {activeFacilities.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {activeFacilities.map(f => {
                      const icons: Record<string, React.ReactNode> = {
                        "Escada rolante": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18h4l9-12h5"/><path d="M14 18h7"/><circle cx="5" cy="6" r="2"/></svg>,
                        "Elevador": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 9l3-3 3 3"/><path d="M9 15l3 3 3-3"/></svg>,
                        "Biblioteca": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
                        "Bicicletário": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 0 0-1-1h-1l-3.5 9h7L15 6z"/><path d="M9.5 14L11 8h4.5"/></svg>,
                        "Caixa eletrônico": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
                        "Farmácia": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
                      };
                      return <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(60,60,67,0.07)", borderRadius: 99, padding: "6px 12px" }}>{icons[f.label]}<span style={{ fontSize: 12, fontWeight: 500, color: "rgba(60,60,67,0.7)" }}>{f.label}</span></div>;
                    })}
                  </div>
                )}
                <p style={{ fontSize: 10, color: "rgba(60,60,67,0.3)", marginTop: 20, lineHeight: 1.4 }}>Horários estimados com base no intervalo atual de {headwaySouth} min (↓) e {headwayNorth} min (↑).</p>
              </div>
            </aside>
          );
        })()}

      </div>{/* end left panels container */}

      {/* ── STATION MODAL — mobile only ── */}
      {selectedStationCode && (() => {
        const st = STATIONS.find(s => s.code === selectedStationCode)!;
        const conn = CONNECTIONS[selectedStationCode];
        const times = getStationTrainTimes(st.minutesFromMercado, now, headwayPeriods, headwaySouth, headwayNorth);
        const facilities: { label: string; active: boolean }[] = [
          { label: "Escada rolante", active: st.escadaRolante },
          { label: "Elevador", active: st.elevador },
          { label: "Biblioteca", active: st.biblioteca },
          { label: "Bicicletário", active: st.bicicletario },
          { label: "Caixa eletrônico", active: st.caixaEletronico },
          { label: "Farmácia", active: st.farmacia },
        ];
        const activeFacilities = facilities.filter(f => f.active);
        return (
          <div className="md:hidden fixed inset-0 flex flex-col justify-end" style={{ zIndex: 60, pointerEvents: stationModalOpen ? "auto" : "none" }}>
            <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", opacity: stationModalOpen ? 1 : 0, transition: "opacity 0.35s ease" }} onClick={closeStationModal} />
            <div
              ref={stationModalRef}
              style={{
                position: "relative",
                background: "#f5f7fb",
                borderRadius: "28px 28px 0 0",
                transform: stationDragStart !== null
                  ? `translateY(${stationDragOffset}px)`
                  : stationModalOpen ? "translateY(0)" : "translateY(100%)",
                transition: stationDragStart !== null ? "none" : "transform 0.45s cubic-bezier(0.32, 0.72, 0, 1)",
                maxHeight: "85vh",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 -8px 48px rgba(0,0,0,0.18)",
              }}>
              {/* Handle arrastável */}
              <div
                onTouchStart={handleStationDragStart}
                onTouchMove={handleStationDragMove}
                onTouchEnd={handleStationDragEnd}
                onMouseDown={handleStationDragStart}
                onMouseMove={handleStationDragMove}
                onMouseUp={handleStationDragEnd}
                style={{ padding: "12px 0 4px", display: "flex", justifyContent: "center", flexShrink: 0, cursor: "grab", touchAction: "none" }}>
                <div style={{ width: 40, height: 5, borderRadius: 99, background: "rgba(60,60,67,0.18)" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 20px 8px", flexShrink: 0 }}>
                <button
                  onClick={closeStationModal}
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: "rgba(60,60,67,0.1)", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    transition: "transform 0.09s cubic-bezier(0.33,1,0.68,1), background 0.15s ease",
                  }}
                  onMouseDown={e => (e.currentTarget.style.transform = "scale(0.88)")}
                  onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
                  onTouchStart={e => (e.currentTarget.style.transform = "scale(0.88)")}
                  onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; closeStationModal(); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6L18 18" stroke="rgba(60,60,67,0.55)" strokeWidth="2.2" strokeLinecap="round"/></svg>
                </button>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1C1C1E", margin: 0 }}>{st.name}</h2>
                  <p style={{ fontSize: 11, color: "rgba(60,60,67,0.45)", margin: "2px 0 0", fontWeight: 500 }}>{st.municipality} · {st.position}</p>
                </div>
                <div style={{ width: 36, flexShrink: 0 }} />
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: "8px 20px 40px" }}>
              {isClosed ? (
              <div style={{ marginBottom: 20, padding: "16px", borderRadius: 16, background: "rgba(60,60,67,0.06)", textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: "rgba(60,60,67,0.45)" }}>Operação encerrada.</p>
              <p style={{ fontSize: 13, color: "rgba(60,60,67,0.35)", marginTop: 4 }}>Retorno às 5h.</p>
              </div>
              ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {([
              { dir: "northbound" as const, label: "Novo Hamburgo", color: "#FF3B30" },
              { dir: "southbound" as const, label: "Mercado", color: "#007AFF" },
              ] as const).filter(({ dir }) => {
              if (st.code === "NH") return dir === "southbound";
              if (st.code === "MR") return dir === "northbound";
              return true;
              }).map(({ dir, label, color }) => {
                    const t = times[dir];
                    return (
                      <div key={dir} style={{ background: "rgba(60,60,67,0.06)", borderRadius: 16, padding: "14px 14px 12px" }}>
                        <span style={{ display: "inline-block", fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "white", background: color, borderRadius: 6, padding: "2px 6px", marginBottom: 10 }}>{label}</span>
                        {t.last && <div style={{ marginBottom: 6 }}><p style={{ fontSize: 9, color: "rgba(60,60,67,0.4)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>Último</p><p style={{ fontSize: 18, fontWeight: 700, color: "rgba(60,60,67,0.4)", lineHeight: 1 }}>{t.last}</p></div>}
                        {t.next1 && <div style={{ marginBottom: 4 }}>
  <p style={{ fontSize: 9, color: "rgba(60,60,67,0.45)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>Próximo</p>
  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
    <p style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1E", lineHeight: 1 }}>{t.next1}</p>
    {t.next1Arriving && (
      <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10, flexShrink: 0 }}>
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: "#FF3B30", opacity: 0.5, animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
        <span style={{ position: "relative", display: "inline-block", width: 10, height: 10, borderRadius: "50%", backgroundColor: "#FF3B30", boxShadow: "0 0 6px rgba(255,59,48,0.6)" }} />
      </span>
    )}
  </div>
</div>}
                        {t.next2 && <div><p style={{ fontSize: 9, color: "rgba(60,60,67,0.45)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 1 }}>Seguinte</p><p style={{ fontSize: 16, fontWeight: 600, color: "rgba(60,60,67,0.55)", lineHeight: 1 }}>{t.next2}</p></div>}
                        {!t.next1 && <p style={{ fontSize: 12, color: "rgba(60,60,67,0.3)" }}>Sem previsão</p>}
                      </div>
                    );
                  })}
                </div>
                )}
                {conn && (
  <div style={{ marginBottom: 16 }}>
    <p className="text-base font-semibold text-slate-500" style={{ marginBottom: 8 }}>Conexão disponível</p>
    {conn.integrated ? (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="60" height="24" viewBox="-2 0 56 24" fill="none" style={{ flexShrink: 0 }}>
  <rect x="0" y="1" width="52" height="22" rx="11" fill="white" stroke="#007AFF" strokeWidth="2.5"/>
  <circle cx="11" cy="12" r="8" fill="#FF3B30" stroke="white" strokeWidth="1.5"/>
  <circle cx="41" cy="12" r="8" fill="#FF3B30" stroke="white" strokeWidth="1.5"/>
  <text x="41" y="16" fontSize="10" textAnchor="middle" fill="white">✈</text>
        </svg>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: conn.color }}>{conn.label}</div>
          {conn.sublabel && <div style={{ fontSize: 12, color: "rgba(60,60,67,0.5)", marginTop: 2 }}>{conn.sublabel}</div>}
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: conn.color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: conn.color }}>{conn.label}</span>
        {conn.sublabel && <span style={{ fontSize: 12, color: "rgba(60,60,67,0.5)" }}>· {conn.sublabel}</span>}
      </div>
    )}
  </div>
)}
                <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(60,60,67,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <p style={{ fontSize: 13, color: "rgba(60,60,67,0.6)", lineHeight: 1.4 }}>{st.address}</p>
                </div>
                {activeFacilities.length > 0 && (
                  <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {activeFacilities.map(f => {
                        const icons: Record<string, React.ReactNode> = {
                          "Escada rolante": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18h4l9-12h5"/><path d="M14 18h7"/><circle cx="5" cy="6" r="2"/></svg>,
                          "Elevador": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 9l3-3 3 3"/><path d="M9 15l3 3 3-3"/></svg>,
                          "Biblioteca": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
                          "Bicicletário": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 0 0-1-1h-1l-3.5 9h7L15 6z"/><path d="M9.5 14L11 8h4.5"/></svg>,
                          "Caixa eletrônico": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
                          "Farmácia": <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
                        };
                        return (
                          <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(60,60,67,0.07)", borderRadius: 99, padding: "6px 12px", color: "rgba(60,60,67,0.6)" }}>
                            {icons[f.label]}
                            <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(60,60,67,0.7)" }}>{f.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <p style={{ fontSize: 10, color: "rgba(60,60,67,0.3)", marginTop: 20, lineHeight: 1.4 }}>Horários estimados com base no intervalo atual de {headwaySouth} min (↓) e {headwayNorth} min (↑).</p>
              </div>
            </div>
          </div>
        );
      })()}
      {/* ── ANÚNCIO DINÂMICO ── */}
      {announcement && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px",
            background: "rgba(0,0,0,0.25)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          <div style={{
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(40px) saturate(200%)",
            WebkitBackdropFilter: "blur(40px) saturate(200%)",
            border: "1px solid rgba(255,255,255,0.75)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.9)",
            borderRadius: 28,
            padding: "28px 24px 24px",
            maxWidth: 340,
            width: "100%",
            textAlign: "center",
          }}>
            {/* Ícone */}
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="24" fill="rgba(255,149,0,0.12)"/>
                <circle cx="24" cy="24" r="18" fill="rgba(255,149,0,0.18)"/>
                <path d="M24 14v13" stroke="#FF9500" strokeWidth="2.8" strokeLinecap="round"/>
                <circle cx="24" cy="33" r="1.8" fill="#FF9500"/>
              </svg>
            </div>
            {/* Título */}
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1C1C1E", margin: 0, marginBottom: 10, letterSpacing: "-0.2px" }}>
              {announcement.title}
            </h2>
            {/* Texto */}
            <p style={{ fontSize: 14, color: "rgba(60,60,67,0.75)", lineHeight: 1.55, margin: 0, marginBottom: announcement.link ? 6 : 20 }}>
              {announcement.body}
            </p>
            {announcement.link && (
              <p style={{ margin: "0 0 20px" }}>
                <a
                  href={announcement.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#007AFF", textDecoration: "none", fontWeight: 600, fontSize: 14 }}
                >
                  {announcement.link_label || "Saiba mais."}
                </a>
              </p>
            )}
            {/* Botão OK */}
            <button
              onClick={() => {
                try { localStorage.setItem(`announcement_seen_${announcement.storage_key}`, "1") } catch {}
                setAnnouncement(null);
              }}
              onMouseDown={e => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.filter = "brightness(1.15)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.filter = "brightness(1)"; }}
              onTouchStart={e => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.filter = "brightness(1.15)"; }}
              onTouchEnd={e => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.filter = "brightness(1)";
                try { localStorage.setItem(`announcement_seen_${announcement.storage_key}`, "1") } catch {}
                setAnnouncement(null);
              }}
              style={{
                width: "100%", padding: "14px",
                background: "#007AFF", color: "white",
                border: "none", borderRadius: 99,
                fontSize: 16, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(0,122,255,0.35)",
                transition: "transform 0.15s cubic-bezier(0.34,1.56,0.64,1), filter 0.1s ease",
                letterSpacing: "-0.1px",
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {tourStep >= 0 && (
        <TremTour
          step={tourStep}
          onAdvance={() => {
            if (tourStep < TREM_TOUR_STEPS.length - 1) {
              setTourStep(s => s + 1);
            } else {
              setTourStep(-1);
              try { localStorage.setItem("trem_tour_done", "1"); } catch (_) {}
            }
          }}
          modalRef={modalRef}
          headerRef={headerRef}
          stationRef={stationTourRef}
          sidebarRef={sidebarRef}
          toggleRef={toggleRef}
        />
      )}
    </div>
  );
}