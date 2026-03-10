export async function GET() {
  const user = process.env.SISOP_USER;
  const senha = process.env.SISOP_SENHA;
  const base = "https://sisop.trensurb.gov.br/App";

  const [operacional, aeromovel] = await Promise.all([
    fetch(`${base}/getSituacaoOperacional.php?user=${user}&senha=${senha}`).then(r => r.json()),
    fetch(`${base}/getSituacaoAeromovel.php?user=${user}&senha=${senha}`).then(r => r.json()),
  ]);

  return Response.json({ operacional, aeromovel });
}