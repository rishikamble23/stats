import type { Metadata, Viewport } from "next";
import { Nunito, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const appFont = Plus_Jakarta_Sans({
  variable: "--font-app",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const cardFont = Nunito({
  variable: "--font-card",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: { default: "howitsgoing — cute progress cards for your app", template: "%s · howitsgoing" },
  description:
    "Connect Stripe, PostHog, GitHub and more. Turn MRR, active users, stars and downloads into minimal, share-ready images in one click.",
};

export const viewport: Viewport = {
  themeColor: "#fdfbf7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${appFont.variable} ${cardFont.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
