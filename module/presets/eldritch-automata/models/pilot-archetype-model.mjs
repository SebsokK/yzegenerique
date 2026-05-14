const { fields } = foundry.data;

function statArrayField() {
  return new fields.SchemaField({
    strength: new fields.NumberField({ required: true, initial: 1, min: 1, max: 6, integer: true }),
    agility:  new fields.NumberField({ required: true, initial: 1, min: 1, max: 6, integer: true }),
    wits:     new fields.NumberField({ required: true, initial: 1, min: 1, max: 6, integer: true }),
    empathy:  new fields.NumberField({ required: true, initial: 1, min: 1, max: 6, integer: true }),
  });
}

export class PilotArchetypeDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description:             new fields.HTMLField({ required: false, initial: "" }),
      breakdownText:           new fields.HTMLField({ required: false, initial: "" }),
      strandTalentDescription: new fields.HTMLField({ required: false, initial: "" }),
      hopeTalentDescription:   new fields.HTMLField({ required: false, initial: "" }),
      statArrayA:              statArrayField(),
      statArrayB:              statArrayField(),
    };
  }
}
