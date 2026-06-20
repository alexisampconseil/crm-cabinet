-- =============================================================================
-- SEED : Questionnaire patrimonial v1.1 — AMP CONSEIL
-- =============================================================================
-- Version dérivée de v1.0 (c1a55000-0000-4000-8000-000000000001).
-- Seul changement : options de fisc_dispositifs alignées sur les libellés
-- métier du CRM (DISPOSITIFS_PRESETS, app/(conseiller)/clients/[id]/fiscalite/page.tsx) —
-- 17 valeurs verbatim au lieu de 8 slugs sous-ensemble.
-- categorie_professionnelle inchangée : déjà alignée avec le CRM (cf. famille/page.tsx).
--
-- Idempotence :
--   1. Désactive la version active courante (s'il y en a une).
--   2. Insère la nouvelle version 1.1, active.
--   ON CONFLICT (id) DO NOTHING sur l'insert — sans danger si rejoué.
-- =============================================================================

UPDATE questionnaire_versions SET actif = FALSE WHERE actif = TRUE;

INSERT INTO questionnaire_versions (
  id,
  version,
  libelle,
  description,
  version_schema,
  structure,
  statut,
  actif,
  date_publication,
  created_at,
  updated_at
)
VALUES (
  'c1a55000-0000-4000-8000-000000000002'::uuid,
  '1.1',
  'Bilan patrimonial initial v1.1',
  'Version 1.1 — alignement des dispositifs fiscaux sur les libellés métier du CRM (17 valeurs verbatim). Catégorie professionnelle déjà alignée depuis v1.0, inchangée.',
  '1.0',
  $json$
{
  "blocs": [
    {
      "code": "identite",
      "libelle": "Identité",
      "ordre": 1,
      "repete": false,
      "questions": [
        {
          "code": "id_nom",
          "libelle": "Nom",
          "type": "texte",
          "portee": "client",
          "obligatoire": true,
          "repete": false,
          "placeholder": "Nom de famille",
          "prefill_path": "identite.nom",
          "conditions": []
        },
        {
          "code": "id_prenom",
          "libelle": "Prénom",
          "type": "texte",
          "portee": "client",
          "obligatoire": true,
          "repete": false,
          "placeholder": "Prénom",
          "prefill_path": "identite.prenom",
          "conditions": []
        },
        {
          "code": "id_date_naissance",
          "libelle": "Date de naissance",
          "type": "date",
          "portee": "client",
          "obligatoire": true,
          "repete": false,
          "prefill_path": "identite.date_naissance",
          "conditions": []
        },
        {
          "code": "id_nationalite",
          "libelle": "Nationalité",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Ex : Française",
          "prefill_path": "identite.nationalite",
          "conditions": []
        },
        {
          "code": "id_pays_naissance",
          "libelle": "Pays de naissance",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Ex : France",
          "prefill_path": "identite.pays_naissance",
          "conditions": []
        },
        {
          "code": "id_adresse",
          "libelle": "Adresse",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Numéro et nom de rue",
          "prefill_path": "identite.adresse",
          "conditions": []
        },
        {
          "code": "id_code_postal",
          "libelle": "Code postal",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "placeholder": "75001",
          "prefill_path": "identite.code_postal",
          "conditions": []
        },
        {
          "code": "id_ville",
          "libelle": "Ville",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Paris",
          "prefill_path": "identite.ville",
          "conditions": []
        },
        {
          "code": "id_nom",
          "libelle": "Nom du conjoint / partenaire",
          "type": "texte",
          "portee": "conjoint",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Nom de famille",
          "prefill_path": "foyer.conjoint.nom",
          "conditions": [
            {
              "champ": "perimetre",
              "operateur": "=",
              "valeur": "foyer"
            }
          ]
        },
        {
          "code": "id_prenom",
          "libelle": "Prénom du conjoint / partenaire",
          "type": "texte",
          "portee": "conjoint",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Prénom",
          "prefill_path": "foyer.conjoint.prenom",
          "conditions": [
            {
              "champ": "perimetre",
              "operateur": "=",
              "valeur": "foyer"
            }
          ]
        },
        {
          "code": "id_pays_naissance",
          "libelle": "Pays de naissance du conjoint / partenaire",
          "type": "texte",
          "portee": "conjoint",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Ex : France",
          "prefill_path": "foyer.conjoint.pays_naissance",
          "conditions": [
            {
              "champ": "perimetre",
              "operateur": "=",
              "valeur": "foyer"
            }
          ]
        }
      ]
    },
    {
      "code": "foyer",
      "libelle": "Situation familiale",
      "ordre": 2,
      "repete": false,
      "repete_source": "foyer.enfants",
      "questions": [
        {
          "code": "foy_situation",
          "libelle": "Situation familiale",
          "type": "liste",
          "portee": "client",
          "obligatoire": true,
          "repete": false,
          "prefill_path": "foyer.situation",
          "options": [
            "celibataire",
            "marie",
            "pacse",
            "concubinage",
            "divorce",
            "veuf"
          ],
          "conditions": []
        },
        {
          "code": "foy_regime_matrimonial",
          "libelle": "Régime matrimonial",
          "type": "liste",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "foyer.regime_matrimonial",
          "options": [
            "communaute_reduite",
            "separation_biens",
            "participation_acquets",
            "communaute_universelle",
            "NA"
          ],
          "conditions": [
            {
              "champ": "foy_situation",
              "operateur": "=",
              "valeur": "marie"
            }
          ]
        },
        {
          "code": "foy_enfant_prenom",
          "libelle": "Prénom de l'enfant",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": true,
          "repete": true,
          "placeholder": "Prénom",
          "prefill_path": "item.prenom",
          "conditions": []
        },
        {
          "code": "foy_enfant_nom",
          "libelle": "Nom de l'enfant",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Nom de famille",
          "prefill_path": "item.nom",
          "conditions": []
        },
        {
          "code": "foy_enfant_date_naissance",
          "libelle": "Date de naissance",
          "type": "date",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.date_naissance",
          "conditions": []
        },
        {
          "code": "foy_enfant_a_charge",
          "libelle": "Fiscalement à charge",
          "type": "booleen",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.a_charge",
          "conditions": []
        },
        {
          "code": "foy_enfant_filiation",
          "libelle": "Filiation",
          "type": "liste",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.filiation",
          "options": [
            "commun",
            "client",
            "conjoint",
            "adoption"
          ],
          "conditions": []
        }
      ]
    },
    {
      "code": "situation_pro",
      "libelle": "Situation professionnelle",
      "ordre": 3,
      "repete": false,
      "questions": [
        {
          "code": "pro_categorie",
          "libelle": "Catégorie professionnelle",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "situation_professionnelle.client.categorie",
          "options": [
            "salarie_prive",
            "salarie_public",
            "fonctionnaire",
            "independant",
            "tns",
            "dirigeant",
            "retraite",
            "sans_activite",
            "autre"
          ],
          "conditions": []
        },
        {
          "code": "pro_profession",
          "libelle": "Profession",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Ex : Médecin, Ingénieur, Commerçant…",
          "prefill_path": "situation_professionnelle.client.profession",
          "conditions": []
        },
        {
          "code": "pro_employeur",
          "libelle": "Employeur",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Nom de l'entreprise ou de l'administration",
          "prefill_path": "situation_professionnelle.client.employeur",
          "conditions": []
        },
        {
          "code": "pro_categorie",
          "libelle": "Catégorie professionnelle du conjoint / partenaire",
          "type": "liste",
          "portee": "conjoint",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "situation_professionnelle.conjoint.categorie",
          "options": [
            "salarie_prive",
            "salarie_public",
            "fonctionnaire",
            "independant",
            "tns",
            "dirigeant",
            "retraite",
            "sans_activite",
            "autre"
          ],
          "conditions": [
            {
              "champ": "perimetre",
              "operateur": "=",
              "valeur": "foyer"
            }
          ]
        },
        {
          "code": "pro_profession",
          "libelle": "Profession du conjoint / partenaire",
          "type": "texte",
          "portee": "conjoint",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Ex : Comptable, Infirmière…",
          "prefill_path": "situation_professionnelle.conjoint.profession",
          "conditions": [
            {
              "champ": "perimetre",
              "operateur": "=",
              "valeur": "foyer"
            }
          ]
        },
        {
          "code": "pro_employeur",
          "libelle": "Employeur du conjoint / partenaire",
          "type": "texte",
          "portee": "conjoint",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Nom de l'entreprise ou de l'administration",
          "prefill_path": "situation_professionnelle.conjoint.employeur",
          "conditions": [
            {
              "champ": "perimetre",
              "operateur": "=",
              "valeur": "foyer"
            }
          ]
        }
      ]
    },
    {
      "code": "revenus",
      "libelle": "Revenus",
      "ordre": 4,
      "repete": true,
      "repete_source": "budget.revenus",
      "questions": [
        {
          "code": "rev_libelle",
          "libelle": "Nature du revenu",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": true,
          "repete": true,
          "placeholder": "Ex : Salaire net, Loyers, Dividendes, Pension…",
          "prefill_path": "item.libelle",
          "conditions": []
        },
        {
          "code": "rev_montant_annuel",
          "libelle": "Montant annuel (€)",
          "type": "nombre",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "0",
          "prefill_path": "item.montant_annuel",
          "conditions": []
        }
      ]
    },
    {
      "code": "charges",
      "libelle": "Charges courantes",
      "ordre": 5,
      "repete": true,
      "repete_source": "budget.charges",
      "questions": [
        {
          "code": "chg_libelle",
          "libelle": "Nature de la charge",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": true,
          "repete": true,
          "placeholder": "Ex : Loyer, Assurance habitation, Frais de scolarité…",
          "prefill_path": "item.libelle",
          "conditions": []
        },
        {
          "code": "chg_montant_annuel",
          "libelle": "Montant annuel (€)",
          "type": "nombre",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "0",
          "prefill_path": "item.montant_annuel",
          "conditions": []
        }
      ]
    },
    {
      "code": "actifs_financiers",
      "libelle": "Patrimoine financier",
      "ordre": 6,
      "repete": true,
      "repete_source": "patrimoine_financier",
      "questions": [
        {
          "code": "af_nature",
          "libelle": "Type de placement",
          "type": "liste",
          "portee": "client",
          "obligatoire": true,
          "repete": true,
          "prefill_path": "item.nature",
          "options": [
            "AV",
            "PER",
            "SCPI",
            "Capitalisation",
            "PEA",
            "CTO",
            "Livret",
            "Autre"
          ],
          "conditions": []
        },
        {
          "code": "af_libelle",
          "libelle": "Libellé / Nom du contrat ou du support",
          "type": "texte",
          "portee": "client",
          "obligatoire": true,
          "repete": true,
          "placeholder": "Ex : Assurance-vie Predica, PER Generali…",
          "prefill_path": "item.libelle",
          "conditions": []
        },
        {
          "code": "af_montant",
          "libelle": "Valeur estimée (€)",
          "type": "nombre",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "placeholder": "0",
          "prefill_path": "item.montant",
          "conditions": []
        },
        {
          "code": "af_souscrit_par",
          "libelle": "Souscrit par",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.souscrit_par",
          "options": [
            "client",
            "conjoint",
            "commun"
          ],
          "conditions": []
        },
        {
          "code": "af_date_souscription",
          "libelle": "Date de souscription",
          "type": "date",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.date_souscription",
          "conditions": []
        }
      ]
    },
    {
      "code": "immobilier",
      "libelle": "Patrimoine immobilier",
      "ordre": 7,
      "repete": true,
      "repete_source": "patrimoine_immobilier",
      "questions": [
        {
          "code": "immo_nature",
          "libelle": "Type de bien",
          "type": "liste",
          "portee": "client",
          "obligatoire": true,
          "repete": true,
          "prefill_path": "item.nature",
          "options": [
            "RP",
            "RS",
            "Locatif",
            "SCI",
            "Autre"
          ],
          "conditions": []
        },
        {
          "code": "immo_valeur",
          "libelle": "Valeur vénale estimée (€)",
          "type": "nombre",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "placeholder": "0",
          "prefill_path": "item.valeur",
          "conditions": []
        },
        {
          "code": "immo_detenu_par",
          "libelle": "Détenu par",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detenu_par",
          "options": [
            "client",
            "conjoint",
            "commun",
            "SCI"
          ],
          "conditions": []
        },
        {
          "code": "immo_revenus_annuels",
          "libelle": "Revenus locatifs annuels (€)",
          "type": "nombre",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "placeholder": "0",
          "prefill_path": "item.revenus_annuels",
          "conditions": []
        }
      ]
    },
    {
      "code": "passifs",
      "libelle": "Crédits et dettes",
      "ordre": 8,
      "repete": true,
      "repete_source": "passifs",
      "questions": [
        {
          "code": "passif_nature",
          "libelle": "Type de crédit",
          "type": "liste",
          "portee": "foyer",
          "obligatoire": true,
          "repete": true,
          "prefill_path": "item.nature",
          "options": [
            "immobilier",
            "consommation",
            "professionnel",
            "autre"
          ],
          "conditions": []
        },
        {
          "code": "passif_banque",
          "libelle": "Établissement prêteur",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Nom de la banque",
          "prefill_path": "item.banque",
          "conditions": []
        },
        {
          "code": "passif_montant",
          "libelle": "Capital restant dû (€)",
          "type": "nombre",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "0",
          "prefill_path": "item.montant",
          "conditions": []
        },
        {
          "code": "passif_mensualite",
          "libelle": "Mensualité (€)",
          "type": "nombre",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "0",
          "prefill_path": "item.mensualite",
          "conditions": []
        },
        {
          "code": "passif_taux",
          "libelle": "Taux d'intérêt (%)",
          "type": "nombre",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Ex : 3.5",
          "prefill_path": "item.taux",
          "conditions": []
        }
      ]
    },
    {
      "code": "fiscalite",
      "libelle": "Situation fiscale",
      "ordre": 9,
      "repete": false,
      "questions": [
        {
          "code": "fisc_tranche_ir",
          "libelle": "Tranche marginale d'imposition (TMI)",
          "type": "liste",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "fiscalite.tranche_ir",
          "options": [
            "0",
            "11",
            "30",
            "41",
            "45"
          ],
          "conditions": []
        },
        {
          "code": "fisc_revenu_fiscal",
          "libelle": "Revenu fiscal de référence (€)",
          "type": "nombre",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "placeholder": "0",
          "prefill_path": "fiscalite.revenu_fiscal",
          "conditions": []
        },
        {
          "code": "fisc_nombre_parts",
          "libelle": "Nombre de parts fiscales",
          "type": "nombre",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Ex : 2, 2.5, 3",
          "prefill_path": "fiscalite.nombre_parts",
          "conditions": []
        },
        {
          "code": "fisc_ifi",
          "libelle": "Impôt sur la Fortune Immobilière — IFI (€)",
          "type": "nombre",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "placeholder": "0",
          "prefill_path": "fiscalite.ifi",
          "conditions": []
        },
        {
          "code": "fisc_option_bareme",
          "libelle": "Option barème progressif pour les revenus de capitaux mobiliers",
          "type": "booleen",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "fiscalite.option_bareme",
          "conditions": []
        },
        {
          "code": "fisc_dispositifs",
          "libelle": "Dispositifs fiscaux en cours",
          "type": "multi_liste",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "fiscalite.dispositifs",
          "options": [
            "Pinel",
            "Pinel+",
            "Malraux",
            "Monuments Historiques",
            "Girardin",
            "Denormandie",
            "Déficit foncier",
            "LMP",
            "LMNP",
            "Madelin",
            "PER (déductible)",
            "IR-PME",
            "Dutreil",
            "SOFICA",
            "CEL / PEL",
            "Démembrement",
            "GFI"
          ],
          "conditions": []
        }
      ]
    },
    {
      "code": "prevoyance",
      "libelle": "Prévoyance et protection",
      "ordre": 10,
      "repete": false,
      "repete_source": "prevoyance.contrats",
      "questions": [
        {
          "code": "prev_testament",
          "libelle": "Avez-vous rédigé un testament ?",
          "type": "booleen",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "prevoyance.testament",
          "conditions": []
        },
        {
          "code": "prev_droits_retraite",
          "libelle": "Droits retraite estimés (€ / an)",
          "type": "nombre",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "placeholder": "0",
          "prefill_path": "prevoyance.droits_retraite_estimes",
          "conditions": []
        },
        {
          "code": "prev_contrat_nature",
          "libelle": "Type de contrat de prévoyance",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.nature",
          "options": [
            "deces",
            "incapacite",
            "invalidite",
            "dependance",
            "sante",
            "autre"
          ],
          "conditions": []
        },
        {
          "code": "prev_contrat_compagnie",
          "libelle": "Compagnie assureur",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Nom de la compagnie",
          "prefill_path": "item.compagnie",
          "conditions": []
        },
        {
          "code": "prev_contrat_montant",
          "libelle": "Capital assuré (€)",
          "type": "nombre",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "placeholder": "0",
          "prefill_path": "item.montant",
          "conditions": []
        }
      ]
    },
    {
      "code": "objectifs",
      "libelle": "Objectifs patrimoniaux",
      "ordre": 11,
      "repete": true,
      "repete_source": "objectifs",
      "questions": [
        {
          "code": "obj_libelle",
          "libelle": "Objectif patrimonial",
          "type": "texte",
          "portee": "client",
          "obligatoire": true,
          "repete": true,
          "placeholder": "Ex : Préparer ma retraite, Financer les études des enfants…",
          "prefill_path": "item.libelle",
          "conditions": []
        },
        {
          "code": "obj_horizon",
          "libelle": "Horizon",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.horizon",
          "options": [
            "court_terme",
            "moyen_terme",
            "long_terme",
            "retraite"
          ],
          "conditions": []
        },
        {
          "code": "obj_montant_cible",
          "libelle": "Montant cible (€)",
          "type": "nombre",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "placeholder": "0",
          "prefill_path": "item.montant_cible",
          "conditions": []
        }
      ]
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
