/* Coquille de la landing — UTM des CTA et révélations au défilement.
 *
 * Servi depuis l'origine : la CSP de netlify.toml n'autorise pas le script
 * en ligne, et l'étape 2 la laisse inchangée.
 *
 * D39 — Les UTM entrantes ne sont JAMAIS écrasées. sos-ecovadis / web /
 * knowledge_base ne sont que des valeurs par défaut ; ce qui arrive d'un
 * e-mail HubSpot, de LinkedIn, de Google ou d'un assistant prime.
 *
 * D36 — Deux chemins, une seule fonction de calcul. Le lien natif porte
 * déjà les défauts, écrits par Eleventy, pour exister sans JavaScript ;
 * ce script les recalcule avec les paramètres réellement entrants. Les CTA
 * HubSpot de l'étape 3 n'apparaissent dans le DOM qu'au chargement de leur
 * script : l'observateur ci-dessous les rattrape quand ils arrivent.
 */
(function () {
  "use strict";

  var DEFAUTS = {
    utm_source: "sos-ecovadis",
    utm_medium: "web",
    utm_campaign: "knowledge_base",
  };
  // Reportés tels quels s'ils sont présents : ils identifient la campagne
  // ou le clic d'origine, et rien ici n'a de meilleure valeur à proposer.
  var REPORTES = ["utm_content", "utm_id", "gclid", "msclkid", "fbclid"];

  var entrantes = new URLSearchParams(window.location.search);

  /* Détection des assistants conversationnels.
   *
   * Deux signaux, jamais contradictoires avec D39 : on ne remplit que ce qui
   * est absent. ChatGPT écrit lui-même utm_source=chatgpt.com ; il arrive donc
   * en UTM entrante et prime, on se contente d'ajouter le medium manquant.
   * Les autres assistants ne laissent qu'un referrer : quand aucune source
   * n'est déclarée, il devient la source.
   *
   * Referrer-Policy vaut strict-origin-when-cross-origin : on ne reçoit que
   * l'origine, ce qui suffit — et beaucoup d'assistants n'envoient rien du
   * tout. Un LLM non détecté retombe simplement sur les défauts.
   */
  var ASSISTANTS = [
    ["chatgpt.com", "chatgpt"],
    ["chat.openai.com", "chatgpt"],
    ["openai.com", "chatgpt"],
    ["perplexity.ai", "perplexity"],
    ["claude.ai", "claude"],
    ["gemini.google.com", "gemini"],
    ["copilot.microsoft.com", "copilot"],
    ["you.com", "you"],
    ["mistral.ai", "mistral"],
    ["poe.com", "poe"],
    ["grok.com", "grok"]
  ];

  function assistantDe(valeur) {
    if (!valeur) return null;
    var v = String(valeur).toLowerCase();
    for (var i = 0; i < ASSISTANTS.length; i++) {
      if (v.indexOf(ASSISTANTS[i][0]) !== -1) return ASSISTANTS[i][1];
    }
    return null;
  }

  var source = entrantes.get("utm_source");
  if (source) {
    // Source déclarée : on la garde telle quelle. Si c'est un assistant et
    // que le medium manque, on le nomme.
    var nomme = assistantDe(source);
    if (nomme && !entrantes.get("utm_medium")) entrantes.set("utm_medium", "llm");
  } else {
    var venu = assistantDe(document.referrer);
    if (venu) {
      entrantes.set("utm_source", venu);
      entrantes.set("utm_medium", "llm");
    }
  }

  // La fonction de calcul, unique. `terme` est le contexte du CTA.
  function utmPour(terme) {
    var out = {};
    Object.keys(DEFAUTS).forEach(function (k) {
      out[k] = entrantes.get(k) || DEFAUTS[k];
    });
    REPORTES.forEach(function (k) {
      if (entrantes.get(k)) out[k] = entrantes.get(k);
    });
    var t = entrantes.get("utm_term") || terme;
    if (t) out.utm_term = t;
    return out;
  }

  function completer(a) {
    var brut = a.getAttribute("href");
    if (!brut) return;
    var url;
    try {
      url = new URL(brut, window.location.origin);
    } catch (e) {
      return;
    }
    if (url.hostname.indexOf("calendly.com") === -1) return;
    var utm = utmPour(a.getAttribute("data-utm-term"));
    Object.keys(utm).forEach(function (k) {
      url.searchParams.set(k, utm[k]);
    });
    a.setAttribute("href", url.toString());
  }

  function balayer(racine) {
    var liens = (racine || document).querySelectorAll('a[href*="calendly.com"]');
    Array.prototype.forEach.call(liens, completer);
  }

  balayer(document);

  // Les CTA rendus après coup (HubSpot, étape 3) arrivent dans le DOM plus
  // tard : on les complète à leur apparition.
  if (window.MutationObserver) {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1) balayer(n);
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  // Révélations : un seul chargement orchestré, et rien si l'utilisateur
  // a demandé moins de mouvement.
  var calme = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cibles = document.querySelectorAll(".reveal");
  if (calme || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(cibles, function (el) { el.classList.add("in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  Array.prototype.forEach.call(cibles, function (el) { io.observe(el); });
})();
