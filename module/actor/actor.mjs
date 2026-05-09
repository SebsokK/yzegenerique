/**
 * YZEActor — classe Actor du système YZE Générique.
 * La logique métier (jets) est déléguée à dice-roller.mjs.
 * Foundry VTT V14
 */

import { YZEDiceRoller }      from "../dice/dice-roller.mjs";
import { DerivedStatsSystem } from "../rules/derived-stats-system.mjs";

export class YZEActor extends Actor {

  /** Items de type "attribute". */
  get attributes() { return this.items.filter(i => i.type === "attribute"); }

  /** Items de type "skill". */
  get skills()      { return this.items.filter(i => i.type === "skill"); }

  /** Total des modificateurs CI actifs pour un item donné. */
  getCIModifierFor(itemId) {
    const item = this.items.get(itemId);
    let total = 0;
    for (const ci of this.items.filter(i => i.type === "critical-injury")) {
      if (ci.system.healed) continue;
      for (const mod of (ci.system.modifiers ?? [])) {
        if (!mod?.value) continue;
        const matchById   = mod.targetId && mod.targetId === itemId;
        const matchByName = !mod.targetId && item &&
          mod.targetName?.toLowerCase().trim() === item.name.toLowerCase().trim();
        if (matchById || matchByName) total += mod.value;
      }
    }
    return total;
  }

  /** Contribution au pool d'un attribut avec malus CI. */
  getAttributePool(attrItem) {
    if (!attrItem) return 0;
    return Math.max(0, (attrItem.system.dicePoolContribution ?? 0) + this.getCIModifierFor(attrItem.id));
  }

  /** Contribution au pool d'un skill avec malus CI. */
  getSkillPool(skillItem) {
    if (!skillItem) return 0;
    return Math.max(0, (skillItem.system.dicePoolContribution ?? 0) + this.getCIModifierFor(skillItem.id));
  }

  /** Items de type "gear". */
  get gear()        { return this.items.filter(i => i.type === "gear"); }

  /**
   * Résout un Item attribut par slug.
   * Cherche d'abord system.slug, puis name.toLowerCase().
   * @param {string} slug
   * @returns {YZEItem|undefined}
   */
  getAttributeBySlug(slug) {
    if (!slug) return undefined;
    const normalized = slug.trim().toLowerCase();
    return this.items.find(i =>
      i.type === "attribute" &&
      ((i.system.slug?.trim().toLowerCase() === normalized) ||
       (i.name.toLowerCase() === normalized))
    );
  }

  /**
   * Niveau de stress courant — résout la bonne propriété selon le modèle.
   * - EA : system.stress (NumberField direct)
   * - Générique / SH : system.stress.value (SchemaField)
   */
  get stressLevel() {
    const s = this.system.stress;
    if (s === undefined || s === null) return 0;
    if (typeof s === "object") return s.value ?? 0;   // SchemaField {value, max}
    return s;                                          // NumberField direct (EA)
  }

  /** Met à jour le stress en écrivant sur le bon chemin. */
  async setStressLevel(newValue) {
    const s = this.system.stress;
    if (typeof s === "object") {
      await this.update({ "system.stress.value": Math.max(0, newValue) });
    } else {
      await this.update({ "system.stress": Math.max(0, newValue) });
    }
  }
  get isBroken() {
    if (typeof this.system.isPilotBroken === "boolean") return this.system.isPilotBroken;
    if (this.system.health !== undefined)                return this.system.health.value <= 0;
    return false;
  }

  /**
   * prepareData — appelé par Foundry à chaque mise à jour de l'Actor.
   * Calcule les ressources dérivées (max uniquement).
   * Ne contient aucune logique asynchrone.
   */
  prepareData() {
    super.prepareData();
    try {
      DerivedStatsSystem.compute(this);
    } catch (err) {
      console.error("YZE | DerivedStatsSystem.compute() error:", err);
    }

    // Borne system.current à system.value sur tous les attributs.
    // Quand value baisse, current ne doit pas dépasser le nouveau value.
    for (const attr of this.attributes) {
      if (attr.system.current > attr.system.value) {
        attr.system.current = attr.system.value;
      }
    }

    Hooks.callAll("yze.prepareActorData", this);
  }

  /**
   * Lance un jet de compétence YZE.
   * @param {string} skillItemId   ID de l'Item skill
   * @param {object} [options]
   */
  async rollSkill(skillItemId, options = {}) {
    const skill = this.items.get(skillItemId);
    if (!skill) {
      ui.notifications.warn("YZE | Skill not found.");
      return;
    }
    const attribute = this.getAttributeBySlug(skill.system.linkedAttribute);
    return YZEDiceRoller.rollSkill(this, skill, attribute, options);
  }

  /**
   * Lance un jet d'attribut pur (sans compétence).
   * @param {string} attributeItemId
   * @param {object} [options]
   */
  async rollAttribute(attributeItemId, options = {}) {
    const attribute = this.items.get(attributeItemId);
    if (!attribute) return;
    return YZEDiceRoller.rollSkill(this, null, attribute, options);
  }
}
