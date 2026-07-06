let cachedCatalog = null;

export async function loadDoctrineCatalog(options = {}) {
  if (Array.isArray(options.catalog)) {
    return normalizeCatalog(options.catalog);
  }
  if (cachedCatalog) return cachedCatalog;

  const catalogUrl = options.catalogUrl || new URL("../doctrines.json", import.meta.url);

  if (typeof window !== "undefined" && typeof fetch === "function") {
    const response = await fetch(catalogUrl);
    if (!response.ok) {
      throw new Error(`doctrine_catalog_fetch_failed:${response.status}`);
    }
    cachedCatalog = normalizeCatalog(await response.json());
    return cachedCatalog;
  }

  const fs = await import("node:fs/promises");
  const body = await fs.readFile(catalogUrl, "utf8");
  cachedCatalog = normalizeCatalog(JSON.parse(body));
  return cachedCatalog;
}

export function normalizeCatalog(catalog) {
  return catalog.map((entry) => ({
    id: entry.id,
    tagline: entry.tagline || "",
    severity_default: normalizeSeverity(entry.severity_default || "medium"),
    lexical_triggers: Array.isArray(entry.lexical_triggers) ? entry.lexical_triggers : [],
    ast_patterns: Array.isArray(entry.ast_patterns) ? entry.ast_patterns : [],
    doctrine_text: entry.doctrine_text || entry.tagline || entry.id,
    example_riverbed: entry.example_riverbed || entry.tagline || entry.id
  }));
}

export function normalizeSeverity(value) {
  const v = String(value || "medium").toLowerCase();
  if (v === "critical" || v === "high" || v === "medium") return v;
  return "medium";
}

export function severityRank(severity) {
  return { medium: 1, high: 2, critical: 3 }[normalizeSeverity(severity)] || 1;
}

export function doctrineById(catalog, id) {
  return catalog.find((entry) => entry.id === id) || {
    id,
    tagline: id,
    severity_default: "medium",
    lexical_triggers: [],
    ast_patterns: [],
    doctrine_text: id,
    example_riverbed: id
  };
}
