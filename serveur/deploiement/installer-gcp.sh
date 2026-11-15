#!/usr/bin/env bash
# ============================================================================
# Installation Google Cloud du serveur du site Z-Survival (lot 3a)
# ============================================================================
# À lancer dans Cloud Shell (icône >_ en haut de la console Google Cloud),
# en collant CETTE LIGNE (pas le contenu du fichier : voir serveur/LISEZMOI.md) :
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/Nowyyy/Z-Survival-Website/main/serveur/deploiement/installer-gcp.sh)
#
# Ce que fait le script (relançable sans casse : chaque étape regarde d'abord ce qui existe) :
#   1. vérifie le projet (z-survival-website) ;
#   2. active les API nécessaires ;
#   3. crée le dépôt d'images Artifact Registry (europe-west3), qui ne garde que les 3 dernières images ;
#   4. crée deux comptes de service : « serveur-site » (le serveur : lecture de ses secrets, rien d'autre)
#      et « deploiement-github » (GitHub : envoyer une image et déployer le service, rien d'autre) ;
#   5. relie GitHub à Google Cloud SANS CLÉ (fédération d'identité), seulement pour le dépôt
#      Nowyyy/Z-Survival-Website et la branche main ;
#   6. vous DEMANDE les valeurs secrètes (saisie masquée) et calcule l'empreinte du mot de passe ici ;
#      génère lui-même la clé de session ;
#   7. range ces valeurs dans Secret Manager ;
#   8. affiche les 4 valeurs NON secrètes à recopier dans GitHub (onglet Variables).
#
# Les secrets ne sont jamais affichés, jamais écrits sur le disque, jamais dans l'historique :
# ils passent du clavier à Secret Manager par un tube (printf | gcloud … --data-file=-).
# Le mot de passe en clair n'est jamais stocké : seule son empreinte PBKDF2-SHA256 l'est.
# ============================================================================

