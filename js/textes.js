// Tous les textes du site, regroupés par langue (fr, en) avec exactement les mêmes clés.
// Le HTML ne contient que des clés (data-t="…", data-t-aria, data-t-alt) ; js/i18n.js les applique.
// Les identifiants des sections (#news, #characters…) ne changent pas avec la langue : seuls les intitulés sont traduits.

export const TEXTES = {
  fr: {
    // Titre de l'onglet et description (lot 4a : soignés pour le référencement). Le HTML d'index.html porte la version française,
    // identique (outils/verifier-lot-4a.mjs le vérifie) ; js/i18n.js pose la version de la langue affichée.
    meta: {
      titre: 'Z-Survival — jeu de survie zombies sur navigateur',
      description: 'Z-Survival, jeu de survie zombies en vue de dessus par No Way Studio : tenez jusqu’à l’aube, directement dans le navigateur, sur téléphone comme sur ordinateur. Bientôt disponible.',
    },
    // Aperçu de partage (lot 4a) : balises Open Graph et Twitter Card d'index.html, en français (og:locale fr_FR), recopiées telles
    // quelles dans le HTML (les réseaux sociaux ne lisent pas le JavaScript) ; outils/verifier-lot-4a.mjs vérifie qu'elles sont identiques.
    partage: {
      titre: 'Z-Survival — survie zombies sur navigateur',
      description: 'La nuit tombe, les morts se relèvent. Tiendrez-vous jusqu’à l’aube ? Z-Survival, jeu de survie zombies en vue de dessus par No Way Studio, bientôt disponible sur navigateur.',
      imageAlt: 'Le logo Z-Survival sur une scène du jeu : un survivant tire, la nuit, devant un hélicoptère en feu.',
    },
    commun: {
      provisoire: 'Provisoire',
      bientot: 'Bientôt disponible',
      accueilAria: 'Z-Survival — retour à l’accueil',
      navigation: 'Sections de la page',
      aVenir: 'à venir',
      langue: 'Langue',
      comingSoon: 'Prochainement',
      discord: 'Rejoindre le Discord de Z-Survival (nouvel onglet)',
      defiler: 'Défiler',
    },
    musique: {
      activer: 'Activer la musique',
      couper: 'Couper la musique',
    },
    accueil: {
      titre: 'Z-Survival',
      sousTitre: 'Tenir jusqu’à l’aube.',
      entrer: 'En savoir plus',
      // Encart en bas à gauche de l'accueil, à la manière des badges « disponible sur… » (petite ligne, puis le nom de la plateforme).
      plateforme: {
        petit: 'Disponible sur',
        grand: 'Navigateur',
      },
      // Bandeau d'alerte (idée « catchy » n° 5, en service) : étiquette et nom accessible ; les messages sont dans
      // contenus/bandeau.json (modifiables sans toucher au code, puis par l'interface d'administration).
      bandeau: {
        titre: 'Alerte',
        aria: 'Messages d’alerte',
      },
    },
    sections: {
      accueil: 'Accueil',
      news: 'Actualités',
      characters: 'Personnages',
      weapons: 'Armes',
      about: 'À propos',
    },
    // Actualités (lot 3b) : articles lus sur le serveur (js/actualites.js) ; le texte des articles vient de la page d'administration.
    news: {
      chargement: 'Chargement des actualités…',
      indisponible: 'Actualités indisponibles pour le moment.',
      vide: {
        titre: 'Radio silencieuse',
        texte: 'Aucune transmission pour l’instant. Restez à l’abri et à l’écoute : les premières nouvelles arrivent.',
      },
      plus: 'Actualités plus anciennes',
      fermer: 'Fermer l’article',
      chargementArticle: 'Chargement de l’article…',
      introuvable: 'Cet article n’existe pas ou n’est plus en ligne.',
      articleIndisponible: 'Article indisponible pour le moment.',
      mentionFr: '(FR)',
      mentionFrTitre: 'Article disponible en français seulement',
      bandeau: 'Dernière transmission',
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
    // À propos : deux blocs, le jeu (textes fixes, about.jeu) puis le studio. Pour le studio, titre (studio.signature) et texte (about.texte)
    // par défaut, remplacés par ceux de la page d'administration dès qu'ils sont enregistrés (js/a-propos.js).
    about: {
      jeu: {
        titre: 'Le jeu',
        texte: 'Z-Survival est un jeu de survie zombies en vue de dessus, jouable directement dans le navigateur, sur téléphone comme sur ordinateur. Bientôt disponible.',
        imageAlt: 'Z-Survival en jeu, vu de dessus : le survivant tire sur des zombies qui l’encerclent.',
      },
      texte: 'No Way Studio crée Z-Survival. Rejoignez la communauté sur [Discord](https://discord.gg/4bBRJNzwwB) pour suivre le développement du jeu.',
      credits: [
        { titre: 'Création', noms: ['Nowy'] },
      ],
      licences: 'Polices : Barlow, Rubik Wet Paint et Rubik Dirt (licence SIL OFL 1.1).',
    },
  },

  en: {
    meta: {
      titre: 'Z-Survival — zombie survival browser game',
      description: 'Z-Survival, a top-down zombie survival game by No Way Studio: hold out until dawn, right in your browser, on phone or computer. Coming soon.',
    },
    partage: {
      titre: 'Z-Survival — zombie survival in your browser',
      description: 'Night falls, the dead rise. Can you hold out until dawn? Z-Survival, a top-down zombie survival game by No Way Studio, coming soon to your browser.',
      imageAlt: 'The Z-Survival logo over a scene from the game: a survivor shoots at night, in front of a burning helicopter.',
    },
    commun: {
      provisoire: 'Placeholder',
      bientot: 'Coming soon',
      accueilAria: 'Z-Survival — back to the top',
      navigation: 'Page sections',
      aVenir: 'coming soon',
      langue: 'Language',
      comingSoon: 'Coming soon',
      discord: 'Join the Z-Survival Discord (opens in a new tab)',
      defiler: 'Scroll',
    },
    musique: {
      activer: 'Turn music on',
      couper: 'Turn music off',
    },
    accueil: {
      titre: 'Z-Survival',
      sousTitre: 'Hold out until dawn.',
      entrer: 'Learn more',
      // Bottom-left badge on the home screen, styled like "available on…" store badges (small line, then the platform name).
      plateforme: {
        petit: 'Available on',
        grand: 'Browser',
      },
      // Alert ticker ("catchy" idea no. 5, live): label and accessible name; the messages live in
      // contenus/bandeau.json (editable without touching the code, later through the admin interface).
      bandeau: {
        titre: 'Alert',
        aria: 'Alert messages',
      },
    },
    sections: {
      accueil: 'Home',
      news: 'News',
      characters: 'Characters',
      weapons: 'Weapons',
      about: 'About us',
    },
    // News (lot 3b): articles read from the server (js/actualites.js); the article text comes from the admin page.
    news: {
      chargement: 'Loading news…',
      indisponible: 'News unavailable at the moment.',
      vide: {
        titre: 'Radio silence',
        texte: 'No transmissions yet. Stay safe and keep listening: the first news is on its way.',
      },
      plus: 'Older news',
      fermer: 'Close the article',
      chargementArticle: 'Loading the article…',
      introuvable: 'This article does not exist or is no longer online.',
      articleIndisponible: 'Article unavailable at the moment.',
      mentionFr: '(FR)',
      mentionFrTitre: 'Article available in French only',
      bandeau: 'Latest transmission',
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
    // About us: two blocks, the game (fixed texts, about.jeu) then the studio (default title and text, replaced by the admin page's).
    about: {
      jeu: {
        titre: 'The game',
        texte: 'Z-Survival is a top-down zombie survival game you can play right in your browser, on phone or computer. Coming soon.',
        imageAlt: 'Z-Survival gameplay, seen from above: the survivor shoots the zombies closing in.',
      },
      texte: 'No Way Studio makes Z-Survival. Join the community on [Discord](https://discord.gg/4bBRJNzwwB) to follow the game’s development.',
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
