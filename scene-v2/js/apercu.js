// Aperçu de l'accueil avec la scène v2 (lot 5a ; même principe que scene/apercu.html, retours du lot 1) : scene-v2/index.html (cadrage B, plein écran) dessous, ../index.html (le site, sans modification)
// dessus. Le site est de la même origine : une feuille de style est ajoutée dans l'aperçu seulement pour rendre son fond transparent,
// masquer l'image animée du site (affiche ; la vidéo n'est pas chargée : ?video=0, lot 2b) et rester sur l'accueil.
// Paramètres transmis : ?t= (image fixe de la scène), ?lang=fr|en (langue du site), ?capture=1 (sans la note).
const q = new URLSearchParams(location.search);
const sceneParams = new URLSearchParams({ cadrage: q.get('cadrage') ?? 'B', format: 'plein' });
if (q.get('t') !== null) sceneParams.set('t', q.get('t'));
for (const k of ['p1', 'zb', 'zombie', 'p2', 'details', 'p1vise']) if (q.get(k)) sceneParams.set(k, q.get(k)); // réglages d'atelier : placement, essais (?zombie=face, ?p2=civil, ?details=0)
document.getElementById('scene').src = `index.html?${sceneParams}`;

const CSS = `
html, body, .section-accueil { background: transparent !important; }
.accueil-scene { background: none !important; }
.accueil-affiche, .accueil-video { display: none !important; }
.sections { overflow: hidden !important; }
`;
const neige = document.getElementById('neige');
let site = null; // cadre du site, créé une fois la scène prête
const siteDoc = () => (site && /index\.html/.test(site.contentWindow?.location.href ?? '') ? site.contentDocument : null);

// Feuille qui rend le fond de l'accueil transparent, ajoutée à CHAQUE nouvelle page du site dès que sa tête existe (avant son premier
// affichage). Retours du propriétaire, sur PC : ajoutée trop tard (fin du chargement complet), ou perdue quand la page était remplacée, elle
// laissait voir un écran noir après la neige.
function rendreTransparent() {
  const doc = siteDoc();
  if (!doc?.head) return false;
  if (!doc.getElementById('apercu-transparent')) {
    const style = doc.createElement('style');
    style.id = 'apercu-transparent';
    style.textContent = CSS;
    doc.head.append(style);
    doc.documentElement.style.colorScheme = 'normal'; // un iframe en « dark » recevrait un fond opaque
  }
  return true;
}
// La neige de l'aperçu s'efface quand le site est affichable par-dessus la scène : feuille ajoutée et, s'il joue son entrée, sa propre
// neige en place (même dessin : le passage ne se voit pas).
function relaisNeige() {
  const doc = siteDoc();
  if (!neige.isConnected || !doc?.body || !doc.getElementById('apercu-transparent')) return;
  const entree = doc.documentElement.classList.contains('entree-accueil');
  const vhs = doc.querySelector('.accueil-vhs');
  if (entree && !(vhs && Number(getComputedStyle(vhs).opacity) > 0.5)) return;
  requestAnimationFrame(() => requestAnimationFrame(() => neige.remove()));
}
(function guetter() {
  rendreTransparent();
  relaisNeige();
  setTimeout(guetter, neige.isConnected ? 4 : 250); // vite tant que la neige d'attente est là, puis en veille (pages remplacées)
}());

// Le cadre du site est créé (et non restauré par le navigateur au rechargement) une fois la scène 3D affichée : son entrée en scène se
// joue ainsi par-dessus la scène.
(function attendreScene() {
  const w = document.getElementById('scene').contentWindow;
  if (w?.__scene?.ready || w?.__sceneError) {
    // ?lang= et ?bandeau= (?bandeau=0 cache le bandeau d'alerte) sont transmis au site.
    const siteParams = new URLSearchParams({ video: '0' }); // la scène 3D tient lieu de vidéo
    if (q.get('lang')) siteParams.set('lang', q.get('lang'));
    if (q.get('bandeau')) siteParams.set('bandeau', q.get('bandeau'));
    site = document.createElement('iframe');
    site.id = 'site';
    site.className = 'couche';
    site.title = 'Accueil du site Z-Survival';
    site.src = `../index.html${siteParams.size ? `?${siteParams}` : ''}#accueil`;
    site.addEventListener('load', rendreTransparent); // filet de sécurité
    neige.before(site);
    return;
  }
  setTimeout(attendreScene, 100);
}());

// Coup de feu de la scène → événement « zs:tir » envoyé à l'accueil du site (js/accueil-tir.js : flash du cadre rouge, son),
// comme le fait la vidéo sur le site (lot 2b) ; retour au début de la boucle → « zs:tour ».
const sceneFrame = document.getElementById('scene');
let avant = null;
function suivreTir() {
  const s = sceneFrame.contentWindow?.__scene;
  const win = site?.contentWindow;
  if (s?.ready && typeof s.temps === 'function' && win?.document?.readyState === 'complete') {
    const t = s.temps();
    if (avant !== null && t !== avant) {
      // La boucle peut repartir de 0 entre deux images (grand retour en arrière) ; un petit recul n'est pas un tour de boucle.
      const tour = avant - t > s.duree / 2;
      const passe = (x) => (tour ? avant < x || x <= t : avant < x && x <= t);
      // Un saut de plus d'une seconde (images perdues, premier rendu lent) n'est pas un vrai passage : pas de flash à contretemps.
      const pas = tour ? t + s.duree - avant : t - avant;
      if (tour && pas < 1) win.document.dispatchEvent(new win.CustomEvent('zs:tour'));
      // Chaque coup de feu de la scène (détails : aussi celui du personnage 2) fait flasher le cadre.
      for (const x of s.tirs ?? [s.tir]) if (passe(x) && pas < 1) win.document.dispatchEvent(new win.CustomEvent('zs:tir'));
    }
    avant = t;
  }
  requestAnimationFrame(suivreTir);
}
requestAnimationFrame(suivreTir);

const note = document.getElementById('note');
if (q.get('capture') === '1') note.remove();
else setTimeout(() => note.classList.add('cachee'), 4000);
window.__apercu = {
  pret: () => Boolean(document.getElementById('scene').contentWindow?.__scene?.ready) && siteDoc()?.readyState === 'complete' && !neige.isConnected,
};