main() {
  set -Eeuo pipefail
  set +o history 2>/dev/null || true
  umask 077
  # gcloud ne pose JAMAIS de question (une question cachée par « >/dev/null 2>&1 » bloquait le script) :
  # sans réponse possible, il prend la réponse par défaut ou s'arrête avec un message visible.
  export CLOUDSDK_CORE_DISABLE_PROMPTS=1

  # --- Réglages (non secrets) ------------------------------------------------
  local PROJET_ATTENDU="${PROJET:-z-survival-website}"
  local REGION="europe-west3"
  local DEPOT_GITHUB="Nowyyy/Z-Survival-Website"
  local BRANCHE="main"
  local DEPOT_IMAGES="serveur"
  local SERVICE="z-survival-serveur"
  local SA_SERVEUR="serveur-site"
  local SA_DEPLOIEMENT="deploiement-github"
  local POOL="github"
  local FOURNISSEUR="github-oidc"
  # Noms des secrets dans Secret Manager (les mêmes que dans .github/workflows/serveur.yml).
  local S_URL="turso-url" S_JETON="turso-jeton" S_ID="admin-identifiant" S_EMPREINTE="admin-empreinte" S_CLE="cle-session"
  local IMAGE_ATTENTE="us-docker.pkg.dev/cloudrun/container/hello"

  local ETAPE="démarrage"
  trap 'echo; echo "✖ Arrêt pendant : ${ETAPE}. Rien de grave : corrigez si besoin, puis relancez la même ligne." >&2' ERR
  trap 'unset turso_url turso_jeton identifiant mdp1 mdp2 2>/dev/null || true' EXIT

  titre() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; ETAPE="$1"; }
  info() { printf '   %s\n' "$1"; }
  fait() { printf '   ✔ %s\n' "$1"; }
  # Question oui/non. $2 = réponse par défaut (o ou n).
  oui_non() {
    local reponse
    while true; do
      if [[ "$2" == "o" ]]; then printf '%s (O/n) ' "$1" >/dev/tty; else printf '%s (o/N) ' "$1" >/dev/tty; fi
      IFS= read -r reponse </dev/tty || reponse=""
      reponse="${reponse:-$2}"
      case "$reponse" in [oOyY]*) return 0 ;; [nN]*) return 1 ;; esac
    done
  }
  # Saisie masquée dans la variable nommée $1 (rien n'est affiché ni gardé ailleurs).
  lire_masque() {
    printf '%s' "$2" >/dev/tty
    IFS= read -r -s "$1" </dev/tty
    printf '\n' >/dev/tty
  }
  # Vrai si la ressource existe. Commande silencieuse, sans clavier, coupée au bout de 60 s.
  existe() {
    timeout 60 "$@" >/dev/null 2>&1 </dev/null
  }
  # Valeur lue sans bruit (vide si absente), sans clavier, coupée au bout de 60 s.
  lire() {
    timeout 60 "$@" 2>/dev/null </dev/null || true
  }
  # Attend qu'une API tout juste activée réponde (cela peut prendre une à deux minutes chez Google).
  attendre_api() {
    local nom="$1" n
    shift
    for n in $(seq 1 18); do
      if existe "$@"; then return 0; fi
      info "… ${nom} pas encore prête, nouvel essai dans 10 s ($n/18)"
      sleep 10
    done
    echo "✖ ${nom} ne répond toujours pas après 3 minutes. Attendez quelques minutes, puis relancez la même ligne." >&2
    exit 1
  }
  # Nouvel essai (les droits d'un compte tout juste créé mettent parfois quelques secondes à arriver).
  reessayer() {
    local n
    for n in 1 2 3 4 5 6; do
      if "$@"; then return 0; fi
      info "… nouvel essai dans 10 s ($n/6)"
      sleep 10
    done
    "$@"
  }

  # --- 1. Projet ---------------------------------------------------------------
  titre "1. Projet Google Cloud"
  local projet compte
  projet="$(lire gcloud config get-value project)"
  compte="$(lire gcloud config get-value account)"
  info "Compte connecté : ${compte:-aucun}"
  if [[ -z "$compte" ]]; then
    echo "✖ Aucun compte connecté. Dans Cloud Shell, cela ne devrait pas arriver : rechargez la page." >&2
    exit 1
  fi
  if [[ "$projet" != "$PROJET_ATTENDU" ]]; then
    info "Projet actuel : ${projet:-aucun}. Projet attendu : ${PROJET_ATTENDU}."
    if existe gcloud projects describe "$PROJET_ATTENDU" && oui_non "   Utiliser le projet ${PROJET_ATTENDU} ?" o; then
      gcloud config set project "$PROJET_ATTENDU" >/dev/null 2>&1
      projet="$PROJET_ATTENDU"
    else
      echo "✖ Projet ${PROJET_ATTENDU} introuvable ou refusé. Choisissez-le en haut de la console, puis relancez." >&2
      exit 1
    fi
  fi
  local NUMERO
  NUMERO="$(gcloud projects describe "$projet" --format='value(projectNumber)')"
  local EMAIL_SERVEUR="${SA_SERVEUR}@${projet}.iam.gserviceaccount.com"
  local EMAIL_DEPLOIEMENT="${SA_DEPLOIEMENT}@${projet}.iam.gserviceaccount.com"
  fait "Projet : ${projet} (numéro ${NUMERO})"

  # --- 2. API ------------------------------------------------------------------
  titre "2. Activation des API (une à deux minutes la première fois)"
  # Cloud Resource Manager : nécessaire pour donner un rôle au niveau du projet.
  # Pas de Cloud Build : l'image est construite par GitHub Actions.
  gcloud services enable \
    run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com \
    iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
    cloudresourcemanager.googleapis.com --quiet
  attendre_api "Artifact Registry" gcloud artifacts repositories list --location="$REGION" --limit=1
  attendre_api "Secret Manager" gcloud secrets list --limit=1
  attendre_api "Cloud Run" gcloud run services list --region="$REGION" --limit=1
  fait "API actives"

  # --- 3. Artifact Registry ---------------------------------------------------
  titre "3. Dépôt d'images Artifact Registry (${REGION})"
  if existe gcloud artifacts repositories describe "$DEPOT_IMAGES" --location="$REGION"; then
    fait "Dépôt « ${DEPOT_IMAGES} » déjà là"
  else
    gcloud artifacts repositories create "$DEPOT_IMAGES" --repository-format=docker --location="$REGION" \
      --description="Images du serveur du site Z-Survival" --quiet
    fait "Dépôt « ${DEPOT_IMAGES} » créé"
  fi
  local politique
  politique="$(mktemp)"
  cat >"$politique" <<'JSON'
