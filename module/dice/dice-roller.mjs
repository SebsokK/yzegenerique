/**
 * YZEDiceRoller — moteur de jets YZE générique.
 *
 * Architecture :
 *   - Pool segmenté : attribut / skill / gear / stress / custom (Strand dice, etc.)
 *   - Chaque segment conserve son origine, ses résultats, ses succès, ses banes
 *   - successFn / baneFn extensibles par segment (Strand dice : 1 ET 6)
 *   - Hook yze.preBuildSegments pour injecter des segments custom (modules extra)
 *   - Hook yze.preRollResult / yze.rollResult / yze.postPush pour post-processing
 *
 * Foundry VTT V14
 */

import { getRuleConfig }  from "../rules/rule-config.mjs";
import { getPushHandler } from "./push-handler.mjs";

export class YZEDiceRoller {

  /**
   * Point d'entrée principal.
   *
   * @param {YZEActor}      actor
   * @param {YZEItem|null}  skillItem       Item "skill", ou null pour jet d'attribut pur
   * @param {YZEItem|null}  attributeItem   Item "attribute"
   * @param {object}        options
   * @param {number}        [options.modifier=0]      Modificateur de dés skill
   * @param {YZEItem[]}     [options.gearItems=[]]    Items gear contribuant au roll
   * @param {boolean}       [options.pushed=false]    Ce roll est un push
   * @param {object}        [options.previousRoll]    YZERollData du roll précédent (pour push)
   * @returns {Promise<object>}  YZERollData
   */
  static async rollSkill(actor, skillItem, attributeItem, options = {}) {
    const cfg       = getRuleConfig();
    const isPush    = options.pushed      ?? false;
    const gearItems = options.gearItems   ?? [];
    const modifier  = options.modifier    ?? 0;
    const prevRoll  = options.previousRoll ?? null;

    // 1. Construction des segments
    const segments = YZEDiceRoller._buildSegments({
      actor, skillItem, attributeItem, gearItems, modifier, isPush, prevRoll, cfg,
    });

    if (segments.length === 0 || segments.every(s => s.count === 0)) {
      ui.notifications.warn("YZE | Empty dice pool — action impossible.");
      return null;
    }

    // 2. Formule et roll Foundry
    const formula = segments.map(s => s.formula).join(" + ");
    const roll    = new Roll(formula);
    await roll.evaluate();

    // 3. Répartition des résultats dans les segments
    YZEDiceRoller._assignResults(segments, roll);

    // 4. Analyse
    const rollData = YZEDiceRoller._buildRollData(
      segments, roll, isPush, actor, skillItem, attributeItem
    );

    // 5. Hooks pre-processing
    Hooks.callAll("yze.preRollResult", rollData, actor);

    // 6. Coût du push
    if (isPush) {
      const handler = getPushHandler(cfg.pushVariant);
      await handler.apply(rollData, actor, { gearItems });
      Hooks.callAll("yze.postPush", rollData, actor);
    }

    // 7. Post-processing global
    Hooks.callAll("yze.rollResult", rollData, actor);

    // 8. Chat
    await YZEDiceRoller._sendToChat(rollData, actor);

    return rollData;
  }

  // ── Construction des segments ──────────────────────────────────────

