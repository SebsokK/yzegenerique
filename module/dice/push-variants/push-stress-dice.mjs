/**
 * PushStressDice — variante : Stress Dice (Sleepy Hollow, EA).
 *
 * Au push : Stress Level +1.
 * Les dés de stress (= niveau de stress actuel) sont DÉJÀ dans le pool
 * avant le push — _buildSegments les calcule avec stressVal + 1 pour
 * anticiper la montée. Ce handler écrit officiellement la nouvelle valeur.
 *
 * Si stressBanes > 0 → Panic Roll déclenché via hook.
 *
 * Compatible EA (system.stress = NumberField) et générique (system.stress.value).
 *
 * Foundry VTT V14
 */

export class PushStressDice {
  async apply(rollData, actor, _context = {}) {
    const current  = actor.stressLevel;
    await actor.setStressLevel(current + 1);

    if (rollData.stressBanes > 0) {
      Hooks.callAll("yze.triggerPanic", actor, rollData);
    }
  }
}
