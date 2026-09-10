// Rendu HTML du Knowledge Catalog SOS-EcoVadis.
//
// Ce fichier ne décide RIEN sur le contenu : les URL viennent de
// taxonomy/url-plan.yaml, les métadonnées de index/catalog.json, le JSON-LD de
// index/jsonld.json, tous produits par scripts/build_index.py. Le rendu est une
// vue, jamais une source.

import kb from "./site/_data/kb.js";
import { pathFor } from "./site/lib/urls.js";
import site from "./site/_data/site.js";

const lang = (d) => (d.lang === "mul" ? "fr" : d.lang);

function ldGraph(id, l) {
  const node = kb.jsonld.objects[`${id}:${l}`];
  if (!node) return null;
  const { "@context": _ctx, ...rest } = node;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [rest, kb.jsonld.organization, kb.jsonld.person],
  }).replace(/</g, "\\u003c");
}

// --- JSON-LD des pages de rendu -------------------------------------------
// Les fiches recoivent leur graphe de index/jsonld.json (ldGraph ci-dessus).
// Les hubs, index de sujets et landings ne sont pas des objets du catalogue :
// leur graphe se compose ici, a partir des memes noeuds Organization et
// Person, pour qu'un seul @id designe l'editeur sur tout le site.
const abs = (u) => (u.startsWith("http") ? u : site.url + u);
const ORG = { "@id": kb.jsonld.organization["@id"] };

const ldJson = (graph) =>
  JSON.stringify({ "@context": "https://schema.org", "@graph": graph })
    .replace(/</g, "\u003c");

function wsNode(lang) {
  return {
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    url: `${site.url}/`,
    name: site.name,
    description: site.tagline[lang],
    inLanguage: lang,
    publisher: ORG,
    ...(site.license && site.license.url ? { license: site.license.url } : {}),
  };
}

// Hub et index des sujets : une page qui liste des fiches.
function ldCollection({ url, lang, name, description, items }) {
  return ldJson([
    {
      "@type": "CollectionPage",
      "@id": abs(url),
      url: abs(url),
      name,
      description,
      inLanguage: lang,
      isPartOf: { "@id": `${site.url}/#website` },
      publisher: ORG,
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: items.length,
        itemListElement: items.map((m, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: abs(m.url),
          name: m.title,
        })),
      },
    },
    wsNode(lang),
    kb.jsonld.organization,
    kb.jsonld.person,
  ]);
}

// Landing : page d'offre. Le noeud Service la rend citable sur la question
// « qui accompagne une PME belge sur EcoVadis ». Aucun prix ici : ils vivent
// dans les fiches tarifs, une seule source evite la derive.
function ldLanding({ url, lang, name, description }) {
  return ldJson([
    {
      "@type": "WebPage",
      "@id": abs(url),
      url: abs(url),
      name,
      description,
      inLanguage: lang,
      isPartOf: { "@id": `${site.url}/#website` },
      about: ORG,
      publisher: ORG,
    },
    {
      "@type": "Service",
      "@id": `${abs(url)}#service`,
      name,
      description,
      serviceType: "EcoVadis assessment support",
      provider: ORG,
      inLanguage: lang,
    },
    wsNode(lang),
    kb.jsonld.organization,
    kb.jsonld.person,
  ]);
}

