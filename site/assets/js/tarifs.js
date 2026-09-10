/* Bloc tarifaire — le forfait et l'échéancier suivent la taille choisie.
 *
 * Servi depuis l'origine : la CSP de netlify.toml n'autorise pas le script
 * en ligne. Eleventy écrit déjà les montants de la taille XS dans le HTML,
 * donc le bloc reste juste et lisible sans JavaScript ; ce fichier ne fait
 * que le recalculer quand l'utilisateur change de taille.
 *
 * L'échéancier 20 / 60 / 20 porte UNIQUEMENT sur le forfait
 * d'accompagnement. L'abonnement Premium EcoVadis en est exclu : il est
 * facturé par EcoVadis, pas par ESGIM.
 *
 * Trois langues : la langue de la page (<html lang>) choisit le format des
 * nombres (7 500 / 7.500 / 7,500) et le texte annoncé au lecteur d'écran.
 */
(function () {
  "use strict";

  var FORFAITS = {
    XS: { forfait: 7500, abo: 899 },
    S: { forfait: 9000, abo: 1219 },
    M: { forfait: 12000, abo: 1949 },
  };

  var LANGUES = {
    fr: {
      locale: "fr-FR",
      plage: { XS: "jusqu'à 25 employés", S: "26 à 99 employés", M: "100 à 999 employés" },
      dire: function (t, f, p, v) {
        return "Entreprise " + t + ", " + p + ". Accompagnement : " + f(v.forfait) +
          " euros hors TVA. Abonnement Premium en supplément : " + f(v.abo) +
          " euros. Versements : " + f(v.v1) + " euros à la commande, " + f(v.v2) +
          " euros à la soumission et " + f(v.v3) +
          " euros uniquement à l'obtention de la médaille.";
      },
    },
    nl: {
      locale: "nl-BE",
      plage: { XS: "tot 25 werknemers", S: "26 tot 99 werknemers", M: "100 tot 999 werknemers" },
      dire: function (t, f, p, v) {
        return "Onderneming " + t + ", " + p + ". Begeleiding: " + f(v.forfait) +
          " euro exclusief btw. Premium-abonnement, apart: " + f(v.abo) +
          " euro. Betalingen: " + f(v.v1) + " euro bij bestelling, " + f(v.v2) +
          " euro bij indiening en " + f(v.v3) +
          " euro enkel wanneer u de medaille behaalt.";
      },
    },
    en: {
      locale: "en-US",
      plage: { XS: "up to 25 employees", S: "26 to 99 employees", M: "100 to 999 employees" },
      dire: function (t, f, p, v) {
        return "Company size " + t + ", " + p + ". Support package: " + f(v.forfait) +
          " euros excluding VAT. Premium subscription, billed separately: " + f(v.abo) +
          " euros. Payments: " + f(v.v1) + " euros on order, " + f(v.v2) +
          " euros on submission and " + f(v.v3) +
          " euros only when you earn the medal.";
      },
    },
  };

  var boutons = document.querySelectorAll('input[name="taille"]');
  if (!boutons.length) return;

  var langue = LANGUES[(document.documentElement.lang || "fr").slice(0, 2)] || LANGUES.fr;
  var nombre = new Intl.NumberFormat(langue.locale, { maximumFractionDigits: 0 });
  var fmt = function (v) { return nombre.format(v); };
  var annonce = document.getElementById("tarifs-annonce");

  function rendre(taille, dire) {
    var f = FORFAITS[taille];
    if (!f) return;
    var v1 = Math.round(f.forfait * 0.2);
    var v2 = Math.round(f.forfait * 0.6);
    var v3 = f.forfait - v1 - v2;
    var valeurs = { forfait: f.forfait, abo: f.abo, v1: v1, v2: v2, v3: v3 };

    Object.keys(valeurs).forEach(function (cle) {
      var cibles = document.querySelectorAll("[data-" + cle + "]");
      Array.prototype.forEach.call(cibles, function (el) {
        el.textContent = fmt(valeurs[cle]);
      });
    });

    if (dire && annonce) {
      annonce.textContent = langue.dire(taille, fmt, langue.plage[taille], valeurs);
    }
  }

  Array.prototype.forEach.call(boutons, function (input) {
    input.addEventListener("change", function (e) { rendre(e.target.value, true); });
  });

  // Le navigateur peut restaurer une sélection au rechargement : on part de
  // ce qui est réellement coché, sans rien annoncer au lecteur d'écran.
  var coche = document.querySelector('input[name="taille"]:checked');
  if (coche) rendre(coche.value, false);
})();
