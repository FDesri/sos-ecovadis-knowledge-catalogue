/* Suivi HubSpot et bandeau de consentement.
 *
 * Le script HubSpot n'est chargé qu'après un « oui » explicite : opt-in,
 * comme le veut la règle belge. Un « non » est mémorisé et respecté.
 *
 * Côté HubSpot, une seule chose à faire : ajouter sos-ecovadis.com aux
 * domaines suivis. Laisser le bandeau HubSpot désactivé — le site porte
 * le sien, et deux bandeaux valent moins que zéro.
 */
(function () {
  "use strict";

  // Le suivi s'allume tout seul sur le domaine réel, et seulement là :
  // sur sos-ecovadis.netlify.app et sur les prévisualisations, il ne
  // compterait rien d'utile. Il n'y a donc aucune bascule à faire le jour
  // de la mise en ligne — brancher le DNS suffit.
  var ACTIF = /(^|\.)sos-ecovadis\.com$/.test(window.location.hostname);
  var PORTAIL = "9391878";
  var CLE = "sos-ecovadis-consentement";

  var bandeau = document.getElementById("consentement");
  if (!ACTIF || !bandeau) return;

  function chargerHubSpot() {
    if (document.getElementById("hs-script-loader")) return;
    var s = document.createElement("script");
    s.id = "hs-script-loader";
    s.async = true;
    s.defer = true;
    s.type = "text/javascript";
    s.src = "https://js.hs-scripts.com/" + PORTAIL + ".js";
    document.head.appendChild(s);
  }

  function memoriser(valeur) {
    try { localStorage.setItem(CLE, valeur); } catch (e) { /* navigation privée */ }
  }

  var deja = null;
  try { deja = localStorage.getItem(CLE); } catch (e) { /* idem */ }

  if (deja === "oui") { chargerHubSpot(); return; }
  if (deja === "non") return;

  bandeau.hidden = false;
  bandeau.querySelector("[data-consent='oui']").addEventListener("click", function () {
    memoriser("oui");
    bandeau.hidden = true;
    chargerHubSpot();
  });
  bandeau.querySelector("[data-consent='non']").addEventListener("click", function () {
    memoriser("non");
    bandeau.hidden = true;
  });
})();
