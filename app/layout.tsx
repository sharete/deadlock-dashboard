import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deadlock Personal Intelligence",
  description:
    "Privates Deadlock-Dashboard für Matches, Helden, Builds und persönliche Entwicklung.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
