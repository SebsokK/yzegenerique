/**
 * PushConditions — variante : Conditions (SRD p.21).
 * Chaque push → 1 condition au choix du joueur.
 * TODO: implémenter le dialog de sélection de condition.
 * Foundry VTT V14
 */

export class PushConditions {
  async apply(rollData, actor, _context = {}) {
    // Hook pour demander la condition au joueur — consommé par un module conditions dédié
    Hooks.callAll("yze.requestCondition", actor, rollData);
    // TODO: dialog + actor.update conditions
    console.warn("YZE | Push conditions: selection dialog not yet implemented.");
  }
}
