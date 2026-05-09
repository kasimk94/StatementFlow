import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import AuthSessionProvider from "@/components/SessionProvider";
import Script from "next/script";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MoneySorted — Free UK Bank Statement Analyser",
  description:
    "Upload your PDF bank statement and instantly see where your money went. Works with Barclays, HSBC, Lloyds, NatWest, Monzo, Starling & more. Free, private, no bank login required.",
  keywords: [
    "bank statement converter",
    "bank statement analyser",
    "PDF to Excel converter UK",
    "spending tracker UK",
    "MoneySorted",
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
  authors: [{ name: "MoneySorted" }],
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
    canonical: "https://www.getmoneysorted.co.uk",
  },
  openGraph: {
    type: "website",
    url: "https://www.getmoneysorted.co.uk",
    title: "MoneySorted — Free UK Bank Statement Analyser",
    description:
      "Upload your PDF bank statement and instantly see where your money went. Works with all major UK banks. Free, private, no bank login.",
    siteName: "MoneySorted",
    locale: "en_GB",
    images: [
      {
        url: "https://www.getmoneysorted.co.uk/og-image.svg",
        width: 1200,
        height: 630,
        alt: "MoneySorted — Free UK Bank Statement Analyser",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@moneysorted",
    title: "MoneySorted — Free UK Bank Statement Analyser",
    description:
      "Upload your PDF bank statement and instantly see where your money went. Free, secure, works with all UK banks.",
    images: ["https://www.getmoneysorted.co.uk/og-image.svg"],
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
  name: "MoneySorted",
  url: "https://www.getmoneysorted.co.uk",
  description:
    "Upload your PDF bank statement and get instant clarity on where your money went. Works with all major UK banks.",
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
      price: "4.99",
      priceCurrency: "GBP",
      billingIncrement: "P1M",
    },
    {
      "@type": "Offer",
      name: "Business Plan",
      price: "19.99",
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
  screenshot: "https://www.getmoneysorted.co.uk/og-image.svg",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "127",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MoneySorted",
  url: "https://www.getmoneysorted.co.uk",
  logo: "https://www.getmoneysorted.co.uk/og-image.svg",
  description: "MoneySorted helps you understand your money by analysing your bank statements instantly.",
  areaServed: "GB",
  foundingDate: "2026",
};

const softwareAppSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MoneySorted",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: "Free UK bank statement analyser. Upload a PDF from any UK bank and instantly see spending categories, subscriptions, and money flow. No bank login required.",
  url: "https://www.getmoneysorted.co.uk",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "GBP",
  },
  featureList: [
    "AI-powered transaction categorisation",
    "Spending personality insights",
    "Subscription detection",
    "CSV and Excel export",
    "Accountant mode",
    "Zero data retention",
  ],
  screenshot: "https://www.getmoneysorted.co.uk/og-image.png",
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is MoneySorted free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, MoneySorted has a free tier that lets you upload and analyse your bank statement with no account required. You get a full spending breakdown, category analysis, and money flow instantly.",
      },
    },
    {
      "@type": "Question",
      name: "Which UK banks does MoneySorted support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "MoneySorted works with all major UK banks including Barclays, HSBC, Lloyds, NatWest, Halifax, Santander, Monzo, Starling Bank, and TSB. Simply export your statement as a PDF from your online banking and upload it.",
      },
    },
    {
      "@type": "Question",
      name: "Is my bank statement data safe with MoneySorted?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MoneySorted uses a zero-knowledge architecture. Your bank statement is analysed and immediately deleted after processing. We never store your banking data, never sell your information, and require no bank login or open banking connection.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to connect my bank account?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. MoneySorted works entirely from PDF uploads. There is no bank login, no open banking connection, and no account required to get started.",
      },
    },
    {
      "@type": "Question",
      name: "Can accountants use MoneySorted for client statements?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. MoneySorted has a dedicated Accountant Mode that presents data in a structured, professional format suitable for processing client bank statements. The Business plan includes bulk processing and client management features.",
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
    <html lang="en-GB" className={`${inter.variable} ${GeistSans.variable} ${playfair.variable} h-full antialiased`}>
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
      <body className="min-h-full flex flex-col">
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HL1LT0C0J3"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-HL1LT0C0J3');
          `}
        </Script>
      </body>
    </html>
  );
}
