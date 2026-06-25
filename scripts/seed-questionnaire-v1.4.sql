-- =============================================================================
-- SEED : Questionnaire patrimonial v1.4 — AMP CONSEIL
-- =============================================================================
-- Version dérivée de v1.3 (c1a55000-0000-4000-8000-000000000004).
-- Changements : logique conditionnelle pilotée par TYPE DE PRODUIT (matrice
-- explicite nature -> questions pertinentes), plus d'accumulation de
-- conditions indépendantes.
--
--   - Actifs financiers : nouvelles natures 'CompteCourant' et 'PrivateEquity'.
--     Date de souscription affichée pour AV/PER/SCPI/Capitalisation/PEA/CTO/
--     PrivateEquity/Autre (pas Livret, pas CompteCourant). Mode de détention
--     (+ démembrement) affiché pour AV/PER/SCPI/Capitalisation/Autre uniquement.
--   - Patrimoine immobilier : 'Locatif' scindé en 'LocatifNu'/'LocatifMeuble'
--     (fiscalité réellement différente), nouvelle nature 'Terrain'. Revenus
--     locatifs affichés uniquement pour LocatifNu/LocatifMeuble/SCI. Régime
--     fiscal scindé en deux questions : foncier (micro-foncier/réel) pour
--     LocatifNu/SCI, meublé (micro-BIC/réel) pour LocatifMeuble.
--
-- Dépend de : migration 016_questionnaire_v1_4_natures.sql (CHECK constraints
-- nature sur actifs_financiers et patrimoine_immobilier) — doit être appliquée
-- avant toute collecte réelle sur cette version, sinon l'application d'un
-- écart utilisant une nouvelle valeur de nature échouera.
--
-- Idempotence :
--   1. Désactive la version active courante (v1.3).
--   2. Insère la nouvelle version 1.4, active.
--   ON CONFLICT (id) DO NOTHING sur l'insert — sans danger si rejoué.
-- =============================================================================

UPDATE questionnaire_versions SET actif = FALSE WHERE actif = TRUE;

