import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "SpeakUp — English Voice Tutor",
  description: "Голосовой ИИ-тренажёр английского к собеседованию",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${display.variable} ${body.variable}`}>
        {children}
      </body>
    </html>
  );
}
