-- Migration 002 : textes de pages du site modifiables depuis l'administration (page « À propos »).
-- Une ligne par page (clé fixe, ex. « a-propos ») ; sans ligne, le site garde ses textes par défaut (js/textes.js).
-- Relançable sans risque (IF NOT EXISTS). Dates : texte ISO 8601 en UTC.

CREATE TABLE IF NOT EXISTS pages (
  cle TEXT PRIMARY KEY,
  titre_fr TEXT NOT NULL DEFAULT '',
  titre_en TEXT NOT NULL DEFAULT '',
  contenu_fr TEXT NOT NULL DEFAULT '',
  contenu_en TEXT NOT NULL DEFAULT '',
  modifie_le TEXT NOT NULL
);
