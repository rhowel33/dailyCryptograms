import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daily Cryptograms",
  description: "A new cipher quote every day. Decode it letter by letter.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
