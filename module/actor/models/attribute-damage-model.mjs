/**
 * AttributeDamageModel — variante Attribute Damage.
 * Les dommages réduisent directement les Items attribut (system.current).
 * Foundry VTT V14
 */

import { BaseActorModel } from "./base-actor-model.mjs";

const { fields } = foundry.data;

export class AttributeDamageModel extends BaseActorModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      // Willpower Points — optionnel, activé via enableWillpower
      willpower: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
    };
  }
}
