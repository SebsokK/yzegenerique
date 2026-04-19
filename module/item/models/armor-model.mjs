/**
 * ArmorDataModel — Item de type "armor".
 *
 * Mécanique de défense :
 *   - Pool = armorRating D6
 *   - Chaque 6 = 1 dégât absorbé
 *   - Chaque 1 = AR -1 SAUF si tous les dégâts sont absorbés
 *   - Non pushable
 *
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export class ArmorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // AR courant (peut descendre si dégradation)
      armorRating: new fields.NumberField({ required: true, initial: 3, min: 0, integer: true }),

      // AR maximum (valeur d'origine de l'armure)
      armorRatingMax: new fields.NumberField({ required: true, initial: 3, min: 0, integer: true }),

      price:       new fields.NumberField({ required: true, initial: 0, min: 0 }),
      description: new fields.StringField({ required: false, initial: "" }),

      // IDs des Tags globaux associés à cette armure
      tagIds: new fields.ArrayField(
        new fields.StringField({ required: false }),
        { required: false, initial: () => [] }
      ),
    };
  }

  /** Contribution au pool de défense = AR courant. */
  get dicePoolContribution() { return this.armorRating; }

  /** true si l'armure est détruite (AR = 0). */
  get isDestroyed() { return this.armorRating <= 0; }
}
