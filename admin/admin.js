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
import { lienSur, rendreMarkdown } from '../js/markdown.js';

const CLE_SESSION = 'z-survival-admin.session';
const DELAI_REVEIL_MS = 600;       // au-delà, « Connexion au serveur… » s'affiche (le serveur se réveille)
const DELAI_MAX_MS = 45_000;
const TAILLE_MAX_IMAGE = 8 * 1024 * 1024;
const TYPES_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const MOTIF_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const $ = (id) => document.getElementById(id);
const ecrans = { connexion: $('ecran-connexion'), liste: $('ecran-liste'), editeur: $('ecran-editeur'), page: $('ecran-page'), bandeau: $('ecran-bandeau'), partage: $('ecran-partage'), armes: $('ecran-armes') };

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
  else if (pageModifiee()) travailGarde = { page: lireFormulairePage() };
  else if (bandeauModifie()) travailGarde = { bandeau: structuredClone(bandeau) };
  else if (partageModifie()) travailGarde = { partage: lireFormulairePartage() };
  else if (armesModifiees()) travailGarde = { armes: structuredClone(armesEtat.armes) };
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
      if (garde.page) await ouvrirPage({ formulaire: garde.page });
      else if (garde.bandeau) await ouvrirBandeau({ garde: garde.bandeau });
      else if (garde.partage) await ouvrirPartage({ garde: garde.partage });
      else if (garde.armes) await ouvrirArmes({ garde: garde.armes });
      else await ouvrirEditeur(garde.id, { formulaire: garde.formulaire });
      annoncer('Votre texte non enregistré a été rouvert. Pensez à l’enregistrer.', { duree: 8000 });
      return;
    } catch (err) {
      if (err instanceof ErreurSession) return;
    }
  }
  await afficherListe();
}

$('deconnexion').addEventListener('click', () => {
  if ((estModifie() || pageModifiee() || bandeauModifie() || partageModifie() || armesModifiees()) && !window.confirm('Des modifications ne sont pas enregistrées. Se déconnecter quand même ?')) return;
  travailGarde = null;
  definirReference();
  referencePage = JSON.stringify(lireFormulairePage());
  referenceBandeau = JSON.stringify(bandeau.messages);
  referencePartage = JSON.stringify(lireFormulairePartage());
  referenceArmes = JSON.stringify(armesEtat.armes);
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
  if (!estModifie() && !pageModifiee() && !bandeauModifie() && !partageModifie() && !armesModifiees() && !travailGarde) return;
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
  const nouveau = lignes.map((l) => (toutes ? l.replace(motif, '') : `${prefixe}${l.replace(/^(#{1,6} |[ \t]*[-*+] )/, '')}`)).join('\n');
  remplacer(zone, debut, fin, nouveau, debut, debut + nouveau.length);
}

// Sous-puce : la ligne devient une puce décalée de deux espaces, rangée sous la puce du dessus (js/markdown.js) ; un nouvel appui sur des
// lignes déjà en sous-puce les remet en puces simples.
function sousPuces(zone) {
  const { selectionStart: d, selectionEnd: f, value: v } = zone;
  const debut = v.lastIndexOf('\n', d - 1) + 1;
  const finLigne = v.indexOf('\n', f);
  const fin = finLigne === -1 ? v.length : finLigne;
  const lignes = v.slice(debut, fin).split('\n');
  const toutes = lignes.every((l) => /^ {2}[-*+] /.test(l));
  const nouveau = lignes.map((l) => (toutes ? l.replace(/^ {2}/, '') : `  - ${l.replace(/^(#{1,6} |[ \t]*[-*+] )/, '')}`)).join('\n');
  remplacer(zone, debut, fin, nouveau, debut, debut + nouveau.length);
}

const formats = {
  gras: (z) => entourer(z, '**', 'texte en gras'),
  italique: (z) => entourer(z, '*', 'texte en italique'),
  titre: (z) => prefixerLignes(z, '## ', /^## /),
  liste: (z) => prefixerLignes(z, '- ', /^- /),
  sousliste: (z) => sousPuces(z),
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
  zone.addEventListener('keydown', (e) => decalerAuTab(zone, e));
});

// Tab dans le texte (demande du propriétaire) : sur une ligne de liste, Tab décale la puce de deux espaces (sous-puce, trois niveaux au
// plus) et Maj + Tab la remonte ; sur une ligne vide, Tab pose deux espaces (on tape ensuite « - »). Sur une ligne de texte ordinaire,
// Tab garde son rôle (champ suivant). Échap puis Tab sort toujours de la zone au clavier. Les titres ne sont pas concernés.
const RETRAIT_MAX = 4; // espaces : troisième niveau (js/markdown.js)
const MOTIF_LIGNE_LISTE = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]/;
let sortieAuTab = false;
function decalerAuTab(zone, e) {
  if (e.key === 'Escape') { sortieAuTab = true; return; }
  if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) { sortieAuTab = false; return; }
  if (sortieAuTab) { sortieAuTab = false; return; }
  const { selectionStart: d, selectionEnd: f, value: v } = zone;
  const debut = v.lastIndexOf('\n', d - 1) + 1;
  const finLigne = v.indexOf('\n', f > d && v[f - 1] === '\n' ? f - 1 : f);
  const fin = finLigne === -1 ? v.length : finLigne;
  const lignes = v.slice(debut, fin).split('\n');
  const listes = lignes.every((l) => MOTIF_LIGNE_LISTE.test(l));
  const vide = lignes.length === 1 && !lignes[0].trim();
  if (!listes && !(vide && !e.shiftKey)) return; // texte ordinaire : Tab passe au champ suivant
  e.preventDefault();
  if (vide) {
    const espaces = Math.min(2, RETRAIT_MAX - lignes[0].length);
    if (espaces > 0) remplacer(zone, d, d, ' '.repeat(espaces), d + espaces, d + espaces);
    return;
  }
  const largeur = (l) => l.match(/^[ \t]*/)[0].replace(/\t/g, '  ').length;
  const nouvelles = lignes.map((l) => {
    const corps = l.replace(/^[ \t]*/, '');
    const retrait = e.shiftKey ? Math.max(0, largeur(l) - 2) : Math.min(RETRAIT_MAX, largeur(l) + 2);
    return ' '.repeat(retrait - (retrait % 2)) + corps;
  });
  const nouveau = nouvelles.join('\n');
  if (nouveau === v.slice(debut, fin)) return;
  if (lignes.length === 1) {
    // Le curseur garde sa place dans le texte de la ligne.
    const ecart = nouvelles[0].length - lignes[0].length;
    const pos = (x) => Math.max(debut, x + ecart);
    remplacer(zone, debut, fin, nouveau, pos(d), pos(f));
  } else {
    remplacer(zone, debut, fin, nouveau, debut, debut + nouveau.length);
  }
}

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
  $('image-etat').textContent = 'Image retirée de l’article (enregistrez pour confirmer). Elle reste dans « Réutiliser une image », d’où on peut aussi la supprimer.';
  $('image-etat').hidden = false;
});

