const { fields } = foundry.data;
export class SpecialAttackDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Roll D6 : index 1-6
      rollIndex:   new fields.NumberField({ required: true, initial: 1, min: 1, max: 6, integer: true }),
      description: new fields.StringField({ initial: "" }),
    };
  }
}
