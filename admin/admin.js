// Page d'administration des actualités (lot 3b) : connexion, liste, éditeur, image, aperçu, publication.
// Mode d'emploi : Docs/ref/admin.md. Routes du serveur : Docs/ref/serveur.md.
// - Jeton de connexion gardé dans sessionStorage (onglet seulement ; protégé par try/catch), envoyé dans Authorization: Bearer.
//   Déconnexion à l'expiration (2 heures) ou sur toute réponse 401, avec retour à l'écran de connexion ; un texte non enregistré
//   est gardé en mémoire et rouvert après la reconnexion.
// - Aucune insertion de HTML : tout est construit en DOM (textContent) ; aperçu par js/article.js et js/markdown.js (comme le site).
// Page en français seulement (décision du propriétaire) : ses textes sont dans ce fichier et dans admin/index.html.
import { ADRESSE_SERVEUR } from '../js/config.js';
import { TEXTES } from '../js/textes.js';
import { construireArticle, construireCarte, imageValide, versionPublique } from '../js/article.js';
import { lienSur } from '../js/markdown.js';

const CLE_SESSION = 'z-survival-admin.session';
const DELAI_REVEIL_MS = 600;       // au-delà, « Connexion au serveur… » s'affiche (le serveur se réveille)
const DELAI_MAX_MS = 45_000;
const TAILLE_MAX_IMAGE = 8 * 1024 * 1024;
const TYPES_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const MOTIF_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const $ = (id) => document.getElementById(id);
const ecrans = { connexion: $('ecran-connexion'), liste: $('ecran-liste'), editeur: $('ecran-editeur') };

// ---------- Messages ----------

let minuteurMessage = 0;
function annoncer(texte, { type = 'info', duree = 6000 } = {}) {
  const m = $('message');
  clearTimeout(minuteurMessage);
  m.textContent = texte;
  m.dataset.type = type;
  m.hidden = false;
  if (duree) minuteurMessage = setTimeout(() => { m.hidden = true; }, duree);
}
function erreurDans(id, texte) {
  const e = $(id);
  e.textContent = texte ?? '';
  e.hidden = !texte;
}

// ---------- Session (jeton) ----------

let session = null;
let minuteurExpiration = 0;

// Fin de validité comptée sur l'horloge de l'appareil : durée du jeton (exp − iat, lue dans sa partie publique) ajoutée à
// l'instant de la connexion, moins 30 s de marge. Une horloge de téléphone décalée ne fausse donc pas l'expiration.
function finLocale(jeton) {
  try {
    const charge = JSON.parse(atob(jeton.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    const duree = (charge.exp - charge.iat) * 1000;
    if (duree > 0 && duree <= 24 * 3600 * 1000) return Date.now() + duree - 30_000;
  } catch { /* jeton illisible : durée par défaut */ }
  return Date.now() + 2 * 3600 * 1000 - 30_000;
}

function lireSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLE_SESSION) ?? 'null');
    if (s && typeof s.jeton === 'string' && Number(s.fin) > Date.now() + 5000) return s;
  } catch { /* stockage indisponible ou illisible */ }
  return null;
}
function garderSession(s) {
  session = s;
  try { sessionStorage.setItem(CLE_SESSION, JSON.stringify(s)); } catch { /* stockage indisponible : la session vit dans cette page seulement */ }
  clearTimeout(minuteurExpiration);
  const reste = s.fin - Date.now();
  // setTimeout ne va pas au-delà de 24,8 jours ; le jeton dure 2 heures.
  minuteurExpiration = setTimeout(() => deconnecter('Session expirée (2 heures). Reconnectez-vous pour continuer.'), Math.max(0, Math.min(reste, 2 ** 31 - 1)));
}
function effacerSession() {
  session = null;
  clearTimeout(minuteurExpiration);
  try { sessionStorage.removeItem(CLE_SESSION); } catch { /* stockage indisponible */ }
}
const sessionValide = () => Boolean(session && session.fin > Date.now());

