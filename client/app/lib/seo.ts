import type { MetaDescriptor } from "react-router";

export const SITE_NAME = "Storyteller";
export const LOCAL_SITE_URL = "http://localhost:5174";
export const OG_IMAGE_PATH = "/og/storyteller-preview.png";

export const HOME_TITLE = "Storyteller - English learning through stories";
export const HOME_DESCRIPTION =
  "Bite-sized reading and writing practice tuned to your age and interests. Read fresh stories, get feedback, and watch your streak climb.";

export const HELP_TITLE = "Help & FAQ - Storyteller";
export const HELP_DESCRIPTION =
  "Answers to common questions about Storyteller's adaptive English reading and writing practice.";

type JsonLdPrimitive = string | number | boolean | null;
export type JsonLdValue =
  | JsonLdPrimitive
  | JsonLdValue[]
  | { [key: string]: JsonLdValue };
export type JsonLdObject = { [key: string]: JsonLdValue };

interface PageMetaOptions {
  title: string;
  description: string;
  path: string;
  jsonLd?: JsonLdObject | JsonLdObject[];
}

export function siteUrl(): string {
  const configured =
    typeof import.meta !== "undefined"
      ? import.meta.env.VITE_PUBLIC_SITE_URL
      : undefined;
  return normalizeSiteUrl(configured) || LOCAL_SITE_URL;
}

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, `${siteUrl()}/`).toString();
}

export function pageMeta({
  title,
  description,
  path,
  jsonLd,
}: PageMetaOptions): MetaDescriptor[] {
  const canonical = absoluteUrl(path);
  const image = absoluteUrl(OG_IMAGE_PATH);
  const meta: MetaDescriptor[] = [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "index, follow, max-image-preview:large" },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonical },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: `${SITE_NAME} preview` },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];

  if (jsonLd) {
    meta.push({ "script:ld+json": jsonLd });
  }

  return meta;
}

export function homeJsonLd(): JsonLdObject[] {
  const home = absoluteUrl("/");
  const organizationId = `${home}#organization`;

  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": organizationId,
      name: SITE_NAME,
      url: home,
      logo: absoluteUrl("/brand/app-icon.svg"),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${home}#website`,
      name: SITE_NAME,
      url: home,
      inLanguage: "en",
      publisher: {
        "@id": organizationId,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${home}#app`,
      name: SITE_NAME,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: home,
      description: HOME_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      audience: {
        "@type": "EducationalAudience",
        educationalRole: "student",
      },
    },
  ];
}

export function faqJsonLd(faqs: Array<[string, string]>): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
}

function normalizeSiteUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}