  static _buildSegments({ actor, skillItem, attributeItem, gearItems, modifier, isPush, prevRoll, cfg }) {
    const segments = [];

    // Attribut
    const attrVal = attributeItem?.system.dicePoolContribution ?? 0;
    if (attrVal > 0) {
      const count = isPush
        ? YZEDiceRoller._rerollableCount(prevRoll, "attribute")
        : attrVal;
      if (count > 0) segments.push({
        origin:     "attribute",
        count,
        dieType:    "d6",
        formula:    `${count}d6`,
        sourceId:   attributeItem?.id,
        sourceName: attributeItem?.name,
        results:    [],
        successes:  0,
        banes:      0,
      });
    }

    // Skill — modificateurs appliqués en priorité sur les dés skill (SRD p.9)
    const skillVal  = skillItem?.system.dicePoolContribution ?? 0;
    const skillDice = Math.max(0, skillVal + modifier);
    if (skillDice > 0) {
      const count = isPush
        ? YZEDiceRoller._rerollableCount(prevRoll, "skill")
        : skillDice;
      if (count > 0) segments.push({
        origin:     "skill",
        count,
        dieType:    "d6",
        formula:    `${count}d6`,
        sourceId:   skillItem?.id,
        sourceName: skillItem?.name,
        results:    [],
        successes:  0,
        banes:      0,
      });
    }

    // Gear
    for (const gear of gearItems) {
      const bonus = gear.system.bonus ?? 0;
      if (bonus <= 0) continue;
      const count = isPush
        ? YZEDiceRoller._rerollableCount(prevRoll, "gear", gear.id)
        : bonus;
      if (count > 0) segments.push({
        origin:     "gear",
        count,
        dieType:    "d6",
        formula:    `${count}d6`,
        sourceId:   gear.id,
        sourceName: gear.name,
        results:    [],
        successes:  0,
        banes:      0,
      });
    }

    // Stress (si module actif — stress dice ajoutés même sans push en EA)
    if (cfg.enableStress) {
      const stressVal = actor.stressLevel;  // getter unifié EA + générique
      if (stressVal > 0) {
        // Au push : on prend stressVal + 1 (push-stress-dice écrira la valeur)
        const count = isPush ? stressVal + 1 : stressVal;
        segments.push({
          origin:    "stress",
          count,
          dieType:   "d6",
          formula:   `${count}d6`,
          results:   [],
          successes: 0,
          banes:     0,
        });
      }
    }

    // Hook pour modules extra (ex: Strand dice avec successFn personnalisée)
    Hooks.callAll("yze.preBuildSegments", segments, actor, {
      skillItem, attributeItem, gearItems, isPush, prevRoll,
    });

    return segments;
  }

  /**
   * Lors d'un push : nombre de dés re-rollables pour un segment donné.
   *
   * Règle SRD : "you can re-roll any dice that don't show 1."
   * → Les banes (1) ne se re-rollent JAMAIS.
   * → Tous les autres résultats (y compris les succès 6) SE RE-ROLLENT.
   *   Le joueur ne choisit pas — tout ce qui n'est pas 1 est re-rollé automatiquement.
   *   C'est le risque du push : on peut perdre des succès déjà obtenus.
   *
   * @param {object} prevRoll  Données du roll précédent (depuis les flags du message)
   * @param {string} origin    Origine du segment ("attribute", "skill", "gear", "stress")
   * @param {string|null} sourceId  ID de l'item source (pour les segments gear)
   * @returns {number}  Nombre de dés à re-roller
   */
  static _rerollableCount(prevRoll, origin, sourceId = null) {
    if (!prevRoll) return 0;
    const seg = prevRoll.segments?.find(
      s => s.origin === origin && (sourceId == null || s.sourceId === sourceId)
    );
    if (!seg || !seg.results) return 0;

    // Règle SRD : tout sauf les banes (1) est re-rollable.
    // Variante optionnelle : si keepSuccessesOnPush est activé, les 6 sont aussi conservés.
    const keepSuccesses = game.settings.get("yzegenerique", "keepSuccessesOnPush") ?? false;

    return seg.results.filter(r => {
      if (r === 1) return false;          // bane — jamais re-rollé
      if (keepSuccesses && r === 6) return false; // succès conservé si option active
      return true;
    }).length;
  }

  /**
   * Répartit les résultats du Roll Foundry dans les segments.
   * Roll.dice sont dans le même ordre que les termes de la formule.
   */
  static _assignResults(segments, roll) {
    for (let i = 0; i < segments.length; i++) {
      const term = roll.dice[i];
      segments[i].results = term?.results.map(r => r.result) ?? [];
    }
  }

  /**
   * Analyse les segments et construit l'objet YZERollData final.
   *
   * successFn par défaut : val === 6
   * baneFn par défaut    : val === 1
   * Ces fonctions peuvent être surchargées sur un segment individuel
   * (ex: Strand dice → successFn = val === 1 || val === 6).
   */
  static _buildRollData(segments, roll, pushed, actor, skillItem, attributeItem) {
    const rollData = {
      segments,
      roll,
      pushed,
      actorId:          actor.id,
      skillName:        skillItem?.name      ?? null,
      attributeName:    attributeItem?.name  ?? null,
      skillItemId:      skillItem?.id        ?? null,
      attributeItemId:  attributeItem?.id    ?? null,
      totalSuccesses: 0,
      totalBanes:     0,
      gearBanes:      0,
      stressBanes:    0,
      success:        false,
    };

    for (const seg of segments) {
      const successFn = seg.successFn ?? ((v) => v === 6);
      const baneFn    = seg.baneFn    ?? ((v) => v === 1);

      for (const val of seg.results) {
        if (successFn(val)) {
          seg.successes++;
          rollData.totalSuccesses++;
        }
        if (baneFn(val)) {
          seg.banes++;
          if (seg.origin === "attribute") rollData.totalBanes++;
          if (seg.origin === "gear")      rollData.gearBanes++;
          if (seg.origin === "stress")    rollData.stressBanes++;
        }
      }
    }

    rollData.success = rollData.totalSuccesses > 0;
    return rollData;
  }

