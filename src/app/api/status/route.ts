import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SISOP_URL =
  "https://sisop.trensurb.gov.br/App/getSituacaoOperacional.php?user=trensite&senha=h1ATPtmrKiOxe3qC";
const AERO_URL =
  "https://sisop.trensurb.gov.br/App/getSituacaoAeromovel.php?user=trensite&senha=h1ATPtmrKiOxe3qC";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SERVICE_START_HOUR = 5; // trens operam a partir das 5h

export async function GET() {
  try {
    const [opRes, aeroRes] = await Promise.all([
      fetch(SISOP_URL, { cache: "no-store" }),
      fetch(AERO_URL, { cache: "no-store" }).catch(() => null),
    ]);

    if (!opRes.ok) {
      return NextResponse.json({ error: "SISOP indisponível" }, { status: 502 });
    }

    const opData = await opRes.json();
    const aeroData = aeroRes?.ok ? await aeroRes.json().catch(() => null) : null;

    // Extrai os intervalos de partida da resposta
    const op = (opData?.operacional ?? opData) as Record<string, unknown>;
    const intervalos = Array.isArray(op?.["intervalos"])
      ? (op["intervalos"] as { intervalo: number; "estacao-partida": string }[])
      : [];

    const ivNH = intervalos.find((i) => i["estacao-partida"] === "Novo Hamburgo")?.intervalo ?? null;
    const ivMR = intervalos.find((i) => i["estacao-partida"] === "Mercado")?.intervalo ?? null;
    const fallbackHW =
      typeof op?.["intervalo-entre-trens"] === "number" ? (op["intervalo-entre-trens"] as number) : null;

    const hwNH = ivNH ?? fallbackHW;
    const hwMR = ivMR ?? fallbackHW;

    // Registra o headway no histórico, garantindo sempre um registro desde o início do serviço
    if (hwNH !== null && hwMR !== null) {
      await recordHeadway(hwNH, hwMR);
    }

    return NextResponse.json({ operacional: op, aeromovel: aeroData });
  } catch {
    return NextResponse.json({ error: "Falha ao obter status operacional" }, { status: 502 });
  }
}

async function recordHeadway(hwNH: number, hwMR: number) {
  const now = new Date();
  const hour = now.getHours();

  // Só registra durante o horário de operação
  if (hour < SERVICE_START_HOUR || hour >= 23) return;

  // Início do serviço de hoje às 5h
  const todayServiceStart = new Date(now);
  todayServiceStart.setHours(SERVICE_START_HOUR, 0, 0, 0);

  // Busca o registro mais recente do dia
  const { data: todayRecords } = await supabase
    .from("headway_history")
    .select("id, headway_nh, headway_mr")
    .gte("recorded_at", todayServiceStart.toISOString())
    .order("recorded_at", { ascending: false })
    .limit(1);

  const lastRecord = todayRecords?.[0] ?? null;

  if (!lastRecord) {
    // Nenhum registro hoje ainda — insere o headway atual às 5h.
    // Isso garante que buildDepartures tenha o headway correto desde o início do serviço,
    // mesmo quando o usuário abre o app depois de uma mudança de intervalo.
    await supabase.from("headway_history").insert({
      recorded_at: todayServiceStart.toISOString(),
      headway_nh: hwNH,
      headway_mr: hwMR,
    });
    return;
  }

  // Headway mudou desde o último registro — insere a mudança com timestamp atual
  if (lastRecord.headway_nh !== hwNH || lastRecord.headway_mr !== hwMR) {
    await supabase.from("headway_history").insert({
      headway_nh: hwNH,
      headway_mr: hwMR,
      // recorded_at é gerado automaticamente pelo Supabase (default now())
    });
  }
}