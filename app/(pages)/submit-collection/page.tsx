import SubmitCollectionClient from "@/src/ui/submit-collection/SubmitCollectionClient";
import type { Metadata } from "next";


export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Submit a Collection | Panthart",
  description:
    "List your NFT collection on Panthart. Provide contract details, media, and links to get discovered by the Electroneum (ETN) community.",
  alternates: { canonical: "/submit-collection" },
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
  openGraph: {
    title: "Submit a Collection | Panthart",
    description:
      "Onboard your ERC-721 collection to Panthart. Reach new collectors across the ETN ecosystem.",
    url: "/submit-collection",
    siteName: "Panthart",
    type: "website",
    images: ["/opengraph-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Submit a Collection | Panthart",
    description: "List your NFT collection on Panthart and reach ETN collectors.",
    images: ["/opengraph-image.png"],
    creator: "@decentroneum",
  },
  keywords: [
    "Panthart",
    "Submit NFT Collection",
    "Electroneum",
    "ETN",
    "ERC721",
    "NFT Marketplace Listing",
  ],
  category: "marketplace",
  referrer: "origin-when-cross-origin",
  formatDetection: { email: false, address: false, telephone: false },
};

export default function SubmitCollectionPage() {
  return <SubmitCollectionClient />;
}
