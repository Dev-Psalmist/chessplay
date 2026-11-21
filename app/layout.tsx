import type { Metadata, Viewport } from "next";
import "./globals.css";
import Splash from "@/components/Splash";

export const metadata: Metadata = {
  title: "CHESS PLAY | Think. Move. Conquer.",
  description:
    "Play chess online, solve puzzles, climb the levels and beat the clock. Challenge friends, play the engine, and track every rating point.",
  applicationName: "CHESS PLAY",
  icons: {
    icon: "/brand/chessplay-mark.png",
    apple: "/brand/chessplay-mark.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#070a14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Splash />
        {children}
      </body>
    </html>
  );
}
