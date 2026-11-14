// Tous les textes du site, regroupés par langue. Le HTML ne contient que des clés (data-t="…") :
// pour ajouter l'anglais, il suffira d'ajouter un bloc `en` avec les mêmes clés.
// Les intitulés de section restent « News », « Characters » et « Weapons » dans toutes les langues.

export const TEXTES = {
  fr: {
    meta: {
      titreAccueil: 'Z-Survival',
      titrePrincipal: 'Z-Survival — News, Characters, Weapons',
      description: 'Site officiel du jeu de survie zombies Z-Survival.',
    },
    commun: {
      provisoire: 'Provisoire',
      jouer: 'Jouer',
      jouerAria: 'Jouer à Z-Survival (ouvre le jeu dans un nouvel onglet)',
      accueil: 'Accueil',
      accueilAria: 'Z-Survival — retour à l’accueil',
      navigation: 'Sections de la page',
      aVenir: 'à venir',
    },
    accueil: {
      titre: 'Z-Survival',
      sousTitre: 'Tenir jusqu’à l’aube.',
      entrer: 'Entrer',
      imageAVenir: 'Image animée — à venir',
    },
    sections: {
      news: 'News',
      characters: 'Characters',
      weapons: 'Weapons',
    },
    news: {
      intro: 'Contenu provisoire : les actualités ci-dessous sont fictives.',
      lire: 'Lire la suite',
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
  },
};

export const LANGUE_PAR_DEFAUT = 'fr';