// Texte en cours gardé en mémoire (jamais sur le disque) quand la session expire, rouvert après la reconnexion.
let travailGarde = null;

function deconnecter(raison) {
  if (ecrans.editeur.hidden === false && estModifie()) travailGarde = { id: courant?.id ?? null, formulaire: lireFormulaire() };
  effacerSession();
  fermerApercu();
  montrerEcran('connexion');
  $('deconnexion').hidden = true;
  if (raison) erreurDans('erreur-connexion', travailGarde ? `${raison} Votre texte non enregistré est gardé : il reviendra après la connexion.` : raison);
  $('mot-de-passe').value = '';
  ($('identifiant').value ? $('mot-de-passe') : $('identifiant')).focus();
}

// Téléphone mis en veille : les minuteurs dorment ; au retour, on vérifie l'expiration.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && session && !sessionValide()) deconnecter('Session expirée (2 heures). Reconnectez-vous pour continuer.');
});

// ---------- Appels au serveur ----------

class ErreurApi extends Error {
  constructor(statut, message, attente = 0) {
    super(message);
    this.statut = statut;
    this.attente = attente;
  }
}
class ErreurSession extends Error {}

let appelsEnCours = 0;
let minuteurReveil = 0;
function reveil(actif) {
  appelsEnCours += actif ? 1 : -1;
  clearTimeout(minuteurReveil);
  if (appelsEnCours > 0) minuteurReveil = setTimeout(() => { $('reveil').hidden = false; }, DELAI_REVEIL_MS);
  else $('reveil').hidden = true;
}

/** Appel JSON (ou image) au serveur. 401 avec jeton : déconnexion propre. */
async function appel(methode, chemin, { corps, type, sansJeton = false } = {}) {
  const entetes = { Accept: 'application/json' };
  if (!sansJeton) {
    if (!sessionValide()) {
      deconnecter('Session expirée (2 heures). Reconnectez-vous pour continuer.');
      throw new ErreurSession();
    }
    entetes.Authorization = `Bearer ${session.jeton}`;
  }
  let corpsEnvoye;
  if (corps !== undefined) {
    entetes['Content-Type'] = type ?? 'application/json';
    corpsEnvoye = type ? corps : JSON.stringify(corps);
  }
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI_MAX_MS);
  reveil(true);
  let r;
  try {
    r = await fetch(`${ADRESSE_SERVEUR}${chemin}`, { method: methode, headers: entetes, body: corpsEnvoye, signal: controle.signal, cache: 'no-store' });
  } catch {
    throw new ErreurApi(0, 'Serveur injoignable. Vérifiez la connexion internet du téléphone, puis réessayez.');
  } finally {
    clearTimeout(minuteur);
    reveil(false);
  }
  let json = null;
  try { json = await r.json(); } catch { /* réponse sans JSON */ }
  if (r.status === 401 && !sansJeton) {
    deconnecter('Session expirée ou refusée. Reconnectez-vous pour continuer.');
    throw new ErreurSession();
  }
  if (!r.ok) throw new ErreurApi(r.status, json?.erreur ?? `Erreur du serveur (code ${r.status}).`, Number(r.headers.get('Retry-After')) || 0);
  return json;
}

/** Message lisible d'une erreur d'appel (ErreurSession : déjà traitée par la déconnexion). */
function messageErreur(err) {
  if (err instanceof ErreurApi) return err.message;
  return 'Erreur inattendue. Réessayez.';
}

// Le serveur s'endort quand personne ne l'appelle : on le réveille dès l'ouverture de la page.
appel('GET', '/api/sante', { sansJeton: true }).catch(() => {});

// ---------- Écrans ----------

function montrerEcran(nom) {
  for (const [cle, el] of Object.entries(ecrans)) el.hidden = cle !== nom;
  window.scrollTo(0, 0);
}

