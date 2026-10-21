import { isIP } from "node:net";

import type { PageFetcher } from "../research/research-chain.js";

type PageFetch = (url: string, init: RequestInit) => Promise<Response>;

export type PageFetcherOptions = {
  fetch?: PageFetch;
  timeoutMilliseconds?: number;
  maximumBytes?: number;
  maximumRedirects?: number;
};

/**
 * Fetches a public search-result page and reduces it to readable text. Only public http(s)
 * hosts are fetched, redirects are re-checked hop by hop, and the body is cut off at a size
 * limit, so a result link cannot make the server read its own network or a huge file.
 */
export function createPageFetcher(options: PageFetcherOptions = {}): PageFetcher {
  const request = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const timeoutMilliseconds = options.timeoutMilliseconds ?? 10_000;
  const maximumBytes = options.maximumBytes ?? 1_500_000;
  const maximumRedirects = options.maximumRedirects ?? 3;

  return async (startUrl) => {
    let url = startUrl;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);

    try {
      for (let redirects = 0; redirects <= maximumRedirects; redirects += 1) {
        if (!isPublicWebUrl(url)) {
          return undefined;
        }

        const response = await request(url, {
          method: "GET",
          redirect: "manual",
          headers: {
            accept: "text/html,text/plain;q=0.9",
            "user-agent": "Mozilla/5.0 (compatible; CSVEnrichmentResearch/1.0)",
          },
          signal: controller.signal,
        });

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");

          if (location === null) {
            return undefined;
          }

          url = new URL(location, url).toString();
          continue;
        }

        const contentType = response.headers.get("content-type") ?? "";

        if (!response.ok || !/text\/html|text\/plain/i.test(contentType)) {
          return undefined;
        }

        const body = await readLimited(response, maximumBytes);

        return /text\/html/i.test(contentType) ? htmlText(body) : body.trim();
      }

      return undefined;
    } catch {
      return undefined;
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function isPublicWebUrl(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return false;
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && isIP(host) === 0) {
    return false;
  }

  if (isIP(host) === 4) {
    const [a, b] = host.split(".").map(Number);

    return !(a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
  }

  if (isIP(host) === 6) {
    return !(host === "::1" || host === "::" || /^f[cd]/.test(host) || /^fe80/.test(host) || host.startsWith("::ffff:"));
  }

  return true;
}

async function readLimited(response: Response, maximumBytes: number): Promise<string> {
  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let total = 0;

  while (total < maximumBytes) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    total += value.byteLength;
  }

  await reader.cancel().catch(() => undefined);

  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, maximumBytes));
}

function htmlText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
