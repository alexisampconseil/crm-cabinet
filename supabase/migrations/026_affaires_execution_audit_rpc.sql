-- =============================================================================
-- Migration 026 : Module Affaires — Exécution & traçabilité (journal + RPC)
-- Dépend de   : 021 (private), 022-024 (tables), 025 (RPC creer/modifier)
-- Idempotente : CREATE TABLE/INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--               DROP TRIGGER/POLICY IF EXISTS, REVOKE/GRANT.
-- =============================================================================
--
-- Périmètre : journal immuable affaire_evenements ; helpers privés (log,
--   chargement/verrou optimiste, validation de champ) ; complément des RPC 025
--   (événements creation / modification_infos) ; RPC d'exécution (champ, étape,
--   tâche, document, contrôle, dérogation). Verrou optimiste au niveau de
--   l'affaire (version_row). Aucune migration modifiée.
--
-- Convention version_row : chaque mutation lit la version sous FOR UPDATE
--   (helper), la compare à p_version_attendue (AFFAIRE_CONFLICT sinon), puis
--   pose version_row = p_version_attendue + 1 via une variable locale (jamais la
--   colonne non qualifiée) ; le trigger trg_aff_bump_version (024) recalcule la
--   même valeur → un seul incrément. Les colonnes version_row sont toujours
--   qualifiées (alias) pour éviter l'ambiguïté avec la sortie TABLE.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 26a. TABLE : affaire_evenements (journal append-only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affaire_evenements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affaire_id     UUID        NOT NULL,
  type_evenement TEXT        NOT NULL,
  motif          TEXT,
  details        JSONB       NOT NULL DEFAULT '{}',
  auteur_id      UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_ev_affaire FOREIGN KEY (affaire_id) REFERENCES public.affaires (id) ON DELETE RESTRICT,
  CONSTRAINT fk_ev_auteur  FOREIGN KEY (auteur_id)  REFERENCES auth.users (id)      ON DELETE SET NULL,
  CONSTRAINT chk_ev_type CHECK (type_evenement IN (
    'creation','modification_infos','champ_modifie','etape_modifiee','tache_modifiee',
    'document_modifie','controle_modifie','derogation','cloture','archivage',
    'reouverture','revenu_corrige'
  ))
);

CREATE INDEX IF NOT EXISTS idx_ev_affaire ON public.affaire_evenements (affaire_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ev_type    ON public.affaire_evenements (type_evenement);

-- Append-only : aucun UPDATE/DELETE (y compris propriétaire).
CREATE OR REPLACE FUNCTION private.fn_guard_evenement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  RAISE EXCEPTION 'affaire_evenements est append-only (aucun UPDATE/DELETE).' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION private.fn_guard_evenement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_ev_append_only ON public.affaire_evenements;
CREATE TRIGGER trg_ev_append_only
  BEFORE UPDATE OR DELETE ON public.affaire_evenements
  FOR EACH ROW EXECUTE FUNCTION private.fn_guard_evenement();

-- Privilèges : lecture conseiller ; aucune écriture directe ; service_role complet.
REVOKE ALL   ON TABLE public.affaire_evenements FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON TABLE public.affaire_evenements TO authenticated;
GRANT  ALL   ON TABLE public.affaire_evenements TO service_role;

ALTER TABLE public.affaire_evenements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "affaire_evenements_select_conseiller" ON public.affaire_evenements;
CREATE POLICY "affaire_evenements_select_conseiller" ON public.affaire_evenements
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'conseiller');


-- ─────────────────────────────────────────────────────────────────────────────
-- 26b. HELPERS INTERNES (private)
-- ─────────────────────────────────────────────────────────────────────────────

