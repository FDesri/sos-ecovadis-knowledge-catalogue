/* Suivi HubSpot + Google Analytics et bandeau de consentement.
 *
 * Les scripts HubSpot et Google Analytics ne sont chargés qu'après un « oui » explicite : opt-in,
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
  // ID de mesure Google Analytics (Administration > Flux de données).
  var GA_ID = "G-FEV6BF2DZ0";
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

  function chargerGoogle() {
    if (!/^G-[A-Z0-9]+$/.test(GA_ID) || GA_ID === "G-XXXXXXXXXX") return;
    if (document.getElementById("ga-loader")) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    var s = document.createElement("script");
    s.id = "ga-loader";
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  function charger() { chargerHubSpot(); chargerGoogle(); }

  function memoriser(valeur) {
    try { localStorage.setItem(CLE, valeur); } catch (e) { /* navigation privée */ }
  }

  var deja = null;
  try { deja = localStorage.getItem(CLE); } catch (e) { /* idem */ }

  if (deja === "oui") { charger(); return; }
  if (deja === "non") return;

  bandeau.hidden = false;
  bandeau.querySelector("[data-consent='oui']").addEventListener("click", function () {
    memoriser("oui");
    bandeau.hidden = true;
    charger();
  });
  bandeau.querySelector("[data-consent='non']").addEventListener("click", function () {
    memoriser("non");
    bandeau.hidden = true;
  });
})();
