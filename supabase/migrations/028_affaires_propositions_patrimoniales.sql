-- =============================================================================
-- Migration 028 : Module Affaires — Propositions patrimoniales
-- Dépend de   : 001 (tables patrimoniales, clients), 021 (private), 024
--               (affaires), 026 (helpers charger/log, affaire_evenements)
-- Idempotente : CREATE TABLE/INDEX IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
--               DROP CONSTRAINT/TRIGGER/POLICY IF EXISTS, REVOKE/GRANT.
-- =============================================================================
--
-- Application par LISTE BLANCHE explicite des colonnes réelles des 4 tables
-- patrimoniales (aucun SQL dynamique) ; création = INSERT ciblé, mise à jour =
-- UPDATE ciblé conservant l'identifiant ; jamais de DELETE+INSERT.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 28a. Extension additive du journal (types d'événements propositions)
-- (ALTER dans une nouvelle migration ; la migration 026 n'est pas modifiée)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.affaire_evenements DROP CONSTRAINT IF EXISTS chk_ev_type;
ALTER TABLE public.affaire_evenements ADD CONSTRAINT chk_ev_type CHECK (type_evenement IN (
  'creation','modification_infos','champ_modifie','etape_modifiee','tache_modifiee',
  'document_modifie','controle_modifie','derogation','cloture','archivage',
  'reouverture','revenu_corrige',
  'proposition_creee','proposition_appliquee','proposition_rejetee','proposition_annulee'
));


-- ─────────────────────────────────────────────────────────────────────────────
-- 28b. TABLE : affaire_propositions_patrimoniales
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affaire_propositions_patrimoniales (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  affaire_id        UUID        NOT NULL,
  client_id         UUID        NOT NULL,
  operation         TEXT        NOT NULL,
  cible_type        TEXT        NOT NULL,
  donnees_proposees JSONB       NOT NULL DEFAULT '{}',
  statut            TEXT        NOT NULL DEFAULT 'en_attente',

  actif_financier_id      UUID,
  patrimoine_immobilier_id UUID,
  passif_id               UUID,
  contrat_prevoyance_id   UUID,

  cree_actif_financier_id      UUID,
  cree_patrimoine_immobilier_id UUID,
  cree_passif_id               UUID,
  cree_contrat_prevoyance_id   UUID,

  created_by     UUID,
  decided_by     UUID,
  decided_at     TIMESTAMPTZ,
  motif_decision TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Même client que l'affaire (FK composite).
  CONSTRAINT fk_pp_affaire  FOREIGN KEY (affaire_id, client_id)
    REFERENCES public.affaires (id, client_id) ON DELETE RESTRICT,
  CONSTRAINT fk_pp_client   FOREIGN KEY (client_id) REFERENCES public.clients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_pp_created_by FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT fk_pp_decided_by FOREIGN KEY (decided_by) REFERENCES auth.users (id) ON DELETE SET NULL,

  CONSTRAINT fk_pp_af  FOREIGN KEY (actif_financier_id)       REFERENCES public.actifs_financiers (id)     ON DELETE SET NULL,
  CONSTRAINT fk_pp_im  FOREIGN KEY (patrimoine_immobilier_id) REFERENCES public.patrimoine_immobilier (id) ON DELETE SET NULL,
  CONSTRAINT fk_pp_pa  FOREIGN KEY (passif_id)                REFERENCES public.passifs (id)               ON DELETE SET NULL,
  CONSTRAINT fk_pp_cp  FOREIGN KEY (contrat_prevoyance_id)    REFERENCES public.contrats_prevoyance (id)   ON DELETE SET NULL,
  CONSTRAINT fk_pp_caf FOREIGN KEY (cree_actif_financier_id)       REFERENCES public.actifs_financiers (id)     ON DELETE SET NULL,
  CONSTRAINT fk_pp_cim FOREIGN KEY (cree_patrimoine_immobilier_id) REFERENCES public.patrimoine_immobilier (id) ON DELETE SET NULL,
  CONSTRAINT fk_pp_cpa FOREIGN KEY (cree_passif_id)                REFERENCES public.passifs (id)               ON DELETE SET NULL,
  CONSTRAINT fk_pp_ccp FOREIGN KEY (cree_contrat_prevoyance_id)    REFERENCES public.contrats_prevoyance (id)   ON DELETE SET NULL,

  CONSTRAINT chk_pp_operation  CHECK (operation IN ('creation','mise_a_jour')),
  CONSTRAINT chk_pp_cible      CHECK (cible_type IN ('actif_financier','patrimoine_immobilier','passif','contrat_prevoyance')),
  CONSTRAINT chk_pp_statut     CHECK (statut IN ('en_attente','appliquee','rejetee','annulee')),

  -- Élément existant : 0 pour création ; exactement 1 (correspondant à cible_type) pour mise à jour.
  CONSTRAINT chk_pp_existant CHECK (
    (operation = 'creation'
       AND num_nonnulls(actif_financier_id, patrimoine_immobilier_id, passif_id, contrat_prevoyance_id) = 0)
    OR (operation = 'mise_a_jour' AND (
         (cible_type = 'actif_financier'       AND actif_financier_id       IS NOT NULL AND num_nonnulls(patrimoine_immobilier_id, passif_id, contrat_prevoyance_id) = 0)
      OR (cible_type = 'patrimoine_immobilier' AND patrimoine_immobilier_id IS NOT NULL AND num_nonnulls(actif_financier_id, passif_id, contrat_prevoyance_id) = 0)
      OR (cible_type = 'passif'                AND passif_id                IS NOT NULL AND num_nonnulls(actif_financier_id, patrimoine_immobilier_id, contrat_prevoyance_id) = 0)
      OR (cible_type = 'contrat_prevoyance'    AND contrat_prevoyance_id    IS NOT NULL AND num_nonnulls(actif_financier_id, patrimoine_immobilier_id, passif_id) = 0)
    ))
  ),

  -- Élément créé/modifié : 0 sauf si appliquée ; sinon exactement 1 correspondant à cible_type.
  CONSTRAINT chk_pp_cree CHECK (
    (statut <> 'appliquee'
       AND num_nonnulls(cree_actif_financier_id, cree_patrimoine_immobilier_id, cree_passif_id, cree_contrat_prevoyance_id) = 0)
    OR (statut = 'appliquee' AND (
         (cible_type = 'actif_financier'       AND cree_actif_financier_id       IS NOT NULL AND num_nonnulls(cree_patrimoine_immobilier_id, cree_passif_id, cree_contrat_prevoyance_id) = 0)
      OR (cible_type = 'patrimoine_immobilier' AND cree_patrimoine_immobilier_id IS NOT NULL AND num_nonnulls(cree_actif_financier_id, cree_passif_id, cree_contrat_prevoyance_id) = 0)
      OR (cible_type = 'passif'                AND cree_passif_id                IS NOT NULL AND num_nonnulls(cree_actif_financier_id, cree_patrimoine_immobilier_id, cree_contrat_prevoyance_id) = 0)
      OR (cible_type = 'contrat_prevoyance'    AND cree_contrat_prevoyance_id    IS NOT NULL AND num_nonnulls(cree_actif_financier_id, cree_patrimoine_immobilier_id, cree_passif_id) = 0)
    ))
  ),
  -- Cohérence décision.
  CONSTRAINT chk_pp_decision CHECK (
    (statut = 'en_attente' AND decided_by IS NULL AND decided_at IS NULL)
    OR (statut <> 'en_attente' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pp_affaire ON public.affaire_propositions_patrimoniales (affaire_id);
CREATE INDEX IF NOT EXISTS idx_pp_client  ON public.affaire_propositions_patrimoniales (client_id);
CREATE INDEX IF NOT EXISTS idx_pp_statut  ON public.affaire_propositions_patrimoniales (statut);

DROP TRIGGER IF EXISTS trg_pp_updated_at ON public.affaire_propositions_patrimoniales;
CREATE TRIGGER trg_pp_updated_at BEFORE UPDATE ON public.affaire_propositions_patrimoniales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Privilèges + RLS : lecture conseiller ; aucune écriture directe.
REVOKE ALL   ON TABLE public.affaire_propositions_patrimoniales FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON TABLE public.affaire_propositions_patrimoniales TO authenticated;
GRANT  ALL   ON TABLE public.affaire_propositions_patrimoniales TO service_role;

ALTER TABLE public.affaire_propositions_patrimoniales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pp_select_conseiller" ON public.affaire_propositions_patrimoniales;
CREATE POLICY "pp_select_conseiller" ON public.affaire_propositions_patrimoniales
  FOR SELECT TO authenticated USING (public.get_user_role() = 'conseiller');


-- ─────────────────────────────────────────────────────────────────────────────
-- 28c. RPC : créer une proposition (affaire terminée uniquement)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_affaire_proposition_creer(
  p_affaire_id UUID, p_version_attendue BIGINT, p_operation TEXT, p_cible_type TEXT,
  p_donnees JSONB,
  p_actif_financier_id UUID DEFAULT NULL, p_patrimoine_immobilier_id UUID DEFAULT NULL,
  p_passif_id UUID DEFAULT NULL, p_contrat_prevoyance_id UUID DEFAULT NULL
)
RETURNS TABLE (proposition_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_statut TEXT; v_client UUID; v_new_ver BIGINT; v_pid UUID; v_existing UUID;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut <> 'terminee' THEN
    RAISE EXCEPTION 'Une proposition ne peut etre creee que sur une affaire terminee (statut: %).', v_statut USING ERRCODE = 'P0001';
  END IF;
  IF p_operation NOT IN ('creation','mise_a_jour') THEN RAISE EXCEPTION 'Operation invalide: %', p_operation USING ERRCODE='P0001'; END IF;
  IF p_cible_type NOT IN ('actif_financier','patrimoine_immobilier','passif','contrat_prevoyance') THEN
    RAISE EXCEPTION 'Cible invalide: %', p_cible_type USING ERRCODE='P0001'; END IF;

  SELECT a.client_id INTO v_client FROM public.affaires AS a WHERE a.id = p_affaire_id;

  v_existing := CASE p_cible_type
    WHEN 'actif_financier'       THEN p_actif_financier_id
    WHEN 'patrimoine_immobilier' THEN p_patrimoine_immobilier_id
    WHEN 'passif'                THEN p_passif_id
    WHEN 'contrat_prevoyance'    THEN p_contrat_prevoyance_id END;

  IF p_operation = 'creation' THEN
    IF num_nonnulls(p_actif_financier_id, p_patrimoine_immobilier_id, p_passif_id, p_contrat_prevoyance_id) <> 0 THEN
      RAISE EXCEPTION 'Une creation ne reference aucun element existant.' USING ERRCODE='P0001';
    END IF;
  ELSE
    IF v_existing IS NULL THEN RAISE EXCEPTION 'Une mise a jour doit referencer un element existant correspondant a la cible.' USING ERRCODE='P0001'; END IF;
    -- L'élément cible appartient au client de l'affaire.
    IF (p_cible_type='actif_financier'       AND NOT EXISTS (SELECT 1 FROM public.actifs_financiers     WHERE id=v_existing AND client_id=v_client))
    OR (p_cible_type='patrimoine_immobilier' AND NOT EXISTS (SELECT 1 FROM public.patrimoine_immobilier WHERE id=v_existing AND client_id=v_client))
    OR (p_cible_type='passif'                AND NOT EXISTS (SELECT 1 FROM public.passifs               WHERE id=v_existing AND client_id=v_client))
    OR (p_cible_type='contrat_prevoyance'    AND NOT EXISTS (SELECT 1 FROM public.contrats_prevoyance   WHERE id=v_existing AND client_id=v_client)) THEN
      RAISE EXCEPTION 'Element cible introuvable ou hors du client de l''affaire.' USING ERRCODE='P0002';
    END IF;
  END IF;

  INSERT INTO public.affaire_propositions_patrimoniales (
    affaire_id, client_id, operation, cible_type, donnees_proposees, statut,
    actif_financier_id, patrimoine_immobilier_id, passif_id, contrat_prevoyance_id, created_by
  ) VALUES (
    p_affaire_id, v_client, p_operation, p_cible_type, COALESCE(p_donnees,'{}'::jsonb), 'en_attente',
    p_actif_financier_id, p_patrimoine_immobilier_id, p_passif_id, p_contrat_prevoyance_id, auth.uid()
  ) RETURNING id INTO v_pid;

  UPDATE public.affaires AS a SET updated_by = auth.uid(), version_row = p_version_attendue + 1
    WHERE a.id = p_affaire_id RETURNING a.version_row INTO v_new_ver;
  PERFORM private.fn_affaire_log(p_affaire_id, 'proposition_creee',
    jsonb_build_object('proposition_id', v_pid, 'operation', p_operation, 'cible_type', p_cible_type));
  RETURN QUERY SELECT v_pid, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_proposition_creer(UUID,BIGINT,TEXT,TEXT,JSONB,UUID,UUID,UUID,UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_proposition_creer(UUID,BIGINT,TEXT,TEXT,JSONB,UUID,UUID,UUID,UUID) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 28d. RPC : appliquer une proposition (liste blanche ; jamais archivée)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_affaire_proposition_appliquer(
  p_affaire_id UUID, p_version_attendue BIGINT, p_proposition_id UUID
)
RETURNS TABLE (proposition_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE
  v_statut TEXT; v_client UUID; v_new_ver BIGINT;
  v_op TEXT; v_cible TEXT; v_donnees JSONB; v_pstatut TEXT; v_existing UUID; v_cree UUID; v_paffaire UUID;
BEGIN
  v_statut := private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  IF v_statut = 'archivee' THEN
    RAISE EXCEPTION 'PROPOSITION_AFFAIRE_ARCHIVEE: aucune application sur une affaire archivee.' USING ERRCODE='P0001';
  END IF;
  SELECT a.client_id INTO v_client FROM public.affaires AS a WHERE a.id = p_affaire_id;

  SELECT p.operation, p.cible_type, p.donnees_proposees, p.statut, p.affaire_id
    INTO v_op, v_cible, v_donnees, v_pstatut, v_paffaire
  FROM public.affaire_propositions_patrimoniales AS p WHERE p.id = p_proposition_id FOR UPDATE;
  IF NOT FOUND OR v_paffaire <> p_affaire_id THEN
    RAISE EXCEPTION 'Proposition introuvable pour cette affaire.' USING ERRCODE='P0002';
  END IF;
  IF v_pstatut <> 'en_attente' THEN
    RAISE EXCEPTION 'Seule une proposition en attente peut etre appliquee (statut: %).', v_pstatut USING ERRCODE='P0001';
  END IF;

  SELECT CASE v_cible
    WHEN 'actif_financier'       THEN pp.actif_financier_id
    WHEN 'patrimoine_immobilier' THEN pp.patrimoine_immobilier_id
    WHEN 'passif'                THEN pp.passif_id
    WHEN 'contrat_prevoyance'    THEN pp.contrat_prevoyance_id END
  INTO v_existing FROM public.affaire_propositions_patrimoniales AS pp WHERE pp.id = p_proposition_id;

  -- ── Application par liste blanche (aucun SQL dynamique) ────────────────────
  IF v_op = 'creation' THEN
    IF v_cible = 'actif_financier' THEN
      IF v_donnees->>'nature' IS NULL OR v_donnees->>'libelle' IS NULL THEN
        RAISE EXCEPTION 'PROPOSITION_DONNEE_MANQUANTE: nature et libelle requis (actif_financier).' USING ERRCODE='P0001'; END IF;
      INSERT INTO public.actifs_financiers (client_id, nature, libelle, montant, souscrit_par, date_souscription, detail)
      VALUES (v_client, v_donnees->>'nature', v_donnees->>'libelle',
              NULLIF(v_donnees->>'montant','')::numeric, v_donnees->>'souscrit_par',
              NULLIF(v_donnees->>'date_souscription','')::date, COALESCE(v_donnees->'detail','{}'::jsonb))
      RETURNING id INTO v_cree;
    ELSIF v_cible = 'patrimoine_immobilier' THEN
      IF v_donnees->>'nature' IS NULL THEN RAISE EXCEPTION 'PROPOSITION_DONNEE_MANQUANTE: nature requise.' USING ERRCODE='P0001'; END IF;
      INSERT INTO public.patrimoine_immobilier (client_id, nature, valeur, detenu_par, revenus_annuels, fiscalite, detail, date_acquisition, quote_part_detenue)
      VALUES (v_client, v_donnees->>'nature', NULLIF(v_donnees->>'valeur','')::numeric, v_donnees->>'detenu_par',
              NULLIF(v_donnees->>'revenus_annuels','')::numeric, v_donnees->>'fiscalite', COALESCE(v_donnees->'detail','{}'::jsonb),
              NULLIF(v_donnees->>'date_acquisition','')::date, NULLIF(v_donnees->>'quote_part_detenue','')::numeric)
      RETURNING id INTO v_cree;
    ELSIF v_cible = 'passif' THEN
      IF v_donnees->>'nature' IS NULL THEN RAISE EXCEPTION 'PROPOSITION_DONNEE_MANQUANTE: nature requise.' USING ERRCODE='P0001'; END IF;
      INSERT INTO public.passifs (client_id, nature, banque, montant, duree, taux, mensualite, detail, capital_restant_du)
      VALUES (v_client, v_donnees->>'nature', v_donnees->>'banque', NULLIF(v_donnees->>'montant','')::numeric,
              NULLIF(v_donnees->>'duree','')::integer, NULLIF(v_donnees->>'taux','')::numeric,
              NULLIF(v_donnees->>'mensualite','')::numeric, COALESCE(v_donnees->'detail','{}'::jsonb),
              NULLIF(v_donnees->>'capital_restant_du','')::numeric)
      RETURNING id INTO v_cree;
    ELSE -- contrat_prevoyance
      IF v_donnees->>'nature' IS NULL THEN RAISE EXCEPTION 'PROPOSITION_DONNEE_MANQUANTE: nature requise.' USING ERRCODE='P0001'; END IF;
      INSERT INTO public.contrats_prevoyance (client_id, nature, compagnie, montant, detail)
      VALUES (v_client, v_donnees->>'nature', v_donnees->>'compagnie', NULLIF(v_donnees->>'montant','')::numeric,
              COALESCE(v_donnees->'detail','{}'::jsonb))
      RETURNING id INTO v_cree;
    END IF;
  ELSE  -- mise_a_jour (UPDATE ciblé, identifiant préservé)
    IF v_cible = 'actif_financier' THEN
      IF NOT EXISTS (SELECT 1 FROM public.actifs_financiers WHERE id=v_existing AND client_id=v_client) THEN
        RAISE EXCEPTION 'Element cible hors du client de l''affaire.' USING ERRCODE='P0002'; END IF;
      UPDATE public.actifs_financiers AS t SET
        nature            = CASE WHEN v_donnees ? 'nature'            THEN v_donnees->>'nature'                       ELSE t.nature END,
        libelle           = CASE WHEN v_donnees ? 'libelle'           THEN v_donnees->>'libelle'                      ELSE t.libelle END,
        montant           = CASE WHEN v_donnees ? 'montant'           THEN NULLIF(v_donnees->>'montant','')::numeric  ELSE t.montant END,
        souscrit_par      = CASE WHEN v_donnees ? 'souscrit_par'      THEN v_donnees->>'souscrit_par'                 ELSE t.souscrit_par END,
        date_souscription = CASE WHEN v_donnees ? 'date_souscription' THEN NULLIF(v_donnees->>'date_souscription','')::date ELSE t.date_souscription END,
        detail            = CASE WHEN v_donnees ? 'detail'            THEN v_donnees->'detail'                        ELSE t.detail END
      WHERE t.id = v_existing;
      v_cree := v_existing;
    ELSIF v_cible = 'patrimoine_immobilier' THEN
      IF NOT EXISTS (SELECT 1 FROM public.patrimoine_immobilier WHERE id=v_existing AND client_id=v_client) THEN
        RAISE EXCEPTION 'Element cible hors du client de l''affaire.' USING ERRCODE='P0002'; END IF;
      UPDATE public.patrimoine_immobilier AS t SET
        nature            = CASE WHEN v_donnees ? 'nature'            THEN v_donnees->>'nature'                        ELSE t.nature END,
        valeur            = CASE WHEN v_donnees ? 'valeur'            THEN NULLIF(v_donnees->>'valeur','')::numeric    ELSE t.valeur END,
        detenu_par        = CASE WHEN v_donnees ? 'detenu_par'        THEN v_donnees->>'detenu_par'                    ELSE t.detenu_par END,
        revenus_annuels   = CASE WHEN v_donnees ? 'revenus_annuels'   THEN NULLIF(v_donnees->>'revenus_annuels','')::numeric ELSE t.revenus_annuels END,
        fiscalite         = CASE WHEN v_donnees ? 'fiscalite'         THEN v_donnees->>'fiscalite'                     ELSE t.fiscalite END,
        detail            = CASE WHEN v_donnees ? 'detail'            THEN v_donnees->'detail'                         ELSE t.detail END,
        date_acquisition  = CASE WHEN v_donnees ? 'date_acquisition'  THEN NULLIF(v_donnees->>'date_acquisition','')::date  ELSE t.date_acquisition END,
        quote_part_detenue= CASE WHEN v_donnees ? 'quote_part_detenue' THEN NULLIF(v_donnees->>'quote_part_detenue','')::numeric ELSE t.quote_part_detenue END
      WHERE t.id = v_existing;
      v_cree := v_existing;
    ELSIF v_cible = 'passif' THEN
      IF NOT EXISTS (SELECT 1 FROM public.passifs WHERE id=v_existing AND client_id=v_client) THEN
        RAISE EXCEPTION 'Element cible hors du client de l''affaire.' USING ERRCODE='P0002'; END IF;
      UPDATE public.passifs AS t SET
        nature             = CASE WHEN v_donnees ? 'nature'             THEN v_donnees->>'nature'                        ELSE t.nature END,
        banque             = CASE WHEN v_donnees ? 'banque'             THEN v_donnees->>'banque'                        ELSE t.banque END,
        montant            = CASE WHEN v_donnees ? 'montant'            THEN NULLIF(v_donnees->>'montant','')::numeric    ELSE t.montant END,
        duree              = CASE WHEN v_donnees ? 'duree'              THEN NULLIF(v_donnees->>'duree','')::integer      ELSE t.duree END,
        taux               = CASE WHEN v_donnees ? 'taux'               THEN NULLIF(v_donnees->>'taux','')::numeric       ELSE t.taux END,
        mensualite         = CASE WHEN v_donnees ? 'mensualite'         THEN NULLIF(v_donnees->>'mensualite','')::numeric ELSE t.mensualite END,
        detail             = CASE WHEN v_donnees ? 'detail'             THEN v_donnees->'detail'                         ELSE t.detail END,
        capital_restant_du = CASE WHEN v_donnees ? 'capital_restant_du' THEN NULLIF(v_donnees->>'capital_restant_du','')::numeric ELSE t.capital_restant_du END
      WHERE t.id = v_existing;
      v_cree := v_existing;
    ELSE -- contrat_prevoyance
      IF NOT EXISTS (SELECT 1 FROM public.contrats_prevoyance WHERE id=v_existing AND client_id=v_client) THEN
        RAISE EXCEPTION 'Element cible hors du client de l''affaire.' USING ERRCODE='P0002'; END IF;
      UPDATE public.contrats_prevoyance AS t SET
        nature    = CASE WHEN v_donnees ? 'nature'    THEN v_donnees->>'nature'                      ELSE t.nature END,
        compagnie = CASE WHEN v_donnees ? 'compagnie' THEN v_donnees->>'compagnie'                   ELSE t.compagnie END,
        montant   = CASE WHEN v_donnees ? 'montant'   THEN NULLIF(v_donnees->>'montant','')::numeric ELSE t.montant END,
        detail    = CASE WHEN v_donnees ? 'detail'    THEN v_donnees->'detail'                       ELSE t.detail END
      WHERE t.id = v_existing;
      v_cree := v_existing;
    END IF;
  END IF;

  UPDATE public.affaire_propositions_patrimoniales SET
    statut = 'appliquee', decided_by = auth.uid(), decided_at = now(),
    cree_actif_financier_id       = CASE WHEN v_cible='actif_financier'       THEN v_cree ELSE NULL END,
    cree_patrimoine_immobilier_id = CASE WHEN v_cible='patrimoine_immobilier' THEN v_cree ELSE NULL END,
    cree_passif_id                = CASE WHEN v_cible='passif'                THEN v_cree ELSE NULL END,
    cree_contrat_prevoyance_id    = CASE WHEN v_cible='contrat_prevoyance'    THEN v_cree ELSE NULL END
  WHERE id = p_proposition_id;

  UPDATE public.affaires AS a SET updated_by = auth.uid(), version_row = p_version_attendue + 1
    WHERE a.id = p_affaire_id RETURNING a.version_row INTO v_new_ver;
  PERFORM private.fn_affaire_log(p_affaire_id, 'proposition_appliquee',
    jsonb_build_object('proposition_id', p_proposition_id, 'cible_type', v_cible, 'element_id', v_cree, 'operation', v_op));
  RETURN QUERY SELECT p_proposition_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_proposition_appliquer(UUID,BIGINT,UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_proposition_appliquer(UUID,BIGINT,UUID) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 28e. RPC : rejeter / annuler une proposition
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_affaire_proposition_rejeter(
  p_affaire_id UUID, p_version_attendue BIGINT, p_proposition_id UUID, p_motif TEXT DEFAULT NULL
)
RETURNS TABLE (proposition_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_new_ver BIGINT; v_pstatut TEXT; v_paffaire UUID;
BEGIN
  PERFORM private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  SELECT p.statut, p.affaire_id INTO v_pstatut, v_paffaire
  FROM public.affaire_propositions_patrimoniales AS p WHERE p.id = p_proposition_id FOR UPDATE;
  IF NOT FOUND OR v_paffaire <> p_affaire_id THEN RAISE EXCEPTION 'Proposition introuvable pour cette affaire.' USING ERRCODE='P0002'; END IF;
  IF v_pstatut <> 'en_attente' THEN RAISE EXCEPTION 'Seule une proposition en attente peut etre rejetee.' USING ERRCODE='P0001'; END IF;

  UPDATE public.affaire_propositions_patrimoniales
    SET statut='rejetee', decided_by=auth.uid(), decided_at=now(), motif_decision=p_motif
    WHERE id = p_proposition_id;
  UPDATE public.affaires AS a SET updated_by=auth.uid(), version_row=p_version_attendue+1
    WHERE a.id=p_affaire_id RETURNING a.version_row INTO v_new_ver;
  PERFORM private.fn_affaire_log(p_affaire_id, 'proposition_rejetee', jsonb_build_object('proposition_id', p_proposition_id), p_motif);
  RETURN QUERY SELECT p_proposition_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_proposition_rejeter(UUID,BIGINT,UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_proposition_rejeter(UUID,BIGINT,UUID,TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_affaire_proposition_annuler(
  p_affaire_id UUID, p_version_attendue BIGINT, p_proposition_id UUID, p_motif TEXT DEFAULT NULL
)
RETURNS TABLE (proposition_id UUID, version_row BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
#variable_conflict use_column
DECLARE v_new_ver BIGINT; v_pstatut TEXT; v_paffaire UUID;
BEGIN
  PERFORM private.fn_affaire_charger_pour_maj(p_affaire_id, p_version_attendue);
  SELECT p.statut, p.affaire_id INTO v_pstatut, v_paffaire
  FROM public.affaire_propositions_patrimoniales AS p WHERE p.id = p_proposition_id FOR UPDATE;
  IF NOT FOUND OR v_paffaire <> p_affaire_id THEN RAISE EXCEPTION 'Proposition introuvable pour cette affaire.' USING ERRCODE='P0002'; END IF;
  IF v_pstatut <> 'en_attente' THEN RAISE EXCEPTION 'Seule une proposition en attente peut etre annulee.' USING ERRCODE='P0001'; END IF;

  UPDATE public.affaire_propositions_patrimoniales
    SET statut='annulee', decided_by=auth.uid(), decided_at=now(), motif_decision=p_motif
    WHERE id = p_proposition_id;
  UPDATE public.affaires AS a SET updated_by=auth.uid(), version_row=p_version_attendue+1
    WHERE a.id=p_affaire_id RETURNING a.version_row INTO v_new_ver;
  PERFORM private.fn_affaire_log(p_affaire_id, 'proposition_annulee', jsonb_build_object('proposition_id', p_proposition_id), p_motif);
  RETURN QUERY SELECT p_proposition_id, v_new_ver;
END;
$$;
REVOKE ALL     ON FUNCTION public.fn_affaire_proposition_annuler(UUID,BIGINT,UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_affaire_proposition_annuler(UUID,BIGINT,UUID,TEXT) TO authenticated, service_role;


-- =============================================================================
-- PLAN DE ROLLBACK (manuel)
--   DROP FUNCTION IF EXISTS public.fn_affaire_proposition_annuler(UUID,BIGINT,UUID,TEXT);
--   DROP FUNCTION IF EXISTS public.fn_affaire_proposition_rejeter(UUID,BIGINT,UUID,TEXT);
--   DROP FUNCTION IF EXISTS public.fn_affaire_proposition_appliquer(UUID,BIGINT,UUID);
--   DROP FUNCTION IF EXISTS public.fn_affaire_proposition_creer(UUID,BIGINT,TEXT,TEXT,JSONB,UUID,UUID,UUID,UUID);
--   DROP TABLE IF EXISTS public.affaire_propositions_patrimoniales CASCADE;
--   -- restaurer chk_ev_type d'origine (12 valeurs) si besoin.
-- FICHIERS MODIFIÉS : + supabase/migrations/028_affaires_propositions_patrimoniales.sql
-- =============================================================================