// ---------- Bibliothèque : réutiliser une image déjà envoyée (rien n'est republié) ----------

/** Phrase sur le sort de l'image d'un article supprimé (réponse du serveur : { chemin, supprimee, raison? }). */
function messageImageSupprimee(info) {
  if (!info) return '';
  if (info.supprimee) return ' Son image est supprimée du dépôt (elle disparaît du site d’ici une minute).';
  if (info.raison === 'utilisee_ailleurs') return ' Son image est gardée : un autre article l’utilise.';
  if (info.raison === 'non_configure') return ' Son image n’a pas pu être supprimée (jeton GitHub des images absent) : elle reste dans « Réutiliser une image ».';
  return ` Son image n’a pas pu être supprimée (${info.message ?? 'GitHub injoignable'}) : supprimez-la plus tard depuis « Réutiliser une image ».`;
}

function nomImage(chemin) { return chemin.slice(chemin.lastIndexOf('/') + 1); }

async function remplirBibliotheque() {
  const etat = $('bibliotheque-etat');
  const ul = $('bibliotheque-liste');
  etat.textContent = 'Chargement des images…';
  ul.replaceChildren();
  let r;
  try {
    r = await appel('GET', '/api/admin/images');
  } catch (err) {
    if (!(err instanceof ErreurSession)) etat.textContent = `Images indisponibles : ${messageErreur(err)}`;
    return;
  }
  const images = r.images.filter((i) => imageValide(i.image));
  const notes = [];
  if (!images.length) notes.push('Aucune image envoyée pour l’instant.');
  else notes.push(`${images.length} image${images.length > 1 ? 's' : ''}.`);
  if (r.source === 'articles') notes.push('Jeton GitHub des images absent : seules les images des articles sont listées.');
  etat.textContent = notes.join(' ');
  ul.replaceChildren(...images.map((i) => {
    const li = document.createElement('li');
    li.className = 'admin-vignette';
    const cadre = document.createElement('div');
    cadre.className = 'admin-vignette-image';
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.addEventListener('error', () => { cadre.dataset.absente = 'oui'; cadre.textContent = 'Pas encore en ligne (environ une minute après l’envoi)'; }, { once: true });
    img.src = apercusLocaux.get(i.image) ?? `../${i.image}`;
    cadre.append(img);
    const usage = document.createElement('p');
    usage.className = 'admin-vignette-usage';
    const autres = i.utilisee_par.filter((a) => a.id !== courant?.id);
    const ici = i.image === image || i.utilisee_par.some((a) => a.id === courant?.id);
    const morceaux = [];
    if (ici) morceaux.push('Cet article');
    if (autres.length) morceaux.push(`Utilisée par : ${autres.map((a) => `${a.titre_fr || '(sans titre)'}${a.statut === 'publie' ? '' : ' (brouillon)'}`).join(', ')}`);
    usage.textContent = morceaux.join(' · ') || 'Inutilisée';
    usage.dataset.libre = String(!i.utilisee_par.length && !ici);
    const actions = document.createElement('div');
    actions.className = 'admin-vignette-actions';
    const utiliser = document.createElement('button');
    utiliser.type = 'button';
    utiliser.className = 'bouton bouton-principal';
    utiliser.textContent = i.image === image ? 'Déjà choisie' : 'Utiliser';
    utiliser.disabled = i.image === image && !fichierChoisi;
    utiliser.addEventListener('click', () => reprendreImage(i.image));
    actions.append(utiliser);
    if (!i.utilisee_par.length && !ici && r.source === 'depot') {
      const supprimer = document.createElement('button');
      supprimer.type = 'button';
      supprimer.className = 'admin-bouton admin-bouton-danger';
      supprimer.textContent = 'Supprimer';
      supprimer.addEventListener('click', () => supprimerImage(i.image, supprimer));
      actions.append(supprimer);
    }
    li.append(cadre, usage, actions);
    return li;
  }));
}

function reprendreImage(chemin) {
  fichierChoisi = null;
  image = chemin;
  $('image-fichier').value = '';
  majImage();
  $('image-etat').textContent = 'Image reprise de la bibliothèque : elle est déjà en ligne, rien n’est republié. Pensez à enregistrer l’article.';
  $('image-etat').hidden = false;
  $('bibliotheque').close();
}

async function supprimerImage(chemin, bouton) {
  if (!window.confirm(`Supprimer l’image « ${nomImage(chemin)} » du site ? Aucun article ne l’utilise. Cette action ne peut pas être annulée.`)) return;
  bouton.disabled = true;
  try {
    await appel('DELETE', `/api/admin/images/${encodeURIComponent(nomImage(chemin))}`);
    annoncer('Image supprimée du dépôt (elle disparaît du site d’ici une minute).');
    await remplirBibliotheque();
  } catch (err) {
    if (!(err instanceof ErreurSession)) {
      bouton.disabled = false;
      $('bibliotheque-etat').textContent = `Image non supprimée : ${messageErreur(err)}`;
    }
  }
}

