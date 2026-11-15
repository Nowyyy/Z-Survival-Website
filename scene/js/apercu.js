// Aperçu de l'accueil (retours du lot 1) : scene/index.html (cadrage B, plein écran) dessous, ../index.html (le site, sans modification)
// dessus. Le site est de la même origine : une feuille de style est ajoutée dans l'aperçu seulement pour rendre son fond transparent,
// masquer l'emplacement provisoire de l'image animée et rester sur l'accueil.
// Paramètres transmis : ?t= (image fixe de la scène), ?lang=fr|en (langue du site), ?capture=1 (sans la note).
const q = new URLSearchParams(location.search);
const sceneParams = new URLSearchParams({ cadrage: q.get('cadrage') ?? 'B', format: 'plein' });
if (q.get('t') !== null) sceneParams.set('t', q.get('t'));
for (const k of ['p1', 'zb']) if (q.get(k)) sceneParams.set(k, q.get(k)); // réglages d'atelier du placement
document.getElementById('scene').src = `index.html?${sceneParams}`;
const site = document.getElementById('site');
// Le site n'est chargé qu'une fois la scène 3D affichée (elle met plusieurs secondes à se construire) : son entrée en scène (grain VHS,
// chute du Z, accroche qui s'écrit) se joue ainsi par-dessus la scène, et non sur un fond noir.
const sceneFrameAttente = document.getElementById('scene');
(function attendreScene() {
  const w = sceneFrameAttente.contentWindow;
  if (w?.__scene?.ready || w?.__sceneError) {
    // ?lang= et ?bandeau=1 (bandeau d'alerte à l'essai) sont transmis au site.
    const siteParams = new URLSearchParams();
    if (q.get('lang')) siteParams.set('lang', q.get('lang'));
    if (q.get('bandeau') === '1') siteParams.set('bandeau', '1');
    site.src = `../index.html${siteParams.size ? `?${siteParams}` : ''}#accueil`;
    return;
  }
  setTimeout(attendreScene, 100);
}());

const CSS = `
html, body, .section-accueil { background: transparent !important; }
.accueil-scene { background: none !important; }
.accueil-scene-brume, .accueil-scene-grain, .accueil-mention { display: none !important; }
.sections { overflow: hidden !important; }
`;
site.addEventListener('load', () => {
  const doc = site.contentDocument;
  if (!doc) return;
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.append(style);
  doc.documentElement.style.colorScheme = 'normal'; // un iframe en « dark » recevrait un fond opaque
});

// Coup de feu de la scène → événement « zs:tir » envoyé à l'accueil du site (js/accueil-tir.js : flash du cadre rouge), comme le fera la
// vidéo du lot 2. On suit le temps de la boucle de la scène et on signale chaque passage de l'instant du tir.
const sceneFrame = document.getElementById('scene');
let avant = null;
function suivreTir() {
  const s = sceneFrame.contentWindow?.__scene;
  const win = site.contentWindow;
  if (s?.ready && typeof s.temps === 'function' && win?.document?.readyState === 'complete') {
    const t = s.temps();
    if (avant !== null && t !== avant) {
      // La boucle peut repartir de 0 entre deux images (grand retour en arrière) ; un petit recul n'est pas un tour de boucle.
      const tour = avant - t > s.duree / 2;
      const passe = tour ? avant < s.tir || s.tir <= t : avant < s.tir && s.tir <= t;
      // Un saut de plus d'une seconde (images perdues, premier rendu lent) n'est pas un vrai passage : pas de flash à contretemps.
      const pas = tour ? t + s.duree - avant : t - avant;
      if (passe && pas < 1) win.document.dispatchEvent(new win.CustomEvent('zs:tir'));
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
  pret: () => Boolean(document.getElementById('scene').contentWindow?.__scene?.ready) && /index\.html/.test(site.contentWindow?.location.href ?? '') && site.contentDocument?.readyState === 'complete',
};
