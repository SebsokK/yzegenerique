/**
 * PushDamageStress — variante de push : Damage & Stress (SRD p.9).
 * Banes sur attribut physique → Health damage.
 * Banes sur attribut mental  → Resolve damage.
 * Banes sur gear             → dégradation gear bonus.
 * Foundry VTT V14
 */

export class PushDamageStress {
  async apply(rollData, actor, { gearItems = [] } = {}) {
    const updates  = {};
    const attrSeg  = rollData.segments.find(s => s.origin === "attribute");

    if (attrSeg && rollData.totalBanes > 0) {
      const attrItem   = actor.items.get(attrSeg.sourceId);
      const isPhysical = attrItem?.system.category !== "mental";

      if (isPhysical) {
        const newVal = Math.max(0, (actor.system.health?.value ?? 0) - rollData.totalBanes);
        updates["system.health.value"] = newVal;
      } else {
        const newVal = Math.max(0, (actor.system.resolve?.value ?? 0) - rollData.totalBanes);
        updates["system.resolve.value"] = newVal;
      }
    }

    // Dégradation gear
    for (const seg of rollData.segments.filter(s => s.origin === "gear" && s.banes > 0)) {
      const item = gearItems.find(g => g.id === seg.sourceId);
      if (item) {
        await item.update({ "system.bonus": Math.max(0, (item.system.bonus ?? 0) - seg.banes) });
      }
    }

    if (Object.keys(updates).length > 0) await actor.update(updates);
  }
}
