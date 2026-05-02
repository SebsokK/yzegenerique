/**
 * YZEItem — classe Item du système YZE Générique.
 * Foundry VTT V14
 */

export class YZEItem extends Item {

  /** Retourne true si cet item contribue au pool de dés. */
  get contributesToPool() {
    return ["attribute", "skill", "gear"].includes(this.type);
  }

  /**
   * Nombre de dés que cet item contribue à un pool dice pool.
   * Délégué au DataModel qui implémente dicePoolContribution.
   */
  get dicePoolContribution() {
    return this.system.dicePoolContribution ?? 0;
  }
}
