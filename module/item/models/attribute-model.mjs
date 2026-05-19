/**
 * AttributeDataModel — Item de type "attribute".
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export const STEP_DICE_MAP = { A: 12, B: 10, C: 8, D: 6 };

export class AttributeDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // Valeur dice pool (1–5), aussi utilisée comme valeur de base pour les formules dérivées
      value:   new fields.NumberField({ required: true, initial: 2, min: 0, max: 20, integer: true }),
      current: new fields.NumberField({ required: true, initial: 2, min: 0, max: 20, integer: true }),
      // Rating step dice (A/B/C/D)
      stepRating: new fields.StringField({
        required: false,
        initial: "C",
        choices: { A: "A (D12)", B: "B (D10)", C: "C (D8)", D: "D (D6)" },
      }),
      // Catégorie : physical (STR/AGI) ou mental (WIT/EMP)
      // Utilisé par les variantes de push pour déterminer le type de dommage
      category: new fields.StringField({
        required: true,
        initial: "physical",
        choices: { physical: "Physical", mental: "Mental" },
      }),
      // Slug stable pour les formules dérivées et le lien skill→attribute
      slug: new fields.StringField({ required: false, initial: "" }),
      description: new fields.StringField({ required: false, initial: "" }),
    };
  }

  /** Taille du dé pour le mode step dice. */
  get dieSize() {
    return STEP_DICE_MAP[this.stepRating] ?? 8;
  }

  /** Contribution au pool dice pool (valeur courante). */
  get dicePoolContribution() {
    return this.current ?? this.value;
  }
}
