/**
 * CriticalInjuryDataModel — Item de type "critical-injury".
 * Foundry VTT V14
 */
const { fields } = foundry.data;

export class CriticalInjuryDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      d66:         new fields.NumberField({ required: false, initial: 11, integer: true }),
      lethal:      new fields.BooleanField({ initial: false }),
      timeLimit:   new fields.StringField({ initial: "" }),
      effect:      new fields.StringField({ initial: "" }),
      healingTime: new fields.StringField({ initial: "" }),
      description: new fields.StringField({ initial: "" }),
      healed:       new fields.BooleanField({ initial: false }),
      instantDeath: new fields.BooleanField({ initial: false }),
      modifiers:    new fields.ArrayField(
        new fields.ObjectField(),
        { initial: [] }
      ),
    };
  }

  get isRollableHealingTime() {
    return /^\d*d\d+$/i.test(this.healingTime.trim());
  }

  get healingFormula() {
    return this.healingTime.toLowerCase().trim();
  }

  /** Retourne les modificateurs actifs (CI non soignée) */
  get activeModifiers() {
    if (this.healed) return [];
    return this.modifiers ?? [];
  }
}