INSERT INTO questionnaire_versions (
  id, version, libelle, description, version_schema, structure, statut, actif,
  date_publication, created_at, updated_at
)
VALUES (
  'c1a55000-0000-4000-8000-000000000005'::uuid,
  '1.4',
  'Bilan patrimonial initial v1.4',
  'Version 1.4 — logique conditionnelle pilotee par type de produit (placements financiers et immobilier), nouvelles natures CompteCourant/PrivateEquity/Terrain, Locatif scinde en nu/meuble, regime fiscal scinde foncier/meuble.',
  '1.0',
  $json$
{
  "blocs": [
    {
      "code": "identite",
      "ordre": 1,
      "repete": false,
      "libelle": "Identité",
      "questions": [
        {
          "code": "id_nom",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Nom",
          "conditions": [],
          "obligatoire": true,
          "placeholder": "Nom de famille",
          "prefill_path": "identite.nom"
        },
        {
          "code": "id_prenom",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Prénom",
          "conditions": [],
          "obligatoire": true,
          "placeholder": "Prénom",
          "prefill_path": "identite.prenom"
        },
        {
          "code": "id_date_naissance",
          "type": "date",
          "portee": "client",
          "repete": false,
          "libelle": "Date de naissance",
          "conditions": [],
          "obligatoire": true,
          "prefill_path": "identite.date_naissance"
        },
        {
          "code": "id_lieu_naissance",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Ville de naissance",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Ex : Lyon",
          "prefill_path": "identite.lieu_naissance"
        },
        {
          "code": "id_nationalite",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Nationalité",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Ex : Française",
          "prefill_path": "identite.nationalite"
        },
        {
          "code": "id_pays_naissance",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Pays de naissance",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Ex : France",
          "prefill_path": "identite.pays_naissance"
        },
        {
          "code": "id_adresse",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Adresse",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Numéro et nom de rue",
          "prefill_path": "identite.adresse"
        },
        {
          "code": "id_code_postal",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Code postal",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "75001",
          "prefill_path": "identite.code_postal"
        },
        {
          "code": "id_ville",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Ville",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Paris",
          "prefill_path": "identite.ville"
        },
        {
          "code": "id_nom",
          "type": "texte",
          "portee": "conjoint",
          "repete": false,
          "libelle": "Nom du conjoint / partenaire",
          "conditions": [
            {
              "champ": "perimetre",
              "valeur": "foyer",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "Nom de famille",
          "prefill_path": "foyer.conjoint.nom"
        },
        {
          "code": "id_prenom",
          "type": "texte",
          "portee": "conjoint",
          "repete": false,
          "libelle": "Prénom du conjoint / partenaire",
          "conditions": [
            {
              "champ": "perimetre",
              "valeur": "foyer",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "Prénom",
          "prefill_path": "foyer.conjoint.prenom"
        },
        {
          "code": "id_pays_naissance",
          "type": "texte",
          "portee": "conjoint",
          "repete": false,
          "libelle": "Pays de naissance du conjoint / partenaire",
          "conditions": [
            {
              "champ": "perimetre",
              "valeur": "foyer",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "Ex : France",
          "prefill_path": "foyer.conjoint.pays_naissance"
        },
        {
          "code": "id_email",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Email",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "exemple@email.fr",
          "prefill_path": "identite.email"
        },
        {
          "code": "id_telephone",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Téléphone",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "06 12 34 56 78",
          "prefill_path": "identite.telephone"
        }
      ]
    },
    {
      "code": "foyer",
      "ordre": 2,
      "repete": false,
      "libelle": "Situation familiale",
      "questions": [
        {
          "code": "foy_situation",
          "type": "liste",
          "portee": "client",
          "repete": false,
          "libelle": "Situation familiale",
          "options": [
            {
              "label": "Célibataire",
              "value": "celibataire"
            },
            {
              "label": "Marié(e)",
              "value": "marie"
            },
            {
              "label": "Pacsé(e)",
              "value": "pacse"
            },
            {
              "label": "Concubinage",
              "value": "concubinage"
            },
            {
              "label": "Divorcé(e)",
              "value": "divorce"
            },
            {
              "label": "Veuf / Veuve",
              "value": "veuf"
            }
          ],
          "conditions": [],
          "obligatoire": true,
          "prefill_path": "foyer.situation"
        },
        {
          "code": "foy_regime_matrimonial",
          "type": "liste",
          "portee": "foyer",
          "repete": false,
          "libelle": "Régime matrimonial",
          "options": [
            {
              "label": "Communauté réduite aux acquêts",
              "value": "communaute_reduite"
            },
            {
              "label": "Séparation de biens",
              "value": "separation_biens"
            },
            {
              "label": "Participation aux acquêts",
              "value": "participation_acquets"
            },
            {
              "label": "Communauté universelle",
              "value": "communaute_universelle"
            },
            {
              "label": "Autre",
              "value": "autre"
            }
          ],
          "conditions": [
            {
              "champ": "foy_situation",
              "valeur": "marie",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "foyer.regime_matrimonial"
        },
        {
          "code": "foy_enfant_prenom",
          "type": "texte",
          "portee": "foyer",
          "repete": true,
          "libelle": "Prénom de l'enfant",
          "conditions": [],
          "obligatoire": true,
          "placeholder": "Prénom",
          "prefill_path": "item.prenom"
        },
        {
          "code": "foy_enfant_nom",
          "type": "texte",
          "portee": "foyer",
          "repete": true,
          "libelle": "Nom de l'enfant",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Nom de famille",
          "prefill_path": "item.nom"
        },
        {
          "code": "foy_enfant_date_naissance",
          "type": "date",
          "portee": "foyer",
          "repete": true,
          "libelle": "Date de naissance",
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.date_naissance"
        },
        {
          "code": "foy_enfant_a_charge",
          "type": "booleen",
          "portee": "foyer",
          "repete": true,
          "libelle": "Fiscalement à charge",
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.a_charge"
        },
        {
          "code": "foy_enfant_filiation",
          "type": "liste",
          "portee": "foyer",
          "repete": true,
          "libelle": "Filiation",
          "options": [
            {
              "label": "Enfant commun",
              "value": "commun"
            },
            {
              "label": "Enfant du client",
              "value": "client"
            },
            {
              "label": "Enfant du conjoint",
              "value": "conjoint"
            },
            {
              "label": "Enfant adopté",
              "value": "adoption"
            }
          ],
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.filiation"
        },
        {
          "code": "foy_lieu_naissance",
          "type": "texte",
          "portee": "conjoint",
          "repete": false,
          "libelle": "Lieu de naissance du conjoint / partenaire (ville)",
          "conditions": [
            {
              "champ": "perimetre",
              "valeur": "foyer",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "Ex : Lyon",
          "prefill_path": "foyer.conjoint.lieu_naissance"
        },
        {
          "code": "foy_conjoint_email",
          "type": "texte",
          "portee": "conjoint",
          "repete": false,
          "libelle": "Email du conjoint / partenaire",
          "conditions": [
            {
              "champ": "perimetre",
              "valeur": "foyer",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "exemple@email.fr",
          "prefill_path": "foyer.conjoint.email"
        },
        {
          "code": "foy_conjoint_telephone",
          "type": "texte",
          "portee": "conjoint",
          "repete": false,
          "libelle": "Téléphone du conjoint / partenaire",
          "conditions": [
            {
              "champ": "perimetre",
              "valeur": "foyer",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "06 12 34 56 78",
          "prefill_path": "foyer.conjoint.telephone"
        },
        {
          "code": "foy_date_mariage",
          "type": "date",
          "portee": "foyer",
          "repete": false,
          "libelle": "Date de mariage",
          "conditions": [
            {
              "champ": "foy_situation",
              "portee": "client",
              "valeur": "marie",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "foyer.date_mariage"
        },
        {
          "code": "foy_contrat_mariage",
          "type": "booleen",
          "portee": "foyer",
          "repete": false,
          "libelle": "Contrat de mariage",
          "conditions": [
            {
              "champ": "foy_situation",
              "portee": "client",
              "valeur": "marie",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "foyer.contrat_mariage"
        },
        {
          "code": "foy_date_contrat_mariage",
          "type": "date",
          "portee": "foyer",
          "repete": false,
          "libelle": "Date du contrat de mariage",
          "conditions": [
            {
              "champ": "foy_contrat_mariage",
              "portee": "foyer",
              "valeur": true,
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "foyer.date_contrat_mariage"
        },
        {
          "code": "foy_donation_dernier_vivant",
          "type": "booleen",
          "portee": "foyer",
          "repete": false,
          "libelle": "Donation au dernier vivant",
          "conditions": [
            {
              "champ": "foy_situation",
              "portee": "client",
              "valeur": "marie",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "foyer.donation_dernier_vivant"
        },
        {
          "code": "foy_regime_pacs",
          "type": "liste",
          "portee": "foyer",
          "repete": false,
          "libelle": "Régime du PACS",
          "options": [
            {
              "label": "Séparation de biens (régime légal)",
              "value": "separation_biens"
            },
            {
              "label": "Indivision",
              "value": "indivision"
            }
          ],
          "conditions": [
            {
              "champ": "foy_situation",
              "portee": "client",
              "valeur": "pacse",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "foyer.regime_pacs"
        },
        {
          "code": "foy_date_pacs",
          "type": "date",
          "portee": "foyer",
          "repete": false,
          "libelle": "Date de PACS",
          "conditions": [
            {
              "champ": "foy_situation",
              "portee": "client",
              "valeur": "pacse",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "foyer.date_pacs"
        }
      ],
      "repete_source": "foyer.enfants"
    },
    {
      "code": "situation_pro",
      "ordre": 3,
      "repete": false,
      "libelle": "Situation professionnelle",
      "questions": [
        {
          "code": "pro_categorie",
          "type": "liste",
          "portee": "client",
          "repete": false,
          "libelle": "Catégorie professionnelle",
          "options": [
            {
              "label": "Salarié secteur privé",
              "value": "salarie_prive"
            },
            {
              "label": "Salarié secteur public",
              "value": "salarie_public"
            },
            {
              "label": "Fonctionnaire",
              "value": "fonctionnaire"
            },
            {
              "label": "Indépendant",
              "value": "independant"
            },
            {
              "label": "Travailleur non salarié (TNS)",
              "value": "tns"
            },
            {
              "label": "Dirigeant d'entreprise",
              "value": "dirigeant"
            },
            {
              "label": "Retraité",
              "value": "retraite"
            },
            {
              "label": "Sans activité",
              "value": "sans_activite"
            },
            {
              "label": "Autre",
              "value": "autre"
            }
          ],
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "situation_professionnelle.client.categorie"
        },
        {
          "code": "pro_profession",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Profession",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Ex : Médecin, Ingénieur, Commerçant…",
          "prefill_path": "situation_professionnelle.client.profession"
        },
        {
          "code": "pro_employeur",
          "type": "texte",
          "portee": "client",
          "repete": false,
          "libelle": "Employeur",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Nom de l'entreprise ou de l'administration",
          "prefill_path": "situation_professionnelle.client.employeur"
        },
        {
          "code": "pro_categorie",
          "type": "liste",
          "portee": "conjoint",
          "repete": false,
          "libelle": "Catégorie professionnelle du conjoint / partenaire",
          "options": [
            {
              "label": "Salarié secteur privé",
              "value": "salarie_prive"
            },
            {
              "label": "Salarié secteur public",
              "value": "salarie_public"
            },
            {
              "label": "Fonctionnaire",
              "value": "fonctionnaire"
            },
            {
              "label": "Indépendant",
              "value": "independant"
            },
            {
              "label": "Travailleur non salarié (TNS)",
              "value": "tns"
            },
            {
              "label": "Dirigeant d'entreprise",
              "value": "dirigeant"
            },
            {
              "label": "Retraité",
              "value": "retraite"
            },
            {
              "label": "Sans activité",
              "value": "sans_activite"
            },
            {
              "label": "Autre",
              "value": "autre"
            }
          ],
          "conditions": [
            {
              "champ": "perimetre",
              "valeur": "foyer",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "situation_professionnelle.conjoint.categorie"
        },
        {
          "code": "pro_profession",
          "type": "texte",
          "portee": "conjoint",
          "repete": false,
          "libelle": "Profession du conjoint / partenaire",
          "conditions": [
            {
              "champ": "perimetre",
              "valeur": "foyer",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "Ex : Comptable, Infirmière…",
          "prefill_path": "situation_professionnelle.conjoint.profession"
        },
        {
          "code": "pro_employeur",
          "type": "texte",
          "portee": "conjoint",
          "repete": false,
          "libelle": "Employeur du conjoint / partenaire",
          "conditions": [
            {
              "champ": "perimetre",
              "valeur": "foyer",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "Nom de l'entreprise ou de l'administration",
          "prefill_path": "situation_professionnelle.conjoint.employeur"
        }
      ]
    },
    {
      "code": "revenus",
      "ordre": 4,
      "repete": true,
      "libelle": "Revenus",
      "questions": [
        {
          "code": "rev_nature",
          "type": "liste",
          "portee": "foyer",
          "repete": true,
          "libelle": "Nature du revenu",
          "options": [
            {
              "label": "Salaires",
              "value": "salaire"
            },
            {
              "label": "Revenus TNS",
              "value": "tns"
            },
            {
              "label": "Revenus BIC",
              "value": "bic"
            },
            {
              "label": "Revenus BNC",
              "value": "bnc"
            },
            {
              "label": "Revenus BA",
              "value": "ba"
            },
            {
              "label": "Retraites",
              "value": "retraite"
            },
            {
              "label": "Revenus fonciers",
              "value": "fonciers"
            },
            {
              "label": "Revenus de capitaux mobiliers",
              "value": "capitaux_mobiliers"
            },
            {
              "label": "Dividendes",
              "value": "dividendes"
            },
            {
              "label": "Pension alimentaire reçue",
              "value": "pension_alimentaire_recue"
            },
            {
              "label": "Pension alimentaire versée",
              "value": "pension_alimentaire_versee"
            },
            {
              "label": "Autres",
              "value": "autre"
            }
          ],
          "conditions": [],
          "obligatoire": true,
          "prefill_path": "item.nature"
        },
        {
          "code": "rev_libelle",
          "type": "texte",
          "portee": "foyer",
          "repete": true,
          "libelle": "Nature du revenu",
          "conditions": [],
          "obligatoire": true,
          "placeholder": "Ex : Salaire net, Loyers, Dividendes, Pension…",
          "prefill_path": "item.libelle"
        },
        {
          "code": "rev_montant_annuel",
          "type": "nombre",
          "portee": "foyer",
          "repete": true,
          "libelle": "Montant annuel (€)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "item.montant_annuel"
        },
        {
          "code": "rev_nature_activite",
          "type": "texte",
          "portee": "foyer",
          "repete": true,
          "libelle": "Nature de l'activité",
          "conditions": [
            {
              "champ": "rev_nature",
              "portee": "foyer",
              "valeur": [
                "tns",
                "bic",
                "bnc",
                "ba"
              ],
              "operateur": "in"
            }
          ],
          "obligatoire": false,
          "placeholder": "Ex : Consultant, artisan, médecin libéral…",
          "prefill_path": "item.detail.nature_activite"
        },
        {
          "code": "rev_regime_fiscal",
          "type": "liste",
          "portee": "foyer",
          "repete": true,
          "libelle": "Régime fiscal",
          "options": [
            {
              "label": "Micro",
              "value": "micro"
            },
            {
              "label": "Réel",
              "value": "reel"
            }
          ],
          "conditions": [
            {
              "champ": "rev_nature",
              "portee": "foyer",
              "valeur": [
                "tns",
                "bic",
                "bnc",
                "ba",
                "fonciers"
              ],
              "operateur": "in"
            }
          ],
          "obligatoire": false,
          "prefill_path": "item.detail.regime_fiscal"
        },
        {
          "code": "rev_societe_distributrice",
          "type": "texte",
          "portee": "foyer",
          "repete": true,
          "libelle": "Société distributrice",
          "conditions": [
            {
              "champ": "rev_nature",
              "portee": "foyer",
              "valeur": "dividendes",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "Nom de la société",
          "prefill_path": "item.detail.societe"
        },
        {
          "code": "rev_nature_produit",
          "type": "texte",
          "portee": "foyer",
          "repete": true,
          "libelle": "Nature du produit",
          "conditions": [
            {
              "champ": "rev_nature",
              "portee": "foyer",
              "valeur": "capitaux_mobiliers",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "Ex : Obligations, compte à terme…",
          "prefill_path": "item.detail.nature_produit"
        },
        {
          "code": "rev_beneficiaire_debiteur",
          "type": "texte",
          "portee": "foyer",
          "repete": true,
          "libelle": "Bénéficiaire / débiteur",
          "conditions": [
            {
              "champ": "rev_nature",
              "portee": "foyer",
              "valeur": [
                "pension_alimentaire_recue",
                "pension_alimentaire_versee"
              ],
              "operateur": "in"
            }
          ],
          "obligatoire": false,
          "placeholder": "Ex : ex-conjoint, enfant…",
          "prefill_path": "item.detail.beneficiaire_debiteur"
        },
        {
          "code": "rev_organisme_payeur",
          "type": "texte",
          "portee": "foyer",
          "repete": true,
          "libelle": "Organisme payeur",
          "conditions": [
            {
              "champ": "rev_nature",
              "portee": "foyer",
              "valeur": "retraite",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "Ex : CARSAT, CNAV…",
          "prefill_path": "item.detail.organisme_payeur"
        },
        {
          "code": "rev_precision_autre",
          "type": "texte",
          "portee": "foyer",
          "repete": true,
          "libelle": "Précision",
          "conditions": [
            {
              "champ": "rev_nature",
              "portee": "foyer",
              "valeur": "autre",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "Préciser la nature de ce revenu",
          "prefill_path": "item.detail.precision"
        },
        {
          "code": "rev_supprime",
          "type": "booleen",
          "portee": "foyer",
          "repete": true,
          "libelle": "(technique — suppression d'instance)",
          "systeme": true,
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item._supprime"
        }
      ],
      "repete_source": "budget.revenus"
    },
    {
      "code": "charges",
      "ordre": 5,
      "repete": true,
      "libelle": "Charges courantes",
      "questions": [
        {
          "code": "chg_libelle",
          "type": "texte",
          "portee": "foyer",
          "repete": true,
          "libelle": "Nature de la charge",
          "conditions": [],
          "obligatoire": true,
          "placeholder": "Ex : Loyer, Assurance habitation, Frais de scolarité…",
          "prefill_path": "item.libelle"
        },
        {
          "code": "chg_montant_annuel",
          "type": "nombre",
          "portee": "foyer",
          "repete": true,
          "libelle": "Montant annuel (€)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "item.montant_annuel"
        },
        {
          "code": "chg_supprime",
          "type": "booleen",
          "portee": "foyer",
          "repete": true,
          "libelle": "(technique — suppression d'instance)",
          "systeme": true,
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item._supprime"
        }
      ],
      "repete_source": "budget.charges"
    },
    {
      "code": "actifs_financiers",
      "ordre": 6,
      "repete": true,
      "libelle": "Patrimoine financier",
      "questions": [
        {
          "code": "af_nature",
          "type": "liste",
          "portee": "client",
          "repete": true,
          "libelle": "Type de placement",
          "options": [
            {
              "value": "AV",
              "label": "Assurance-vie"
            },
            {
              "value": "PER",
              "label": "Plan d'épargne retraite (PER)"
            },
            {
              "value": "SCPI",
              "label": "SCPI"
            },
            {
              "value": "Capitalisation",
              "label": "Contrat de capitalisation"
            },
            {
              "value": "PEA",
              "label": "Plan d'épargne en actions (PEA)"
            },
            {
              "value": "CTO",
              "label": "Compte-titres ordinaire"
            },
            {
              "value": "Livret",
              "label": "Livret d'épargne (Livret A, LDDS, LEP, CEL, PEL...)"
            },
            {
              "value": "CompteCourant",
              "label": "Compte courant"
            },
            {
              "value": "PrivateEquity",
              "label": "Private Equity"
            },
            {
              "value": "Autre",
              "label": "Autre"
            }
          ],
          "conditions": [],
          "obligatoire": true,
          "prefill_path": "item.nature"
        },
        {
          "code": "af_libelle",
          "type": "texte",
          "portee": "client",
          "repete": true,
          "libelle": "Libellé / Nom du contrat ou du support",
          "conditions": [],
          "obligatoire": true,
          "placeholder": "Ex : Assurance-vie Predica, PER Generali…",
          "prefill_path": "item.libelle"
        },
        {
          "code": "af_montant",
          "type": "nombre",
          "portee": "client",
          "repete": true,
          "libelle": "Valeur estimée (€)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "item.montant"
        },
        {
          "code": "af_souscrit_par",
          "type": "liste",
          "portee": "client",
          "repete": true,
          "libelle": "Souscrit par",
          "options": [
            {
              "label": "Client",
              "value": "client"
            },
            {
              "label": "Conjoint",
              "value": "conjoint"
            },
            {
              "label": "Commun",
              "value": "commun"
            }
          ],
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.souscrit_par"
        },
        {
          "code": "af_date_souscription",
          "type": "date",
          "portee": "client",
          "repete": true,
          "libelle": "Date de souscription",
          "conditions": [
            {
              "champ": "af_nature",
              "operateur": "in",
              "valeur": [
                "AV",
                "PER",
                "SCPI",
                "Capitalisation",
                "PEA",
                "CTO",
                "PrivateEquity",
                "Autre"
              ],
              "portee": "client"
            }
          ],
          "obligatoire": false,
          "prefill_path": "item.date_souscription"
        },
        {
          "code": "af_mode_detention",
          "type": "liste",
          "portee": "client",
          "repete": true,
          "libelle": "Mode de détention",
          "options": [
            {
              "label": "Pleine propriété",
              "value": "pleine_propriete"
            },
            {
              "label": "Nue-propriété",
              "value": "nue_propriete"
            },
            {
              "label": "Usufruit",
              "value": "usufruit"
            }
          ],
          "conditions": [
            {
              "champ": "af_nature",
              "operateur": "in",
              "valeur": [
                "AV",
                "PER",
                "SCPI",
                "Capitalisation",
                "Autre"
              ],
              "portee": "client"
            }
          ],
          "obligatoire": false,
          "prefill_path": "item.detail.mode_detention"
        },
        {
          "code": "af_type_demembrement",
          "type": "liste",
          "portee": "client",
          "repete": true,
          "libelle": "Usufruit temporaire ou viager",
          "options": [
            {
              "label": "Viager",
              "value": "viager"
            },
            {
              "label": "Temporaire",
              "value": "temporaire"
            }
          ],
          "conditions": [
            {
              "champ": "af_mode_detention",
              "portee": "client",
              "valeur": "nue_propriete",
              "operateur": "="
            },
            {
              "champ": "af_nature",
              "operateur": "in",
              "valeur": [
                "AV",
                "PER",
                "SCPI",
                "Capitalisation",
                "Autre"
              ],
              "portee": "client"
            }
          ],
          "obligatoire": false,
          "prefill_path": "item.detail.type_demembrement"
        },
        {
          "code": "af_age_usufruitier",
          "type": "nombre",
          "portee": "client",
          "repete": true,
          "libelle": "Âge de l'usufruitier",
          "conditions": [
            {
              "champ": "af_mode_detention",
              "portee": "client",
              "valeur": "nue_propriete",
              "operateur": "="
            },
            {
              "champ": "af_nature",
              "operateur": "in",
              "valeur": [
                "AV",
                "PER",
                "SCPI",
                "Capitalisation",
                "Autre"
              ],
              "portee": "client"
            }
          ],
          "obligatoire": false,
          "prefill_path": "item.detail.age_usufruitier"
        },
        {
          "code": "af_date_demembrement",
          "type": "date",
          "portee": "client",
          "repete": true,
          "libelle": "Date de démembrement",
          "conditions": [
            {
              "champ": "af_mode_detention",
              "portee": "client",
              "valeur": "nue_propriete",
              "operateur": "="
            },
            {
              "champ": "af_nature",
              "operateur": "in",
              "valeur": [
                "AV",
                "PER",
                "SCPI",
                "Capitalisation",
                "Autre"
              ],
              "portee": "client"
            }
          ],
          "obligatoire": false,
          "prefill_path": "item.detail.date_demembrement"
        },
        {
          "code": "af_lien_usufruitier",
          "type": "texte",
          "portee": "client",
          "repete": true,
          "libelle": "Lien avec l'usufruitier",
          "conditions": [
            {
              "champ": "af_mode_detention",
              "portee": "client",
              "valeur": "nue_propriete",
              "operateur": "="
            },
            {
              "champ": "af_nature",
              "operateur": "in",
              "valeur": [
                "AV",
                "PER",
                "SCPI",
                "Capitalisation",
                "Autre"
              ],
              "portee": "client"
            }
          ],
          "obligatoire": false,
          "placeholder": "Ex : Parent, conjoint, enfant, autre personne physique, personne morale…",
          "prefill_path": "item.detail.lien_usufruitier"
        },
        {
          "code": "af_supprime",
          "type": "booleen",
          "portee": "client",
          "repete": true,
          "libelle": "(technique — suppression d'instance)",
          "systeme": true,
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item._supprime"
        }
      ],
      "repete_source": "patrimoine_financier"
    },
    {
      "code": "immobilier",
      "ordre": 7,
      "repete": true,
      "libelle": "Patrimoine immobilier",
      "questions": [
        {
          "code": "immo_nature",
          "type": "liste",
          "portee": "client",
          "repete": true,
          "libelle": "Type de bien",
          "options": [
            {
              "value": "RP",
              "label": "Résidence principale"
            },
            {
              "value": "RS",
              "label": "Résidence secondaire"
            },
            {
              "value": "LocatifNu",
              "label": "Locatif nu"
            },
            {
              "value": "LocatifMeuble",
              "label": "Locatif meublé"
            },
            {
              "value": "SCI",
              "label": "Parts de SCI"
            },
            {
              "value": "Terrain",
              "label": "Terrain"
            },
            {
              "value": "Autre",
              "label": "Autre"
            }
          ],
          "conditions": [],
          "obligatoire": true,
          "prefill_path": "item.nature"
        },
        {
          "code": "immo_valeur",
          "type": "nombre",
          "portee": "client",
          "repete": true,
          "libelle": "Valeur vénale estimée (€)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "item.valeur"
        },
        {
          "code": "immo_detenu_par",
          "type": "liste",
          "portee": "client",
          "repete": true,
          "libelle": "Détenu par",
          "options": [
            {
              "label": "Client",
              "value": "client"
            },
            {
              "label": "Conjoint",
              "value": "conjoint"
            },
            {
              "label": "Commun",
              "value": "commun"
            },
            {
              "label": "Via une SCI",
              "value": "SCI"
            }
          ],
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.detenu_par"
        },
        {
          "code": "immo_revenus_annuels",
          "type": "nombre",
          "portee": "client",
          "repete": true,
          "libelle": "Revenus locatifs annuels (€)",
          "conditions": [
            {
              "champ": "immo_nature",
              "operateur": "in",
              "valeur": [
                "LocatifNu",
                "LocatifMeuble",
                "SCI"
              ],
              "portee": "client"
            }
          ],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "item.revenus_annuels"
        },
        {
          "code": "immo_regime_fiscal_foncier",
          "libelle": "Régime fiscal (location nue)",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.regime_fiscal",
          "options": [
            {
              "value": "micro_foncier",
              "label": "Micro-foncier"
            },
            {
              "value": "reel",
              "label": "Réel"
            }
          ],
          "conditions": [
            {
              "champ": "immo_nature",
              "operateur": "in",
              "valeur": [
                "LocatifNu",
                "SCI"
              ],
              "portee": "client"
            }
          ]
        },
        {
          "code": "immo_regime_fiscal_meuble",
          "libelle": "Régime fiscal (location meublée)",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.regime_fiscal",
          "options": [
            {
              "value": "micro_bic",
              "label": "Micro-BIC"
            },
            {
              "value": "reel",
              "label": "Réel"
            }
          ],
          "conditions": [
            {
              "champ": "immo_nature",
              "operateur": "in",
              "valeur": [
                "LocatifMeuble"
              ],
              "portee": "client"
            }
          ]
        },
        {
          "code": "immo_type_bien",
          "type": "liste",
          "portee": "client",
          "repete": true,
          "libelle": "Catégorie du bien",
          "options": [
            {
              "label": "Appartement",
              "value": "appartement"
            },
            {
              "label": "Maison",
              "value": "maison"
            },
            {
              "label": "Terrain",
              "value": "terrain"
            },
            {
              "label": "Local commercial",
              "value": "local_commercial"
            },
            {
              "label": "Parking / Garage",
              "value": "parking"
            },
            {
              "label": "Parts de SCI",
              "value": "parts_sci"
            },
            {
              "label": "Autre",
              "value": "autre"
            }
          ],
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.detail.type_bien"
        },
        {
          "code": "immo_quote_part",
          "type": "nombre",
          "portee": "client",
          "repete": true,
          "libelle": "Quote-part détenue (%)",
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.quote_part_detenue"
        },
        {
          "code": "immo_date_acquisition",
          "type": "date",
          "portee": "client",
          "repete": true,
          "libelle": "Date d'acquisition",
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.date_acquisition"
        },
        {
          "code": "immo_mode_detention",
          "type": "liste",
          "portee": "client",
          "repete": true,
          "libelle": "Mode de détention",
          "options": [
            {
              "label": "Pleine propriété",
              "value": "pleine_propriete"
            },
            {
              "label": "Nue-propriété",
              "value": "nue_propriete"
            },
            {
              "label": "Usufruit",
              "value": "usufruit"
            }
          ],
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.detail.mode_detention"
        },
        {
          "code": "immo_type_demembrement",
          "type": "liste",
          "portee": "client",
          "repete": true,
          "libelle": "Usufruit temporaire ou viager",
          "options": [
            {
              "label": "Viager",
              "value": "viager"
            },
            {
              "label": "Temporaire",
              "value": "temporaire"
            }
          ],
          "conditions": [
            {
              "champ": "immo_mode_detention",
              "portee": "client",
              "valeur": "nue_propriete",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "item.detail.type_demembrement"
        },
        {
          "code": "immo_age_usufruitier",
          "type": "nombre",
          "portee": "client",
          "repete": true,
          "libelle": "Âge de l'usufruitier",
          "conditions": [
            {
              "champ": "immo_mode_detention",
              "portee": "client",
              "valeur": "nue_propriete",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "item.detail.age_usufruitier"
        },
        {
          "code": "immo_date_demembrement",
          "type": "date",
          "portee": "client",
          "repete": true,
          "libelle": "Date de démembrement",
          "conditions": [
            {
              "champ": "immo_mode_detention",
              "portee": "client",
              "valeur": "nue_propriete",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "item.detail.date_demembrement"
        },
        {
          "code": "immo_lien_usufruitier",
          "type": "texte",
          "portee": "client",
          "repete": true,
          "libelle": "Lien avec l'usufruitier",
          "conditions": [
            {
              "champ": "immo_mode_detention",
              "portee": "client",
              "valeur": "nue_propriete",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "placeholder": "Ex : Parent, conjoint, enfant, autre personne physique, personne morale…",
          "prefill_path": "item.detail.lien_usufruitier"
        },
        {
          "code": "immo_supprime",
          "type": "booleen",
          "portee": "client",
          "repete": true,
          "libelle": "(technique — suppression d'instance)",
          "systeme": true,
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item._supprime"
        }
      ],
      "repete_source": "patrimoine_immobilier"
    },
    {
      "code": "passifs",
      "ordre": 8,
      "repete": true,
      "libelle": "Crédits et dettes",
      "questions": [
        {
          "code": "passif_nature",
          "type": "liste",
          "portee": "foyer",
          "repete": true,
          "libelle": "Type de crédit",
          "options": [
            {
              "label": "Crédit immobilier",
              "value": "immobilier"
            },
            {
              "label": "Crédit à la consommation",
              "value": "consommation"
            },
            {
              "label": "Crédit professionnel",
              "value": "professionnel"
            },
            {
              "label": "Autre",
              "value": "autre"
            }
          ],
          "conditions": [],
          "obligatoire": true,
          "prefill_path": "item.nature"
        },
        {
          "code": "passif_banque",
          "type": "texte",
          "portee": "foyer",
          "repete": true,
          "libelle": "Établissement prêteur",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Nom de la banque",
          "prefill_path": "item.banque"
        },
        {
          "code": "passif_montant",
          "type": "nombre",
          "portee": "foyer",
          "repete": true,
          "libelle": "Capital emprunté (€)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "item.montant"
        },
        {
          "code": "passif_mensualite",
          "type": "nombre",
          "portee": "foyer",
          "repete": true,
          "libelle": "Mensualité (€)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "item.mensualite"
        },
        {
          "code": "passif_taux",
          "type": "nombre",
          "portee": "foyer",
          "repete": true,
          "libelle": "Taux d'intérêt (hors assurance)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Ex : 3.5",
          "prefill_path": "item.taux"
        },
        {
          "code": "passif_capital_restant_du",
          "type": "nombre",
          "portee": "foyer",
          "repete": true,
          "libelle": "Capital restant dû",
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.capital_restant_du"
        },
        {
          "code": "passif_quotite",
          "type": "nombre",
          "portee": "foyer",
          "repete": true,
          "libelle": "Quotité (%) — part revenant à chaque membre du foyer",
          "conditions": [
            {
              "champ": "perimetre",
              "valeur": "foyer",
              "operateur": "="
            }
          ],
          "obligatoire": false,
          "prefill_path": "item.detail.quotite"
        },
        {
          "code": "passif_supprime",
          "type": "booleen",
          "portee": "foyer",
          "repete": true,
          "libelle": "(technique — suppression d'instance)",
          "systeme": true,
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item._supprime"
        }
      ],
      "repete_source": "passifs"
    },
    {
      "code": "fiscalite",
      "ordre": 9,
      "repete": false,
      "libelle": "Situation fiscale",
      "questions": [
        {
          "code": "fisc_tranche_ir",
          "type": "liste",
          "portee": "foyer",
          "repete": false,
          "libelle": "Tranche marginale d'imposition (TMI)",
          "options": [
            {
              "label": "0 % — Non imposable",
              "value": "0"
            },
            {
              "label": "11 %",
              "value": "11"
            },
            {
              "label": "30 %",
              "value": "30"
            },
            {
              "label": "41 %",
              "value": "41"
            },
            {
              "label": "45 %",
              "value": "45"
            }
          ],
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "fiscalite.tranche_ir"
        },
        {
          "code": "fisc_revenu_fiscal",
          "type": "nombre",
          "portee": "foyer",
          "repete": false,
          "libelle": "Revenu fiscal de référence (€)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "fiscalite.revenu_fiscal"
        },
        {
          "code": "fisc_nombre_parts",
          "type": "nombre",
          "portee": "foyer",
          "repete": false,
          "libelle": "Nombre de parts fiscales",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Ex : 2, 2.5, 3",
          "prefill_path": "fiscalite.nombre_parts"
        },
        {
          "code": "fisc_ifi",
          "type": "nombre",
          "portee": "foyer",
          "repete": false,
          "libelle": "Impôt sur la Fortune Immobilière — IFI (€)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "fiscalite.ifi"
        },
        {
          "code": "fisc_option_bareme",
          "type": "liste",
          "portee": "foyer",
          "repete": false,
          "libelle": "Option barème progressif pour les revenus de capitaux mobiliers",
          "options": [
            {
              "label": "Oui",
              "value": "true"
            },
            {
              "label": "Non",
              "value": "false"
            },
            {
              "label": "Je ne sais pas",
              "value": ""
            }
          ],
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "fiscalite.option_bareme"
        },
        {
          "code": "fisc_dispositifs",
          "type": "multi_liste",
          "portee": "foyer",
          "repete": false,
          "libelle": "Dispositifs fiscaux en cours",
          "options": [
            {
              "label": "Pinel",
              "value": "Pinel"
            },
            {
              "label": "Pinel+",
              "value": "Pinel+"
            },
            {
              "label": "Malraux",
              "value": "Malraux"
            },
            {
              "label": "Monuments Historiques",
              "value": "Monuments Historiques"
            },
            {
              "label": "Girardin",
              "value": "Girardin"
            },
            {
              "label": "Denormandie",
              "value": "Denormandie"
            },
            {
              "label": "Déficit foncier",
              "value": "Déficit foncier"
            },
            {
              "label": "Location meublée professionnelle (LMP)",
              "value": "LMP"
            },
            {
              "label": "Location meublée non professionnelle (LMNP)",
              "value": "LMNP"
            },
            {
              "label": "Contrat Madelin",
              "value": "Madelin"
            },
            {
              "label": "PER (déductible)",
              "value": "PER (déductible)"
            },
            {
              "label": "Réduction IR-PME",
              "value": "IR-PME"
            },
            {
              "label": "Pacte Dutreil",
              "value": "Dutreil"
            },
            {
              "label": "SOFICA",
              "value": "SOFICA"
            },
            {
              "label": "Compte/Plan d'épargne logement (CEL/PEL)",
              "value": "CEL / PEL"
            },
            {
              "label": "Démembrement",
              "value": "Démembrement"
            },
            {
              "label": "Groupement forestier d'investissement (GFI)",
              "value": "GFI"
            }
          ],
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "fiscalite.dispositifs"
        }
      ]
    },
    {
      "code": "prevoyance",
      "ordre": 10,
      "repete": false,
      "libelle": "Prévoyance et protection",
      "questions": [
        {
          "code": "prev_testament",
          "type": "booleen",
          "portee": "client",
          "repete": false,
          "libelle": "Avez-vous rédigé un testament ?",
          "conditions": [
            {
              "champ": "foy_situation",
              "portee": "client",
              "valeur": "celibataire",
              "operateur": "!="
            }
          ],
          "obligatoire": false,
          "prefill_path": "prevoyance.testament"
        },
        {
          "code": "prev_droits_retraite",
          "type": "nombre",
          "portee": "client",
          "repete": false,
          "libelle": "Droits retraite estimés (€ / an)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "prevoyance.droits_retraite_estimes"
        },
        {
          "code": "prev_contrat_nature",
          "type": "liste",
          "portee": "client",
          "repete": true,
          "libelle": "Type de contrat de prévoyance",
          "options": [
            {
              "label": "Décès",
              "value": "deces"
            },
            {
              "label": "Incapacité de travail",
              "value": "incapacite"
            },
            {
              "label": "Invalidité",
              "value": "invalidite"
            },
            {
              "label": "Dépendance",
              "value": "dependance"
            },
            {
              "label": "Complémentaire santé",
              "value": "sante"
            },
            {
              "label": "Autre",
              "value": "autre"
            }
          ],
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.nature"
        },
        {
          "code": "prev_contrat_compagnie",
          "type": "texte",
          "portee": "client",
          "repete": true,
          "libelle": "Compagnie assureur",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "Nom de la compagnie",
          "prefill_path": "item.compagnie"
        },
        {
          "code": "prev_contrat_montant",
          "type": "nombre",
          "portee": "client",
          "repete": true,
          "libelle": "Capital assuré (€)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "item.montant"
        }
      ],
      "repete_source": "prevoyance.contrats"
    },
    {
      "code": "objectifs",
      "ordre": 11,
      "repete": true,
      "libelle": "Objectifs patrimoniaux",
      "questions": [
        {
          "code": "obj_libelle",
          "type": "texte",
          "portee": "client",
          "repete": true,
          "libelle": "Objectif patrimonial",
          "conditions": [],
          "obligatoire": true,
          "placeholder": "Ex : Préparer ma retraite, Financer les études des enfants…",
          "prefill_path": "item.libelle"
        },
        {
          "code": "obj_horizon",
          "type": "liste",
          "portee": "client",
          "repete": true,
          "libelle": "Horizon",
          "options": [
            {
              "label": "Court terme (moins de 3 ans)",
              "value": "court_terme"
            },
            {
              "label": "Moyen terme (3 à 8 ans)",
              "value": "moyen_terme"
            },
            {
              "label": "Long terme (plus de 8 ans)",
              "value": "long_terme"
            },
            {
              "label": "Horizon retraite",
              "value": "retraite"
            }
          ],
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item.horizon"
        },
        {
          "code": "obj_montant_cible",
          "type": "nombre",
          "portee": "client",
          "repete": true,
          "libelle": "Montant cible (€)",
          "conditions": [],
          "obligatoire": false,
          "placeholder": "0",
          "prefill_path": "item.montant_cible"
        },
        {
          "code": "obj_supprime",
          "type": "booleen",
          "portee": "client",
          "repete": true,
          "libelle": "(technique — suppression d'instance)",
          "systeme": true,
          "conditions": [],
          "obligatoire": false,
          "prefill_path": "item._supprime"
        }
      ],
      "repete_source": "objectifs"
    }
  ]
}
  $json$::jsonb,
  'publie',
  true,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