-- Écriture d'un événement (unique vecteur d'écriture du journal).
CREATE OR REPLACE FUNCTION private.fn_affaire_log(
  p_affaire_id UUID, p_type TEXT, p_details JSONB DEFAULT '{}', p_motif TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  INSERT INTO public.affaire_evenements (affaire_id, type_evenement, motif, details, auteur_id)
  VALUES (p_affaire_id, p_type, p_motif, COALESCE(p_details, '{}'::jsonb), auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION private.fn_affaire_log(UUID,TEXT,JSONB,TEXT) FROM PUBLIC, anon, authenticated;

-- Chargement pour mutation : exige conseiller, verrouille l'affaire, contrôle la
-- version. Retourne le statut courant. (AFFAIRE_CONFLICT si version différente.)
CREATE OR REPLACE FUNCTION private.fn_affaire_charger_pour_maj(
  p_affaire_id UUID, p_version_attendue BIGINT
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_version BIGINT;
BEGIN
  PERFORM private.fn_affaire_exige_conseiller();
  SELECT a.statut, a.version_row INTO v_statut, v_version
  FROM public.affaires AS a WHERE a.id = p_affaire_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Affaire introuvable: %', p_affaire_id USING ERRCODE = 'P0002';
  END IF;
  IF v_version <> p_version_attendue THEN
    RAISE EXCEPTION 'AFFAIRE_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_statut;
END;
$$;
REVOKE ALL ON FUNCTION private.fn_affaire_charger_pour_maj(UUID,BIGINT) FROM PUBLIC, anon, authenticated;

-- Validation du type JSON d'une valeur de champ dynamique.
CREATE OR REPLACE FUNCTION private.fn_affaire_valider_champ(p_type TEXT, p_valeur JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
BEGIN
  IF p_valeur IS NULL THEN RETURN; END IF;  -- nullable pendant le traitement
  IF p_type IN ('texte','enum') THEN
    IF jsonb_typeof(p_valeur) <> 'string' THEN
      RAISE EXCEPTION 'AFFAIRE_CHAMP_TYPE_INVALIDE (% attend une chaine)', p_type USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_type IN ('nombre','montant') THEN
    IF jsonb_typeof(p_valeur) <> 'number' THEN
      RAISE EXCEPTION 'AFFAIRE_CHAMP_TYPE_INVALIDE (% attend un nombre)', p_type USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_type = 'booleen' THEN
    IF jsonb_typeof(p_valeur) <> 'boolean' THEN
      RAISE EXCEPTION 'AFFAIRE_CHAMP_TYPE_INVALIDE (booleen attendu)' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_type = 'date' THEN
    IF jsonb_typeof(p_valeur) <> 'string' THEN
      RAISE EXCEPTION 'AFFAIRE_CHAMP_TYPE_INVALIDE (date attend une chaine)' USING ERRCODE = 'P0001';
    END IF;
    BEGIN
      PERFORM (p_valeur #>> '{}')::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'AFFAIRE_CHAMP_TYPE_INVALIDE (date invalide)' USING ERRCODE = 'P0001';
    END;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.fn_affaire_valider_champ(TEXT,JSONB) FROM PUBLIC, anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 26c. COMPLÉMENT DES RPC 025 (ajout des événements) — CREATE OR REPLACE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_affaire_creer(
  p_client_id UUID, p_famille_id UUID, p_type_id UUID, p_libelle TEXT,
  p_montant NUMERIC DEFAULT NULL, p_frais NUMERIC DEFAULT NULL,
  p_revenu_previsionnel NUMERIC DEFAULT NULL, p_produit_id UUID DEFAULT NULL,
  p_partenaire_id UUID DEFAULT NULL
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_famille_actif BOOLEAN; v_frise UUID; v_affaire UUID;
BEGIN
  PERFORM private.fn_affaire_exige_conseiller();

  IF coalesce(btrim(p_libelle), '') = '' THEN
    RAISE EXCEPTION 'Le libelle est obligatoire.' USING ERRCODE = 'P0001';
  END IF;
  IF (p_montant IS NOT NULL AND p_montant < 0)
     OR (p_frais IS NOT NULL AND p_frais < 0)
     OR (p_revenu_previsionnel IS NOT NULL AND p_revenu_previsionnel < 0) THEN
    RAISE EXCEPTION 'Les montants ne peuvent pas etre negatifs.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'Client introuvable: %', p_client_id USING ERRCODE = 'P0002';
  END IF;
  SELECT actif INTO v_famille_actif FROM public.affaire_familles WHERE id = p_famille_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Famille introuvable: %', p_famille_id USING ERRCODE = 'P0002'; END IF;
  IF v_famille_actif IS NOT TRUE THEN RAISE EXCEPTION 'Famille inactive: %', p_famille_id USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affaire_types WHERE id = p_type_id AND famille_id = p_famille_id AND actif = TRUE) THEN
    RAISE EXCEPTION 'Type introuvable, inactif, ou hors de la famille: %', p_type_id USING ERRCODE = 'P0001';
  END IF;
  IF p_produit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.produits WHERE id = p_produit_id) THEN
    RAISE EXCEPTION 'Produit introuvable: %', p_produit_id USING ERRCODE = 'P0002';
  END IF;
  IF p_partenaire_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.partenaires WHERE id = p_partenaire_id AND actif = TRUE) THEN
    RAISE EXCEPTION 'Partenaire introuvable ou inactif: %', p_partenaire_id USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_frise FROM public.frise_versions
  WHERE famille_id = p_famille_id AND actif = TRUE AND statut = 'publie' LIMIT 1;
  IF v_frise IS NULL THEN
    RAISE EXCEPTION 'AFFAIRE_FRISE_ACTIVE_INTROUVABLE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.affaires (
    client_id, famille_id, type_id, frise_version_id, produit_id, partenaire_id,
    libelle, montant, frais, revenu_previsionnel, statut, date_ouverture,
    version_row, created_by, updated_by
  ) VALUES (
    p_client_id, p_famille_id, p_type_id, v_frise, p_produit_id, p_partenaire_id,
    p_libelle, p_montant, p_frais, p_revenu_previsionnel, 'en_cours', now(),
    1, auth.uid(), auth.uid()
  ) RETURNING id INTO v_affaire;

  INSERT INTO public.affaire_etapes (affaire_id, etape_modele_id, code, libelle, description, instructions, ordre, delai_indicatif_jours, validation_manuelle, conditions_blocage)
  SELECT v_affaire, m.id, m.code, m.libelle, m.description, m.instructions, m.ordre, m.delai_indicatif_jours, m.validation_manuelle, m.conditions_blocage
  FROM public.frise_etapes_modele m WHERE m.frise_version_id = v_frise;

  INSERT INTO public.affaire_taches (affaire_id, etape_id, tache_modele_id, code, libelle, obligatoire, ordre)
  SELECT v_affaire, ae.id, tm.id, tm.code, tm.libelle, tm.obligatoire, tm.ordre
  FROM public.frise_taches_modele tm
  JOIN public.affaire_etapes ae ON ae.affaire_id = v_affaire AND ae.etape_modele_id = tm.etape_modele_id
  WHERE tm.frise_version_id = v_frise;

  INSERT INTO public.affaire_documents (affaire_id, etape_id, document_modele_id, code, libelle, type_document, obligatoire, ordre)
  SELECT v_affaire, ae.id, dm.id, dm.code, dm.libelle, dm.type_document, dm.obligatoire, dm.ordre
  FROM public.frise_documents_modele dm
  JOIN public.affaire_etapes ae ON ae.affaire_id = v_affaire AND ae.etape_modele_id = dm.etape_modele_id
  WHERE dm.frise_version_id = v_frise;

  INSERT INTO public.affaire_controles (affaire_id, etape_id, controle_modele_id, code, libelle, type_controle, obligatoire, ordre)
  SELECT v_affaire, ae.id, cm.id, cm.code, cm.libelle, cm.type_controle, cm.obligatoire, cm.ordre
  FROM public.frise_controles_modele cm
  JOIN public.affaire_etapes ae ON ae.affaire_id = v_affaire AND ae.etape_modele_id = cm.etape_modele_id
  WHERE cm.frise_version_id = v_frise;

  INSERT INTO public.affaire_champ_valeurs (affaire_id, champ_def_id, valeur)
  SELECT v_affaire, d.id, NULL::jsonb
  FROM public.affaire_champ_defs d
  WHERE d.frise_version_id = v_frise
    AND (d.portee = 'famille' OR (d.portee = 'type' AND d.type_id = p_type_id));

  PERFORM private.fn_affaire_log(v_affaire, 'creation',
    jsonb_build_object('libelle', p_libelle, 'famille_id', p_famille_id,
                       'type_id', p_type_id, 'client_id', p_client_id, 'frise_version_id', v_frise));

  RETURN QUERY SELECT v_affaire, 1::bigint;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_creer(UUID,UUID,UUID,TEXT,NUMERIC,NUMERIC,NUMERIC,UUID,UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_creer(UUID,UUID,UUID,TEXT,NUMERIC,NUMERIC,NUMERIC,UUID,UUID) TO authenticated, service_role;


CREATE OR REPLACE FUNCTION public.fn_affaire_modifier_infos(
  p_affaire_id UUID, p_version_attendue BIGINT, p_libelle TEXT,
  p_montant NUMERIC DEFAULT NULL, p_frais NUMERIC DEFAULT NULL,
  p_revenu_previsionnel NUMERIC DEFAULT NULL, p_produit_id UUID DEFAULT NULL,
  p_partenaire_id UUID DEFAULT NULL
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_new_ver BIGINT;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut <> 'en_cours' THEN
    RAISE EXCEPTION 'Affaire non modifiable (statut: %).', v_statut USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(btrim(p_libelle), '') = '' THEN
    RAISE EXCEPTION 'Le libelle est obligatoire.' USING ERRCODE = 'P0001';
  END IF;
  IF (p_montant IS NOT NULL AND p_montant < 0)
     OR (p_frais IS NOT NULL AND p_frais < 0)
     OR (p_revenu_previsionnel IS NOT NULL AND p_revenu_previsionnel < 0) THEN
    RAISE EXCEPTION 'Les montants ne peuvent pas etre negatifs.' USING ERRCODE = 'P0001';
  END IF;
  IF p_produit_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.produits WHERE id = p_produit_id) THEN
    RAISE EXCEPTION 'Produit introuvable: %', p_produit_id USING ERRCODE = 'P0002';
  END IF;
  IF p_partenaire_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.partenaires WHERE id = p_partenaire_id AND actif = TRUE) THEN
    RAISE EXCEPTION 'Partenaire introuvable ou inactif: %', p_partenaire_id USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.affaires AS a SET
    libelle = p_libelle, montant = p_montant, frais = p_frais,
    revenu_previsionnel = p_revenu_previsionnel, produit_id = p_produit_id,
    partenaire_id = p_partenaire_id, updated_by = auth.uid(),
    version_row = p_version_attendue + 1
  WHERE a.id = p_affaire_id
  RETURNING a.version_row INTO v_new_ver;

  PERFORM private.fn_affaire_log(p_affaire_id, 'modification_infos', jsonb_build_object('libelle', p_libelle));
  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_modifier_infos(UUID,BIGINT,TEXT,NUMERIC,NUMERIC,NUMERIC,UUID,UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_modifier_infos(UUID,BIGINT,TEXT,NUMERIC,NUMERIC,NUMERIC,UUID,UUID) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 26d. RPC D'EXÉCUTION
-- ─────────────────────────────────────────────────────────────────────────────

-- Valeur de champ dynamique
CREATE OR REPLACE FUNCTION public.fn_affaire_champ_modifier(
  p_affaire_id UUID, p_version_attendue BIGINT, p_champ_def_id UUID, p_valeur JSONB DEFAULT NULL
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_type TEXT; v_new_ver BIGINT;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut <> 'en_cours' THEN RAISE EXCEPTION 'Affaire non modifiable (statut: %).', v_statut USING ERRCODE='P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affaire_champ_valeurs WHERE affaire_id = p_affaire_id AND champ_def_id = p_champ_def_id) THEN
    RAISE EXCEPTION 'Champ non applicable a cette affaire.' USING ERRCODE = 'P0002';
  END IF;
  SELECT d.type_donnee INTO v_type FROM public.affaire_champ_defs d WHERE d.id = p_champ_def_id;
  PERFORM private.fn_affaire_valider_champ(v_type, p_valeur);

  UPDATE public.affaire_champ_valeurs SET valeur = p_valeur
    WHERE affaire_id = p_affaire_id AND champ_def_id = p_champ_def_id;
  UPDATE public.affaires AS a SET updated_by = auth.uid(), version_row = p_version_attendue + 1
    WHERE a.id = p_affaire_id RETURNING a.version_row INTO v_new_ver;
  PERFORM private.fn_affaire_log(p_affaire_id, 'champ_modifie', jsonb_build_object('champ_def_id', p_champ_def_id));
  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_champ_modifier(UUID,BIGINT,UUID,JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_champ_modifier(UUID,BIGINT,UUID,JSONB) TO authenticated, service_role;

-- Statut d'étape
CREATE OR REPLACE FUNCTION public.fn_affaire_etape_statut(
  p_affaire_id UUID, p_version_attendue BIGINT, p_etape_id UUID, p_statut TEXT
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_new_ver BIGINT;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut <> 'en_cours' THEN RAISE EXCEPTION 'Affaire non modifiable (statut: %).', v_statut USING ERRCODE='P0001'; END IF;
  IF p_statut NOT IN ('a_faire','en_cours','terminee','ignoree') THEN
    RAISE EXCEPTION 'Statut d''etape invalide: %', p_statut USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affaire_etapes WHERE id = p_etape_id AND affaire_id = p_affaire_id) THEN
    RAISE EXCEPTION 'Etape non rattachee a cette affaire.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.affaire_etapes SET statut = p_statut,
    date_debut = CASE WHEN p_statut = 'en_cours' AND date_debut IS NULL THEN now() ELSE date_debut END,
    date_fin   = CASE WHEN p_statut = 'terminee' THEN now() ELSE date_fin END
    WHERE id = p_etape_id;
  UPDATE public.affaires AS a SET updated_by = auth.uid(), version_row = p_version_attendue + 1
    WHERE a.id = p_affaire_id RETURNING a.version_row INTO v_new_ver;
  PERFORM private.fn_affaire_log(p_affaire_id, 'etape_modifiee', jsonb_build_object('etape_id', p_etape_id, 'statut', p_statut));
  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_etape_statut(UUID,BIGINT,UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_etape_statut(UUID,BIGINT,UUID,TEXT) TO authenticated, service_role;

-- Statut de tâche
CREATE OR REPLACE FUNCTION public.fn_affaire_tache_statut(
  p_affaire_id UUID, p_version_attendue BIGINT, p_tache_id UUID, p_statut TEXT
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_new_ver BIGINT;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut <> 'en_cours' THEN RAISE EXCEPTION 'Affaire non modifiable (statut: %).', v_statut USING ERRCODE='P0001'; END IF;
  IF p_statut NOT IN ('a_faire','en_cours','terminee','ignoree') THEN
    RAISE EXCEPTION 'Statut de tache invalide: %', p_statut USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affaire_taches WHERE id = p_tache_id AND affaire_id = p_affaire_id) THEN
    RAISE EXCEPTION 'Tache non rattachee a cette affaire.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.affaire_taches SET statut = p_statut,
    date_debut = CASE WHEN p_statut = 'en_cours' AND date_debut IS NULL THEN now() ELSE date_debut END,
    date_fin   = CASE WHEN p_statut = 'terminee' THEN now() ELSE date_fin END
    WHERE id = p_tache_id;
  UPDATE public.affaires AS a SET updated_by = auth.uid(), version_row = p_version_attendue + 1
    WHERE a.id = p_affaire_id RETURNING a.version_row INTO v_new_ver;
  PERFORM private.fn_affaire_log(p_affaire_id, 'tache_modifiee', jsonb_build_object('tache_id', p_tache_id, 'statut', p_statut));
  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_tache_statut(UUID,BIGINT,UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_tache_statut(UUID,BIGINT,UUID,TEXT) TO authenticated, service_role;

-- Statut de document
CREATE OR REPLACE FUNCTION public.fn_affaire_document_statut(
  p_affaire_id UUID, p_version_attendue BIGINT, p_document_id UUID, p_statut TEXT
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_new_ver BIGINT;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut <> 'en_cours' THEN RAISE EXCEPTION 'Affaire non modifiable (statut: %).', v_statut USING ERRCODE='P0001'; END IF;
  IF p_statut NOT IN ('attendu','depose','valide','refuse','non_requis') THEN
    RAISE EXCEPTION 'Statut de document invalide: %', p_statut USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affaire_documents WHERE id = p_document_id AND affaire_id = p_affaire_id) THEN
    RAISE EXCEPTION 'Document non rattache a cette affaire.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.affaire_documents SET statut = p_statut,
    date_depot    = CASE WHEN p_statut = 'depose' AND date_depot IS NULL THEN now() ELSE date_depot END,
    date_decision = CASE WHEN p_statut IN ('valide','refuse') THEN now() ELSE date_decision END
    WHERE id = p_document_id;
  UPDATE public.affaires AS a SET updated_by = auth.uid(), version_row = p_version_attendue + 1
    WHERE a.id = p_affaire_id RETURNING a.version_row INTO v_new_ver;
  PERFORM private.fn_affaire_log(p_affaire_id, 'document_modifie', jsonb_build_object('document_id', p_document_id, 'statut', p_statut));
  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_document_statut(UUID,BIGINT,UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_document_statut(UUID,BIGINT,UUID,TEXT) TO authenticated, service_role;

-- Statut de contrôle
CREATE OR REPLACE FUNCTION public.fn_affaire_controle_statut(
  p_affaire_id UUID, p_version_attendue BIGINT, p_controle_id UUID, p_statut TEXT
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_new_ver BIGINT;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut <> 'en_cours' THEN RAISE EXCEPTION 'Affaire non modifiable (statut: %).', v_statut USING ERRCODE='P0001'; END IF;
  IF p_statut NOT IN ('a_controler','conforme','non_conforme','deroge') THEN
    RAISE EXCEPTION 'Statut de controle invalide: %', p_statut USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affaire_controles WHERE id = p_controle_id AND affaire_id = p_affaire_id) THEN
    RAISE EXCEPTION 'Controle non rattache a cette affaire.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.affaire_controles SET statut = p_statut,
    date_controle = CASE WHEN p_statut <> 'a_controler' THEN now() ELSE date_controle END
    WHERE id = p_controle_id;
  UPDATE public.affaires AS a SET updated_by = auth.uid(), version_row = p_version_attendue + 1
    WHERE a.id = p_affaire_id RETURNING a.version_row INTO v_new_ver;
  PERFORM private.fn_affaire_log(p_affaire_id, 'controle_modifie', jsonb_build_object('controle_id', p_controle_id, 'statut', p_statut));
  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_controle_statut(UUID,BIGINT,UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_controle_statut(UUID,BIGINT,UUID,TEXT) TO authenticated, service_role;

-- Dérogation à un blocage
CREATE OR REPLACE FUNCTION public.fn_affaire_deroger_blocage(
  p_affaire_id UUID, p_version_attendue BIGINT, p_blocage_id UUID, p_motif TEXT
)
RETURNS TABLE (affaire_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_new_ver BIGINT;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut <> 'en_cours' THEN RAISE EXCEPTION 'Affaire non modifiable (statut: %).', v_statut USING ERRCODE='P0001'; END IF;
  IF coalesce(btrim(p_motif), '') = '' THEN
    RAISE EXCEPTION 'Un motif de derogation est obligatoire.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.affaire_blocages WHERE id = p_blocage_id AND affaire_id = p_affaire_id AND deroge = FALSE) THEN
    RAISE EXCEPTION 'Blocage introuvable, hors affaire, ou deja deroge.' USING ERRCODE = 'P0002';
  END IF;
  UPDATE public.affaire_blocages SET
    deroge = TRUE, motif_derogation = p_motif, deroge_par = auth.uid(), deroge_at = now()
    WHERE id = p_blocage_id;
  UPDATE public.affaires AS a SET updated_by = auth.uid(), version_row = p_version_attendue + 1
    WHERE a.id = p_affaire_id RETURNING a.version_row INTO v_new_ver;
  PERFORM private.fn_affaire_log(p_affaire_id, 'derogation', jsonb_build_object('blocage_id', p_blocage_id), p_motif);
  RETURN QUERY SELECT p_affaire_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_deroger_blocage(UUID,BIGINT,UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_deroger_blocage(UUID,BIGINT,UUID,TEXT) TO authenticated, service_role;


-- =============================================================================
-- PLAN DE ROLLBACK (manuel — non exécuté ici)
-- =============================================================================
--   DROP FUNCTION IF EXISTS public.fn_affaire_deroger_blocage(UUID,BIGINT,UUID,TEXT);
--   DROP FUNCTION IF EXISTS public.fn_affaire_controle_statut(UUID,BIGINT,UUID,TEXT);
--   DROP FUNCTION IF EXISTS public.fn_affaire_document_statut(UUID,BIGINT,UUID,TEXT);
--   DROP FUNCTION IF EXISTS public.fn_affaire_tache_statut(UUID,BIGINT,UUID,TEXT);
--   DROP FUNCTION IF EXISTS public.fn_affaire_etape_statut(UUID,BIGINT,UUID,TEXT);
--   DROP FUNCTION IF EXISTS public.fn_affaire_champ_modifier(UUID,BIGINT,UUID,JSONB);
--   -- (fn_affaire_creer / fn_affaire_modifier_infos : redéfinies par 025 en cas de rollback)
--   DROP FUNCTION IF EXISTS private.fn_affaire_valider_champ(TEXT,JSONB);
--   DROP FUNCTION IF EXISTS private.fn_affaire_charger_pour_maj(UUID,BIGINT);
--   DROP FUNCTION IF EXISTS private.fn_affaire_log(UUID,TEXT,JSONB,TEXT);
--   DROP TABLE IF EXISTS public.affaire_evenements CASCADE;
--   DROP FUNCTION IF EXISTS private.fn_guard_evenement();
--
-- FICHIERS MODIFIÉS : + supabase/migrations/026_affaires_execution_audit_rpc.sql
-- =============================================================================