$('image-bibliotheque').addEventListener('click', () => {
  $('bibliotheque').showModal();
  $('bibliotheque').scrollTop = 0;
  remplirBibliotheque();
});
$('bibliotheque-fermer').addEventListener('click', () => $('bibliotheque').close());
$('bibliotheque').addEventListener('close', () => $('image-bibliotheque').focus());

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
  const avecImage = imageValide(courant.image) ? ' Son image sera aussi supprimée du site, sauf si un autre article l’utilise.' : '';
  if (!window.confirm(`Supprimer définitivement « ${courant.titre_fr} » ?${avecImage} Cette action ne peut pas être annulée.`)) return;
  action('Suppression', async () => {
    const r = await appel('DELETE', `/api/admin/articles/${courant.id}`);
    courant = null;
    definirReference();
    annoncer(`Article supprimé.${messageImageSupprimee(r.image)}`, { duree: 9000 });
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
  if ($('bibliotheque').open) $('bibliotheque').close();
  if ($('apercu-page').open) $('apercu-page').close();
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

// ---------- Page « À propos » du site : deux blocs, le jeu puis le studio (titre et texte, FR et EN ; lot 3e) ----------
// Bloc du jeu : page « a-propos-jeu » du serveur ; bloc du studio : page « a-propos » (titre = ligne sous le logo du studio).
// Sans page enregistrée, chaque bloc part des textes par défaut du site (js/textes.js) ; « Enregistrer et publier » n'envoie que les
// blocs modifiés et les met en ligne (une minute au plus, le temps du cache du serveur).

const BLOCS_PAGE = Object.freeze({
  jeu: { cle: 'a-propos-jeu', prefixe: 'jeu', nom: 'du jeu' },
  studio: { cle: 'a-propos', prefixe: 'page', nom: 'du studio' },
});
let referencePage = '';
const pagesEnregistrees = { jeu: null, studio: null };

function lireBlocPage(bloc) {
  const p = BLOCS_PAGE[bloc].prefixe;
  return {
    titre_fr: $(`${p}_titre_fr`).value.trim(),
    titre_en: $(`${p}_titre_en`).value.trim(),
    contenu_fr: $(`${p}_contenu_fr`).value,
    contenu_en: $(`${p}_contenu_en`).value,
  };
}
function lireFormulairePage() { return { jeu: lireBlocPage('jeu'), studio: lireBlocPage('studio') }; }
function remplirBlocPage(bloc, valeurs) {
  const p = BLOCS_PAGE[bloc].prefixe;
  $(`${p}_titre_fr`).value = valeurs.titre_fr ?? '';
  $(`${p}_titre_en`).value = valeurs.titre_en ?? '';
  $(`${p}_contenu_fr`).value = valeurs.contenu_fr ?? '';
  $(`${p}_contenu_en`).value = valeurs.contenu_en ?? '';
}
function remplirFormulairePage(f) {
  if (f.jeu) remplirBlocPage('jeu', f.jeu);
  if (f.studio) remplirBlocPage('studio', f.studio);
}
function pageModifiee() { return !ecrans.page.hidden && JSON.stringify(lireFormulairePage()) !== referencePage; }
// Le titre du studio est la ligne sous le logo (par défaut « Un jeu de No Way Studio ») ; le grand titre « À propos » reste fixe.
const texteParDefaut = {
  jeu: () => ({ titre_fr: TEXTES.fr.about.jeu.titre, titre_en: TEXTES.en.about.jeu.titre, contenu_fr: TEXTES.fr.about.jeu.texte, contenu_en: TEXTES.en.about.jeu.texte }),
  studio: () => ({ titre_fr: TEXTES.fr.studio.signature, titre_en: TEXTES.en.studio.signature, contenu_fr: TEXTES.fr.about.texte, contenu_en: TEXTES.en.about.texte }),
};
// Un enregistrement fait quand le titre du studio désignait le grand titre de la section (« À propos » / « About us ») : le site affiche
// la signature par défaut (js/a-propos.js), le formulaire aussi.
const ANCIENS_TITRES = new Set([TEXTES.fr.sections.about, TEXTES.en.sections.about]);
function corrigerAncienTitre(p) {
  if (!p) return p;
  const c = { ...p };
  if (ANCIENS_TITRES.has(c.titre_fr)) c.titre_fr = TEXTES.fr.studio.signature;
  if (ANCIENS_TITRES.has(c.titre_en)) c.titre_en = TEXTES.en.studio.signature;
  return c;
}

function majStatutPage() {
  const s = $('page-statut');
  const dates = Object.values(pagesEnregistrees).filter(Boolean).map((p) => p.modifie_le).sort();
  s.dataset.statut = dates.length ? 'publie' : 'nouveau';
  s.textContent = dates.length ? `En ligne · ${dateCourte(dates.at(-1))}` : 'Texte d’origine';
}

function choisirOngletPage(langue) {
  for (const l of ['fr', 'en']) {
    const actif = l === langue;
    $(`page-onglet-${l}`).setAttribute('aria-selected', String(actif));
    $(`page-onglet-${l}`).tabIndex = actif ? 0 : -1;
    $(`page-panneau-${l}`).hidden = !actif;
  }
}
document.querySelectorAll('[data-onglet-page]').forEach((b) => {
  b.addEventListener('click', () => choisirOngletPage(b.dataset.ongletPage));
  b.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const autre = b.dataset.ongletPage === 'fr' ? 'en' : 'fr';
    choisirOngletPage(autre);
    $(`page-onglet-${autre}`).focus();
  });
});

async function ouvrirPage({ formulaire = null } = {}) {
  try {
    const [jeu, studio] = await Promise.all([
      appel('GET', `/api/admin/pages/${BLOCS_PAGE.jeu.cle}`),
      appel('GET', `/api/admin/pages/${BLOCS_PAGE.studio.cle}`),
    ]);
    pagesEnregistrees.jeu = jeu.page;
    pagesEnregistrees.studio = studio.page;
  } catch (err) {
    if (!(err instanceof ErreurSession)) annoncer(messageErreur(err), { type: 'erreur', duree: 0 });
    throw err;
  }
  remplirFormulairePage({
    jeu: pagesEnregistrees.jeu ?? texteParDefaut.jeu(),
    studio: corrigerAncienTitre(pagesEnregistrees.studio) ?? texteParDefaut.studio(),
  });
  erreurDans('erreur-page', null);
  choisirOngletPage('fr');
  montrerEcran('page');
  referencePage = JSON.stringify(lireFormulairePage());
  // Texte gardé pendant une expiration de session (ancien format : bloc du studio seul).
  if (formulaire) remplirFormulairePage(formulaire.jeu || formulaire.studio ? formulaire : { studio: formulaire });
  majStatutPage();
}

$('ouvrir-page-a-propos').addEventListener('click', () => ouvrirPage().catch(() => {}));
$('page-retour').addEventListener('click', () => {
  if (pageModifiee() && !window.confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) return;
  referencePage = JSON.stringify(lireFormulairePage());
  afficherListe();
});

