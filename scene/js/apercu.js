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
site.src = `../index.html${q.get('lang') ? `?lang=${encodeURIComponent(q.get('lang'))}` : ''}#accueil`;

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

const note = document.getElementById('note');
if (q.get('capture') === '1') note.remove();
else setTimeout(() => note.classList.add('cachee'), 4000);
window.__apercu = {
  pret: () => Boolean(document.getElementById('scene').contentWindow?.__scene?.ready) && site.contentDocument?.readyState === 'complete',
};
