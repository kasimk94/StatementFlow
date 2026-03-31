import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StatementFlow – Free Bank Statement Converter | PDF to Excel UK",
  description:
    "Convert any UK bank statement PDF to Excel instantly. Works with Barclays, HSBC, Lloyds, NatWest, Monzo, Starling & more. Free bank statement analyser with spending dashboard. No sign-up required.",
  keywords: [
    "bank statement converter",
    "bank statement analyser",
    "PDF to Excel converter UK",
    "spending tracker UK",
    "budget tracker UK",
    "Barclays statement converter",
    "HSBC statement converter",
    "Lloyds statement converter",
    "NatWest PDF to Excel",
    "Monzo statement analyser",
    "Starling statement converter",
    "Halifax statement converter",
    "Santander statement converter",
    "free bank statement tool",
    "bank statement to spreadsheet",
  ],
  authors: [{ name: "StatementFlow" }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "https://statementflow.app",
  },
  openGraph: {
    type: "website",
    url: "https://statementflow.app",
    title: "StatementFlow – Free Bank Statement Converter UK",
    description:
      "Upload your PDF bank statement and instantly get a beautiful Excel report and spending dashboard. Works with all major UK banks. Free, private, no sign-up.",
    siteName: "StatementFlow",
    locale: "en_GB",
    images: [
      {
        url: "https://statementflow.app/og-image.svg",
        width: 1200,
        height: 630,
        alt: "StatementFlow – Free UK Bank Statement Converter",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@statementflow",
    title: "StatementFlow – Free Bank Statement Converter UK",
    description:
      "Convert your PDF bank statement to Excel instantly. Free, secure, works with all UK banks.",
    images: ["https://statementflow.app/og-image.svg"],
  },
  other: {
    "geo.region": "GB",
    "geo.placename": "United Kingdom",
    "language": "English",
    "theme-color": "#6c5ce7",
  },
};

// ─── JSON-LD Schemas ──────────────────────────────────────────────────────────

const webAppSchema = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "StatementFlow",
  url: "https://statementflow.app",
  description:
    "Free UK bank statement converter. Convert PDF bank statements to Excel reports and spending dashboards instantly.",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web Browser",
  browserRequirements: "Requires JavaScript",
  offers: [
    {
      "@type": "Offer",
      name: "Free Plan",
      price: "0",
      priceCurrency: "GBP",
    },
    {
      "@type": "Offer",
      name: "Pro Plan",
      price: "7.99",
      priceCurrency: "GBP",
      billingIncrement: "P1M",
    },
    {
      "@type": "Offer",
      name: "Business Plan",
      price: "25.99",
      priceCurrency: "GBP",
      billingIncrement: "P1M",
    },
  ],
  featureList: [
    "PDF bank statement conversion",
    "Excel report generation",
    "Spending category analysis",
    "Interactive transaction dashboard",
    "CSV export",
    "Supports Barclays, HSBC, Lloyds, NatWest, Monzo, Starling, Halifax, Santander",
  ],
  screenshot: "https://statementflow.app/og-image.svg",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "127",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "StatementFlow",
  url: "https://statementflow.app",
  logo: "https://statementflow.app/og-image.svg",
  description: "StatementFlow provides free UK bank statement conversion tools",
  areaServed: "GB",
  foundingDate: "2026",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "StatementFlow",
  operatingSystem: "Web",
  applicationCategory: "FinanceApplication",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "GBP",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Which banks are supported?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "StatementFlow supports all major UK banks including Barclays, HSBC, Lloyds, NatWest, Santander, Monzo, Starling, and Halifax.",
      },
    },
    {
      "@type": "Question",
      name: "Is my data secure?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Your files are processed entirely in your browser memory and never uploaded to any server. Data is deleted immediately after processing.",
      },
    },
    {
      "@type": "Question",
      name: "How do I convert my bank statement to Excel?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Simply upload your PDF bank statement to StatementFlow, and within seconds you will receive a formatted Excel report with spending categories, transaction history and a summary dashboard.",
      },
    },
    {
      "@type": "Question",
      name: "Is StatementFlow really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, the free plan allows 3 PDF uploads per month with no sign-up or credit card required.",
      },
    },
    {
      "@type": "Question",
      name: "What file types are supported?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "StatementFlow currently supports PDF bank statements from all major UK banks.",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className={`${geist.variable} h-full antialiased`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