// ---------- Connexion ----------

$('formulaire-connexion').addEventListener('submit', async (e) => {
  e.preventDefault();
  const identifiant = $('identifiant').value.trim();
  const motDePasse = $('mot-de-passe').value;
  if (!identifiant || !motDePasse) {
    erreurDans('erreur-connexion', 'Entrez votre identifiant et votre mot de passe.');
    return;
  }
  const bouton = $('bouton-connexion');
  bouton.disabled = true;
  erreurDans('erreur-connexion', null);
  try {
    const r = await appel('POST', '/api/admin/connexion', { corps: { identifiant, mot_de_passe: motDePasse }, sansJeton: true });
    $('mot-de-passe').value = '';
    garderSession({ jeton: r.jeton, expire_le: r.expire_le, fin: finLocale(r.jeton) });
    await entrer();
  } catch (err) {
    $('mot-de-passe').value = '';
    if (err instanceof ErreurApi && err.statut === 429) {
      const minutes = Math.max(1, Math.ceil((err.attente || 900) / 60));
      erreurDans('erreur-connexion', `Trop d’essais manqués : par sécurité, la connexion est bloquée pendant environ ${minutes} minute${minutes > 1 ? 's' : ''}. Le blocage s’arrête tout seul ; réessayez ensuite, sans vous presser.`);
    } else if (err instanceof ErreurApi && err.statut === 401) {
      erreurDans('erreur-connexion', 'Identifiant ou mot de passe incorrect.');
    } else if (err instanceof ErreurApi && err.statut === 503) {
      erreurDans('erreur-connexion', 'L’administration n’est pas encore configurée sur le serveur (voir serveur/LISEZMOI.md).');
    } else {
      erreurDans('erreur-connexion', messageErreur(err));
    }
    $('mot-de-passe').focus();
  } finally {
    bouton.disabled = false;
  }
});

async function entrer() {
  $('deconnexion').hidden = false;
  erreurDans('erreur-connexion', null);
  if (travailGarde) {
    const garde = travailGarde;
    travailGarde = null;
    try {
      await ouvrirEditeur(garde.id, { formulaire: garde.formulaire });
      annoncer('Votre texte non enregistré a été rouvert. Pensez à l’enregistrer.', { duree: 8000 });
      return;
    } catch (err) {
      if (err instanceof ErreurSession) return;
    }
  }
  await afficherListe();
}

$('deconnexion').addEventListener('click', () => {
  if (!ecrans.editeur.hidden && estModifie() && !window.confirm('Des modifications ne sont pas enregistrées. Se déconnecter quand même ?')) return;
  travailGarde = null;
  definirReference();
  deconnecter('Vous êtes déconnecté.');
});

// ---------- Liste ----------

function dateCourte(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

async function afficherListe() {
  montrerEcran('liste');
  const ul = $('liste-articles');
  try {
    const articles = [];
    for (let page = 1, pages = 1; page <= pages && page <= 20; page += 1) {
      const r = await appel('GET', `/api/admin/articles?page=${page}`);
      articles.push(...r.articles);
      pages = r.pages;
    }
    ul.replaceChildren(...articles.map((a) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'admin-article';
      const titre = document.createElement('span');
      titre.className = 'admin-article-titre';
      titre.textContent = a.titre_fr || '(sans titre)';
      const statut = document.createElement('span');
      statut.className = 'admin-statut';
      statut.dataset.statut = a.statut;
      statut.textContent = a.statut === 'publie' ? 'Publié' : 'Brouillon';
      const date = document.createElement('span');
      date.className = 'admin-article-date';
      date.textContent = a.date_publication ? `Publication : ${dateCourte(a.date_publication)}` : `Créé le ${dateCourte(a.cree_le)}`;
      const details = document.createElement('span');
      details.className = 'admin-article-details';
      details.append(statut, date);
      if (!a.titre_en) {
        const fr = document.createElement('span');
        fr.className = 'admin-article-langue';
        fr.textContent = 'FR seulement';
        details.append(fr);
      }
      b.append(titre, details);
      b.addEventListener('click', () => ouvrirEditeur(a.id).catch(() => {}));
      li.append(b);
      return li;
    }));
    $('liste-vide').hidden = articles.length > 0;
  } catch (err) {
    if (!(err instanceof ErreurSession)) annoncer(messageErreur(err), { type: 'erreur', duree: 0 });
  }
}