export default function (eleventyConfig) {
  // Ce qui n'est pas du contenu rendu : documentation du dépôt, outillage,
  // sources des index. Déclaré ici plutôt que dans un .eleventyignore, pour
  // que toute la configuration du rendu tienne dans un seul fichier.
  for (const p of [
    "README.md", "CHANGELOG.md", "CONTRIBUTING.md", "GOVERNANCE.md",
    "SOURCES.md", "VISION.md",
    "scripts/**", "measurement/**", "schemas/**", "taxonomy/**",
    "index/**", "public/**", "node_modules/**",
    // Résidus d'un téléversement : des gabarits de l'ancien squelette sont
    // arrivés à la racine. Ancrés par "./", ils n'atteignent pas leurs
    // homonymes légitimes dans site/.
    "./404.njk", "./base.njk", "./head.njk", "./index.njk",
    // Deuxième vague de résidus, arrivée avec la landing de l'étape 2 ter :
    // les fichiers ont été déposés à la racine au lieu de site/. Les copies
    // qui font foi sont sous site/ ; celles-ci sont inertes une fois ignorées.
    "./fr-landing.njk", "./landing.njk", "./mentions.njk",
    // Troisième vague de résidus (téléversements web) : légales déposées à la
    // racine + doublons de fiches catalogue. Ignorés ici pour que le build et
    // le check restent verts même s'ils subsistent dans le dépôt.
    "./en-legal-notice.njk", "./fr-mentions-legales.njk", "./nl-wettelijke-vermeldingen.njk",
    "./esgim.md", "./esgim \\(2\\).md", "./esgim \\(4\\).md",
    "./francois-dequenne.md", "./francois-dequenne \\(1\\).md", "./francois-dequenne \\(3\\).md",
  ]) eleventyConfig.ignores.add(p);

  // Les fiches du catalogue : gabarit, URL et données dérivées. Tout est ici
  // plutôt que dans un fichier de données déposé sous catalog/, pour que la
  // couche de rendu tienne dans un seul fichier à la racine.
  // Une fiche qui n'est pas en `status: published` n'est pas rendue (D19).
  eleventyConfig.addPreprocessor("catalogue", "md", (data) => {
    const p = (data.page && data.page.inputPath) || "";
    if (!p.includes("/catalog/")) return;
    if (data.status !== "published") return false;
    // Retirée pour révision dépassée sur un contenu volatil (D32).
    if (kb.excluded.includes(data.id)) return false;

    const l = lang(data);
    data.layout = "layouts/object.njk";
    data.htmlLang = l;
    data.permalink = pathFor(l, data.type, data.slug) + "index.html";
    data.altUrls = data.type === "glossary" ? {} : kb.alternates[data.id] || {};
    data.dateUpdated = data.date_updated;
    data.jsonldBlocks = ldGraph(data.id, l);
    data.hubItems = kb.hubs
      .filter((h) => h.members[l].some((m) => m.id === data.id))
      .map((h) => ({ title: h.title[l], url: h.path[l] }));
    data.relatedItems = (data.related || [])
      .map((slug) => kb.bySlug[l] && kb.bySlug[l][slug])
      .filter(Boolean);
  });

  // Fabriques de JSON-LD accessibles depuis le front matter des gabarits.
  eleventyConfig.addGlobalData("ld", { collection: ldCollection, landing: ldLanding });

  // Landings : front matter YAML statique, donc pas d'eleventyComputed. Le
  // graphe se pose ici, avant rendu.
  eleventyConfig.addPreprocessor("landing-jsonld", "njk", (data) => {
    const p = (data.page && data.page.inputPath) || "";
    if (!/\/site\/(fr|nl|en)-landing\.njk$/.test(p)) return;
    data.jsonldBlocks = ldLanding({
      url: String(data.permalink).replace(/index\.html$/, ""),
      lang: data.htmlLang,
      name: data.title,
      description: data.description,
    });
  });

  // Fichiers machine servis à la racine de l'origine (url-plan §machine_files).
  eleventyConfig.addPassthroughCopy({ public: "." });
  eleventyConfig.addPassthroughCopy({ "index/catalog.json": "catalog.json" });
  eleventyConfig.addPassthroughCopy({ "site/assets": "assets" });

  eleventyConfig.setLiquidOptions({ jekyllInclude: false });

  return {
    dir: {
      input: ".",
      includes: "site/_includes",
      data: "site/_data",
      output: "_site",
    },
    // Le corps des fiches n'est PAS interprété comme un gabarit : le texte
    // français contient des accolades et ne doit pas être exécuté.
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk"],
  };
}
