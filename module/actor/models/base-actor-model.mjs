/**
 * BaseActorModel — champs communs à tous les DataModels Actor.
 * Ne contient aucun champ de santé : ceux-ci sont dans les sous-modèles.
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export class BaseActorModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      archetype: new fields.StringField({ required: false, initial: "" }),
      biography: new fields.HTMLField({ required: false, initial: "" }),
      notes:     new fields.StringField({ required: false, initial: "" }),
      xp: new fields.SchemaField({
        total: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
        spent: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
      }),
      // Champ générique pour DerivedStatsSystem.
      // Géré programmatiquement — ne pas modifier manuellement.
      derived: new fields.ObjectField({ required: false, initial: {} }),
    };
  }
}
