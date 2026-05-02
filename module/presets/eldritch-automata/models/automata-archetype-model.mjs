/**
 * AutomataArchetypeDataModel — Item de type "automata-archetype".
 * Un seul item de ce type par Actor (référencé via system.ea.automataArchetypeId).
 * Foundry VTT V14
 */

const { fields } = foundry.data;

export class AutomataArchetypeDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: false, initial: "" }),

      // [CONFIRMÉ] Texte de Berserk — affiché sur la feuille Actor quand inBerserk = true
      // "Acting against your Berserk requires a successful Pilot roll"
      berserkText: new fields.HTMLField({ required: false, initial: "" }),

      // [CONFIRMÉ] Arrays de stats de l'Automata — chaque archétype a deux options possibles
      // Format texte libre pour l'instant : "Strength 3 | Agility 1 | Wits 3 | Empathy 1"
      // [TODO] Format structuré une fois la liste complète des archétypes confirmée
      statArrayA: new fields.StringField({ required: false, initial: "" }),
      statArrayB: new fields.StringField({ required: false, initial: "" }),
    };
  }
}
