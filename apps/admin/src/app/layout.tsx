import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "MyCommunity · Society management",
  description:
    "A little more connected. Society administration for MyCommunity.",
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