$('nouvel-article').addEventListener('click', () => ouvrirEditeur(null));
$('actualiser').addEventListener('click', () => afficherListe());

// ---------- Éditeur ----------

const champs = ['titre_fr', 'titre_en', 'contenu_fr', 'contenu_en', 'slug', 'date_publication'];
let courant = null;        // article tel qu'enregistré sur le serveur (null : nouveau)
let reference = '';        // formulaire au dernier enregistrement (repère des modifications)
let slugManuel = false;    // le slug a été modifié à la main : il ne suit plus le titre
let image = '';            // chemin de l'image (img/actus/…) ; vide : pas d'image
let fichierChoisi = null;  // image choisie sur l'appareil, pas encore envoyée
let apercusLocaux = new Map(); // chemin envoyé → adresse blob: (l'image met une minute à être en ligne)

/** Slug depuis un titre : « Nouvelle carte : l'hôpital ! » → « nouvelle-carte-l-hopital ». */
export function slugDepuis(titre) {
  const brut = String(titre).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (brut.length <= 80) return brut;
  const coupe = brut.slice(0, 81);
  return (coupe.lastIndexOf('-') > 40 ? coupe.slice(0, coupe.lastIndexOf('-')) : brut.slice(0, 80)).replace(/-+$/, '');
}

const versLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const versIso = (local) => (local ? new Date(local).toISOString() : null);

function lireFormulaire() {
  return {
    slug: $('slug').value.trim(),
    titre_fr: $('titre_fr').value.trim(),
    titre_en: $('titre_en').value.trim(),
    contenu_fr: $('contenu_fr').value,
    contenu_en: $('contenu_en').value,
    date_publication: versIso($('date_publication').value),
    image,
  };
}
function definirReference() { reference = JSON.stringify(lireFormulaire()); }
function estModifie() { return !ecrans.editeur.hidden && JSON.stringify(lireFormulaire()) !== reference; }

function remplirFormulaire(a) {
  $('titre_fr').value = a.titre_fr ?? '';
  $('titre_en').value = a.titre_en ?? '';
  $('contenu_fr').value = a.contenu_fr ?? '';
  $('contenu_en').value = a.contenu_en ?? '';
  $('slug').value = a.slug ?? '';
  $('date_publication').value = versLocal(a.date_publication);
  image = a.image ?? '';
}

function majEtat() {
  const statut = courant?.statut ?? 'nouveau';
  const s = $('statut-article');
  s.dataset.statut = statut;
  s.textContent = { nouveau: 'Nouveau', brouillon: 'Brouillon', publie: 'Publié' }[statut];
  $('titre-editeur').textContent = courant ? (courant.titre_fr || 'Article') : 'Nouvel article';
  $('bouton-enregistrer').textContent = statut === 'publie' ? 'Enregistrer (reste publié)' : 'Enregistrer le brouillon';
  $('bouton-publier').hidden = statut === 'publie';
  $('bouton-depublier').hidden = statut !== 'publie';
  $('zone-suppression').hidden = !courant;
  $('slug-aide').textContent = statut === 'publie'
    ? 'Attention : changer l’adresse d’un article publié casse les liens déjà partagés.'
    : 'Calculée depuis le titre français. Lettres minuscules, chiffres et tirets.';
  majImage();
}

