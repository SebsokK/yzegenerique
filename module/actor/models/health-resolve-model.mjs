/**
 * HealthResolveModel — variante Health + Resolve (SRD par défaut).
 * Foundry VTT V14
 */

import { BaseActorModel } from "./base-actor-model.mjs";

const { fields } = foundry.data;

export class HealthResolveModel extends BaseActorModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      health: new fields.SchemaField({
        value:    new fields.NumberField({ required: true, initial: 4, min: 0, integer: true }),
        max:      new fields.NumberField({ required: true, initial: 4, min: 0, integer: true }),
        autoCalc: new fields.BooleanField({ initial: true }),
      }),
      resolve: new fields.SchemaField({
        value:    new fields.NumberField({ required: true, initial: 4, min: 0, integer: true }),
        max:      new fields.NumberField({ required: true, initial: 4, min: 0, integer: true }),
        autoCalc: new fields.BooleanField({ initial: true }),
      }),
      stress: new fields.SchemaField({
        value: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
      }),
    };
  }
}
