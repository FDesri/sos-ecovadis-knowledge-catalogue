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

// Le prix et la durée tels qu'ils s'écrivent dans chaque langue. `prix` et
// `duree` restent les valeurs françaises : la page /fr/mentions-legales/ les
// lit encore sous ce nom.
const T = {
  fr: { prix: "125 € HTVA", duree: "30 minutes" },
  nl: { prix: "125 € excl. btw", duree: "30 minuten" },
  en: { prix: "€125 excl. VAT", duree: "30 minutes" },
};

export default {
  base: BASE,
  prix: T.fr.prix,
  duree: T.fr.duree,
  t: T,
  url: Object.fromEntries(TERMES.map((t) => [t, lien(t)])),
};
