-- Migration 003 (lot 3c) : date de l'annonce Discord d'un article (première publication).
-- NULL tant que l'article n'a pas été annoncé : une annonce par article, jamais deux, même s'il est dépublié puis republié.
-- Si l'envoi échoue, la date reste NULL et la publication suivante réessaie.
ALTER TABLE articles ADD COLUMN annonce_discord_le TEXT;