[
  { "name": "garder-les-3-dernieres", "action": { "type": "Keep" }, "mostRecentVersions": { "keepCount": 3 } },
  { "name": "supprimer-les-autres", "action": { "type": "Delete" }, "condition": { "tagState": "any" } }
]
JSON
  gcloud artifacts repositories set-cleanup-policies "$DEPOT_IMAGES" --location="$REGION" --policy="$politique" --quiet >/dev/null
  rm -f "$politique"
  fait "Règle de nettoyage : seules les 3 dernières images sont gardées (nettoyage automatique, environ une fois par jour)"

  # --- 4. Comptes de service ---------------------------------------------------
  titre "4. Comptes de service"
  local sa
  for sa in "$SA_SERVEUR:Serveur du site Z-Survival (lecture de ses secrets)" "$SA_DEPLOIEMENT:Déploiement depuis GitHub Actions"; do
    if existe gcloud iam service-accounts describe "${sa%%:*}@${projet}.iam.gserviceaccount.com"; then
      fait "Compte « ${sa%%:*} » déjà là"
    else
      gcloud iam service-accounts create "${sa%%:*}" --display-name="${sa#*:}" --quiet
      fait "Compte « ${sa%%:*} » créé"
    fi
  done
  # Déploiement : déployer le service Cloud Run (sans pouvoir changer qui y a accès)…
  reessayer gcloud projects add-iam-policy-binding "$projet" --member="serviceAccount:${EMAIL_DEPLOIEMENT}" \
    --role="roles/run.developer" --condition=None --quiet >/dev/null
  # … envoyer des images dans CE dépôt seulement…
  reessayer gcloud artifacts repositories add-iam-policy-binding "$DEPOT_IMAGES" --location="$REGION" \
    --member="serviceAccount:${EMAIL_DEPLOIEMENT}" --role="roles/artifactregistry.writer" --quiet >/dev/null
  # … et faire tourner le service sous le compte du serveur (et aucun autre).
  reessayer gcloud iam service-accounts add-iam-policy-binding "$EMAIL_SERVEUR" \
    --member="serviceAccount:${EMAIL_DEPLOIEMENT}" --role="roles/iam.serviceAccountUser" --quiet >/dev/null
  fait "Droits du déploiement : Cloud Run (déployer), dépôt « ${DEPOT_IMAGES} » (écrire), compte du serveur (utiliser)"
  info "Le compte du serveur n'a aucun droit sur le projet : seulement la lecture de ses 5 secrets (étape 7)."

  # --- 5. Fédération d'identité GitHub → Google Cloud (sans clé) ---------------
  titre "5. Liaison GitHub ↔ Google Cloud sans clé"
  local etat
  etat="$(lire gcloud iam workload-identity-pools describe "$POOL" --location=global --format='value(state)')"
  if [[ -z "$etat" ]]; then
    gcloud iam workload-identity-pools create "$POOL" --location=global --display-name="GitHub Actions" --quiet
    fait "Groupe d'identités « ${POOL} » créé"
  elif [[ "$etat" == "DELETED" ]]; then
    gcloud iam workload-identity-pools undelete "$POOL" --location=global --quiet
    fait "Groupe d'identités « ${POOL} » restauré"
  else
    fait "Groupe d'identités « ${POOL} » déjà là"
  fi
  # Condition : seul ce dépôt, seule la branche main. On ajoute l'identifiant numérique du propriétaire du dépôt
  # quand GitHub le donne (un dépôt supprimé puis recréé sous le même nom par quelqu'un d'autre serait refusé).
  local condition="assertion.repository == '${DEPOT_GITHUB}' && assertion.ref == 'refs/heads/${BRANCHE}'"
  local proprietaire_id
  proprietaire_id="$(curl -fsS --max-time 15 "https://api.github.com/repos/${DEPOT_GITHUB}" 2>/dev/null \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["owner"]["id"])' 2>/dev/null || true)"
  if [[ "$proprietaire_id" =~ ^[0-9]+$ ]]; then
    condition="${condition} && assertion.repository_owner_id == '${proprietaire_id}'"
  else
    info "(Identifiant du propriétaire GitHub non lu : condition sur le nom du dépôt et la branche seulement.)"
  fi
  local correspondance="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref,attribute.repository_owner_id=assertion.repository_owner_id"
  etat="$(lire gcloud iam workload-identity-pools providers describe "$FOURNISSEUR" --location=global \
    --workload-identity-pool="$POOL" --format='value(state)')"
  if [[ "$etat" == "DELETED" ]]; then
    gcloud iam workload-identity-pools providers undelete "$FOURNISSEUR" --location=global --workload-identity-pool="$POOL" --quiet
    etat="ACTIVE"
  fi
  if [[ -z "$etat" ]]; then
    gcloud iam workload-identity-pools providers create-oidc "$FOURNISSEUR" --location=global --workload-identity-pool="$POOL" \
      --display-name="GitHub (Z-Survival-Website, main)" --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="$correspondance" --attribute-condition="$condition" --quiet
    fait "Fournisseur « ${FOURNISSEUR} » créé"
  else
    gcloud iam workload-identity-pools providers update-oidc "$FOURNISSEUR" --location=global --workload-identity-pool="$POOL" \
      --display-name="GitHub (Z-Survival-Website, main)" --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="$correspondance" --attribute-condition="$condition" --quiet >/dev/null
    fait "Fournisseur « ${FOURNISSEUR} » mis à jour"
  fi
  info "Condition : ${condition}"
  reessayer gcloud iam service-accounts add-iam-policy-binding "$EMAIL_DEPLOIEMENT" --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${NUMERO}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${DEPOT_GITHUB}" \
    --quiet >/dev/null
  fait "GitHub (${DEPOT_GITHUB}, branche ${BRANCHE}) peut utiliser le compte « ${SA_DEPLOIEMENT} », sans clé"

  # --- 6 et 7. Secrets ---------------------------------------------------------
  titre "6. Valeurs secrètes (saisie masquée : rien ne s'affiche quand vous tapez, c'est normal)"

  a_une_valeur() {
    [[ -n "$(lire gcloud secrets versions list "$1" --filter='state=ENABLED' --limit=1 --format='value(name)')" ]]
  }
  # Ajoute une version au secret $1 avec la valeur lue sur l'entrée standard, puis détruit les anciennes
  # (une seule version utile : moins de risque, et Secret Manager facture chaque version gardée).
  ranger() {
    local nom="$1" derniere v
    if ! existe gcloud secrets describe "$nom"; then
      gcloud secrets create "$nom" --replication-policy=user-managed --locations="$REGION" \
        --labels=application=z-survival-serveur --quiet >/dev/null
    fi
    gcloud secrets versions add "$nom" --data-file=- --quiet >/dev/null
    derniere="$(gcloud secrets versions list "$nom" --filter='state=ENABLED' --sort-by='~createTime' --limit=1 --format='value(name.basename())')"
    for v in $(gcloud secrets versions list "$nom" --filter='state=ENABLED OR state=DISABLED' --format='value(name.basename())'); do
      if [[ "$v" != "$derniere" ]]; then gcloud secrets versions destroy "$v" --secret="$nom" --quiet >/dev/null; fi
    done
    fait "Secret « ${nom} » rangé (version ${derniere})"
  }

  local change=0
  # 6a. Turso
  if a_une_valeur "$S_URL" && a_une_valeur "$S_JETON" && oui_non "   L'adresse et le jeton Turso sont déjà rangés. Les garder ?" o; then
    fait "Turso : valeurs actuelles gardées"
  else
    info "Turso → base « z-survival-site » → bouton « Connect » : adresse (libsql://…) et jeton (« Create token »)."
    local turso_url="" turso_jeton=""
    while true; do
      lire_masque turso_url "   Adresse de la base Turso (libsql://…) : "
      turso_url="$(printf '%s' "$turso_url" | tr -d '[:space:]')"
      if [[ "$turso_url" =~ ^(libsql|https)://[A-Za-z0-9.-]+(:[0-9]+)?/?$ ]]; then break; fi
      info "Adresse non reconnue : elle commence par libsql:// (ex. libsql://nom-de-la-base-compte.turso.io). Réessayez."
    done
    while true; do
      lire_masque turso_jeton "   Jeton Turso : "
      turso_jeton="$(printf '%s' "$turso_jeton" | tr -d '[:space:]')"
      if [[ ${#turso_jeton} -ge 20 ]]; then break; fi
      info "Jeton trop court (copiez-le en entier). Réessayez."
    done
    printf '%s' "$turso_url" | ranger "$S_URL"
    printf '%s' "$turso_jeton" | ranger "$S_JETON"
    unset turso_url turso_jeton
    change=1
  fi

  # 6b. Administrateur
  if a_une_valeur "$S_ID" && a_une_valeur "$S_EMPREINTE" && oui_non "   L'identifiant et le mot de passe admin sont déjà rangés. Les garder ?" o; then
    fait "Administrateur : valeurs actuelles gardées"
  else
    command -v python3 >/dev/null || { echo "✖ python3 introuvable (il est pourtant fourni par Cloud Shell)." >&2; exit 1; }
    local identifiant="" mdp1="" mdp2=""
    while true; do
      lire_masque identifiant "   Identifiant admin (celui que vous taperez pour vous connecter) : "
      identifiant="$(printf '%s' "$identifiant" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      if [[ -n "$identifiant" && ${#identifiant} -le 200 ]]; then break; fi
      info "Identifiant vide ou trop long (200 caractères au plus). Réessayez."
    done
    while true; do
      lire_masque mdp1 "   Mot de passe admin (12 caractères au moins) : "
      lire_masque mdp2 "   Le même, encore une fois : "
      if [[ "$mdp1" != "$mdp2" ]]; then info "Les deux saisies sont différentes. Réessayez."; continue; fi
      if [[ ${#mdp1} -lt 12 || ${#mdp1} -gt 256 ]]; then info "Entre 12 et 256 caractères. Réessayez."; continue; fi
      break
    done
    printf '%s' "$identifiant" | ranger "$S_ID"
    # Empreinte PBKDF2-SHA256, 600 000 itérations, sel aléatoire de 16 octets, calculée ici (dans Cloud Shell).
    # Le mot de passe passe par un tube vers python3, l'empreinte par un tube vers Secret Manager.
    printf '%s' "$mdp1" | python3 -c '
import base64, hashlib, os, sys
mdp = sys.stdin.buffer.read()
sel = os.urandom(16)
empreinte = hashlib.pbkdf2_hmac("sha256", mdp, sel, 600000, 32)
sys.stdout.write("pbkdf2$600000$" + base64.b64encode(sel).decode() + "$" + base64.b64encode(empreinte).decode())
' | ranger "$S_EMPREINTE"
    unset identifiant mdp1 mdp2
    change=1
  fi

  # 6c. Clé de session (signature des jetons de connexion) : générée ici, 32 octets aléatoires.
  if a_une_valeur "$S_CLE" && oui_non "   La clé de session existe déjà. La garder ? (une nouvelle clé déconnecte l'admin)" o; then
    fait "Clé de session : actuelle gardée"
  else
    head -c 32 /dev/urandom | base64 | tr -d '\n' | ranger "$S_CLE"
    change=1
  fi

  titre "7. Accès du serveur à ses secrets (et à rien d'autre)"
  local s
  for s in "$S_URL" "$S_JETON" "$S_ID" "$S_EMPREINTE" "$S_CLE"; do
    reessayer gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:${EMAIL_SERVEUR}" \
      --role="roles/secretmanager.secretAccessor" --quiet >/dev/null
  done
  fait "Le compte « ${SA_SERVEUR} » peut lire ses 5 secrets"

  # --- Service Cloud Run -------------------------------------------------------
  titre "Service Cloud Run « ${SERVICE} » (${REGION})"
  local image_actuelle
  image_actuelle="$(lire gcloud run services describe "$SERVICE" --region="$REGION" --format='value(spec.template.spec.containers[0].image)')"
  if [[ -z "$image_actuelle" ]]; then
    # Service d'attente (page « Hello » de Google), remplacé par le vrai serveur au premier déploiement GitHub.
    # Le créer ici permet de rendre le service public une fois pour toutes : le compte de déploiement n'a
    # ainsi pas besoin du droit de changer qui a accès au service.
    gcloud run deploy "$SERVICE" --image="$IMAGE_ATTENTE" --region="$REGION" --service-account="$EMAIL_SERVEUR" \
      --min-instances=0 --max-instances=2 --cpu-throttling --cpu=1 --memory=256Mi --execution-environment=gen1 \
      --allow-unauthenticated --quiet
    fait "Service d'attente créé (le vrai serveur arrivera avec le workflow GitHub « serveur »)"
  else
    fait "Service déjà là"
    if [[ "$change" == 1 && "$image_actuelle" != "$IMAGE_ATTENTE" ]]; then
      # Nouvelle révision : les instances relisent les secrets (version « latest »).
      gcloud run services update "$SERVICE" --region="$REGION" --update-env-vars="SECRETS_MAJ_LE=$(date -u +%Y%m%d%H%M%S)" --quiet >/dev/null
      fait "Nouvelle révision lancée pour prendre les nouveaux secrets"
    fi
  fi
  # Accès public (la sécurité est gérée par l'application : jeton pour l'administration).
  if ! gcloud run services add-iam-policy-binding "$SERVICE" --region="$REGION" --member="allUsers" --role="roles/run.invoker" --quiet >/dev/null 2>&1; then
    info "⚠ Impossible de rendre le service public (règle de l'organisation ?). Voir serveur/LISEZMOI.md, « Problèmes »."
  else
    fait "Service accessible publiquement"
  fi
  local adresse
  adresse="$(lire gcloud run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')"

  # --- 8. Variables à recopier dans GitHub ---------------------------------------
  titre "8. Terminé. À recopier dans GitHub (valeurs NON secrètes)"
  cat <<EOF

   GitHub → dépôt ${DEPOT_GITHUB} → Settings → Secrets and variables → Actions
   → onglet « Variables » → « New repository variable », quatre fois :

   Nom (Name)                        Valeur (Value)
   --------------------------------  ----------------------------------------------
   GCP_PROJECT_ID                    ${projet}
   GCP_WORKLOAD_IDENTITY_PROVIDER    projects/${NUMERO}/locations/global/workloadIdentityPools/${POOL}/providers/${FOURNISSEUR}
   GCP_SERVICE_ACCOUNT               ${EMAIL_DEPLOIEMENT}
   GCP_REGION                        ${REGION}

   Puis : onglet « Actions » → workflow « serveur » → « Run workflow » (branche main).
   Adresse du serveur : ${adresse:-(affichée dans Cloud Run une fois le service créé)}
   Vérification : ${adresse:-https://…run.app}/api/sante → « ok »: true et « base »: « connectée ».

EOF
  ETAPE="fin"
}

main "$@"
