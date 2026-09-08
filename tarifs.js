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
 */
(function () {
  "use strict";

  var FORFAITS = {
    XS: { forfait: 7500, abo: 899, plage: "jusqu'à 25 employés" },
    S: { forfait: 9000, abo: 1219, plage: "26 à 99 employés" },
    M: { forfait: 12000, abo: 1949, plage: "100 à 999 employés" },
  };

  var boutons = document.querySelectorAll('input[name="taille"]');
  if (!boutons.length) return;

  var nombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
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
      annonce.textContent =
        "Entreprise " + taille + ", " + f.plage + ". Accompagnement : " +
        fmt(f.forfait) + " euros hors TVA. Abonnement Premium en supplément : " +
        fmt(f.abo) + " euros. Versements : " + fmt(v1) + " euros à la commande, " +
        fmt(v2) + " euros à la soumission et " + fmt(v3) +
        " euros uniquement à l'obtention de la médaille.";
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
