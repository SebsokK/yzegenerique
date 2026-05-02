/**
 * ResourceDataModel — Item de type "resource".
 *
 * Représente une jauge configurable (Health, Stability, Ego, Durability, etc.)
 * embarquée sur un Actor comme n'importe quel autre Item.
 *
 * max = DerivedStatsSystem.evalFormula(formula, attrMap) + modifier
 *   - formula vide ou null → max = modifier seul (jauge purement manuelle)
 *   - modifier peut être négatif
 *   - value est toujours éditable manuellement
 *
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export class ResourceDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Identifiant stable pour les références (formules, hooks)
      // Ex: "health", "stability", "ego", "durability"
      slug: new fields.StringField({ required: false, initial: "" }),

      // Valeur courante — toujours éditable, jamais écrasée par DerivedStatsSystem
      value: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),

      // Max calculé — écrit par DerivedStatsSystem, lu par la feuille
      max: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),

      // Formule additive de slugs d'attributs + constantes
      // Ex: "strength + agility", "wits", "empathy", "strength + agility + 5"
      // Vide ou null = pas de calcul auto, max = modifier seul
      formula: new fields.StringField({ required: false, initial: "" }),

      // Modificateur fixe ajouté au max calculé (talents, capacités spéciales, etc.)
      // Ex: talent Tough → modifier = +1 sur health.max
      modifier: new fields.NumberField({ required: true, initial: 0, integer: true }),

      // Minimum autorisé pour value (par défaut 0, peut être négatif pour certains jeux)
      min: new fields.NumberField({ required: true, initial: 0, integer: true }),

      // Catégorie optionnelle pour l'affichage (ex: "pilot", "automata", "general")
      // Utilisé par la feuille EA pour grouper les ressources
      category: new fields.StringField({ required: false, initial: "general" }),

      description: new fields.StringField({ required: false, initial: "" }),
    };
  }

  /**
   * Max effectif = max calculé (déjà écrit par DerivedStatsSystem) + modifier.
   * DerivedStatsSystem écrit directement dans this.max lors de prepareData.
   */
  get effectiveMax() {
    return this.max;
    // Note : le modifier est déjà intégré dans max par DerivedStatsSystem.
    // Ce getter existe pour une utilisation externe claire.
  }
}