/** Premier problème du formulaire : [message, id du champ, langue] ou null. */
function problemePage(f) {
  for (const bloc of ['jeu', 'studio']) {
    const b = f[bloc];
    const p = BLOCS_PAGE[bloc].prefixe;
    const nom = BLOCS_PAGE[bloc].nom;
    if (!b.titre_fr) return [`Le titre français ${nom} est obligatoire.`, `${p}_titre_fr`, 'fr'];
    if (bloc === 'studio' && ANCIENS_TITRES.has(b.titre_fr)) return ['Ce titre est celui de la section (fixe) : écrivez la ligne qui s’affiche sous le logo du studio.', `${p}_titre_fr`, 'fr'];
    if (!b.contenu_fr.trim()) return [`Le texte français ${nom} est obligatoire.`, `${p}_contenu_fr`, 'fr'];
    if (b.contenu_en.trim() && !b.titre_en) return [`Texte anglais ${nom} sans titre anglais : ajoutez le titre anglais (sinon le texte anglais ne sera pas affiché).`, `${p}_titre_en`, 'en'];
  }
  return null;
}

$('page-enregistrer').addEventListener('click', async () => {
  const f = lireFormulairePage();
  const probleme = problemePage(f);
  if (probleme) {
    erreurDans('erreur-page', probleme[0]);
    choisirOngletPage(probleme[2]);
    $(probleme[1]).focus();
    return;
  }
  const reference = JSON.parse(referencePage || '{}');
  // Un bloc jamais enregistré et resté sur les textes d'origine n'est pas envoyé (le site les affiche déjà).
  const aEnvoyer = ['jeu', 'studio'].filter((bloc) => JSON.stringify(f[bloc]) !== JSON.stringify(reference[bloc]));
  if (!aEnvoyer.length) {
    annoncer('Rien n’a changé : rien à enregistrer.');
    return;
  }
  const bouton = $('page-enregistrer');
  bouton.disabled = true;
  erreurDans('erreur-page', null);
  try {
    for (const bloc of aEnvoyer) {
      pagesEnregistrees[bloc] = (await appel('PUT', `/api/admin/pages/${BLOCS_PAGE[bloc].cle}`, { corps: f[bloc] })).page;
      remplirBlocPage(bloc, pagesEnregistrees[bloc]);
      reference[bloc] = lireBlocPage(bloc);
      referencePage = JSON.stringify({ jeu: reference.jeu, studio: reference.studio });
    }
    majStatutPage();
    const quoi = aEnvoyer.length === 2 ? 'Blocs du jeu et du studio enregistrés' : `Bloc ${BLOCS_PAGE[aEnvoyer[0]].nom} enregistré`;
    annoncer(`${quoi} : en ligne sur le site (une minute au plus, le temps du cache).`);
  } catch (err) {
    majStatutPage();
    if (!(err instanceof ErreurSession)) erreurDans('erreur-page', `Enregistrement impossible : ${messageErreur(err)}`);
  } finally {
    bouton.disabled = false;
  }
});

