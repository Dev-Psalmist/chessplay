import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CHESS PLAY | Think. Move. Conquer.",
  description:
    "Play chess online, challenge intelligent opponents, compete in tournaments and climb the global leaderboard.",
  applicationName: "CHESS PLAY",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}