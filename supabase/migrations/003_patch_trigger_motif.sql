-- Migration 003 : Correctif trigger fn_snapshot_gouvernance
-- Problème : la colonne `motif` de produits_gouvernance_historique
-- restait toujours NULL car le trigger ne la renseignait pas.
-- Fix : passage de NEW.motif_signalement dans la colonne `motif`.

CREATE OR REPLACE FUNCTION fn_snapshot_gouvernance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO produits_gouvernance_historique (
    gouvernance_id,
    produit_id,
    snapshot,
    modifie_par,
    modifie_le,
    motif,
    statut_conformite_avant,
    statut_conformite_apres,
    statut_validation_avant,
    statut_validation_apres
  ) VALUES (
    OLD.id,
    OLD.produit_id,
    to_jsonb(OLD),
    auth.uid(),
    NOW(),
    NEW.motif_signalement,
    OLD.statut_conformite,
    NEW.statut_conformite,
    OLD.statut_validation,
    NEW.statut_validation
  );
  RETURN NEW;
END;
$$;