let langueApercuPage = 'fr';
/** Titre et texte d'un bloc dans la langue demandée (règle du site : sans titre anglais, le français). */
function versionBloc(b, lang) {
  const traduit = Boolean(b[`titre_${lang}`]);
  return { traduit, titre: traduit ? b[`titre_${lang}`] : b.titre_fr, contenu: (traduit ? b[`contenu_${lang}`] : '') || b.contenu_fr };
}
function rendreTexteApercu(zone, contenu, mentionFr, lang) {
  const fragment = document.createDocumentFragment();
  if (mentionFr) {
    const mention = document.createElement('p');
    mention.className = 'about-mention';
    const badge = document.createElement('span');
    badge.className = 'actu-mention-fr';
    badge.textContent = TEXTES[lang].news.mentionFr;
    mention.append(badge);
    fragment.append(mention);
  }
  fragment.append(rendreMarkdown(contenu, { niveauTitre: 3 }));
  zone.replaceChildren(fragment);
}
function rendreApercuPage() {
  const f = lireFormulairePage();
  const lang = langueApercuPage;
  const jeu = versionBloc(f.jeu, lang);
  const studio = versionBloc(f.studio, lang);
  $('apercu-page-titre').textContent = TEXTES[lang].sections.about;
  $('apercu-jeu-titre').textContent = jeu.titre || TEXTES[lang].about.jeu.titre;
  rendreTexteApercu($('apercu-jeu-texte'), jeu.contenu, !jeu.traduit && lang !== 'fr', lang);
  $('apercu-page-signature').textContent = (studio.titre && !ANCIENS_TITRES.has(studio.titre)) ? studio.titre : TEXTES[lang].studio.signature;
  rendreTexteApercu($('apercu-page-texte'), studio.contenu, !studio.traduit && lang !== 'fr', lang);
  document.querySelectorAll('[data-apercu-page]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.apercuPage === lang)));
  const sansAnglais = lang !== 'fr' ? ['jeu', 'studio'].filter((bloc) => !versionBloc(f[bloc], lang).traduit).map((bloc) => BLOCS_PAGE[bloc].nom) : [];
  const note = sansAnglais.length ? `Pas de titre anglais pour le bloc ${sansAnglais.join(' ni pour le bloc ')} : le site anglais montre la version française, avec la mention « (FR) ».` : '';
  $('apercu-page-note').textContent = note;
  $('apercu-page-note').hidden = !note;
}
$('page-apercu').addEventListener('click', () => {
  langueApercuPage = 'fr';
  rendreApercuPage();
  $('apercu-page').showModal();
  $('apercu-page').scrollTop = 0;
});
document.querySelectorAll('[data-apercu-page]').forEach((b) => b.addEventListener('click', () => {
  langueApercuPage = b.dataset.apercuPage;
  rendreApercuPage();
}));
$('apercu-page-fermer').addEventListener('click', () => $('apercu-page').close());
$('apercu-page').addEventListener('close', () => $('page-apercu').focus());

// ---------- Bandeau d'alerte de l'accueil (lot 3d) ----------
// Messages de contenus/bandeau.json (lus et réécrits dans le dépôt par le serveur, GET/PUT /api/admin/bandeau). L'empreinte (sha) du
// fichier lu est renvoyée à l'enregistrement : si le fichier a changé ailleurs entre-temps, le serveur refuse (409) au lieu d'écraser.

const MAX_MESSAGES = 30;
let bandeau = { messages: [], sha: null };
let referenceBandeau = '[]';
let langueApercuBandeau = 'fr';
function bandeauModifie() { return !ecrans.bandeau.hidden && JSON.stringify(bandeau.messages) !== referenceBandeau; }

function majStatutBandeau() {
  const n = bandeau.messages.length;
  const affiches = bandeau.messages.filter((m) => m.actif).length;
  const s = $('bandeau-statut');
  s.dataset.statut = bandeauModifie() ? 'brouillon' : 'publie';
  s.textContent = bandeauModifie() ? 'Non enregistré' : `${n} message${n > 1 ? 's' : ''} · ${affiches} affiché${affiches > 1 ? 's' : ''}`;
  $('bandeau-ajouter').hidden = n >= MAX_MESSAGES;
}

function rendreApercuBandeau() {
  const lang = langueApercuBandeau;
  $('bandeau-apercu-titre').textContent = TEXTES[lang].accueil.bandeau.titre;
  const liste = $('bandeau-apercu-liste');
  const items = [];
  const actu = document.createElement('li');
  actu.className = 'admin-bandeau-actu';
  actu.textContent = `${TEXTES[lang].news.bandeau} : (titre du dernier article publié)`;
  items.push(actu);
  for (const m of bandeau.messages) {
    if (!m.actif || !m.fr.trim()) continue;
    const li = document.createElement('li');
    li.textContent = lang === 'en' && m.en.trim() ? m.en.trim() : m.fr.trim();
    if (lang === 'en' && !m.en.trim()) li.lang = 'fr';
    items.push(li);
  }
  liste.replaceChildren(...items);
  $('bandeau-apercu-vide').hidden = items.length > 1;
  document.querySelectorAll('[data-apercu-bandeau]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.apercuBandeau === lang)));
}

function bouton(texte, action, { etiquette, danger = false } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `admin-bouton${danger ? ' admin-bouton-danger' : ''}`;
  b.textContent = texte;
  if (etiquette) b.setAttribute('aria-label', etiquette);
  b.dataset.action = action;
  return b;
}

function champ(etiquette, mention, valeur, lang, cle) {
  const label = document.createElement('label');
  label.className = 'admin-champ';
  const span = document.createElement('span');
  span.className = 'admin-etiquette';
  span.append(`${etiquette} `);
  const m = document.createElement('span');
  m.className = mention === 'obligatoire' ? 'admin-requis' : 'admin-facultatif';
  m.textContent = mention;
  span.append(m);
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 160;
  input.lang = lang;
  input.autocomplete = 'off';
  input.spellcheck = true;
  input.value = valeur;
  input.dataset.cle = cle;
  label.append(span, input);
  return label;
}

function rendreBandeau({ focus = null } = {}) {
  const ol = $('bandeau-liste');
  const n = bandeau.messages.length;
  ol.replaceChildren(...bandeau.messages.map((m, i) => {
    const li = document.createElement('li');
    li.className = 'admin-carte admin-bandeau-message';
    li.dataset.index = String(i);
    li.dataset.cache = String(!m.actif);
    const tete = document.createElement('div');
    tete.className = 'admin-bandeau-tete';
    const numero = document.createElement('span');
    numero.className = 'admin-bandeau-numero';
    numero.textContent = `Message ${i + 1}`;
    const inter = document.createElement('label');
    inter.className = 'admin-interrupteur';
    const coche = document.createElement('input');
    coche.type = 'checkbox';
    coche.checked = m.actif;
    coche.dataset.cle = 'actif';
    inter.append(coche, ' Affiché');
    tete.append(numero, inter);
    const outils = document.createElement('div');
    outils.className = 'admin-bandeau-outils';
    const haut = bouton('↑ Monter', 'monter', { etiquette: `Monter le message ${i + 1}` });
    const bas = bouton('↓ Descendre', 'descendre', { etiquette: `Descendre le message ${i + 1}` });
    haut.disabled = i === 0;
    bas.disabled = i === n - 1;
    outils.append(haut, bas, bouton('Supprimer', 'supprimer', { etiquette: `Supprimer le message ${i + 1}`, danger: true }));
    li.append(tete, champ('Français', 'obligatoire', m.fr, 'fr', 'fr'), champ('English', 'facultatif', m.en, 'en', 'en'), outils);
    return li;
  }));
  if (focus) ol.querySelector(`li[data-index="${focus.index}"] ${focus.selecteur}`)?.focus();
  rendreApercuBandeau();
  majStatutBandeau();
}

$('bandeau-liste').addEventListener('input', (e) => {
  const li = e.target.closest('li[data-index]');
  const cle = e.target.dataset.cle;
  if (!li || !cle) return;
  const m = bandeau.messages[Number(li.dataset.index)];
  if (cle === 'actif') {
    m.actif = e.target.checked;
    li.dataset.cache = String(!m.actif);
  } else m[cle] = e.target.value;
  rendreApercuBandeau();
  majStatutBandeau();
});
$('bandeau-liste').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-action]');
  const li = e.target.closest('li[data-index]');
  if (!b || !li) return;
  const i = Number(li.dataset.index);
  const liste = bandeau.messages;
  if (b.dataset.action === 'monter' && i > 0) {
    [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]];
    rendreBandeau({ focus: { index: i - 1, selecteur: i - 1 === 0 ? '[data-action="descendre"]' : '[data-action="monter"]' } });
  } else if (b.dataset.action === 'descendre' && i < liste.length - 1) {
    [liste[i + 1], liste[i]] = [liste[i], liste[i + 1]];
    rendreBandeau({ focus: { index: i + 1, selecteur: i + 1 === liste.length - 1 ? '[data-action="monter"]' : '[data-action="descendre"]' } });
  } else if (b.dataset.action === 'supprimer') {
    liste.splice(i, 1);
    rendreBandeau();
    (liste.length ? $('bandeau-liste').querySelector(`li[data-index="${Math.min(i, liste.length - 1)}"] input[data-cle="fr"]`) : $('bandeau-ajouter'))?.focus();
    annoncer('Message retiré de la liste (« Annuler les changements » le remet tant que rien n’est enregistré).');
  }
});
$('bandeau-ajouter').addEventListener('click', () => {
  if (bandeau.messages.length >= MAX_MESSAGES) return;
  bandeau.messages.push({ id: '', actif: true, fr: '', en: '' });
  rendreBandeau({ focus: { index: bandeau.messages.length - 1, selecteur: 'input[data-cle="fr"]' } });
});
document.querySelectorAll('[data-apercu-bandeau]').forEach((b) => b.addEventListener('click', () => {
  langueApercuBandeau = b.dataset.apercuBandeau;
  rendreApercuBandeau();
}));