  // ── Affichage chat ─────────────────────────────────────────────────

  static async _sendToChat(rollData, actor) {
    const label = [rollData.attributeName, rollData.skillName].filter(Boolean).join(" / ");

    // Résumé des segments — pour un push, distinguer les dés figés des nouveaux
    const segmentSummary = rollData.segments
      .filter(s => s.count > 0)
      .map(s => {
        const icons = { attribute: "⬡", skill: "◆", gear: "⚙", stress: "⚡", strand: "∞" };
        const icon  = icons[s.origin] ?? "◻";
        const baneStr = s.banes > 0 ? ` <span class="yze-bane">${s.banes}✕</span>` : "";
        return `<span class="yze-segment">${icon} ${s.count}d6 → ${s.successes}✓${baneStr}</span>`;
      })
      .join(" ");

    // Dés figés du push précédent (banes non re-rollés)
    let keptBanesHtml = "";
    if (rollData.pushed && rollData.totalBanes > 0) {
      keptBanesHtml = `<div class="yze-roll-kept">⚑ ${rollData.totalBanes} bane${rollData.totalBanes > 1 ? "s" : ""} kept (not re-rolled)</div>`;
    }

    const rollId = foundry.utils.randomID();

    const content = `
      <div class="yze-roll-result" data-roll-id="${rollId}"
           data-actor-id="${actor.id}"
           data-skill-id="${rollData.skillItemId ?? ""}"
           data-attribute-id="${rollData.attributeItemId ?? ""}">
        ${label ? `<div class="yze-roll-label">${label}</div>` : ""}
        ${rollData.pushed ? `<div class="yze-roll-pushed-badge">↻ Pushed</div>` : ""}
        <div class="yze-roll-outcome ${rollData.success ? "success" : "failure"}">
          ${rollData.success
            ? `✓ <strong>${rollData.totalSuccesses}</strong> success${rollData.totalSuccesses > 1 ? "es" : ""}`
            : "✗ Failure"
          }
        </div>
        <div class="yze-roll-segments">${segmentSummary}</div>
        ${keptBanesHtml}
        ${rollData.stressBanes > 0 ? `
        <div class="yze-roll-panic">
          ⚡ Stress bane — Panic triggered
          <button class="yze-panic-btn" type="button"
            data-action="rollPanic"
            data-actor-id="${actor.id}">
            🎲 Roll Panic
          </button>
        </div>` : ""}
        ${!rollData.pushed ? `<div class="yze-roll-push-row">
          <button class="yze-push-btn" type="button"
            data-action="pushRoll"
            data-roll-id="${rollId}">
            ↻ Push Roll
          </button>
          <span class="yze-push-hint">${
            (game.settings.get("yzegenerique", "keepSuccessesOnPush") ?? false)
              ? "Keeps successes, re-rolls non-bane dice"
              : "Re-rolls all non-bane dice (successes included)"
          }</span>
        </div>` : ""}
      </div>`;

    const rollFlags = {
      "yzegenerique": {
        rollData: {
          segments: rollData.segments.map(s => ({
            origin:     s.origin,
            results:    s.results,
            sourceId:   s.sourceId   ?? null,
            sourceName: s.sourceName ?? null,
            count:      s.count,
            banes:      s.banes,
            successes:  s.successes,
          })),
          pushed:          rollData.pushed,
          actorId:         rollData.actorId,
          skillName:       rollData.skillName,
          attributeName:   rollData.attributeName,
          skillItemId:     rollData.skillItemId      ?? null,
          attributeItemId: rollData.attributeItemId  ?? null,
          totalSuccesses:  rollData.totalSuccesses,
          totalBanes:      rollData.totalBanes,
          success:         rollData.success,
          rollId,
        },
      },
    };

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      flags: rollFlags,
      rolls: [rollData.roll],
    };

    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined) {
      messageData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    } else if (CONST.CHAT_MESSAGE_TYPES?.ROLL !== undefined) {
      messageData.type = CONST.CHAT_MESSAGE_TYPES.ROLL;
    }

    await ChatMessage.create(messageData);
  }
}
