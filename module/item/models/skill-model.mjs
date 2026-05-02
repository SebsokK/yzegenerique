/**
 * SkillDataModel — Item de type "skill".
 * Le lien vers l'attribut est un slug string.
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export const STEP_DICE_MAP = { A: 12, B: 10, C: 8, D: 6 };

export class SkillDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Niveau dice pool (0–5 SRD, 0–6 EA)
      value: new fields.NumberField({ required: true, initial: 0, min: 0, max: 10, integer: true }),
      // Rating step dice
      stepRating: new fields.StringField({
        required: false,
        initial: "D",
        choices: { A: "A (D12)", B: "B (D10)", C: "C (D8)", D: "D (D6)" },
      }),
      // Slug de l'attribut lié — correspond à attribute.system.slug ou attribute.name.toLowerCase()
      linkedAttribute: new fields.StringField({ required: false, initial: "" }),
      // Slug stable pour les références
      slug: new fields.StringField({ required: false, initial: "" }),
      description: new fields.StringField({ required: false, initial: "" }),
    };
  }

  get dicePoolContribution() {
    return this.value;
  }

  get dieSize() {
    return STEP_DICE_MAP[this.stepRating] ?? 6;
  }
}