async function ouvrirBandeau({ garde = null } = {}) {
  let lu;
  try {
    lu = await appel('GET', '/api/admin/bandeau');
  } catch (err) {
    if (!(err instanceof ErreurSession)) annoncer(messageErreur(err), { type: 'erreur', duree: 0 });
    throw err;
  }
  const propres = (liste) => liste.map((m) => ({ id: m.id ?? '', actif: m.actif !== false, fr: m.fr ?? '', en: m.en ?? '' }));
  bandeau = { messages: propres(lu.messages ?? []), sha: lu.sha ?? null };
  referenceBandeau = JSON.stringify(bandeau.messages);
  if (garde) bandeau.messages = propres(garde.messages); // liste gardée pendant une expiration de session (empreinte : celle relue)
  erreurDans('erreur-bandeau', null);
  langueApercuBandeau = 'fr';
  montrerEcran('bandeau');
  rendreBandeau();
}

$('ouvrir-bandeau').addEventListener('click', () => ouvrirBandeau().catch(() => {}));
$('bandeau-retour').addEventListener('click', () => {
  if (bandeauModifie() && !window.confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) return;
  referenceBandeau = JSON.stringify(bandeau.messages);
  afficherListe();
});
$('bandeau-annuler').addEventListener('click', () => {
  if (!bandeauModifie()) { annoncer('Aucun changement à annuler.'); return; }
  if (!window.confirm('Revenir aux messages enregistrés ? Les changements en cours seront perdus.')) return;
  bandeau.messages = JSON.parse(referenceBandeau);
  erreurDans('erreur-bandeau', null);
  rendreBandeau();
});

$('bandeau-enregistrer').addEventListener('click', async () => {
  const vide = bandeau.messages.findIndex((m) => !m.fr.trim());
  if (vide >= 0) {
    erreurDans('erreur-bandeau', `Message ${vide + 1} : le texte français est obligatoire (ou supprimez le message).`);
    $('bandeau-liste').querySelector(`li[data-index="${vide}"] input[data-cle="fr"]`)?.focus();
    return;
  }
  const b = $('bandeau-enregistrer');
  b.disabled = true;
  erreurDans('erreur-bandeau', null);
  try {
    const r = await appel('PUT', '/api/admin/bandeau', { corps: { messages: bandeau.messages, sha: bandeau.sha } });
    bandeau = { messages: r.messages.map((m) => ({ ...m })), sha: r.sha ?? null };
    referenceBandeau = JSON.stringify(bandeau.messages);
    rendreBandeau();
    annoncer('Bandeau enregistré : il sera sur l’accueil dans une minute environ (le temps que le site soit republié).', { duree: 9000 });
  } catch (err) {
    if (err instanceof ErreurSession) return;
    if (err instanceof ErreurApi && err.statut === 409) {
      erreurDans('erreur-bandeau', `${messageErreur(err)} Touchez « ← Articles », puis rouvrez le bandeau.`);
    } else erreurDans('erreur-bandeau', `Enregistrement impossible : ${messageErreur(err)}`);
  } finally {
    b.disabled = false;
  }
});

// ---------- Aperçu de partage (lot 3f) : titre et description d'index.html (balises Open Graph / Twitter), réécrits par le serveur ----------

let partageSha = null;
let referencePartage = JSON.stringify({ titre: '', description: '' });
const LIMITES_PARTAGE = { titre: 90, description: 300 };
const surUneLigne = (t) => t.replace(/\s+/g, ' ').trim();

function lireFormulairePartage() {
  return { titre: surUneLigne($('partage_titre').value), description: surUneLigne($('partage_description').value) };
}
function partageModifie() { return !ecrans.partage.hidden && JSON.stringify(lireFormulairePartage()) !== referencePartage; }
function rendrePartage() {
  const f = lireFormulairePartage();
  $('partage-apercu-titre').textContent = f.titre || '(titre)';
  $('partage-apercu-description').textContent = f.description || '(description)';
  $('partage-titre-compteur').textContent = `${f.titre.length} / ${LIMITES_PARTAGE.titre}`;
  $('partage-description-compteur').textContent = `${f.description.length} / ${LIMITES_PARTAGE.description}`;
  const s = $('partage-statut');
  s.dataset.statut = partageModifie() ? 'brouillon' : 'publie';
  s.textContent = partageModifie() ? 'Non enregistré' : 'En ligne';
}
['partage_titre', 'partage_description'].forEach((id) => $(id).addEventListener('input', rendrePartage));

async function ouvrirPartage({ garde = null } = {}) {
  let lu;
  try {
    lu = await appel('GET', '/api/admin/partage');
  } catch (err) {
    if (!(err instanceof ErreurSession)) annoncer(messageErreur(err), { type: 'erreur', duree: 0 });
    throw err;
  }
  partageSha = lu.sha ?? null;
  $('partage_titre').value = lu.titre ?? '';
  $('partage_description').value = lu.description ?? '';
  referencePartage = JSON.stringify(lireFormulairePartage());
  if (garde) { $('partage_titre').value = garde.titre; $('partage_description').value = garde.description; } // texte gardé pendant une expiration de session
  erreurDans('erreur-partage', null);
  montrerEcran('partage');
  rendrePartage();
}

$('ouvrir-partage').addEventListener('click', () => ouvrirPartage().catch(() => {}));
$('partage-retour').addEventListener('click', () => {
  if (partageModifie() && !window.confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) return;
  referencePartage = JSON.stringify(lireFormulairePartage());
  afficherListe();
});
$('partage-annuler').addEventListener('click', () => {
  if (!partageModifie()) { annoncer('Aucun changement à annuler.'); return; }
  const r = JSON.parse(referencePartage);
  $('partage_titre').value = r.titre;
  $('partage_description').value = r.description;
  erreurDans('erreur-partage', null);
  rendrePartage();
});
$('partage-enregistrer').addEventListener('click', async () => {
  const f = lireFormulairePartage();
  if (!f.titre || !f.description) {
    erreurDans('erreur-partage', 'Le titre et la description sont obligatoires.');
    $(f.titre ? 'partage_description' : 'partage_titre').focus();
    return;
  }
  if (!partageModifie()) { annoncer('Rien n’a changé : rien à enregistrer.'); return; }
  const b = $('partage-enregistrer');
  b.disabled = true;
  erreurDans('erreur-partage', null);
  try {
    const r = await appel('PUT', '/api/admin/partage', { corps: { ...f, sha: partageSha } });
    partageSha = r.sha ?? null;
    $('partage_titre').value = r.titre;
    $('partage_description').value = r.description;
    referencePartage = JSON.stringify(lireFormulairePartage());
    rendrePartage();
    annoncer('Aperçu de partage enregistré : en ligne dans une minute environ. Discord et WhatsApp peuvent garder l’ancien quelques jours.', { duree: 9000 });
  } catch (err) {
    if (err instanceof ErreurSession) return;
    if (err instanceof ErreurApi && err.statut === 409) erreurDans('erreur-partage', `${messageErreur(err)} Touchez « ← Articles », puis rouvrez l’aperçu.`);
    else erreurDans('erreur-partage', `Enregistrement impossible : ${messageErreur(err)}`);
  } finally {
    b.disabled = false;
  }
});

