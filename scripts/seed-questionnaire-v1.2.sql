-- =============================================================================
-- SEED : Questionnaire patrimonial v1.2 — AMP CONSEIL
-- =============================================================================
-- Version dérivée de v1.1 (c1a55000-0000-4000-8000-000000000002).
-- Changements :
--   - Toutes les options de liste/multi_liste passent de string[] à
--     {value,label}[] — libellés explicites (plus d'acronymes bruts type AV/CTO/RP).
--   - Identité : email, téléphone, lieu de naissance (client).
--   - Foyer : coordonnées conjoint (email, téléphone, lieu de naissance),
--     situation familiale étendue (date de mariage, contrat de mariage + date,
--     donation au dernier vivant, régime et date de PACS), régime matrimonial
--     'NA' renommé 'autre' (alignement CRM famille/page.tsx), testament étendu
--     à toute situation sauf célibataire.
--   - Revenus : catégorisation complète (12 natures) + sous-questions
--     conditionnelles par catégorie (employeur, régime fiscal, société
--     distributrice, etc.) — nécessite budget_postes.nature + detail (migration 015).
--   - Actifs financiers / Immobilier : mode de détention (PP/NP/USU), type de
--     démembrement, âge usufruitier, date de démembrement, lien avec
--     l'usufruitier — stockés dans detail JSONB (aucune migration).
--   - Immobilier : catégorie physique du bien, quote-part détenue, date
--     d'acquisition (migration 015).
--   - Passifs : capital restant dû (migration 015), quotité par membre du
--     foyer (detail JSONB), libellé taux clarifié (hors assurance).
--
-- Dépend de : migration 015_questionnaire_v1_2_referentiel.sql (doit être
-- appliquée avant publication — sinon les écarts sur les nouveaux champs
-- échoueront à l'application au référentiel).
--
-- Idempotence :
--   1. Désactive la version active courante (v1.1).
--   2. Insère la nouvelle version 1.2, active.
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
  'c1a55000-0000-4000-8000-000000000003'::uuid,
  '1.2',
  'Bilan patrimonial initial v1.2',
  'Version 1.2 — libellés explicites, coordonnées client/conjoint, situation familiale étendue, catégorisation des revenus avec sous-questions conditionnelles, démembrement actifs/immobilier, quote-part et acquisition immobilier, capital restant dû et quotité passifs.',
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
        },
        {
          "code": "id_email",
          "libelle": "Email",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "placeholder": "exemple@email.fr",
          "prefill_path": "identite.email",
          "conditions": []
        },
        {
          "code": "id_telephone",
          "libelle": "Téléphone",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "placeholder": "06 12 34 56 78",
          "prefill_path": "identite.telephone",
          "conditions": []
        },
        {
          "code": "id_lieu_naissance",
          "libelle": "Lieu de naissance (ville)",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Ex : Lyon",
          "prefill_path": "identite.lieu_naissance",
          "conditions": []
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
            {
              "value": "celibataire",
              "label": "Célibataire"
            },
            {
              "value": "marie",
              "label": "Marié(e)"
            },
            {
              "value": "pacse",
              "label": "Pacsé(e)"
            },
            {
              "value": "concubinage",
              "label": "Concubinage"
            },
            {
              "value": "divorce",
              "label": "Divorcé(e)"
            },
            {
              "value": "veuf",
              "label": "Veuf / Veuve"
            }
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
            {
              "value": "communaute_reduite",
              "label": "Communauté réduite aux acquêts"
            },
            {
              "value": "separation_biens",
              "label": "Séparation de biens"
            },
            {
              "value": "participation_acquets",
              "label": "Participation aux acquêts"
            },
            {
              "value": "communaute_universelle",
              "label": "Communauté universelle"
            },
            {
              "value": "autre",
              "label": "Autre"
            }
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
            {
              "value": "commun",
              "label": "Enfant commun"
            },
            {
              "value": "client",
              "label": "Enfant du client"
            },
            {
              "value": "conjoint",
              "label": "Enfant du conjoint"
            },
            {
              "value": "adoption",
              "label": "Enfant adopté"
            }
          ],
          "conditions": []
        },
        {
          "code": "foy_lieu_naissance",
          "libelle": "Lieu de naissance du conjoint / partenaire (ville)",
          "type": "texte",
          "portee": "conjoint",
          "obligatoire": false,
          "repete": false,
          "placeholder": "Ex : Lyon",
          "prefill_path": "foyer.conjoint.lieu_naissance",
          "conditions": [
            {
              "champ": "perimetre",
              "operateur": "=",
              "valeur": "foyer"
            }
          ]
        },
        {
          "code": "foy_conjoint_email",
          "libelle": "Email du conjoint / partenaire",
          "type": "texte",
          "portee": "conjoint",
          "obligatoire": false,
          "repete": false,
          "placeholder": "exemple@email.fr",
          "prefill_path": "foyer.conjoint.email",
          "conditions": [
            {
              "champ": "perimetre",
              "operateur": "=",
              "valeur": "foyer"
            }
          ]
        },
        {
          "code": "foy_conjoint_telephone",
          "libelle": "Téléphone du conjoint / partenaire",
          "type": "texte",
          "portee": "conjoint",
          "obligatoire": false,
          "repete": false,
          "placeholder": "06 12 34 56 78",
          "prefill_path": "foyer.conjoint.telephone",
          "conditions": [
            {
              "champ": "perimetre",
              "operateur": "=",
              "valeur": "foyer"
            }
          ]
        },
        {
          "code": "foy_date_mariage",
          "libelle": "Date de mariage",
          "type": "date",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "foyer.date_mariage",
          "conditions": [
            {
              "champ": "foy_situation",
              "operateur": "=",
              "valeur": "marie",
              "portee": "client"
            }
          ]
        },
        {
          "code": "foy_contrat_mariage",
          "libelle": "Contrat de mariage",
          "type": "booleen",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "foyer.contrat_mariage",
          "conditions": [
            {
              "champ": "foy_situation",
              "operateur": "=",
              "valeur": "marie",
              "portee": "client"
            }
          ]
        },
        {
          "code": "foy_date_contrat_mariage",
          "libelle": "Date du contrat de mariage",
          "type": "date",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "foyer.date_contrat_mariage",
          "conditions": [
            {
              "champ": "foy_contrat_mariage",
              "operateur": "=",
              "valeur": true,
              "portee": "foyer"
            }
          ]
        },
        {
          "code": "foy_donation_dernier_vivant",
          "libelle": "Donation au dernier vivant",
          "type": "booleen",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "foyer.donation_dernier_vivant",
          "conditions": [
            {
              "champ": "foy_situation",
              "operateur": "=",
              "valeur": "marie",
              "portee": "client"
            }
          ]
        },
        {
          "code": "foy_regime_pacs",
          "libelle": "Régime du PACS",
          "type": "liste",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "foyer.regime_pacs",
          "options": [
            {
              "value": "separation_biens",
              "label": "Séparation de biens"
            },
            {
              "value": "indivision",
              "label": "Indivision"
            },
            {
              "value": "autre",
              "label": "Autre"
            }
          ],
          "conditions": [
            {
              "champ": "foy_situation",
              "operateur": "=",
              "valeur": "pacse",
              "portee": "client"
            }
          ]
        },
        {
          "code": "foy_date_pacs",
          "libelle": "Date de PACS",
          "type": "date",
          "portee": "foyer",
          "obligatoire": false,
          "repete": false,
          "prefill_path": "foyer.date_pacs",
          "conditions": [
            {
              "champ": "foy_situation",
              "operateur": "=",
              "valeur": "pacse",
              "portee": "client"
            }
          ]
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
            {
              "value": "salarie_prive",
              "label": "Salarié secteur privé"
            },
            {
              "value": "salarie_public",
              "label": "Salarié secteur public"
            },
            {
              "value": "fonctionnaire",
              "label": "Fonctionnaire"
            },
            {
              "value": "independant",
              "label": "Indépendant"
            },
            {
              "value": "tns",
              "label": "Travailleur non salarié (TNS)"
            },
            {
              "value": "dirigeant",
              "label": "Dirigeant d'entreprise"
            },
            {
              "value": "retraite",
              "label": "Retraité"
            },
            {
              "value": "sans_activite",
              "label": "Sans activité"
            },
            {
              "value": "autre",
              "label": "Autre"
            }
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
            {
              "value": "salarie_prive",
              "label": "Salarié secteur privé"
            },
            {
              "value": "salarie_public",
              "label": "Salarié secteur public"
            },
            {
              "value": "fonctionnaire",
              "label": "Fonctionnaire"
            },
            {
              "value": "independant",
              "label": "Indépendant"
            },
            {
              "value": "tns",
              "label": "Travailleur non salarié (TNS)"
            },
            {
              "value": "dirigeant",
              "label": "Dirigeant d'entreprise"
            },
            {
              "value": "retraite",
              "label": "Retraité"
            },
            {
              "value": "sans_activite",
              "label": "Sans activité"
            },
            {
              "value": "autre",
              "label": "Autre"
            }
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
          "code": "rev_nature",
          "libelle": "Nature du revenu",
          "type": "liste",
          "portee": "foyer",
          "obligatoire": true,
          "repete": true,
          "prefill_path": "item.nature",
          "options": [
            {
              "value": "salaire",
              "label": "Salaires"
            },
            {
              "value": "tns",
              "label": "Revenus TNS"
            },
            {
              "value": "bic",
              "label": "Revenus BIC"
            },
            {
              "value": "bnc",
              "label": "Revenus BNC"
            },
            {
              "value": "ba",
              "label": "Revenus BA"
            },
            {
              "value": "retraite",
              "label": "Retraites"
            },
            {
              "value": "fonciers",
              "label": "Revenus fonciers"
            },
            {
              "value": "capitaux_mobiliers",
              "label": "Revenus de capitaux mobiliers"
            },
            {
              "value": "dividendes",
              "label": "Dividendes"
            },
            {
              "value": "pension_alimentaire_recue",
              "label": "Pension alimentaire reçue"
            },
            {
              "value": "pension_alimentaire_versee",
              "label": "Pension alimentaire versée"
            },
            {
              "value": "autre",
              "label": "Autres"
            }
          ],
          "conditions": []
        },
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
        },
        {
          "code": "rev_employeur",
          "libelle": "Employeur",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Nom de l'employeur",
          "prefill_path": "item.detail.employeur",
          "conditions": [
            {
              "champ": "rev_nature",
              "operateur": "=",
              "valeur": "salaire",
              "portee": "foyer"
            }
          ]
        },
        {
          "code": "rev_nature_activite",
          "libelle": "Nature de l'activité",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Ex : Consultant, artisan, médecin libéral…",
          "prefill_path": "item.detail.nature_activite",
          "conditions": [
            {
              "champ": "rev_nature",
              "operateur": "in",
              "valeur": [
                "tns",
                "bic",
                "bnc",
                "ba"
              ],
              "portee": "foyer"
            }
          ]
        },
        {
          "code": "rev_regime_fiscal",
          "libelle": "Régime fiscal",
          "type": "liste",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.regime_fiscal",
          "options": [
            {
              "value": "micro",
              "label": "Micro"
            },
            {
              "value": "reel",
              "label": "Réel"
            }
          ],
          "conditions": [
            {
              "champ": "rev_nature",
              "operateur": "in",
              "valeur": [
                "tns",
                "bic",
                "bnc",
                "ba",
                "fonciers"
              ],
              "portee": "foyer"
            }
          ]
        },
        {
          "code": "rev_societe_distributrice",
          "libelle": "Société distributrice",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Nom de la société",
          "prefill_path": "item.detail.societe",
          "conditions": [
            {
              "champ": "rev_nature",
              "operateur": "=",
              "valeur": "dividendes",
              "portee": "foyer"
            }
          ]
        },
        {
          "code": "rev_nature_produit",
          "libelle": "Nature du produit",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Ex : Obligations, compte à terme…",
          "prefill_path": "item.detail.nature_produit",
          "conditions": [
            {
              "champ": "rev_nature",
              "operateur": "=",
              "valeur": "capitaux_mobiliers",
              "portee": "foyer"
            }
          ]
        },
        {
          "code": "rev_beneficiaire_debiteur",
          "libelle": "Bénéficiaire / débiteur",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Ex : ex-conjoint, enfant…",
          "prefill_path": "item.detail.beneficiaire_debiteur",
          "conditions": [
            {
              "champ": "rev_nature",
              "operateur": "in",
              "valeur": [
                "pension_alimentaire_recue",
                "pension_alimentaire_versee"
              ],
              "portee": "foyer"
            }
          ]
        },
        {
          "code": "rev_organisme_payeur",
          "libelle": "Organisme payeur",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Ex : CARSAT, CNAV…",
          "prefill_path": "item.detail.organisme_payeur",
          "conditions": [
            {
              "champ": "rev_nature",
              "operateur": "=",
              "valeur": "retraite",
              "portee": "foyer"
            }
          ]
        },
        {
          "code": "rev_precision_autre",
          "libelle": "Précision",
          "type": "texte",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Préciser la nature de ce revenu",
          "prefill_path": "item.detail.precision",
          "conditions": [
            {
              "champ": "rev_nature",
              "operateur": "=",
              "valeur": "autre",
              "portee": "foyer"
            }
          ]
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
              "label": "Livret d'épargne"
            },
            {
              "value": "Autre",
              "label": "Autre"
            }
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
            {
              "value": "client",
              "label": "Client"
            },
            {
              "value": "conjoint",
              "label": "Conjoint"
            },
            {
              "value": "commun",
              "label": "Commun"
            }
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
        },
        {
          "code": "af_mode_detention",
          "libelle": "Mode de détention",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.mode_detention",
          "options": [
            {
              "value": "pleine_propriete",
              "label": "Pleine propriété"
            },
            {
              "value": "nue_propriete",
              "label": "Nue-propriété"
            },
            {
              "value": "usufruit",
              "label": "Usufruit"
            }
          ],
          "conditions": []
        },
        {
          "code": "af_type_demembrement",
          "libelle": "Usufruit temporaire ou viager",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.type_demembrement",
          "options": [
            {
              "value": "viager",
              "label": "Viager"
            },
            {
              "value": "temporaire",
              "label": "Temporaire"
            }
          ],
          "conditions": [
            {
              "champ": "af_mode_detention",
              "operateur": "=",
              "valeur": "nue_propriete",
              "portee": "client"
            }
          ]
        },
        {
          "code": "af_age_usufruitier",
          "libelle": "Âge de l'usufruitier",
          "type": "nombre",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.age_usufruitier",
          "conditions": [
            {
              "champ": "af_mode_detention",
              "operateur": "=",
              "valeur": "nue_propriete",
              "portee": "client"
            }
          ]
        },
        {
          "code": "af_date_demembrement",
          "libelle": "Date de démembrement",
          "type": "date",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.date_demembrement",
          "conditions": [
            {
              "champ": "af_mode_detention",
              "operateur": "=",
              "valeur": "nue_propriete",
              "portee": "client"
            }
          ]
        },
        {
          "code": "af_lien_usufruitier",
          "libelle": "Lien avec l'usufruitier",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Ex : Parent, conjoint, enfant, autre personne physique, personne morale…",
          "prefill_path": "item.detail.lien_usufruitier",
          "conditions": [
            {
              "champ": "af_mode_detention",
              "operateur": "=",
              "valeur": "nue_propriete",
              "portee": "client"
            }
          ]
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
            {
              "value": "RP",
              "label": "Résidence principale"
            },
            {
              "value": "RS",
              "label": "Résidence secondaire"
            },
            {
              "value": "Locatif",
              "label": "Bien locatif"
            },
            {
              "value": "SCI",
              "label": "Parts de SCI"
            },
            {
              "value": "Autre",
              "label": "Autre"
            }
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
            {
              "value": "client",
              "label": "Client"
            },
            {
              "value": "conjoint",
              "label": "Conjoint"
            },
            {
              "value": "commun",
              "label": "Commun"
            },
            {
              "value": "SCI",
              "label": "Via une SCI"
            }
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
        },
        {
          "code": "immo_type_bien",
          "libelle": "Catégorie du bien",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.type_bien",
          "options": [
            {
              "value": "appartement",
              "label": "Appartement"
            },
            {
              "value": "maison",
              "label": "Maison"
            },
            {
              "value": "terrain",
              "label": "Terrain"
            },
            {
              "value": "local_commercial",
              "label": "Local commercial"
            },
            {
              "value": "parking",
              "label": "Parking / Garage"
            },
            {
              "value": "parts_sci",
              "label": "Parts de SCI"
            },
            {
              "value": "autre",
              "label": "Autre"
            }
          ],
          "conditions": []
        },
        {
          "code": "immo_quote_part",
          "libelle": "Quote-part détenue (%)",
          "type": "nombre",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.quote_part_detenue",
          "conditions": []
        },
        {
          "code": "immo_date_acquisition",
          "libelle": "Date d'acquisition",
          "type": "date",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.date_acquisition",
          "conditions": []
        },
        {
          "code": "immo_mode_detention",
          "libelle": "Mode de détention",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.mode_detention",
          "options": [
            {
              "value": "pleine_propriete",
              "label": "Pleine propriété"
            },
            {
              "value": "nue_propriete",
              "label": "Nue-propriété"
            },
            {
              "value": "usufruit",
              "label": "Usufruit"
            }
          ],
          "conditions": []
        },
        {
          "code": "immo_type_demembrement",
          "libelle": "Usufruit temporaire ou viager",
          "type": "liste",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.type_demembrement",
          "options": [
            {
              "value": "viager",
              "label": "Viager"
            },
            {
              "value": "temporaire",
              "label": "Temporaire"
            }
          ],
          "conditions": [
            {
              "champ": "immo_mode_detention",
              "operateur": "=",
              "valeur": "nue_propriete",
              "portee": "client"
            }
          ]
        },
        {
          "code": "immo_age_usufruitier",
          "libelle": "Âge de l'usufruitier",
          "type": "nombre",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.age_usufruitier",
          "conditions": [
            {
              "champ": "immo_mode_detention",
              "operateur": "=",
              "valeur": "nue_propriete",
              "portee": "client"
            }
          ]
        },
        {
          "code": "immo_date_demembrement",
          "libelle": "Date de démembrement",
          "type": "date",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.date_demembrement",
          "conditions": [
            {
              "champ": "immo_mode_detention",
              "operateur": "=",
              "valeur": "nue_propriete",
              "portee": "client"
            }
          ]
        },
        {
          "code": "immo_lien_usufruitier",
          "libelle": "Lien avec l'usufruitier",
          "type": "texte",
          "portee": "client",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Ex : Parent, conjoint, enfant, autre personne physique, personne morale…",
          "prefill_path": "item.detail.lien_usufruitier",
          "conditions": [
            {
              "champ": "immo_mode_detention",
              "operateur": "=",
              "valeur": "nue_propriete",
              "portee": "client"
            }
          ]
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
            {
              "value": "immobilier",
              "label": "Crédit immobilier"
            },
            {
              "value": "consommation",
              "label": "Crédit à la consommation"
            },
            {
              "value": "professionnel",
              "label": "Crédit professionnel"
            },
            {
              "value": "autre",
              "label": "Autre"
            }
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
          "libelle": "Taux d'intérêt (hors assurance)",
          "type": "nombre",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "placeholder": "Ex : 3.5",
          "prefill_path": "item.taux",
          "conditions": []
        },
        {
          "code": "passif_capital_restant_du",
          "libelle": "Capital restant dû",
          "type": "nombre",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.capital_restant_du",
          "conditions": []
        },
        {
          "code": "passif_quotite",
          "libelle": "Quotité (%) — part revenant à chaque membre du foyer",
          "type": "nombre",
          "portee": "foyer",
          "obligatoire": false,
          "repete": true,
          "prefill_path": "item.detail.quotite",
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
            {
              "value": "0",
              "label": "0 % — Non imposable"
            },
            {
              "value": "11",
              "label": "11 %"
            },
            {
              "value": "30",
              "label": "30 %"
            },
            {
              "value": "41",
              "label": "41 %"
            },
            {
              "value": "45",
              "label": "45 %"
            }
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
            {
              "value": "Pinel",
              "label": "Pinel"
            },
            {
              "value": "Pinel+",
              "label": "Pinel+"
            },
            {
              "value": "Malraux",
              "label": "Malraux"
            },
            {
              "value": "Monuments Historiques",
              "label": "Monuments Historiques"
            },
            {
              "value": "Girardin",
              "label": "Girardin"
            },
            {
              "value": "Denormandie",
              "label": "Denormandie"
            },
            {
              "value": "Déficit foncier",
              "label": "Déficit foncier"
            },
            {
              "value": "LMP",
              "label": "Location meublée professionnelle (LMP)"
            },
            {
              "value": "LMNP",
              "label": "Location meublée non professionnelle (LMNP)"
            },
            {
              "value": "Madelin",
              "label": "Contrat Madelin"
            },
            {
              "value": "PER (déductible)",
              "label": "PER (déductible)"
            },
            {
              "value": "IR-PME",
              "label": "Réduction IR-PME"
            },
            {
              "value": "Dutreil",
              "label": "Pacte Dutreil"
            },
            {
              "value": "SOFICA",
              "label": "SOFICA"
            },
            {
              "value": "CEL / PEL",
              "label": "Compte/Plan d'épargne logement (CEL/PEL)"
            },
            {
              "value": "Démembrement",
              "label": "Démembrement"
            },
            {
              "value": "GFI",
              "label": "Groupement forestier d'investissement (GFI)"
            }
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
          "conditions": [
            {
              "champ": "foy_situation",
              "operateur": "!=",
              "valeur": "celibataire",
              "portee": "client"
            }
          ]
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
            {
              "value": "deces",
              "label": "Décès"
            },
            {
              "value": "incapacite",
              "label": "Incapacité de travail"
            },
            {
              "value": "invalidite",
              "label": "Invalidité"
            },
            {
              "value": "dependance",
              "label": "Dépendance"
            },
            {
              "value": "sante",
              "label": "Complémentaire santé"
            },
            {
              "value": "autre",
              "label": "Autre"
            }
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
            {
              "value": "court_terme",
              "label": "Court terme (moins de 3 ans)"
            },
            {
              "value": "moyen_terme",
              "label": "Moyen terme (3 à 8 ans)"
            },
            {
              "value": "long_terme",
              "label": "Long terme (plus de 8 ans)"
            },
            {
              "value": "retraite",
              "label": "Horizon retraite"
            }
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
