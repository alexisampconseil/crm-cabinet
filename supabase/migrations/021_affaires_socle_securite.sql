-- =============================================================================
-- Migration 021 : Module Affaires — Socle de sécurité
-- Dépend de   : 001_initial_schema.sql (user_roles, auth.users, auth.uid())
-- Idempotente : CREATE SCHEMA IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
--               DROP CONSTRAINT/TRIGGER IF EXISTS avant (re)création,
--               CREATE OR REPLACE FUNCTION, REVOKE/GRANT rejouables.
-- =============================================================================
--
-- Rôle de cette migration :
--   Poser UNIQUEMENT le socle de sécurité du futur module « Affaires », avant
--   toute table métier (familles, types, frises, affaires…). Elle prépare :
--     1. le schéma interne `private` (emplacement sécurisé des futures fonctions
--        internes et fonctions de triggers — non exposé aux rôles applicatifs) ;
--     2. la permission `user_roles.peut_parametrer_affaires` ;
--     3. les garanties empêchant un client de posséder cette permission ;
--     4. la protection empêchant tout rôle applicatif de la modifier ;
--     5. le helper `public.peut_parametrer_affaires()` pour les futures policies
--        RLS et RPC du module.
--
--   Cette migration NE crée AUCUNE table métier du module Affaires et AUCUNE
--   fonction interne du module autre que le garde strictement nécessaire à la
--   permission. Elle ne modifie pas la configuration PostgREST.
--
-- ── Contexte de sécurité (audit préalable) ──────────────────────────────────
--   Supabase accorde par défaut GRANT ALL (dont UPDATE) aux rôles `anon`,
--   `authenticated` et `service_role` sur toutes les tables du schéma `public`
--   (cf. note migration 013 §"rôle anon"). `authenticated` dispose donc d'un
--   droit d'UPDATE de NIVEAU TABLE sur `user_roles`. En conséquence, un simple
--   `REVOKE UPDATE (peut_parametrer_affaires)` serait INOPÉRANT : le privilège
--   de table prime sur toute révocation de colonne.
--
--   Le verrou réel est donc un TRIGGER de garde, volontairement défini en
--   SECURITY INVOKER (et non DEFINER) : dans une fonction INVOKER, `current_user`
--   reflète le rôle applicatif réel positionné par PostgREST (`authenticated`,
--   `anon`, ou `service_role`). Une fonction SECURITY DEFINER renverrait au
--   contraire le propriétaire, rendant la distinction impossible. Le garde
--   bloque toute écriture de la colonne par `authenticated`/`anon`, quel que
--   soit le privilège de table, sans retirer les droits existants (la gestion
--   des rôles par `conseiller_all_roles` reste intacte).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 21a. SCHÉMA INTERNE `private`
-- Emplacement des futures fonctions internes du module (fn_log_evenement,
-- fn_affaire_recalculer_cache, helpers de validation/calcul/instanciation) et
-- des fonctions de triggers. Aucun objet métier n'y est créé ici, hormis le
-- garde de la permission (§21c).
--
-- Non exposé aux rôles applicatifs :
--   - USAGE révoqué à PUBLIC (donc à anon/authenticated qui n'héritent que via
--     PUBLIC pour un schéma nouvellement créé) ;
--   - REVOKE explicite pour anon/authenticated (défense en profondeur, no-op si
--     rien n'était accordé) ;
--   - default privileges verrouillés pour que les FUTURES fonctions n'accordent
--     pas EXECUTE à PUBLIC.
-- La configuration PostgREST (db-schemas) n'est PAS modifiée : `private` reste
-- hors des schémas exposés, et l'absence d'USAGE le rend de toute façon
-- inatteignable par les rôles applicatifs.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL    ON SCHEMA private FROM PUBLIC;
REVOKE USAGE  ON SCHEMA private FROM anon, authenticated;

-- Verrou des privilèges par défaut sur les futures fonctions de `private` :
-- par défaut PostgreSQL accorde EXECUTE à PUBLIC sur toute nouvelle fonction.
-- On l'empêche pour ce schéma. (L'absence d'USAGE schéma suffirait à bloquer
-- l'accès applicatif ; ceci est une seconde barrière.)
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMENT ON SCHEMA private IS
  'Schéma interne (module Affaires et transverse). Non exposé à PostgREST ni aux rôles applicatifs. Contient les fonctions internes et de triggers, appelées uniquement par des fonctions propriétaires ou des RPC métier.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 21b. PERMISSION : user_roles.peut_parametrer_affaires
-- Booléen, NOT NULL, FALSE par défaut. Les lignes existantes (dont les clients)
-- reçoivent FALSE — cohérent avec la contrainte 21b-bis.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS peut_parametrer_affaires BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.user_roles.peut_parametrer_affaires IS
  'Permission de paramétrage du module Affaires (familles, types, frises…). '
  'Toujours FALSE pour un rôle client (CHECK). Modifiable uniquement par '
  'service_role / un processus administratif contrôlé (trigger de garde). '
  'Jamais attribuable par un utilisateur authentifié, y compris à lui-même.';

-- 21b-bis. Un rôle client ne peut jamais posséder la permission.
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS chk_ur_permission_client_false;
ALTER TABLE public.user_roles
  ADD  CONSTRAINT chk_ur_permission_client_false
  CHECK (role <> 'client' OR peut_parametrer_affaires = FALSE);


-- ─────────────────────────────────────────────────────────────────────────────
-- 21c. GARDE : blocage des écritures de la permission par les rôles applicatifs
--
-- SECURITY INVOKER (défaut) — NÉCESSAIRE : seul le mode INVOKER laisse
-- `current_user` refléter le rôle applicatif réel (`authenticated`/`anon`/
-- `service_role`). En SECURITY DEFINER, `current_user` vaudrait le propriétaire
-- de la fonction et la distinction serait perdue.
--
-- Comportement :
--   - Rôles applicatifs (`authenticated`, `anon`) : toute tentative de POSER
--     (INSERT à TRUE) ou de MODIFIER (UPDATE) la colonne est rejetée.
--   - service_role, postgres, propriétaire, ou toute future RPC SECURITY DEFINER
--     appartenant à un rôle privilégié : autorisés (chemin administratif).
--   - Un INSERT/UPDATE ne touchant pas la valeur (IS NOT DISTINCT) n'est jamais
--     bloqué (ex. seed conseiller mettant à jour role/client_id).
--
-- search_path vidé : la fonction ne référence aucun objet applicatif
-- (uniquement current_user / TG_OP / NEW / OLD) — aucune résolution dépendante
-- du search_path de l'appelant.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.fn_guard_peut_parametrer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Seuls les rôles applicatifs PostgREST sont bridés. Les rôles privilégiés
  -- (service_role, propriétaire de migration, admin) passent librement.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' AND NEW.peut_parametrer_affaires IS DISTINCT FROM FALSE THEN
      RAISE EXCEPTION
        'user_roles.peut_parametrer_affaires : attribution interdite aux rôles applicatifs — réservé à service_role / processus administratif.'
        USING ERRCODE = '42501'; -- insufficient_privilege
    ELSIF TG_OP = 'UPDATE'
      AND NEW.peut_parametrer_affaires IS DISTINCT FROM OLD.peut_parametrer_affaires THEN
      RAISE EXCEPTION
        'user_roles.peut_parametrer_affaires : modification interdite aux rôles applicatifs (y compris pour soi-même) — réservé à service_role / processus administratif.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- La fonction ne doit être invocable par aucun rôle applicatif (elle n'est
-- déclenchée que par le trigger, indépendamment de tout privilège EXECUTE).
REVOKE ALL ON FUNCTION private.fn_guard_peut_parametrer() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_peut_parametrer ON public.user_roles;
CREATE TRIGGER trg_guard_peut_parametrer
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION private.fn_guard_peut_parametrer();


