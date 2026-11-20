import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agenda",
  description: "Un agenda qui rassemble les dates de vos autres applications.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon.svg` },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="top">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden />
            Agenda
          </Link>
          <nav>
            <Link href="/">Calendrier</Link>
            <Link href="/applications">Applications liées</Link>
            <Link href="/notifications">Notifications</Link>
          </nav>
        </header>
        <main className="wrap">{children}</main>
      </body>
    </html>
  );
}
