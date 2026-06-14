-- 006_trigger_auto_gouvernance.sql
-- Création automatique d'une fiche produits_gouvernance à chaque INSERT dans produits

CREATE OR REPLACE FUNCTION fn_auto_create_gouvernance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO produits_gouvernance (
    produit_id,
    statut_conformite,
    statut_validation,
    source_marche_cible,
    alerte_revue
  ) VALUES (
    NEW.id,
    'conforme',
    'a_valider',
    'manuel',
    false
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_gouvernance ON produits;

CREATE TRIGGER trg_auto_gouvernance
  AFTER INSERT ON produits
  FOR EACH ROW EXECUTE FUNCTION fn_auto_create_gouvernance();

-- Backfill : initialise la gouvernance des produits existants sans fiche
INSERT INTO produits_gouvernance (
  produit_id, statut_conformite, statut_validation, source_marche_cible, alerte_revue
)
SELECT p.id, 'conforme', 'a_valider', 'manuel', false
FROM produits p
LEFT JOIN produits_gouvernance g ON g.produit_id = p.id
WHERE g.id IS NULL
ON CONFLICT DO NOTHING;
