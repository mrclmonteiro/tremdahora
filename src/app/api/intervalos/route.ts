export async function GET() {
  const data = await fetch(
    "https://sisop.trensurb.gov.br/site/getTabelaIntervalos.php"
  ).then(r => r.json());

  return Response.json(data);
}