-- ============================================================
-- SEED : Conseiller AMP CONSEIL
-- ============================================================
-- 1. Ouvrez le Dashboard Supabase → Authentication → Users
-- 2. Copiez l'UUID de votre utilisateur (colonne "UID")
-- 3. Remplacez 'VOTRE-UUID-ICI' par cet UUID
-- 4. Exécutez dans : Database → SQL Editor → New query
-- ============================================================

-- Vérification préalable (optionnel, pour confirmer l'UUID)
-- SELECT id, email, created_at FROM auth.users;

-- Insertion du rôle conseiller
-- client_id = NULL car le conseiller n'est pas lui-même un client du cabinet
INSERT INTO public.user_roles (user_id, role, client_id)
VALUES (
  '564bedff-1df7-4ab6-a800-77069cc05ab6'::uuid,
  'conseiller',
  NULL
)
ON CONFLICT (user_id) DO UPDATE
  SET role = 'conseiller',
      client_id = NULL;

-- Vérification après insertion
SELECT
  ur.id,
  ur.user_id,
  ur.role,
  ur.client_id,
  au.email,
  ur.created_at
FROM public.user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE ur.user_id = '564bedff-1df7-4ab6-a800-77069cc05ab6'::uuid;