function choisirOnglet(langue) {
  for (const l of ['fr', 'en']) {
    const actif = l === langue;
    const onglet = $(`onglet-${l}`);
    onglet.setAttribute('aria-selected', String(actif));
    onglet.tabIndex = actif ? 0 : -1;
    $(`panneau-${l}`).hidden = !actif;
  }
}
document.querySelectorAll('#ecran-editeur .admin-onglet').forEach((b) => {
  b.addEventListener('click', () => choisirOnglet(b.dataset.langue));
  b.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const autre = b.dataset.langue === 'fr' ? 'en' : 'fr';
    choisirOnglet(autre);
    $(`onglet-${autre}`).focus();
  });
});

async function ouvrirEditeur(id, { formulaire = null } = {}) {
  if (id !== null) {
    try {
      courant = (await appel('GET', `/api/admin/articles/${id}`)).article;
    } catch (err) {
      if (!(err instanceof ErreurSession)) annoncer(messageErreur(err), { type: 'erreur', duree: 0 });
      throw err;
    }
  } else courant = null;
  remplirFormulaire(courant ?? {});
  slugManuel = Boolean(courant);
  fichierChoisi = null;
  $('image-fichier').value = '';
  erreurDans('erreur-article', null);
  choisirOnglet('fr');
  montrerEcran('editeur');
  definirReference();
  if (formulaire) {
    // Texte gardé pendant une expiration de session : remis tel quel (donc « modifié »).
    remplirFormulaire(formulaire);
    slugManuel = true;
  }
  majEtat();
  if (!courant) $('titre_fr').focus();
}

$('titre_fr').addEventListener('input', () => {
  if (!slugManuel) $('slug').value = slugDepuis($('titre_fr').value);
});
$('slug').addEventListener('input', () => {
  slugManuel = true;
  const propre = $('slug').value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (propre !== $('slug').value) $('slug').value = propre;
});
$('slug').addEventListener('change', () => {
  $('slug').value = $('slug').value.replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!$('slug').value) {
    slugManuel = false;
    $('slug').value = slugDepuis($('titre_fr').value);
  }
});

$('retour-liste').addEventListener('click', () => {
  if (estModifie() && !window.confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) return;
  definirReference();
  afficherListe();
});

// Alerte du navigateur si on quitte la page avec des modifications non enregistrées.
window.addEventListener('beforeunload', (e) => {
  if (!estModifie() && !travailGarde) return;
  e.preventDefault();
  e.returnValue = '';
});

// ---------- Barre de mise en forme (utilisable au pouce : boutons de 44 px) ----------

function remplacer(zone, debut, fin, texte, selDebut, selFin) {
  zone.focus();
  zone.setRangeText(texte, debut, fin, 'end');
  zone.setSelectionRange(selDebut, selFin);
  zone.dispatchEvent(new Event('input', { bubbles: true }));
}

function entourer(zone, marque, exemple) {
  const { selectionStart: d, selectionEnd: f, value: v } = zone;
  const choisi = v.slice(d, f);
  const texte = choisi || exemple;
  remplacer(zone, d, f, `${marque}${texte}${marque}`, d + marque.length, d + marque.length + texte.length);
}

function prefixerLignes(zone, prefixe, motif) {
  const { selectionStart: d, selectionEnd: f, value: v } = zone;
  const debut = v.lastIndexOf('\n', d - 1) + 1;
  const finLigne = v.indexOf('\n', f);
  const fin = finLigne === -1 ? v.length : finLigne;
  const lignes = v.slice(debut, fin).split('\n');
  const toutes = lignes.every((l) => motif.test(l));
  const nouveau = lignes.map((l) => (toutes ? l.replace(motif, '') : `${prefixe}${l.replace(/^(#{1,6} |[-*+] )/, '')}`)).join('\n');
  remplacer(zone, debut, fin, nouveau, debut, debut + nouveau.length);
}

