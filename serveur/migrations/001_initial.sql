-- Migration 001 : tables de départ.
-- Relançable sans risque (IF NOT EXISTS). Chaque instruction se termine par « ; » en fin de ligne.
-- Dates : texte ISO 8601 en UTC (ex. 2026-11-15T14:00:00.000Z), sauf tentee_le (millisecondes depuis 1970).

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  statut TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'publie')),
  date_publication TEXT,
  titre_fr TEXT NOT NULL DEFAULT '',
  titre_en TEXT NOT NULL DEFAULT '',
  contenu_fr TEXT NOT NULL DEFAULT '',
  contenu_en TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  cree_le TEXT NOT NULL,
  modifie_le TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS articles_publies ON articles (statut, date_publication DESC);

-- Limite des tentatives de connexion : une ligne par tentative, adresse IP hachée (HMAC-SHA256), jamais en clair.
CREATE TABLE IF NOT EXISTS tentatives_connexion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hachee TEXT NOT NULL,
  tentee_le INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS tentatives_par_ip ON tentatives_connexion (ip_hachee, tentee_le);
