import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trem da Hora",
  description: "Acompanhamento de horários e operação da Trensurb em Porto Alegre.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
