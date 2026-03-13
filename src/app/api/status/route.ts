import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";



export async function GET() {
  const user = process.env.SISOP_USER;
  const senha = process.env.SISOP_SENHA;
  const base = "https://sisop.trensurb.gov.br/App";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [operacional, aeromovel] = await Promise.all([
    fetch(`${base}/getSituacaoOperacional.php?user=${user}&senha=${senha}`).then(r => r.json()),
    fetch(`${base}/getSituacaoAeromovel.php?user=${user}&senha=${senha}`).then(r => r.json()),
  ]);

  // Extrai intervalos do payload cru
  const intervalos = Array.isArray(operacional?.intervalos) ? operacional.intervalos : [];
  const nhNow = intervalos.find((i: any) => i["estacao-partida"] === "Novo Hamburgo")?.intervalo ?? operacional?.["intervalo-entre-trens"] ?? null;
  const mrNow = intervalos.find((i: any) => i["estacao-partida"] === "Mercado")?.intervalo ?? operacional?.["intervalo-entre-trens"] ?? null;

  if (nhNow && mrNow) {
    const { data: last } = await supabase
      .from("headway_history")
      .select("headway_nh, headway_mr")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    if (!last || last.headway_nh !== nhNow || last.headway_mr !== mrNow) {
      await supabase.from("headway_history").insert({ headway_nh: nhNow, headway_mr: mrNow });
    }
  }

  return NextResponse.json({ operacional, aeromovel });
}