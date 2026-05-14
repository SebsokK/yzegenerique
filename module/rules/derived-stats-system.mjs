/**
 * DerivedStatsSystem — calcule les .max des ressources dérivées.
 *
 * Deux sources de ressources :
 *
 * 1. Items de type "resource" embarqués sur l'Actor (nouveau — générique)
 *    → max = evalFormula(item.system.formula, attrMap) + item.system.modifier
 *    → Écrit directement dans item.system.max (en mémoire, via prepareData)
 *
 * 2. Champs fixes du preset (legacy EA — health, stability, ego, durability, egoField)
 *    → Conservés pour compatibilité avec EaCharacterModel
 *    → max = evalFormula(stat.formula, attrMap) + 0
 *    → Écrit dans actor.system[stat.key].max
 *
 * Règles invariantes :
 *   - Écrit UNIQUEMENT sur .max
 *   - Ne touche JAMAIS à .value
 *   - Borne .value à .max si dépassement
 *   - Opère en mémoire (valide dans prepareData, pas d'update async)
 *   - Pas d'eval() — parsing manuel
 *
 * Foundry VTT V14
 */

import { resolvePreset } from "../presets/preset-registry.mjs";

export class DerivedStatsSystem {

  static compute(actor) {
    // Map slug → valeur de base des attributs
    const attrMap = {};
    for (const attr of actor.attributes) {
      const slug = attr.system.slug?.trim().toLowerCase() || attr.name.toLowerCase();
      attrMap[slug] = attr.system.value ?? 0;
    }

    // ── 1. Items de type "resource" ────────────────────────────────
    const resourceItems = actor.items.filter(i => i.type === "resource");
    for (const res of resourceItems) {
      const sys      = res.system;
      const formula  = sys.formula?.trim() ?? "";
      const modifier = sys.modifier ?? 0;

      // Respecter le flag autoCalc — si false, l'utilisateur a saisi manuellement
      if (sys.autoCalc === false) continue;

      let newMax = modifier;
      if (formula !== "") {
        // Cas spécial : référence à un autre resource par slug (ex: "ego_max")
        if (formula.endsWith("_max")) {
          const refSlug = formula.slice(0, -4);
          const refRes  = resourceItems.find(
            r => (r.system.slug ?? r.name.toLowerCase()) === refSlug
          );
          newMax = (refRes?.system.max ?? 0) + modifier;
        } else {
          newMax = DerivedStatsSystem._evalFormula(formula, attrMap) + modifier;
        }
      }

      newMax = Math.max(newMax, sys.min ?? 0);

      // Écriture en mémoire sur le DataModel de l'Item
      sys.max = newMax;
      if (sys.value > newMax) sys.value = newMax;
    }

    // ── 2. Champs fixes du preset (legacy — compatibilité EA) ──────
    // Skip pour les NPCs qui gèrent leurs stats manuellement
    if (actor.type === "npc") return;

    const preset       = resolvePreset(game.settings.get("yzegenerique", "activePresetId"));
    const derivedStats = preset.derivedStats ?? [];

    for (const stat of derivedStats) {
      if (!stat.formula) continue;  // null ou "" → skip

      let newMax;
      if (stat.formula === "ego_max") {
        // Référence à une resource "ego" — cherche d'abord dans les Items resource
        const egoRes = resourceItems.find(r => r.system.slug === "ego");
        newMax = egoRes ? egoRes.system.max : (actor.system.ego?.max ?? 0);
      } else {
        newMax = DerivedStatsSystem._evalFormula(stat.formula, attrMap);
      }

      const target = foundry.utils.getProperty(actor.system, stat.key);
      if (!target || typeof target !== "object" || !("max" in target)) continue;

      // Respecter le flag autoCalc — si false, l'utilisateur a saisi manuellement
      if (target.autoCalc === false) continue;

      target.max = newMax;
      if (target.value > newMax) target.value = newMax;
    }
  }

  /**
   * Évalue une formule additive : slugs d'attributs + entiers, opérateur + uniquement.
   * @param {string} formula  ex: "strength + agility + 5"
   * @param {object} attrMap  slug → valeur numérique
   * @returns {number}
   */
  static _evalFormula(formula, attrMap) {
    let result = 0;
    for (const token of formula.split(/\s*\+\s*/)) {
      const trimmed = token.trim();
      if (trimmed === "") continue;
      const asInt = parseInt(trimmed, 10);
      if (!isNaN(asInt)) {
        result += asInt;
      } else {
        if (!(trimmed in attrMap)) {
          console.warn(`YZE DerivedStats | Slug "${trimmed}" introuvable (formule: "${formula}")`);
        }
        result += attrMap[trimmed] ?? 0;
      }
    }
    return Math.max(result, 0);
  }

  /**
   * Méthode publique pour évaluer une formule depuis l'extérieur
   * (ex: preview dans la feuille ResourceSheet).
   */
  static evalFormulaPublic(formula, actor) {
    const attrMap = {};
    for (const attr of actor.attributes) {
      const slug = attr.system.slug?.trim().toLowerCase() || attr.name.toLowerCase();
      attrMap[slug] = attr.system.value ?? 0;
    }
    return DerivedStatsSystem._evalFormula(formula, attrMap);
  }
}
