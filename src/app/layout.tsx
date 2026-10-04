import type { Metadata } from "next";
import { PWARegister } from "@/components/PWARegister";
import "./globals.css";
import "./theme.css";

const themeScript = `(function(){try{var t=localStorage.getItem("moneypilot-theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})()`;

export const metadata: Metadata = {
  title: "MoneyPilot AI — Tu dinero, en perspectiva",
  description: "Tu copiloto financiero privado. Controla tus movimientos, metas y patrimonio desde un solo lugar.",
  applicationName: "MoneyPilot AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MoneyPilot",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" data-theme="light" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
