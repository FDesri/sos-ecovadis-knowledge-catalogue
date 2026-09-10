#!/usr/bin/env python3
"""Construit les index machine du Knowledge Catalog SOS-EcoVadis et valide le dépôt.

v2 (2026-09-01, vision v1.2). Ce script est la SEULE source des URL canoniques
et des index : rien de ce qu'il écrit ne doit être édité à la main.

Sorties
-------
index/catalog.json      Graphe complet — tous les objets, tous les statuts, avec
                        `canonical_url`, l'appartenance aux hubs, les sources
                        résolues et le statut de publication. Point d'entrée RAG.
index/jsonld.json       JSON-LD schema.org par objet (Article / FAQPage /
                        Organization / Person), à injecter par le build du site.
public/                 Ce qui sera servi à la RACINE du domaine :
  robots.txt            Politique de robots explicite (KC-A03 → A06).
  sitemap.xml           Objets PUBLIÉS uniquement (KC-T06).
  llms.txt              Répertoire agents : hubs d'abord, fiches ensuite (KC-L01→L04).

Règle de publication (décision D19)
-----------------------------------
Seuls les objets en `status: published` reçoivent une URL canonique et entrent
au sitemap et dans llms.txt. Une fiche en `review` ou
`draft` reste dans catalog.json, marquée comme telle, et n'est pas indexable.
Tant que François n'a pas relu, les surfaces publiques sont vides — c'est le
comportement voulu, pas un bug.

Contrôles bloquants (KC-G15) — le script sort en code 1 :
  champ obligatoire manquant · id ou slug dupliqué · slug `related` non résolu ·
  source inconnue du registre · sujet inconnu de la taxonomie · fiche SANS AUCUN
  SUJET · volatilité inconnue · fiche modifiée dans le commit dont la révision
  est dépassée (voir --changed).

Ce que le script AVERTIT sans refuser (D28, D31, D32) :
  description hors 70-155 · parité de langues incomplète · sujet ayant atteint
  le seuil de hub sans être déclaré · fiche publiée dont la révision approche ou
  est dépassée.

Hubs (D31). Un sujet devient un hub à partir de `threshold` objets. En dessous,
il reste une facette : ses fiches vivent dans l'index général, dans llms.txt, au
sitemap et dans les pages de situation. Aucune fiche n'est orpheline, aucune
n'attend qu'un hub existe pour naître.

Fraîcheur (D32, D33). `review_due` est DÉRIVÉE de `verified_at` + `volatility`
(taxonomy/freshness.yaml). Une fiche périmée n'arrête jamais la chaîne : elle est
avertie, et si sa classe est volatile, retirée des surfaces indexables
(`review_required`) jusqu'à révision. Elle ne devient une erreur que dans le
commit qui la modifie. Un correctif de sécurité n'est jamais bloqué par une date.

Usage:  python3 scripts/build_index.py [--check-only] [--changed <ref>]
        --changed main   → les fiches modifiées depuis <ref> voient leur
                           révision dépassée traitée en erreur (utilisé en CI).
"""
import datetime, json, os, re, sys
import yaml

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = os.path.join(REPO, "catalog")
TAX = os.path.join(REPO, "taxonomy")
LANGS = ["en", "fr", "nl"]
REQUIRED = ["id", "type", "lang", "title", "slug", "summary", "description", "intent",
            "author", "source", "date_created", "date_updated", "verified_at",
            "volatility", "version", "status"]
# `review_due` n'est plus un champ de front matter : il est dérivé (D33).
# S'il est présent, on le compare à la valeur dérivée et on avertit en cas d'écart.

def load(name):
    return yaml.safe_load(open(os.path.join(TAX, name), encoding="utf-8"))

