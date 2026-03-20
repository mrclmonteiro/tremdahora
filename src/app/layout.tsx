import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  manifest: "/manifest.json",
  title: "Trem da Hora",
  description: "Acompanhamento de horários e operação da Trensurb em Porto Alegre.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Trem da Hora",
    startupImage: "/apple-touch-icon.png",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon-192.png", sizes: "192x192" },
      { url: "/icon-512.png", sizes: "512x512" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Trem da Hora",
    description: "Acompanhe os horários e operação da Trensurb em tempo real",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#eceff3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body>
        <svg
          aria-hidden="true"
          focusable="false"
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", pointerEvents: "none" }}
        >
          <defs>
            <filter
              id="lg-refract"
              colorInterpolationFilters="linearRGB"
              x="-5%"
              y="-5%"
              width="110%"
              height="110%"
            >
              <feTurbulence type="fractalNoise" baseFrequency="0.018 0.014" numOctaves="2" seed="7" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <filter id="lg-gooey" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
              <feColorMatrix
                in="blur"
                mode="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
                result="goo"
              />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
        </svg>

        {children}

        <div
          className="md:hidden"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            height: "calc(env(safe-area-inset-top) + 28px)",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
        <div
          className="md:hidden"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 40,
            height: "calc(env(safe-area-inset-bottom) + 40px)",
            background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 100%)",
            pointerEvents: "none",
          }}
        />
      </body>
    </html>
  );
}