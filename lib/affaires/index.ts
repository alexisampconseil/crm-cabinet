// Façade publique du module Affaires — importer depuis '@/lib/affaires'.

export * from './types'
export * from './errors'

export {
  requireConseiller, requirePeutParametrer,
} from './services/guard'

export {
  creerAffaire, modifierInfos,
  modifierChamp, modifierEtape, modifierTache, modifierDocument, modifierControle, derogerBlocage,
  terminer, archiver, reouvrir, corrigerRevenu,
  creerProposition, appliquerProposition, rejeterProposition, annulerProposition,
} from './services/mutations'
export type { CreerAffaireInput, ModifierInfosInput, CreerPropositionInput } from './services/mutations'

export {
  listAffairesByClient, getAffaire, getAffaireDetail,
  getAffaireEvenements, getAffairePropositions, resolveChampDefId,
} from './repository/affaires'

export {
  getFamillesActives, getTypesActifs, getPartenairesActifs, getFrisesActives, getDonneesCreation,
} from './repository/referentiel'

export { getProductionStats, peutParametrer } from './repository/production'
export type { ProductionStats, ProductionParTypeLigne } from './repository/production'

export {
  listFamilles, listTypes, listPartenaires, listMotifs, listFrises, getFriseDetail,
} from './repository/parametrage'
export { parametrage, publierFrise, archiverFrise } from './services/parametrage'
