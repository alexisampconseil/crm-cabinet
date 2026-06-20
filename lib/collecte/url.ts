// =============================================================================
// Construction centralisée de l'URL publique du portail collecte.
// Toute route qui doit produire un lien /collecte/{token} — pour le CRM
// (copier/ouvrir) ou pour un envoi externe (email) — doit passer par ce module.
// =============================================================================

const HOTES_LOCAUX = ['localhost', '127.0.0.1', '0.0.0.0', '::1']

interface AppBaseUrl {
  url:         string | null  // URL de base normalisée (sans slash final), null si absente/invalide
  isLocalhost: boolean
}

// Lit NEXT_PUBLIC_APP_URL en priorité, puis APP_URL. Valide qu'il s'agit
// d'une URL absolue http(s) — toute autre valeur est considérée comme absente.
function getAppBaseUrl(): AppBaseUrl {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || ''
  if (!raw) return { url: null, isLocalhost: false }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { url: null, isLocalhost: false }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { url: null, isLocalhost: false }
  }

  return {
    url:         raw.replace(/\/+$/, ''),
    isLocalhost: HOTES_LOCAUX.includes(parsed.hostname),
  }
}

export interface BuildCollecteUrlOptions {
  // Usage interne CRM (copier/ouvrir) : tolère localhost en développement.
  // Usage externe (email) : doit rester false — un lien localhost est inutilisable par le destinataire.
  allowLocalhost?: boolean
  // Si aucune base n'est configurée, retourne une URL relative (/collecte/{token})
  // plutôt qu'une erreur — utile uniquement pour un usage interne CRM same-origin.
  fallbackRelative?: boolean
}

export interface BuildCollecteUrlResult {
  url:      string        // toujours une chaîne — vide uniquement si error est renseigné
  absolute: boolean
  warning:  string | null // configuration incomplète mais lien tout de même produit (usage interne)
  error:    string | null // aucun lien exploitable n'a pu être produit (usage externe)
}

export function buildCollecteUrl(
  token: string,
  options: BuildCollecteUrlOptions = {}
): BuildCollecteUrlResult {
  const { allowLocalhost = false, fallbackRelative = false } = options
  const base = getAppBaseUrl()
  const path = `/collecte/${token}`

  if (!base.url) {
    if (fallbackRelative) {
      return {
        url:      path,
        absolute: false,
        warning:  "NEXT_PUBLIC_APP_URL (ou APP_URL) non configurée — ce lien fonctionne uniquement depuis le CRM, pas par email ni partage externe.",
        error:    null,
      }
    }
    return { url: '', absolute: false, warning: null, error: "URL publique de l'application non configurée" }
  }

  if (base.isLocalhost && !allowLocalhost) {
    return { url: '', absolute: false, warning: null, error: "URL publique de l'application non configurée" }
  }

  const warning = base.isLocalhost
    ? "NEXT_PUBLIC_APP_URL pointe vers localhost — ce lien ne fonctionnera pas hors de cette machine (email, partage externe)."
    : null

  return { url: `${base.url}${path}`, absolute: true, warning, error: null }
}
