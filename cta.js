// Le lien natif Calendly et ses UTM par défaut.
//
// D36 — Le bouton doit exister sans JavaScript : Eleventy écrit ici l'URL
// complète, défauts compris. D39 — ces valeurs ne sont QUE des défauts ;
// site/assets/js/landing.js les recalcule avec les UTM réellement entrantes,
// qu'il n'écrase jamais. Deux chemins, une seule fonction de calcul.
const BASE = "https://calendly.com/francois-dequenne/30min";
const DEFAUTS = {
  utm_source: "sos-ecovadis",
  utm_medium: "web",
  utm_campaign: "knowledge_base",
};

// Un utm_term par contexte de CTA (§Technique du spec de l'étape 2).
const TERMES = ["nav", "hero", "prix", "cta-final"];

const lien = (terme) => {
  const p = new URLSearchParams({ ...DEFAUTS, utm_term: terme });
  return `${BASE}?${p.toString()}`;
};

export default {
  base: BASE,
  prix: "125 € HTVA",
  duree: "30 minutes",
  url: Object.fromEntries(TERMES.map((t) => [t, lien(t)])),
};
