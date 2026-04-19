/**
 * TagDataModel — Item de type "tag".
 * Badge visuel affiché sur les armes et armures.
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export class TagDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.StringField({ required: false, initial: "" }),
    };
  }
}
