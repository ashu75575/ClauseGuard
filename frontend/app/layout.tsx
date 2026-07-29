import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ClauseGuard — Contract Intelligence",
    template: "%s · ClauseGuard",
  },
  description:
    "Review contract risks, inspect flagged clauses, and ask grounded questions about your documents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
