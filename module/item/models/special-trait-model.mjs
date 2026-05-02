const { fields } = foundry.data;
export class SpecialTraitDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.StringField({ initial: "" }),
    };
  }
}
