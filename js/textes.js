// Tous les textes du site, regroupés par langue (fr, en) avec exactement les mêmes clés.
// Le HTML ne contient que des clés (data-t="…", data-t-aria, data-t-alt) ; js/i18n.js les applique.
// Les identifiants des sections (#news, #characters…) ne changent pas avec la langue : seuls les intitulés sont traduits.

export const TEXTES = {
  fr: {
    meta: {
      titre: 'Z-Survival',
      description: 'Site officiel du jeu de survie zombies Z-Survival.',
    },
    commun: {
      provisoire: 'Provisoire',
      bientot: 'Bientôt disponible',
      accueilAria: 'Z-Survival — retour à l’accueil',
      navigation: 'Sections de la page',
      aVenir: 'à venir',
      langue: 'Langue',
      comingSoon: 'Coming soon',   // volontairement en anglais dans les deux langues
    },
    accueil: {
      titre: 'Z-Survival',
      sousTitre: 'Tenir jusqu’à l’aube.',
      entrer: 'En savoir plus',
      imageAVenir: 'Image animée — à venir',
    },
    sections: {
      accueil: 'Accueil',
      news: 'Actualités',
      characters: 'Personnages',
      weapons: 'Armes',
      about: 'À propos',
    },
    news: {
      intro: 'Contenu provisoire : les actualités ci-dessous sont fictives.',
      cartes: [
        {
          date: '12/11/2026',
          categorie: 'Mise à jour',
          titre: 'Nouvelle vague de zombies',
          resume: 'Exemple d’actualité : les nuits deviennent plus longues et les zombies plus nombreux.',
        },
        {
          date: '05/11/2026',
          categorie: 'Carte',
          titre: 'L’hélicoptère écrasé',
          resume: 'Exemple d’actualité : une épave fumante apparaît près du bâtiment.',
        },
        {
          date: '28/10/2026',
          categorie: 'Communauté',
          titre: 'Le site ouvre ses portes',
          resume: 'Exemple d’actualité : bienvenue sur le site de Z-Survival.',
        },
      ],
    },
    characters: {
      intro: 'Contenu provisoire : les personnages définitifs arriveront dans un prochain lot.',
      zone: 'Grand personnage',
      liste: 'Choisir un personnage',
      personnages: [
        { nom: 'Personnage 1', role: 'Survivant' },
        { nom: 'Personnage 2', role: 'Survivante' },
        { nom: 'Zombie marcheur', role: 'Infecté' },
        { nom: 'Zombie grand', role: 'Infecté' },
      ],
    },
    weapons: {
      intro: 'Contenu provisoire : armes et statistiques fictives.',
      zone: 'Arme',
      liste: 'Choisir une arme',
      stats: {
        degats: 'Dégâts',
        cadence: 'Cadence',
        portee: 'Portée',
        chargeur: 'Chargeur',
      },
      armes: {
        pistolet: { nom: 'Pistolet', type: 'Arme de poing' },
        fusil: { nom: 'Fusil à pompe', type: 'Courte portée' },
        carabine: { nom: 'Carabine', type: 'Longue portée' },
      },
    },
    studio: {
      nom: 'No Way Studio',
      logoAlt: 'No Way Studio',
      signature: 'Un jeu de No Way Studio',
      copyright: '© 2026 No Way Studio',
    },
    about: {
      intro: 'Contenu provisoire : texte de présentation du studio à écrire.',
      texte: 'No Way Studio crée Z-Survival, un jeu de survie zombies en vue de dessus, jouable directement dans le navigateur, sur téléphone comme sur ordinateur.',
      credits: [
        { titre: 'Création', noms: ['Nowy'] },
      ],
      licences: 'Polices : Barlow, Rubik Wet Paint et Rubik Dirt (licence SIL OFL 1.1).',
    },
  },

  en: {
    meta: {
      titre: 'Z-Survival',
      description: 'Official website of the zombie survival game Z-Survival.',
    },
    commun: {
      provisoire: 'Placeholder',
      bientot: 'Coming soon',
      accueilAria: 'Z-Survival — back to the top',
      navigation: 'Page sections',
      aVenir: 'coming soon',
      langue: 'Language',
      comingSoon: 'Coming soon',
    },
    accueil: {
      titre: 'Z-Survival',
      sousTitre: 'Hold out until dawn.',
      entrer: 'Learn more',
      imageAVenir: 'Animated scene — coming soon',
    },
    sections: {
      accueil: 'Home',
      news: 'News',
      characters: 'Characters',
      weapons: 'Weapons',
      about: 'About us',
    },
    news: {
      intro: 'Placeholder content: the news below is fictional.',
      cartes: [
        {
          date: 'Nov 12, 2026',
          categorie: 'Update',
          titre: 'A new zombie wave',
          resume: 'Sample news: nights are getting longer and the zombies more numerous.',
        },
        {
          date: 'Nov 5, 2026',
          categorie: 'Map',
          titre: 'The crashed helicopter',
          resume: 'Sample news: a smoking wreck appears near the building.',
        },
        {
          date: 'Oct 28, 2026',
          categorie: 'Community',
          titre: 'The website is open',
          resume: 'Sample news: welcome to the Z-Survival website.',
        },
      ],
    },
    characters: {
      intro: 'Placeholder content: the final characters will arrive in a later update.',
      zone: 'Featured character',
      liste: 'Choose a character',
      personnages: [
        { nom: 'Character 1', role: 'Survivor' },
        { nom: 'Character 2', role: 'Survivor' },
        { nom: 'Walker zombie', role: 'Infected' },
        { nom: 'Big zombie', role: 'Infected' },
      ],
    },
    weapons: {
      intro: 'Placeholder content: fictional weapons and stats.',
      zone: 'Weapon',
      liste: 'Choose a weapon',
      stats: {
        degats: 'Damage',
        cadence: 'Fire rate',
        portee: 'Range',
        chargeur: 'Magazine',
      },
      armes: {
        pistolet: { nom: 'Pistol', type: 'Sidearm' },
        fusil: { nom: 'Shotgun', type: 'Short range' },
        carabine: { nom: 'Rifle', type: 'Long range' },
      },
    },
    studio: {
      nom: 'No Way Studio',
      logoAlt: 'No Way Studio',
      signature: 'A No Way Studio game',
      copyright: '© 2026 No Way Studio',
    },
    about: {
      intro: 'Placeholder content: studio introduction to be written.',
      texte: 'No Way Studio makes Z-Survival, a top-down zombie survival game you can play right in your browser, on phone or computer.',
      credits: [
        { titre: 'Created by', noms: ['Nowy'] },
      ],
      licences: 'Fonts: Barlow, Rubik Wet Paint and Rubik Dirt (SIL OFL 1.1 license).',
    },
  },
};

// Langue de secours pour une clé manquante. La langue affichée au premier passage dépend du navigateur (js/i18n.js).
export const LANGUE_PAR_DEFAUT = 'fr';
export const LANGUES = ['fr', 'en'];
