/**
 * getPushHandler — factory pour les variantes de push.
 * Pattern Strategy : chaque variante implémente apply(rollData, actor, context).
 * Foundry VTT V14
 */

import { PushDamageStress }    from "./push-variants/push-damage-stress.mjs";
import { PushAttributeDamage } from "./push-variants/push-attribute-damage.mjs";
import { PushStressDice }      from "./push-variants/push-stress-dice.mjs";
import { PushConditions }      from "./push-variants/push-conditions.mjs";
import { PushDoomPoints }      from "./push-variants/push-doom-points.mjs";

const HANDLERS = {
  damageStress:    new PushDamageStress(),
  attributeDamage: new PushAttributeDamage(),
  stressDice:      new PushStressDice(),
  conditions:      new PushConditions(),
  doomPoints:      new PushDoomPoints(),
};

/**
 * @param {string} variant  Clé du world setting "pushVariant"
 * @returns {object}        Handler avec méthode async apply(rollData, actor, context)
 */
export function getPushHandler(variant) {
  const handler = HANDLERS[variant];
  if (!handler) {
    console.warn(`YZE | Push variant "${variant}" unknown. Fallback: damageStress.`);
    return HANDLERS.damageStress;
  }
  return handler;
}
