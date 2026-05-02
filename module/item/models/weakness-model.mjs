const { fields } = foundry.data;
export class WeaknessDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.StringField({ initial: "" }),
    };
  }
}