const formats = {
  gras: (z) => entourer(z, '**', 'texte en gras'),
  italique: (z) => entourer(z, '*', 'texte en italique'),
  titre: (z) => prefixerLignes(z, '## ', /^## /),
  liste: (z) => prefixerLignes(z, '- ', /^- /),
  lien: (z) => {
    const { selectionStart: d, selectionEnd: f, value: v } = z;
    const saisie = window.prompt('Adresse du lien (commence par https://) :', 'https://');
    if (saisie === null) { z.focus(); return; }
    const adresse = lienSur(saisie);
    if (!adresse) {
      annoncer('Adresse refusée : elle doit commencer par https:// (ou http://).', { type: 'erreur' });
      z.focus();
      return;
    }
    const texte = v.slice(d, f) || 'texte du lien';
    remplacer(z, d, f, `[${texte}](${adresse})`, d + 1, d + 1 + texte.length);
  },
};
document.querySelectorAll('.admin-outils').forEach((barre) => {
  const zone = $(barre.dataset.cible);
  barre.querySelectorAll('button[data-format]').forEach((b) => {
    // Le toucher ne fait pas perdre la sélection du texte.
    b.addEventListener('pointerdown', (e) => e.preventDefault());
    b.addEventListener('click', () => formats[b.dataset.format](zone));
  });
});

// ---------- Image ----------

function majImage() {
  const apercu = $('image-apercu');
  const etat = $('image-etat');
  const source = fichierChoisi ? apercusLocaux.get(fichierChoisi) : (apercusLocaux.get(image) ?? (imageValide(image) ? `../${image}` : null));
  apercu.hidden = !source;
  $('image-vide').hidden = Boolean(source);
  if (source && apercu.getAttribute('src') !== source) apercu.src = source;
  if (!source) apercu.removeAttribute('src');
  $('image-envoyer').hidden = !fichierChoisi;
  $('image-retirer').hidden = !image && !fichierChoisi;
  $('image-choisir').textContent = image || fichierChoisi ? 'Remplacer l’image' : 'Choisir une image';
  if (fichierChoisi) {
    etat.textContent = 'Image choisie, pas encore envoyée : touchez « Envoyer l’image ».';
    etat.hidden = false;
  } else if (!image) etat.hidden = true;
}

$('image-apercu').addEventListener('error', () => {
  if (!fichierChoisi && image && !apercusLocaux.has(image)) {
    $('image-etat').textContent = 'Image pas encore en ligne : GitHub republie le site, environ une minute après l’envoi.';
    $('image-etat').hidden = false;
  }
});

$('image-fichier').addEventListener('change', () => {
  const fichier = $('image-fichier').files?.[0];
  if (!fichier) return;
  if (!TYPES_IMAGE.includes(fichier.type)) {
    annoncer('Format refusé : JPEG, PNG ou WebP seulement.', { type: 'erreur' });
    $('image-fichier').value = '';
    return;
  }
  if (fichier.size > TAILLE_MAX_IMAGE) {
    annoncer(`Image trop lourde (${(fichier.size / 1024 / 1024).toFixed(1)} Mo) : 8 Mo au plus.`, { type: 'erreur' });
    $('image-fichier').value = '';
    return;
  }
  fichierChoisi = fichier;
  if (!apercusLocaux.has(fichier)) apercusLocaux.set(fichier, URL.createObjectURL(fichier));
  majImage();
});

$('image-envoyer').addEventListener('click', async () => {
  if (!fichierChoisi) return;
  const slug = $('slug').value.trim();
  if (!MOTIF_SLUG.test(slug)) {
    erreurDans('erreur-article', 'Écrivez d’abord le titre français (il donne son nom à l’image).');
    $('titre_fr').focus();
    return;
  }
  const bouton = $('image-envoyer');
  bouton.disabled = true;
  $('image-etat').textContent = 'Envoi de l’image…';
  $('image-etat').hidden = false;
  try {
    const r = await appel('POST', `/api/admin/images?slug=${encodeURIComponent(slug)}`, { corps: fichierChoisi, type: fichierChoisi.type });
    apercusLocaux.set(r.image, apercusLocaux.get(fichierChoisi));
    image = r.image;
    fichierChoisi = null;
    $('image-fichier').value = '';
    majImage();
    $('image-etat').textContent = `Image envoyée (${r.largeur} × ${r.hauteur} pixels, ${Math.round(r.octets / 1024)} Ko, sans informations cachées). `
      + 'Elle sera visible sur le site dans environ une minute (GitHub republie le site). Pensez à enregistrer l’article.';
    $('image-etat').hidden = false;
  } catch (err) {
    if (!(err instanceof ErreurSession)) {
      $('image-etat').textContent = `Image non envoyée : ${messageErreur(err)}`;
      $('image-etat').hidden = false;
    }
  } finally {
    bouton.disabled = false;
  }
});

$('image-retirer').addEventListener('click', () => {
  fichierChoisi = null;
  image = '';
  $('image-fichier').value = '';
  majImage();
  $('image-etat').textContent = 'Image retirée de l’article (enregistrez pour confirmer). Le fichier reste dans le dépôt.';
  $('image-etat').hidden = false;
});

// ---------- Enregistrer, publier, dépublier, supprimer ----------

function verifier({ pourPublier }) {
  const f = lireFormulaire();
  if (!f.titre_fr) return ['Le titre français est obligatoire.', 'titre_fr', 'fr'];
  if (!MOTIF_SLUG.test(f.slug)) return ['Adresse (slug) invalide : lettres minuscules, chiffres et tirets seulement.', 'slug'];
  if (pourPublier && !f.contenu_fr.trim()) return ['Pour publier, le texte français est obligatoire.', 'contenu_fr', 'fr'];
  if (f.contenu_en.trim() && !f.titre_en) return ['Texte anglais sans titre anglais : ajoutez le titre anglais (sinon le texte anglais ne sera pas affiché).', 'titre_en', 'en'];
  if (fichierChoisi) return ['Une image est choisie mais pas envoyée : touchez « Envoyer l’image », ou « Retirer l’image ».', 'image-envoyer'];
  return null;
}

let occupe = false;
async function action(nom, travail) {
  if (occupe) return;
  occupe = true;
  const boutons = [...document.querySelectorAll('#actions-article button, #bouton-supprimer')];
  boutons.forEach((b) => { b.disabled = true; });
  erreurDans('erreur-article', null);
  try {
    await travail();
  } catch (err) {
    if (!(err instanceof ErreurSession)) erreurDans('erreur-article', `${nom} impossible : ${messageErreur(err)}`);
  } finally {
    occupe = false;
    boutons.forEach((b) => { b.disabled = false; });
  }
}

function refuser(probleme) {
  const [texte, champ, onglet] = probleme;
  erreurDans('erreur-article', texte);
  if (onglet) choisirOnglet(onglet);
  $(champ)?.focus();
}

/** Envoie le formulaire (création ou modification) ; renvoie l'article enregistré. */
async function enregistrer() {
  const f = lireFormulaire();
  if (!courant) {
    courant = (await appel('POST', '/api/admin/articles', { corps: { ...f, statut: 'brouillon' } })).article;
  } else if (JSON.stringify(f) !== reference || !courant) {
    courant = (await appel('PUT', `/api/admin/articles/${courant.id}`, { corps: f })).article;
  }
  remplirFormulaire(courant);
  slugManuel = true;
  definirReference();
  majEtat();
  return courant;
}

$('bouton-enregistrer').addEventListener('click', () => {
  const probleme = verifier({ pourPublier: courant?.statut === 'publie' });
  if (probleme) { refuser(probleme); return; }
  action('Enregistrement', async () => {
    await enregistrer();
    annoncer(courant.statut === 'publie' ? 'Modifications enregistrées : elles sont en ligne (une minute au plus).' : 'Brouillon enregistré (invisible sur le site).');
  });
});

$('bouton-publier').addEventListener('click', () => {
  const probleme = verifier({ pourPublier: true });
  if (probleme) { refuser(probleme); return; }
  action('Publication', async () => {
    await enregistrer();
    courant = (await appel('POST', `/api/admin/articles/${courant.id}/publier`)).article;
    remplirFormulaire(courant);
    definirReference();
    majEtat();
    annoncer('Article publié : il est sur le site (une minute au plus, le temps du cache).');
  });
});

$('bouton-depublier').addEventListener('click', () => {
  if (!courant) return;
  if (!window.confirm('Dépublier cet article ? Il disparaîtra du site et redeviendra un brouillon.')) return;
  action('Dépublication', async () => {
    if (estModifie()) {
      const probleme = verifier({ pourPublier: false });
      if (probleme) { refuser(probleme); return; }
      await enregistrer();
    }
    courant = (await appel('POST', `/api/admin/articles/${courant.id}/depublier`)).article;
    remplirFormulaire(courant);
    definirReference();
    majEtat();
    annoncer('Article dépublié : il redevient un brouillon, invisible sur le site.');
  });
});

$('bouton-supprimer').addEventListener('click', () => {
  if (!courant) return;
  if (!window.confirm(`Supprimer définitivement « ${courant.titre_fr} » ? Cette action ne peut pas être annulée.`)) return;
  action('Suppression', async () => {
    await appel('DELETE', `/api/admin/articles/${courant.id}`);
    courant = null;
    definirReference();
    annoncer('Article supprimé.');
    await afficherListe();
  });
});

// ---------- Aperçu (tel que sur le site) ----------

let langueApercu = 'fr';

function rendreApercu() {
  const f = lireFormulaire();
  const brut = { ...f, date_publication: f.date_publication ?? courant?.date_publication ?? new Date().toISOString() };
  const article = versionPublique(brut, langueApercu);
  const source = fichierChoisi ? apercusLocaux.get(fichierChoisi) : apercusLocaux.get(f.image);
  const options = { lang: langueApercu, textes: TEXTES[langueApercu].news, prefixe: '../', source };
  const carte = construireCarte(article, options);
  carte.addEventListener('click', (e) => e.preventDefault());
  $('apercu-carte').replaceChildren(carte);
  $('apercu-article').replaceChildren(construireArticle(article, { ...options, idTitre: 'apercu-article-titre' }));
  document.querySelectorAll('[data-apercu]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.apercu === langueApercu)));
  const notes = [];
  if (langueApercu === 'en' && article.langue === 'fr') notes.push('Pas de titre anglais : le site anglais montre la version française, avec la mention « (FR) ».');
  if (!f.date_publication) notes.push('Date affichée : celle d’aujourd’hui (la vraie date sera celle de la publication).');
  if (fichierChoisi) notes.push('Image choisie mais pas encore envoyée.');
  $('apercu-note').textContent = notes.join(' ');
  $('apercu-note').hidden = notes.length === 0;
}

function fermerApercu() {
  if ($('apercu').open) $('apercu').close();
}

$('bouton-apercu').addEventListener('click', () => {
  langueApercu = 'fr';
  rendreApercu();
  $('apercu').showModal();
  $('apercu').scrollTop = 0;
});
document.querySelectorAll('[data-apercu]').forEach((b) => b.addEventListener('click', () => {
  langueApercu = b.dataset.apercu;
  rendreApercu();
}));
$('apercu-fermer').addEventListener('click', fermerApercu);
$('apercu').addEventListener('close', () => $('bouton-apercu').focus());

// ---------- Démarrage ----------

const existante = lireSession();
if (existante) {
  garderSession(existante);
  entrer().catch(() => {});
} else {
  montrerEcran('connexion');
  $('identifiant').focus();
}
