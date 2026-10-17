import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import "@/styles/cinematic.css";
import "@/styles/theme.css";
import "@/styles/production.css";

export const metadata: Metadata = {
  title: "BLOOM — The Art of Becoming",
  description:
    "Every form begins with a fracture. An interactive exploration of form, transformation, and the beautiful possibility of becoming.",
  applicationName: "BLOOM",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
