/**
 * SpecialtyDataModel — Item de type "specialty".
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export class SpecialtyDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description:      new fields.HTMLField({ required: false, initial: "" }),
      mechanicalEffect: new fields.StringField({ required: false, initial: "" }),
      wpCost:           new fields.NumberField({ required: false, initial: 0, min: 0, integer: true }),
    };
  }
}
