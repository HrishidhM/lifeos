import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "LifeOS", description: "Plan your goals, tasks, money and habits in one place." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;600;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