// ---------- Armes de la section Armes (lot 6a) ----------
// Réglages de contenus/armes.json (lus et réécrits dans le dépôt par le serveur, GET/PUT /api/admin/armes) : affichée ou « ? »,
// descriptions FR / EN, statistiques de 0 à 100 et leur affichage. Les noms, catégories et images viennent du jeu (lecture seule ici).

const STATS_ARMES = ['degats', 'cadence', 'portee', 'chargeur'];
const MAX_DESCRIPTION = 400;
let armesEtat = { armes: [], sha: null };
let referenceArmes = '[]';
function armesModifiees() { return !ecrans.armes.hidden && JSON.stringify(armesEtat.armes) !== referenceArmes; }
// Réglages seuls (ce que le serveur accepte), dans un ordre stable pour comparer.
const reglagesArme = (a) => ({
  id: a.id,
  prochainement: a.prochainement === true,
  description: { fr: a.description?.fr ?? '', en: a.description?.en ?? '' },
  stats: STATS_ARMES.some((c) => Number.isInteger(a.stats?.[c])) ? Object.fromEntries(STATS_ARMES.map((c) => [c, Number.isInteger(a.stats?.[c]) ? a.stats[c] : null])) : null,
  statsVisibles: a.statsVisibles === true,
});
const libelleStat = (c) => TEXTES.fr.weapons.stats[c] ?? c;
const libelleCategorie = (c) => TEXTES.fr.weapons.categories?.[c] ?? c;
const libelleFamille = (f) => TEXTES.fr.weapons.familles?.[f] ?? f;

function majStatutArmes() {
  const n = armesEtat.armes.length;
  const affichees = armesEtat.armes.filter((a) => !a.prochainement).length;
  const s = $('armes-statut');
  s.dataset.statut = armesModifiees() ? 'brouillon' : 'publie';
  s.textContent = armesModifiees() ? 'Non enregistré' : `${affichees} affichée${affichees > 1 ? 's' : ''} sur ${n}`;
}

function rendreArmes() {
  const ol = $('armes-liste');
  ol.replaceChildren(...armesEtat.armes.map((a, i) => {
    const li = document.createElement('li');
    li.className = 'admin-carte admin-arme';
    li.dataset.index = String(i);
    li.dataset.cache = String(a.prochainement);
    // Tête : miniature, nom, catégorie, interrupteur « Afficher sur le site ».
    const tete = document.createElement('div');
    tete.className = 'admin-arme-tete';
    const img = document.createElement('img');
    img.className = 'admin-arme-image';
    img.src = `../img/armes/${a.id}-mini.webp`;
    img.alt = '';
    img.width = 320;
    img.height = 160;
    img.loading = 'lazy';
    const ident = document.createElement('div');
    ident.className = 'admin-arme-ident';
    const nom = document.createElement('p');
    nom.className = 'admin-arme-nom';
    nom.textContent = a.nomEn && a.nomEn !== a.nom ? `${a.nom} (EN : ${a.nomEn})` : a.nom;
    const cat = document.createElement('p');
    cat.className = 'admin-aide';
    cat.textContent = `${libelleCategorie(a.categorie)} · ${libelleFamille(a.famille)}`;
    const etat = document.createElement('span');
    etat.className = 'admin-arme-etat';
    etat.textContent = a.prochainement ? 'Cachée : « ? » sur le site' : 'Affichée sur le site';
    ident.append(nom, cat, etat);
    tete.append(img, ident);
    const inter = document.createElement('label');
    inter.className = 'admin-interrupteur';
    const coche = document.createElement('input');
    coche.type = 'checkbox';
    coche.checked = !a.prochainement;
    coche.dataset.cle = 'afficher';
    inter.append(coche, ' Afficher sur le site');
    // Descriptions.
    const descriptions = ['fr', 'en'].map((l) => {
      const lab = document.createElement('label');
      lab.className = 'admin-champ';
      const e = document.createElement('span');
      e.className = 'admin-etiquette';
      const compteur = document.createElement('span');
      compteur.className = 'admin-compteur';
      compteur.dataset.compteur = l;
      compteur.textContent = `${(a.description?.[l] ?? '').length} / ${MAX_DESCRIPTION}`;
      e.append(l === 'fr' ? 'Description en français ' : 'Description en anglais ', compteur);
      const zone = document.createElement('textarea');
      zone.className = 'admin-arme-description';
      zone.rows = 4;
      zone.maxLength = MAX_DESCRIPTION;
      zone.lang = l;
      zone.spellcheck = true;
      zone.dataset.cle = `description-${l}`;
      zone.value = a.description?.[l] ?? '';
      lab.append(e, zone);
      return lab;
    });
    // Statistiques.
    const bloc = document.createElement('fieldset');
    bloc.className = 'admin-arme-stats';
    const legende = document.createElement('legend');
    legende.className = 'admin-etiquette';
    legende.textContent = 'Statistiques (0 à 100)';
    const grille = document.createElement('div');
    grille.className = 'admin-arme-grille';
    for (const c of STATS_ARMES) {
      const lab = document.createElement('label');
      lab.className = 'admin-arme-stat';
      const t = document.createElement('span');
      t.textContent = libelleStat(c);
      const champ = document.createElement('input');
      champ.type = 'number';
      champ.min = '0';
      champ.max = '100';
      champ.step = '1';
      champ.inputMode = 'numeric';
      champ.dataset.cle = `stat-${c}`;
      champ.value = Number.isInteger(a.stats?.[c]) ? String(a.stats[c]) : '';
      champ.setAttribute('aria-label', `${libelleStat(c)} de ${a.nom}, de 0 à 100`);
      const barre = document.createElement('span');
      barre.className = 'admin-arme-barre';
      barre.setAttribute('aria-hidden', 'true');
      const plein = document.createElement('span');
      plein.style.setProperty('--valeur', String((Number.isInteger(a.stats?.[c]) ? a.stats[c] : 0) / 100));
      barre.append(plein);
      lab.append(t, champ, barre);
      grille.append(lab);
    }
    const voir = document.createElement('label');
    voir.className = 'admin-interrupteur';
    const cocheStats = document.createElement('input');
    cocheStats.type = 'checkbox';
    cocheStats.checked = a.statsVisibles;
    cocheStats.dataset.cle = 'statsVisibles';
    voir.append(cocheStats, ' Afficher les statistiques (sinon « Prochainement »)');
    bloc.append(legende, grille, voir);
    if (a.prochainement && a.statsVisibles) {
      const note = document.createElement('p');
      note.className = 'admin-aide';
      note.textContent = 'Arme cachée : ses statistiques restent masquées tant qu’elle n’est pas affichée.';
      bloc.append(note);
    }
    li.append(tete, inter, ...descriptions, bloc);
    return li;
  }));
  majStatutArmes();
}

