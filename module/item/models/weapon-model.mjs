/**
 * WeaponDataModel — Item de type "weapon".
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export class WeaponDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      bonusDice: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),

      grip: new fields.StringField({
        required: true, initial: "1H",
        choices: { "1H": "One-Handed", "2H": "Two-Handed" },
      }),

      damage: new fields.NumberField({ required: true, initial: 1, min: 0, integer: true }),

      range: new fields.StringField({
        required: true, initial: "short",
        choices: {
          engaged: "Engaged",
          short:   "Short",
          medium:  "Medium",
          long:    "Long",
          extreme: "Extreme",
        },
      }),

      weight: new fields.NumberField({ required: true, initial: 0, min: 0 }),
      price:  new fields.NumberField({ required: true, initial: 0, min: 0 }),

      // Toggle explicite : active le bloc munitions
      isRanged: new fields.BooleanField({ required: true, initial: false }),

      // Munitions — gérées par chargeur, pas individuellement
      currentReloads: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
      maxReloads:     new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),

      description:     new fields.StringField({ required: false, initial: "" }),
      linkedAttribute: new fields.StringField({ required: false, initial: "" }),
      linkedSkill:     new fields.StringField({ required: false, initial: "" }),

      tagIds: new fields.ArrayField(
        new fields.StringField({ required: false }),
        { required: false, initial: () => [] }
      ),
    };
  }

  get dicePoolContribution() { return this.bonusDice; }

  /** true si les reloads sont épuisés sur une arme à distance. */
  get isOutOfAmmo() { return this.isRanged && this.currentReloads <= 0 && this.maxReloads > 0; }
}
