/**
 * GearDataModel — Item de type "gear".
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export class GearDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      bonus:           new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
      reliability:     new fields.NumberField({ required: true, initial: 5, min: 0, integer: true }),
      reliabilityMax:  new fields.NumberField({ required: true, initial: 5, min: 0, integer: true }),
      weight:          new fields.NumberField({ required: false, initial: 0, min: 0 }),
      description:     new fields.HTMLField({ required: false, initial: "" }),
    };
  }

  get dicePoolContribution() {
    return this.bonus;
  }
}
