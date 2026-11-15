// Accueil : accroche « radio de survie » (idée « catchy » n° 4, après le lot 1).
// - Pendant l'entrée en scène (js/accueil-entree.js), « Tenir jusqu'à l'aube. » s'écrit lettre par lettre comme un message capté à la
//   radio : chaque lettre passe d'abord par une lettre brouillée, un curseur clignote pendant l'écriture puis s'efface.
// - Le grésillement de la ligne (sursaut, dédoublement rouge et bleu) est en CSS (css/accueil.css, animation accroche-gresille).
// Le texte complet reste lu par les lecteurs d'écran (copie invisible) ; la version écrite est décorative. Un changement de langue remet le
// texte entier tout de suite (js/i18n.js réécrit l'élément). Mouvement réduit : texte fixe, ni écriture ni grésillement.
import { mouvementReduit } from './i18n.js';

const PAS_MS = 42; // une lettre brouillée, puis la vraie : environ 0,09 s par lettre
const BROUILLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// p : l'accroche ; departMs : attente avant la première lettre (synchronisée avec l'apparition de l'accroche).
export function taperAccroche(p, departMs = 0) {
  if (!p || mouvementReduit()) return;
  const texte = p.textContent;
  if (!texte) return;
  const lecture = document.createElement('span');
  lecture.className = 'accroche-lecture';
  lecture.textContent = texte;
  const ecrit = document.createElement('span');
  ecrit.setAttribute('aria-hidden', 'true');
  const lettres = [...texte].map((c) => {
    const s = document.createElement('span');
    s.className = 'accroche-lettre';
    s.textContent = c;
    ecrit.append(s);
    return s;
  });
  const curseur = document.createElement('span');
  curseur.className = 'accroche-curseur';
  ecrit.prepend(curseur); // le curseur avance derrière la dernière lettre écrite
  p.replaceChildren(lecture, ecrit);
  const vraies = [...texte];
  let i = 0;
  let brouille = true;
  const tic = () => {
    if (!p.contains(curseur)) return; // langue changée entre-temps : le texte a été réécrit, on s'arrête
    if (i >= lettres.length) {
      setTimeout(() => curseur.remove(), 1200);
      return;
    }
    const s = lettres[i];
    if (brouille && vraies[i].trim()) {
      s.textContent = BROUILLE[Math.floor(Math.random() * BROUILLE.length)];
      s.classList.add('est-brouille', 'est-visible');
      brouille = false;
    } else {
      s.textContent = vraies[i];
      s.classList.remove('est-brouille');
      s.classList.add('est-visible');
      i += 1;
      brouille = true;
    }
    s.after(curseur);
    setTimeout(tic, PAS_MS);
  };
  setTimeout(tic, departMs);
}