-- ─────────────────────────────────────────────────────────────────────────────
-- 21d. HELPER : public.peut_parametrer_affaires()
-- Destiné aux futures policies RLS et RPC du module Affaires.
--
-- - Dérive l'utilisateur exclusivement de auth.uid() — aucun paramètre user_id.
-- - Retourne FALSE si aucun utilisateur (auth.uid() NULL), utilisateur inconnu,
--   ou non-conseiller ; TRUE seulement pour un conseiller portant la permission.
-- - SECURITY DEFINER : lit user_roles en contournant le RLS de façon fiable
--   (même intention que get_user_role() en migration 001), sans jamais écrire.
-- - STABLE, sans effet de bord, aucune écriture.
-- - search_path vidé + objets pleinement qualifiés (public.user_roles,
--   auth.uid()) : aucune résolution dépendante du search_path de l'appelant.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.peut_parametrer_affaires()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'conseiller'
      AND peut_parametrer_affaires = TRUE
  );
$$;

COMMENT ON FUNCTION public.peut_parametrer_affaires() IS
  'TRUE ssi l''utilisateur courant (auth.uid()) est un conseiller possédant la '
  'permission peut_parametrer_affaires. FALSE sinon (anonyme, inconnu, client, '
  'ou conseiller sans permission). À utiliser dans les policies RLS et RPC de '
  'paramétrage du module Affaires.';

-- Privilèges minimaux : révoquer l'EXECUTE par défaut (PUBLIC + anon accordé par
-- les default privileges Supabase), n'accorder qu'à authenticated. service_role
-- contourne le RLS et n'en a pas besoin en lecture, mais l'accès lui reste
-- ouvert par ses privilèges généraux.
REVOKE ALL     ON FUNCTION public.peut_parametrer_affaires() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.peut_parametrer_affaires() TO authenticated;


-- =============================================================================
-- PLAN DE ROLLBACK  (à exécuter manuellement, dans cet ordre — non exécuté ici)
-- =============================================================================
--   DROP TRIGGER   IF EXISTS trg_guard_peut_parametrer ON public.user_roles;
--   DROP FUNCTION  IF EXISTS private.fn_guard_peut_parametrer();
--   DROP FUNCTION  IF EXISTS public.peut_parametrer_affaires();
--   ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS chk_ur_permission_client_false;
--   ALTER TABLE public.user_roles DROP COLUMN IF EXISTS peut_parametrer_affaires;
--   -- Ne DROP le schéma `private` que s'il n'a pas encore reçu d'objets d'autres
--   -- migrations (022+). Sinon, ne pas le supprimer.
--   DROP SCHEMA   IF EXISTS private RESTRICT;
--
-- Impact du rollback :
--   Aucune donnée métier n'est perdue (aucune table métier créée). La colonne
--   de permission et son garde disparaissent ; les rôles existants restent
--   intacts. Rollback strictement additif inverse.
--
-- =============================================================================
-- FICHIERS MODIFIÉS
-- =============================================================================
-- + supabase/migrations/021_affaires_socle_securite.sql  (ce fichier — nouveau)
--
-- Aucun fichier applicatif (lib/, app/, components/) n'est modifié par cette
-- migration. Aucune table métier du module Affaires n'est créée à ce stade.
-- =============================================================================
