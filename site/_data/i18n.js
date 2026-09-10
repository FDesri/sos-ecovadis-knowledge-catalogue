// Chaînes d'interface, par langue. Deux blocs par langue :
//   · les clés de premier niveau servent au catalogue (layouts/base.njk) ;
//   · `landing` sert à la coquille des landings (layouts/landing.njk), aux
//     mentions du pied de page et au bandeau de consentement.
// Le néerlandais est du flamand : kmo, btw, wettelijke vermeldingen,
// vouvoiement « u » partout (glossaire §9).
export default {
  fr: {
    skip: "Aller au contenu", home: "Accueil", topics: "Sujets", all_topics: "Tous les sujets",
    faq: "Questions fréquentes", further: "Pour aller plus loin", in_this_topic: "Dans ce sujet",
    updated: "Mise à jour", written_by: "Rédigé par", review_due: "Prochaine revue",
    sheets: "fiches", other_sheets: "Autres fiches", other_langs: "Autres langues", who: "Qui sommes-nous",
    license: "Réutilisation avec attribution", notfound: "Page introuvable",
    notfound_body: "Cette adresse n'existe pas ou plus. Les sujets ci-dessous mènent à l'ensemble du catalogue.",
    catalog_intro: "Le catalogue rassemble l'expérience de plus de 100 projets EcoVadis menés pour des très petites et petites entreprises. Chaque fiche répond à une question réelle, posée par un dirigeant ou un responsable durabilité.",
    types: { article: "Article", faq: "Question", service: "Service", pricing: "Tarifs", expert: "Expert", glossary: "Glossaire", organization: "À propos" },
    landing: {
      brand_label: "SOS EcoVadis — accueil",
      nav_book: "Réserver",
      home: "Accueil", catalogue: "Le catalogue", who: "Qui sommes-nous",
      legal: "Mentions légales", legal_url: "/fr/mentions-legales/",
      mentions: "SOS EcoVadis est un service d'ESG Interim Management. Ce site n'est ni édité, ni affilié, ni approuvé par EcoVadis SAS. EcoVadis est une marque appartenant à son titulaire.",
      consent_label: "Consentement aux cookies de mesure",
      consent_text: "Nous aimerions déposer des cookies de mesure HubSpot pour savoir quelles pages sont lues. Rien n'est déposé sans votre accord. Détail sur la page",
      consent_link: "mentions légales", consent_yes: "Accepter", consent_no: "Refuser",
    },
  },
  nl: {
    skip: "Naar de inhoud", home: "Start", topics: "Onderwerpen", all_topics: "Alle onderwerpen",
    faq: "Veelgestelde vragen", further: "Verder lezen", in_this_topic: "In dit onderwerp",
    updated: "Bijgewerkt", written_by: "Geschreven door", review_due: "Volgende herziening",
    sheets: "fiches", other_sheets: "Overige fiches", other_langs: "Andere talen", who: "Wie zijn wij",
    license: "Hergebruik met bronvermelding", notfound: "Pagina niet gevonden",
    notfound_body: "Dit adres bestaat niet (meer). Via de onderwerpen hieronder vindt u de volledige kennisbank.",
    catalog_intro: "De kennisbank bundelt de ervaring van meer dan 100 EcoVadis-projecten bij zeer kleine en kleine ondernemingen. Elke fiche beantwoordt een echte vraag van een zaakvoerder of duurzaamheidsverantwoordelijke.",
    types: { article: "Artikel", faq: "Vraag", service: "Dienst", pricing: "Tarieven", expert: "Expert", glossary: "Woordenlijst", organization: "Over ons" },
    landing: {
      brand_label: "SOS EcoVadis — startpagina",
      nav_book: "Reserveer",
      home: "Start", catalogue: "De kennisbank", who: "Wie zijn wij",
      legal: "Wettelijke vermeldingen", legal_url: "/nl/wettelijke-vermeldingen/",
      mentions: "SOS EcoVadis is een dienst van ESG Interim Management. Deze website wordt niet uitgegeven door, is niet verbonden met en is niet goedgekeurd door EcoVadis SAS. EcoVadis is een merk van zijn houder.",
      consent_label: "Toestemming voor meetcookies",
      consent_text: "Wij willen graag HubSpot-meetcookies plaatsen om te weten welke pagina's gelezen worden. Zonder uw toestemming wordt niets geplaatst. Meer uitleg op de pagina",
      consent_link: "wettelijke vermeldingen", consent_yes: "Aanvaarden", consent_no: "Weigeren",
    },
  },
  en: {
    skip: "Skip to content", home: "Home", topics: "Topics", all_topics: "All topics",
    faq: "Frequently asked questions", further: "Read next", in_this_topic: "In this topic",
    updated: "Updated", written_by: "Written by", review_due: "Next review",
    sheets: "entries", other_sheets: "Other entries", other_langs: "Other languages", who: "Who we are",
    license: "Reuse with attribution", notfound: "Page not found",
    notfound_body: "This address does not exist, or no longer does. The topics below lead to the whole catalogue.",
    catalog_intro: "The catalogue gathers the experience of more than 100 EcoVadis projects run for very small and small companies. Each entry answers a real question, asked by an owner or a sustainability lead.",
    types: { article: "Article", faq: "Question", service: "Service", pricing: "Pricing", expert: "Expert", glossary: "Glossary", organization: "About" },
    landing: {
      brand_label: "SOS EcoVadis — home",
      nav_book: "Book",
      home: "Home", catalogue: "Knowledge base", who: "Who we are",
      legal: "Legal notice", legal_url: "/en/legal-notice/",
      mentions: "SOS EcoVadis is a service of ESG Interim Management. This site is not published, affiliated with, or endorsed by EcoVadis SAS. EcoVadis is a trademark of its owner.",
      consent_label: "Consent to analytics cookies",
      consent_text: "We would like to set HubSpot analytics cookies to learn which pages get read. Nothing is set without your consent. Details on the",
      consent_link: "legal notice page", consent_yes: "Accept", consent_no: "Decline",
    },
  },
};
