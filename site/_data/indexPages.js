// Pages d'index (accueil de langue, index des sujets) : URL et alternatives
// précalculées, comme pour les hubs. Aucune logique d'URL dans les gabarits.
import { urlplan } from "../lib/urls.js";

const ORDER = ["fr", "nl", "en"];

// Étape 2 : /fr/ est passé à la landing ; l'accueil du catalogue français
// a basculé vers /fr/sujets/. Étape 2 quater : /nl/ et /en/ passent à leur
// tour à la landing traduite. Il ne reste donc aucun accueil de catalogue
// rendu par lang-home.njk — la liste est vide, le gabarit reste en place
// pour le jour où une langue sans landing serait ajoutée.
const HOME_LANGS = [];

// L'équivalent d'un accueil de catalogue est désormais l'index des sujets
// de chaque langue : c'est vers là que pointent l'alternative hreflang et
// le sélecteur de langue des pages du catalogue. Les trois landings se
// déclarent entre elles dans leur propre front matter.
const topicAlt = Object.fromEntries(ORDER.map((x) => [x, `/${x}/${urlplan.branches.hub[x]}/`]));

export default {
  home: HOME_LANGS.map((l) => ({ lang: l, url: `/${l}/`, alt: topicAlt })),
  topics: ORDER.map((l) => ({ lang: l, url: `/${l}/${urlplan.branches.hub[l]}/`, alt: topicAlt })),
};
