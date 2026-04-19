/**
 * TalentDataModel — Item de type "talent".
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export class TalentDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, initial: "" }),

      // Court résumé affiché inline sur la fiche de personnage
      excerpt: new fields.StringField({ required: false, initial: "" }),

      // [CONFIRMÉ] "pilot" ou "automata" — détermine la liste d'affichage dans la feuille
      talentSource: new fields.StringField({
        required: true,
        initial:  "general",
        choices:  { general: "General", pilot: "Pilot", automata: "Automata" },
      }),

      // [CONFIRMÉ] Required Talents : doivent être achetés avant les autres du même archétype
      isRequired: new fields.BooleanField({ initial: false }),

      // [CONFIRMÉ] Hope Talent : one-time use, acheté avec XP
      isHopeTalent: new fields.BooleanField({ initial: false }),

      // [CONFIRMÉ] Strand Talent : définit comment le personnage forme des Strands
      isStrandTalent: new fields.BooleanField({ initial: false }),

      // [CONFIRMÉ] Hope Talent se lock après usage jusqu'au prochain milestone
      hopeLocked: new fields.BooleanField({ initial: false }),

      // [TODO] Coût en ressource — format non systématisé dans le Preview
      // Champ texte libre pour les GMs (ex: "Ego -1")
      resourceCost: new fields.StringField({ required: false, initial: "" }),
    };
  }
}