def parse(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return None, text
    return yaml.safe_load(m.group(1)), m.group(2)

# --------------------------------------------------------------------------
def canonical(urlplan, lang, otype, slug):
    """URL canonique d'une fiche. Unique source : taxonomy/url-plan.yaml."""
    site = urlplan["site"]
    base = f"{site['scheme']}://{site['canonical_host']}"
    singles = urlplan["singletons"]
    if otype == "glossary":
        return base + singles["glossary"]["canonical"]
    if otype == "organization":
        return base + singles["organization"][lang]
    branch = urlplan["branches"][otype][lang]
    return f"{base}/{lang}/{branch}/{slug}/"

def hub_url(urlplan, lang, slug):
    site = urlplan["site"]
    branch = urlplan["branches"]["hub"][lang]
    return f"{site['scheme']}://{site['canonical_host']}/{lang}/{branch}/{slug}/"

def add_months(d, months):
    """Même quantième, mois plus tard. Le 31 devient le dernier jour du mois."""
    y, m = divmod(d.month - 1 + months, 12)
    y, m = d.year + y, m + 1
    day = min(d.day, [31, 29 if (y % 4 == 0 and (y % 100 or y % 400 == 0)) else 28,
                      31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
    return datetime.date(y, m, day)


def as_date(v):
    return v if isinstance(v, datetime.date) else datetime.date.fromisoformat(str(v))


def changed_paths(ref):
    """Fiches modifiées depuis `ref`. Vide si git n'est pas disponible."""
    import subprocess
    try:
        out = subprocess.run(["git", "diff", "--name-only", f"{ref}...HEAD"],
                             cwd=REPO, capture_output=True, text=True, timeout=20)
        return {l.strip() for l in out.stdout.splitlines() if l.strip()}
    except Exception:
        return set()


# --------------------------------------------------------------------------
def main():
    check_only = "--check-only" in sys.argv
    urlplan = load("url-plan.yaml")
    hubs_cfg = load("hubs.yaml")
    fresh = load("freshness.yaml")
    known_topics = set(load("taxonomy.yaml")["topics"])
    registry = load("sources-registry.yaml")["sources"]
    today = datetime.date.today()

    changed = set()
    if "--changed" in sys.argv:
        changed = changed_paths(sys.argv[sys.argv.index("--changed") + 1])

    objects, bodies = {}, {}
    slugs_by_lang = {l: {} for l in LANGS + ["mul"]}
    errors, warnings = [], []

    for root, _d, files in os.walk(CATALOG):
        for f in sorted(files):
            if not f.endswith(".md"):
                continue
            path = os.path.join(root, f)
            rel = os.path.relpath(path, REPO).replace(os.sep, "/")
            fm, body = parse(path)
            if fm is None:
                errors.append(f"{rel}: pas de front matter")
                continue

            missing = [k for k in REQUIRED if k not in fm or fm[k] in (None, "")]
            if missing:
                errors.append(f"{rel}: champs obligatoires manquants {missing}")
                continue
            if not 70 <= len(fm["description"]) <= 155:
                warnings.append(f"{rel}: description de {len(fm['description'])} caractères "
                                f"(fenêtre indicative 70-155) — D28")
            for sid in fm.get("sources") or []:
                if sid not in registry:
                    errors.append(f"{rel}: source '{sid}' absente du registre")

            lang, oid = fm["lang"], fm["id"]
            if fm["slug"] in slugs_by_lang.setdefault(lang, {}):
                errors.append(f"{rel}: slug '{fm['slug']}' déjà utilisé en {lang} par "
                              f"{slugs_by_lang[lang][fm['slug']]}")
            slugs_by_lang[lang][fm["slug"]] = oid

            # --- fraîcheur (D32, D33) ------------------------------------
            vol = fm["volatility"]
            if vol not in fresh["cadence_months"]:
                errors.append(f"{rel}: volatilité '{vol}' inconnue de freshness.yaml")
                continue
            verified = as_date(fm["verified_at"])
            due = add_months(verified, fresh["cadence_months"][vol])
            if "review_due" in fm and as_date(fm["review_due"]) != due:
                warnings.append(f"{rel}: review_due déclarée {fm['review_due']} ; "
                                f"la valeur dérivée est {due} — le champ est ignoré")

            published = fm["status"] == "published"
            retire = False
            if published:
                if due < today:
                    if rel in changed:
                        errors.append(f"{rel}: modifiée alors que sa révision est due "
                                      f"depuis {due} — vérifier les faits ou reporter "
                                      f"verified_at dans le même commit")
                    elif vol in fresh["withdraw_when_overdue"]:
                        retire = True
                        warnings.append(f"{rel}: révision due depuis {due} et contenu "
                                        f"volatil ({vol}) — retirée des surfaces "
                                        f"indexables, statut review_required")
                    else:
                        warnings.append(f"{rel}: révision due depuis {due} ({vol})")
                elif (due - today).days <= fresh["warn_days_before"]:
                    warnings.append(f"{rel}: révision due dans {(due - today).days} jours "
                                    f"({due})")
            published = published and not retire

            obj = objects.setdefault(oid, {
                "id": oid, "type": fm["type"], "status": fm["status"],
                "intent": fm.get("intent"),
                "situations": fm.get("situations", []), "sizes": fm.get("sizes", []),
                "content_kind": fm.get("content_kind"), "themes": fm.get("themes", []),
                "topics": fm.get("topics", []),
                "ecovadis_questions": fm.get("ecovadis_questions", []),
                "audience": fm.get("audience", []), "author": fm.get("author"),
                "source": fm.get("source"), "reliability": fm.get("reliability"),
                "sources": sorted(set(fm.get("sources") or [])),
                "date_updated": str(fm["date_updated"]),
                "verified_at": str(verified),
                "volatility": vol,
                "review_due": str(due),
                "indexable": published,
                "effective_status": "review_required" if retire else fm["status"],
                "hubs": [], "languages": {},
            })
            # Un objet, trois fichiers : on retient la position la plus prudente.
            obj["indexable"] = obj["indexable"] and published
            if not published and fm["status"] == "published":
                obj["effective_status"] = "review_required"
            if due < as_date(obj["review_due"]):
                obj["review_due"], obj["verified_at"], obj["volatility"] = \
                    str(due), str(verified), vol

            obj["languages"][lang] = {
                "slug": fm["slug"], "title": fm["title"],
                "summary": re.sub(r"\s+", " ", (fm.get("summary") or "")).strip(),
                "description": fm["description"],
                "keywords": fm.get("keywords", []), "path": rel,
                "canonical_url": canonical(urlplan, lang, fm["type"], fm["slug"])
                                 if published else None,
                "source_lang": fm.get("source_lang"),
                "translation_of": fm.get("translation_of"),
                "related": fm.get("related", []),
                "relations": fm.get("relations", {}) or {},
                "faq": fm.get("faq", []),
            }
            bodies[(oid, lang)] = body

    # --- parité de langues (D26) -------------------------------------------
    # Indicateur éditorial, PAS une condition de build : une fiche peut vivre
    # dans une seule langue. Règle d'exploitation : une langue est absente ou
    # publiée, jamais entre les deux (le statut reste au niveau de l'objet).
    incomplets = []
    for oid, obj in sorted(objects.items()):
        langs = set(obj["languages"])
        if "mul" in langs:
            continue
        if langs != set(LANGS):
            manque = sorted(set(LANGS) - langs)
            incomplets.append(oid)
            warnings.append(f"{oid}: langue(s) manquante(s) {manque} — parité incomplète")
    parite = f"parité : {len(objects) - len(incomplets)}/{len(objects)} objets complets"

    # --- résolution des `related` -----------------------------------------
    for oid, obj in sorted(objects.items()):
        for lang, v in obj["languages"].items():
            pool = slugs_by_lang.get(lang, {})
            for r in v["related"]:
                if r not in pool:
                    errors.append(f"{oid} [{lang}] : slug related '{r}' ne résout pas")
            for kind in ("alternatives", "prerequisites"):
                for r in (v["relations"].get(kind) or []):
                    if r not in pool:
                        errors.append(f"{oid} [{lang}] : {kind} '{r}' ne résout pas")

    # --- sujets et hubs (D31) ---------------------------------------------
    # Un sujet devient un hub à partir du seuil. En dessous il reste une facette :
    # ses fiches vivent dans l'index général, au sitemap, dans llms.txt et dans
    # les pages de situation. Ce qui est BLOQUANT est le fait — une fiche sans
    # sujet, ou un sujet inconnu de la taxonomie. Le hub, lui, n'est pas dû.
    hub_defs = hubs_cfg["hubs"]
    threshold = hubs_cfg.get("threshold", 4)
    hub_members = {h: [] for h in hub_defs}
    topic_members = {}
    hors_hub = []
    for oid, obj in sorted(objects.items()):
        if not obj["topics"]:
            errors.append(f"{oid}: aucun sujet déclaré — une fiche sans sujet "
                          f"n'est reliée à rien")
            continue
        inconnus = [t for t in obj["topics"] if t not in known_topics]
        if inconnus:
            errors.append(f"{oid}: sujet(s) inconnu(s) de taxonomy.yaml {inconnus}")
            continue
        for t in obj["topics"]:
            topic_members.setdefault(t, []).append(oid)
        mine = [t for t in obj["topics"] if t in hub_defs]
        obj["hubs"] = mine
        obj["parent_hub"] = mine[0] if mine else None
        if mine:
            for t in mine:
                hub_members[t].append(oid)
        else:
            hors_hub.append(oid)

    # Un sujet qui atteint le seuil sans être déclaré mérite son hub : on le dit,
    # on ne l'invente pas — un hub porte un titre et une introduction en trois
    # langues, qui s'écrivent (huit lignes dans hubs.yaml).
    for t, members in sorted(topic_members.items()):
        if t not in hub_defs and len(members) >= threshold:
            warnings.append(f"sujet '{t}' : {len(members)} objets, seuil {threshold} "
                            f"atteint — à promouvoir en hub dans taxonomy/hubs.yaml")

    # Déterminisme : l'ordre d'insertion des langues suit l'ordre de parcours du
    # disque, qui n'est pas le même d'une machine à l'autre. Sans ce tri, le
    # catalog.json régénéré en CI diffère de celui du poste et le build échoue
    # pour une raison qui n'a rien à voir avec le contenu.
    LANG_ORDER = {l: i for i, l in enumerate(LANGS + ["mul"])}
    for obj in objects.values():
        obj["languages"] = dict(sorted(obj["languages"].items(),
                                       key=lambda kv: LANG_ORDER.get(kv[0], 99)))
        obj["hubs"] = sorted(obj["hubs"])

    published_ids = {oid for oid, o in objects.items()
                     if o["status"] == "published" and o["indexable"]}

    if errors:
        for e in errors:
            print("ERREUR:", e)
        print(f"\n{len(objects)} objets — {len(errors)} erreurs, build refusé")
        sys.exit(1)
    if check_only:
        print(f"{len(objects)} objets, {sum(len(o['languages']) for o in objects.values())} "
              f"fichiers — 0 erreur, {len(warnings)} avertissement(s)")
        print(parite)
        for w in warnings:
            print("WARN:", w)
        return

    # ======================================================================
    #  ÉCRITURES
    # ======================================================================
    os.makedirs(os.path.join(REPO, "index"), exist_ok=True)
    public = os.path.join(REPO, "public")
    os.makedirs(public, exist_ok=True)
    site = urlplan["site"]
    base = f"{site['scheme']}://{site['canonical_host']}"

    # --- catalog.json ------------------------------------------------------
    catalog = {
        "name": "SOS-EcoVadis Knowledge Catalog",
        "publisher": "ESG Interim Management (esgim.eu)",
        "description": "Trilingual (EN/FR/NL-BE) knowledge base on EcoVadis assessments "
                       "for XS/S companies: articles, FAQ, pricing, services, glossary. "
                       "Built for retrieval by AI assistants.",
        "license": {
            "content": "CC BY-NC 4.0",
            "content_url": "https://creativecommons.org/licenses/by-nc/4.0/",
            "code": "MIT",
            "note": "Quote with attribution to ESG Interim Management (esgim.eu).",
        },
        "canonical_site": base,
        "languages": LANGS,
        "object_count": len(objects),
        "published_count": len(published_ids),
        "sources": {sid: {k: v for k, v in s.items() if k in
                          ("title", "publisher", "kind", "url", "accessed")}
                    for sid, s in registry.items()},
        "hubs": [{
            "id": h, "slug": hub_defs[h]["slug"],
            "title": hub_defs[h]["title"],
            "url": {l: hub_url(urlplan, l, hub_defs[h]["slug"][l]) for l in LANGS},
            "member_count": len(hub_members[h]),
            "members": sorted(hub_members[h]),
        } for h in sorted(hub_defs, key=lambda k: -len(hub_members[k]))],
        # Sujets sous le seuil (D31) : facettes de filtrage, pas de page à eux.
        # Leurs fiches sont listées dans l'index général des sujets.
        "facets": [{"id": t, "member_count": len(m), "members": sorted(m)}
                   for t, m in sorted(topic_members.items())
                   if t not in hub_defs],
        # Fiches qu'aucun hub ne porte : elles ne sont pas orphelines pour autant.
        "unhubbed": sorted(oid for oid in hors_hub if oid in published_ids),
        "objects": [objects[k] for k in sorted(objects)],
    }
    json.dump(catalog, open(os.path.join(REPO, "index", "catalog.json"), "w",
                            encoding="utf-8"), ensure_ascii=False, indent=1, default=str)

    # --- JSON-LD (KC-T04) --------------------------------------------------
    # ESG INTERIM MANAGEMENT est une MARQUE ; la personne morale est
    # IMAGINATION@WORK SRL. Un moteur à qui l'on demande « qui est ESGIM »
    # doit trouver les deux et savoir laquelle contracte (KC-S07, KC-S12).
    ORG = {
        "@type": "Organization", "@id": f"{base}/#organization",
        "name": "ESG Interim Management", "alternateName": ["ESGIM"],
        "legalName": "IMAGINATION@WORK SRL",
        "brand": {"@type": "Brand", "name": "ESG INTERIM MANAGEMENT"},
        "identifier": [
            {"@type": "PropertyValue", "propertyID": "BE-KBO", "value": "0774.373.269"},
            {"@type": "PropertyValue", "propertyID": "VAT", "value": "BE0774373269"},
        ],
        "vatID": "BE0774373269",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Boulevard du Souverain 24 (c/o Buzzy Nest)",
            "postalCode": "1170", "addressLocality": "Watermael-Boitsfort",
            "addressRegion": "Bruxelles-Capitale", "addressCountry": "BE",
        },
        "url": "https://esgim.eu/",
        "sameAs": ["https://esgim.eu/", "https://esgim.eu/legal"],
        "areaServed": [{"@type": "Country", "name": "Belgium"},
                       {"@type": "Place", "name": "Benelux"}],
        "knowsAbout": ["EcoVadis", "sustainability rating", "sustainable procurement",
                       "VSME", "CSRD", "ESG reporting"],
        "founder": {"@id": f"{base}/#francois-dequenne"},
    }
    PERSON = {
        "@type": "Person", "@id": f"{base}/#francois-dequenne",
        "name": "François Dequenne", "jobTitle": "EcoVadis Interim Manager",
        "worksFor": {"@id": f"{base}/#organization"},
    }
    jsonld = {"@context": "https://schema.org", "organization": ORG, "person": PERSON,
              "objects": {}}
    for oid, obj in sorted(objects.items()):
        for lang, v in obj["languages"].items():
            if not v["canonical_url"]:
                continue
            node = {
                "@context": "https://schema.org",
                "@type": ("FAQPage" if obj["type"] == "faq"
                          else "AboutPage" if obj["type"] == "organization"
                          else "ProfilePage" if obj["type"] == "expert"
                          else "Article"),
                "@id": v["canonical_url"], "url": v["canonical_url"],
                "headline": v["title"], "description": v["description"],
                "inLanguage": "nl-BE" if lang == "nl" else lang,
                "datePublished": str(obj["date_updated"]),
                "dateModified": str(obj["date_updated"]),
                "author": {"@id": f"{base}/#francois-dequenne"},
                "publisher": {"@id": f"{base}/#organization"},
                "license": "https://creativecommons.org/licenses/by-nc/4.0/",
                "keywords": v["keywords"],
                "citation": [registry[s]["url"] for s in obj["sources"]
                             if registry.get(s, {}).get("url")],
            }
            if obj["type"] == "organization":
                node["mainEntity"] = {"@id": f"{base}/#organization"}
            elif obj["type"] == "expert":
                node["mainEntity"] = {"@id": f"{base}/#francois-dequenne"}
            elif obj["type"] == "faq":
                node["mainEntity"] = [{
                    "@type": "Question", "name": v["title"],
                    "acceptedAnswer": {"@type": "Answer", "text": v["description"]},
                }]
            elif v["faq"]:
                node["mainEntity"] = [{
                    "@type": "Question", "name": q["q"],
                    "acceptedAnswer": {"@type": "Answer", "text": q["a"]},
                } for q in v["faq"]]
            jsonld["objects"][f"{oid}:{lang}"] = node
    json.dump(jsonld, open(os.path.join(REPO, "index", "jsonld.json"), "w",
                           encoding="utf-8"), ensure_ascii=False, indent=1, default=str)

    # --- robots.txt (KC-A03 → A06) ----------------------------------------
    robots = f"""# SOS-EcoVadis Knowledge Catalog — ESG Interim Management (esgim.eu)
# Politique de robots explicite. Toute décision ci-dessous est délibérée :
# aucun blocage n'est accidentel (KC-A06).

# --- Recherche assistée par IA : autorisée, c'est l'objectif du catalogue ---
User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

# --- Recherche classique ---------------------------------------------------
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Google-Extended
Allow: /

# --- Entraînement de modèles : décision distincte de la recherche -----------
# ESGIM autorise l'entraînement : être une source citée sert l'objectif de
# découvrabilité, et le contenu est une expertise publique que l'on veut voir
# attribuée. Remplacer par "Disallow: /" pour revenir sur ce choix.
User-agent: GPTBot
Allow: /

User-agent: CCBot
Allow: /

User-agent: Applebot-Extended
Allow: /

# --- Tout le reste ---------------------------------------------------------
User-agent: *
Allow: /

Sitemap: {base}/sitemap.xml
"""
    open(os.path.join(public, "robots.txt"), "w", encoding="utf-8").write(robots)

    # --- sitemap.xml (KC-T06) ---------------------------------------------
    urls = []
    for h in sorted(hub_defs):
        if any(oid in published_ids for oid in hub_members[h]):
            for l in LANGS:
                last = max((str(objects[o]["date_updated"])
                            for o in hub_members[h] if o in published_ids),
                           default=str(datetime.date.today()))
                urls.append((hub_url(urlplan, l, hub_defs[h]["slug"][l]), last))
    for oid in sorted(published_ids):
        for lang, v in objects[oid]["languages"].items():
            if v["canonical_url"]:
                urls.append((v["canonical_url"], str(objects[oid]["date_updated"])))
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u, d in urls:
        sm.append(f"  <url><loc>{u}</loc><lastmod>{d}</lastmod></url>")
    sm.append("</urlset>")
    open(os.path.join(public, "sitemap.xml"), "w", encoding="utf-8").write("\n".join(sm) + "\n")

    # --- llms.txt (KC-L01 → L04, L06) -------------------------------------
    LANG_LABEL = {"en": "English", "fr": "Français", "nl": "Nederlands (België)"}
    TYPE_LABEL = {"pricing": {"en": "Pricing", "fr": "Tarifs", "nl": "Tarieven"},
                  "service": {"en": "Services", "fr": "Services", "nl": "Diensten"},
                  "expert": {"en": "Experts", "fr": "Experts", "nl": "Experts"},
                  "glossary": {"en": "Glossary", "fr": "Glossaire", "nl": "Woordenlijst"},
                  "article": {"en": "Articles", "fr": "Articles", "nl": "Artikels"},
                  "faq": {"en": "FAQ", "fr": "FAQ", "nl": "FAQ"},
                  "organization": {"en": "About", "fr": "À propos", "nl": "Over ons"}}
    L = ["# SOS-EcoVadis Knowledge Catalog — ESG Interim Management", "",
         "> Base de connaissances trilingue (EN / FR / NL-BE) sur la notation EcoVadis",
         "> pour les très petites (XS) et petites (S) entreprises : fonctionnement du",
         "> score, preuves acceptées, obtention, maintien et récupération d'une médaille,",
         "> coût d'un accompagnement. Auteur : François Dequenne (ESGIM, esgim.eu),",
         "> plus de 100 projets EcoVadis livrés.",
         "> Licence : CC BY-NC 4.0 — citation avec attribution à ESG Interim Management.",
         "",
         f"Index machine complet : {base}/catalog.json",
         ""]
    L += ["## Index par sujet", ""]
    for h in sorted(hub_defs, key=lambda k: -len(hub_members[k])):
        pub = [o for o in hub_members[h] if o in published_ids]
        if not pub:
            continue
        L.append(f"- [{hub_defs[h]['title']['fr']}]"
                 f"({hub_url(urlplan, 'fr', hub_defs[h]['slug']['fr'])}) : "
                 f"{len(pub)} fiches")
    L.append("")
    for lang in LANGS:
        entries = [(oid, objects[oid]) for oid in sorted(published_ids)
                   if lang in objects[oid]["languages"]]
        if not entries:
            continue
        L += [f"## {LANG_LABEL[lang]}", ""]
        for t in ["organization", "pricing", "service", "expert", "glossary",
                  "article", "faq"]:
            rows = [(oid, o["languages"][lang]) for oid, o in entries if o["type"] == t]
            if not rows:
                continue
            L += [f"### {TYPE_LABEL[t][lang]}", ""]
            for oid, v in rows:
                L.append(f"- [{v['title']}]({v['canonical_url']}) : {v['description']}")
            L.append("")
    if len(published_ids) == 0:
        L += ["## Aucune fiche publiée à ce jour", "",
              "Les 105 objets du catalogue sont en relecture (`status: review`).",
              "Ce fichier se remplira à mesure des validations — voir GOVERNANCE.md §2.", ""]
    open(os.path.join(public, "llms.txt"), "w", encoding="utf-8").write("\n".join(L))

    # llms-full.txt n'est plus produit (D27, 02/09/2026). Le HTML est crawlable
    # et llms.txt dit où trouver quoi : une seconde copie intégrale du catalogue
    # se maintient, se désynchronise, et sous CC BY-NC facilite la reprise en gros
    # plutôt que la citation. Le code retiré est dans l'historique git.

    # --- rapport -----------------------------------------------------------
    nfiles = sum(len(o["languages"]) for o in objects.values())
    print(f"{len(objects)} objets / {nfiles} fichiers — 0 erreur")
    print(f"publiés : {len(published_ids)} ; en relecture : {len(objects)-len(published_ids)}")
    n_unhub = len([o for o in hors_hub if o in published_ids])
    print(f"hubs : {len(hub_defs)} ; facettes sous le seuil : "
          f"{len([t for t in topic_members if t not in hub_defs])} ; "
          f"fiches publiées hors hub : {n_unhub} (listées à l'index des sujets)")
    print(parite)
    for w in warnings:
        print("AVERTISSEMENT :", w)
    print(f"écrit : index/catalog.json, index/jsonld.json, "
          f"public/{{robots.txt, sitemap.xml, llms.txt}}")
    if len(published_ids) == 0:
        print("NOTE : aucune fiche publiée, donc sitemap et llms.txt sont vides. "
              "C'est le comportement voulu (décision D19).")

if __name__ == "__main__":
    main()
