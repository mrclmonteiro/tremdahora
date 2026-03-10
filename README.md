# Trem da Hora

Scaffold inicial do app de acompanhamento da Trensurb (Porto Alegre), com stack moderna e pronta para evoluir.

## Stack

- Next.js `16.1.6`
- React `19.2.3`
- TypeScript `^5`
- Tailwind CSS `^4.2.1`
- Supabase (`@supabase/ssr` `^0.9.0` e `@supabase/supabase-js` `^2.98.0`)

## Primeiros passos

1. Instale as dependencias:

```bash
npm install
```

2. Configure variaveis de ambiente:

```bash
cp .env.example .env.local
```

3. Preencha no `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Rode o projeto:

```bash
npm run dev
```

## Estrutura

- `src/app`: rotas e layout base (App Router)
- `src/lib/supabase`: clientes Supabase para browser, server e middleware
- `middleware.ts`: atualizacao de sessao do Supabase

## Fora do escopo neste scaffold

- Scripts de seed
- Web push
- html2canvas
