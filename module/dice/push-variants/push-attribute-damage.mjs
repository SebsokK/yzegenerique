/**
 * PushAttributeDamage — variante : Attribute Damage (SRD p.9 + p.20).
 * Banes sur dés ATTRIBUT → damage sur l'Item attribut (system.current).
 * Banes sur dés GEAR     → dégradation gear bonus.
 * Banes sur dés SKILL    → aucun effet (SRD : "Only base dice from the attribute count").
 * Willpower Points = 1 par dommage d'attribut (si enableWillpower actif).
 * Foundry VTT V14
 */

export class PushAttributeDamage {
  async apply(rollData, actor, { gearItems = [] } = {}) {
    const attrSeg = rollData.segments.find(s => s.origin === "attribute");

    if (attrSeg && rollData.totalBanes > 0) {
      const attrItem = actor.items.get(attrSeg.sourceId);
      if (attrItem) {
        const currentVal = attrItem.system.current ?? attrItem.system.value;
        await attrItem.update({
          "system.current": Math.max(0, currentVal - rollData.totalBanes),
        });
        // Willpower Points optionnels
        if (actor.system.willpower !== undefined) {
          await actor.update({
            "system.willpower": (actor.system.willpower ?? 0) + rollData.totalBanes,
          });
        }
      }
    }

    // Dégradation gear
    for (const seg of rollData.segments.filter(s => s.origin === "gear" && s.banes > 0)) {
      const item = gearItems.find(g => g.id === seg.sourceId);
      if (item) {
        await item.update({ "system.bonus": Math.max(0, (item.system.bonus ?? 0) - seg.banes) });
      }
    }
  }
}