$('armes-liste').addEventListener('input', (e) => {
  const champ = e.target;
  const li = champ.closest('li[data-index]');
  if (!li || !champ.dataset.cle) return;
  const a = armesEtat.armes[Number(li.dataset.index)];
  const cle = champ.dataset.cle;
  if (cle === 'afficher') {
    a.prochainement = !champ.checked;
    li.dataset.cache = String(a.prochainement);
    li.querySelector('.admin-arme-etat').textContent = a.prochainement ? 'Cachée : « ? » sur le site' : 'Affichée sur le site';
  } else if (cle === 'statsVisibles') a.statsVisibles = champ.checked;
  else if (cle.startsWith('description-')) {
    const l = cle.slice('description-'.length);
    a.description = { ...a.description, [l]: champ.value };
    li.querySelector(`[data-compteur="${l}"]`).textContent = `${champ.value.length} / ${MAX_DESCRIPTION}`;
  } else if (cle.startsWith('stat-')) {
    const c = cle.slice('stat-'.length);
    const v = champ.value === '' ? null : Math.round(Number(champ.value));
    const propre = Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : null;
    const stats = { ...Object.fromEntries(STATS_ARMES.map((k) => [k, a.stats?.[k] ?? null])), [c]: propre };
    a.stats = STATS_ARMES.some((k) => Number.isInteger(stats[k])) ? stats : null;
    champ.parentElement.querySelector('.admin-arme-barre span').style.setProperty('--valeur', String((propre ?? 0) / 100));
  }
  majStatutArmes();
});

async function ouvrirArmes({ garde = null } = {}) {
  let lu;
  try {
    lu = await appel('GET', '/api/admin/armes');
  } catch (err) {
    if (!(err instanceof ErreurSession)) annoncer(messageErreur(err), { type: 'erreur', duree: 0 });
    throw err;
  }
  const propres = (liste) => liste.map((a) => ({ id: a.id, nom: a.nom ?? a.id, nomEn: a.nomEn ?? null, categorie: a.categorie ?? '', famille: a.famille ?? '', ...reglagesArme(a) }));
  armesEtat = { armes: propres(lu.armes ?? []), sha: lu.sha ?? null };
  referenceArmes = JSON.stringify(armesEtat.armes);
  if (garde) { // réglages gardés pendant une expiration de session (empreinte : celle relue)
    const parId = new Map(garde.map((a) => [a.id, a]));
    armesEtat.armes = armesEtat.armes.map((a) => (parId.has(a.id) ? { ...a, ...reglagesArme(parId.get(a.id)) } : a));
  }
  erreurDans('erreur-armes', null);
  montrerEcran('armes');
  rendreArmes();
}

$('ouvrir-armes').addEventListener('click', () => ouvrirArmes().catch(() => {}));
$('armes-retour').addEventListener('click', () => {
  if (armesModifiees() && !window.confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) return;
  referenceArmes = JSON.stringify(armesEtat.armes);
  afficherListe();
});
$('armes-annuler').addEventListener('click', () => {
  if (!armesModifiees()) { annoncer('Aucun changement à annuler.'); return; }
  if (!window.confirm('Revenir aux réglages enregistrés ? Les changements en cours seront perdus.')) return;
  armesEtat.armes = JSON.parse(referenceArmes);
  erreurDans('erreur-armes', null);
  rendreArmes();
});
for (const [id, cacher] of [['armes-tout-afficher', false], ['armes-tout-cacher', true]]) {
  $(id).addEventListener('click', () => {
    armesEtat.armes.forEach((a) => { a.prochainement = cacher; });
    rendreArmes();
  });
}
$('armes-enregistrer').addEventListener('click', async () => {
  if (!armesModifiees()) { annoncer('Rien n’a changé : rien à enregistrer.'); return; }
  const sansStats = armesEtat.armes.findIndex((a) => a.statsVisibles && !a.stats);
  if (sansStats >= 0) {
    erreurDans('erreur-armes', `${armesEtat.armes[sansStats].nom} : pour afficher les statistiques, remplissez-en au moins une (ou décochez « Afficher les statistiques »).`);
    $('armes-liste').querySelector(`li[data-index="${sansStats}"] input[data-cle^="stat-"]`)?.focus();
    return;
  }
  const b = $('armes-enregistrer');
  b.disabled = true;
  erreurDans('erreur-armes', null);
  try {
    const avant = new Map(JSON.parse(referenceArmes).map((a) => [a.id, JSON.stringify(reglagesArme(a))]));
    const changees = armesEtat.armes.map(reglagesArme).filter((r) => avant.get(r.id) !== JSON.stringify(r));
    const r = await appel('PUT', '/api/admin/armes', { corps: { armes: changees, sha: armesEtat.sha } });
    armesEtat = { armes: (r.armes ?? []).map((a) => ({ id: a.id, nom: a.nom ?? a.id, nomEn: a.nomEn ?? null, categorie: a.categorie ?? '', famille: a.famille ?? '', ...reglagesArme(a) })), sha: r.sha ?? null };
    referenceArmes = JSON.stringify(armesEtat.armes);
    rendreArmes();
    annoncer('Armes enregistrées : en ligne dans une minute environ (le temps que le site soit republié).', { duree: 9000 });
  } catch (err) {
    if (err instanceof ErreurSession) return;
    if (err instanceof ErreurApi && err.statut === 409) erreurDans('erreur-armes', `${messageErreur(err)} Touchez « ← Articles », puis rouvrez les armes.`);
    else erreurDans('erreur-armes', `Enregistrement impossible : ${messageErreur(err)}`);
  } finally {
    b.disabled = false;
  }
});

// ---------- Démarrage ----------

const existante = lireSession();
if (existante) {
  garderSession(existante);
  entrer().catch(() => {});
} else {
  montrerEcran('connexion');
  $('identifiant').focus();
}
