/**
 * StrandDataModel — Item de type "strand".
 * Représente une relation mécanique entre deux personnages.
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export class StrandDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // [CONFIRMÉ] Nom du personnage / NPC de l'autre côté du Strand
      targetName: new fields.StringField({ required: true, initial: "" }),

      // [CONFIRMÉ] Exhausted : Strand utilisé, pas encore rafraîchi
      // Rafraîchissement : après Shift de downtime ensemble
      exhausted: new fields.BooleanField({ initial: false }),

      // [CONFIRMÉ] Broken : permanent — ne peut pas être recréé
      // Exception : Hope Talent (géré dans bloc 3)
      broken: new fields.BooleanField({ initial: false }),

      // [CONFIRMÉ] Mémoire du moment fondateur de la relation
      memory: new fields.StringField({ required: false, initial: "" }),

      // [CONFIRMÉ] Les Strands persistent après la mort du porteur
      isPostMortem: new fields.BooleanField({ initial: false }),

      // Notes libres
      notes: new fields.StringField({ required: false, initial: "" }),
    };
  }
}
