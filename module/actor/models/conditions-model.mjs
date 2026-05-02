/**
 * ConditionsModel — variante Conditions (SRD p.21).
 * Broken à 3 conditions physiques ou mentales.
 * Foundry VTT V14
 */

import { BaseActorModel } from "./base-actor-model.mjs";

const { fields } = foundry.data;

const PHYSICAL_CONDITIONS = ["exhausted", "battered", "wounded"];
const MENTAL_CONDITIONS    = ["angry", "scared", "disheartened"];

function conditionFields(list) {
  return Object.fromEntries(
    list.map(c => [c, new fields.BooleanField({ required: true, initial: false })])
  );
}

export class ConditionsModel extends BaseActorModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      physicalConditions: new fields.SchemaField(conditionFields(PHYSICAL_CONDITIONS)),
      mentalConditions:   new fields.SchemaField(conditionFields(MENTAL_CONDITIONS)),
    };
  }

  get physicalConditionCount() {
    return PHYSICAL_CONDITIONS.filter(c => this.physicalConditions[c]).length;
  }

  get mentalConditionCount() {
    return MENTAL_CONDITIONS.filter(c => this.mentalConditions[c]).length;
  }

  get isBrokenPhysical() { return this.physicalConditionCount >= 3; }
  get isBrokenMental()   { return this.mentalConditionCount   >= 3; }
}
