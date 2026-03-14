import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const centuryGothic = localFont({
  src: [
    { path: "../fonts/CenturyGothicPaneuropeanThin.ttf", weight: "100", style: "normal" },
    { path: "../fonts/CenturyGothicPaneuropeanThinItalic.ttf", weight: "100", style: "italic" },
    { path: "../fonts/CenturyGothicPaneuropeanLight.ttf", weight: "300", style: "normal" },
    { path: "../fonts/CenturyGothicPaneuropeanLightItalic.ttf", weight: "300", style: "italic" },
    { path: "../fonts/CenturyGothicPaneuropeanRegular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/CenturyGothicPaneuropeanItalic.ttf", weight: "400", style: "italic" },
    { path: "../fonts/CenturyGothicPaneuropeanSemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/CenturyGothicPaneuropeanSemiBoldItalic.ttf", weight: "600", style: "italic" },
    { path: "../fonts/CenturyGothicPaneuropeanBold.ttf", weight: "700", style: "normal" },
    { path: "../fonts/CenturyGothicPaneuropeanBoldItalic.ttf", weight: "700", style: "italic" },
    { path: "../fonts/CenturyGothicPaneuropeanExtraBold.ttf", weight: "800", style: "normal" },
    { path: "../fonts/CenturyGothicPaneuropeanExtraBoldItalic.ttf", weight: "800", style: "italic" },
    { path: "../fonts/CenturyGothicPaneuropeanBlack.ttf", weight: "900", style: "normal" },
    { path: "../fonts/CenturyGothicPaneuropeanBlackItalic.ttf", weight: "900", style: "italic" },
  ],
  variable: "--font-century",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const neueMachina = localFont({
  src: [
    { path: "../fonts/PPNeueMachina-PlainLight.otf", weight: "300", style: "normal" },
    { path: "../fonts/PPNeueMachina-PlainLightItalic.otf", weight: "300", style: "italic" },
    { path: "../fonts/PPNeueMachina-PlainRegular.otf", weight: "400", style: "normal" },
    { path: "../fonts/PPNeueMachina-PlainRegularItalic.otf", weight: "400", style: "italic" },
    { path: "../fonts/PPNeueMachina-PlainUltrabold.otf", weight: "800", style: "normal" },
    { path: "../fonts/PPNeueMachina-PlainUltraboldItalic.otf", weight: "800", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Throughput | AAVA Product Studio Training & Certification",
  description:
    "Internal training and public certification platform for AAVA Product Studio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${centuryGothic.variable} ${geistMono.variable} ${neueMachina.variable} antialiased font-sans`}>
        {children}
      </body>
    </html>
  );
}
