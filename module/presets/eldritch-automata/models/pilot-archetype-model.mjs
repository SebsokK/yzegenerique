/**
 * PilotArchetypeDataModel — Item de type "pilot-archetype".
 * Un seul item de ce type par Actor (référencé via system.ea.pilotArchetypeId).
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export class PilotArchetypeDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, initial: "" }),

      // [CONFIRMÉ] Texte de Breakdown — affiché sur la feuille Actor quand inBreakdown = true
      // "Acting against your Breakdown reduces your rolls to 1"
      breakdownText: new fields.HTMLField({ required: false, initial: "" }),

      // [CONFIRMÉ] Description du Strand Talent de cet archétype
      // La mécanique active (formation de Strands) est dans ea-strands.mjs (bloc 3)
      strandTalentDescription: new fields.HTMLField({ required: false, initial: "" }),

      // [CONFIRMÉ] Description du Hope Talent
      // "One-time use ability, purchased with XP, locks after use until milestone"
      hopeTalentDescription: new fields.HTMLField({ required: false, initial: "" }),
    };
  }
}
