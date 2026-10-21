/**
 * A company is identified by its website domain: `https://www.toasttab.com/about` and
 * `toasttab.com` are the same company. A name alone can belong to several companies, so a
 * row without a usable website has no domain and never reads or feeds a Company Dossier.
 */
export function companyDomain(website: string | undefined): string | undefined {
  const value = (website ?? "").trim().toLowerCase();

  if (value === "") {
    return undefined;
  }

  let hostname: string;

  try {
    hostname = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(value) ? value : `https://${value}`).hostname;
  } catch {
    return undefined;
  }

  const domain = hostname.replace(/^www\d*\./, "").replace(/\.$/, "");

  // A bare word ("acme") or an IP address cannot name one company's website.
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) && !/^\d+(\.\d+)+$/.test(domain)
    ? domain
    : undefined;
}
