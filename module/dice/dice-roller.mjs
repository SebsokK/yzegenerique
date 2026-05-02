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
    const keepSuccesses = isPush
      ? (game.settings.get("yzegenerique", "keepSuccessesOnPush") ?? false)
      : false;

    // ── Helper : construit un segment push avec dés gardés + nouveaux ──
    const pushSegment = (origin, sourceId, sourceName) => {
      if (!prevRoll) return null;
      const prev = prevRoll.segments?.find(
        s => s.origin === origin && (sourceId == null || s.sourceId === sourceId)
      );
      if (!prev) return null;

      // Tous les résultats du segment précédent (nouveaux + déjà gardés)
      const allResults = [...(prev.results ?? []), ...(prev.keptResults ?? [])];
      // Dés gardés : banes (1) toujours gardés, succès (6) gardés si keepSuccesses
      const kept       = allResults.filter(r => r === 1 || (keepSuccesses && r === 6));
      // Dés à re-roller
      const rerollable = allResults.filter(r => r !== 1 && !(keepSuccesses && r === 6));

      return { origin, sourceId, sourceName, kept, rerollable, rerollCount: rerollable.length };
    };

    // Attribut
    const attrVal = actor.getAttributePool(attributeItem) ?? 0;
    if (attrVal > 0) {
      if (isPush) {
        const ps = pushSegment("attribute", attributeItem?.id, attributeItem?.name);
        if (ps && ps.rerollCount > 0) segments.push({
          origin: "attribute", count: ps.rerollCount,
          dieType: "d6", formula: `${ps.rerollCount}d6`,
          sourceId: ps.sourceId, sourceName: ps.sourceName,
          keptResults: ps.kept, results: [], successes: 0, banes: 0,
        });
        else if (ps && ps.kept.length > 0) segments.push({
          origin: "attribute", count: 0,
          dieType: "d6", formula: "0d6",
          sourceId: ps.sourceId, sourceName: ps.sourceName,
          keptResults: ps.kept, results: [], successes: 0, banes: 0,
        });
      } else {
        segments.push({
          origin: "attribute", count: attrVal, dieType: "d6", formula: `${attrVal}d6`,
          sourceId: attributeItem?.id, sourceName: attributeItem?.name,
          keptResults: [], results: [], successes: 0, banes: 0,
        });
      }
    }

    // Skill
    const skillDice = Math.max(0, (actor.getSkillPool(skillItem) ?? 0) + modifier);
    if (skillDice > 0) {
      if (isPush) {
        const ps = pushSegment("skill", skillItem?.id, skillItem?.name);
        if (ps && ps.rerollCount > 0) segments.push({
          origin: "skill", count: ps.rerollCount,
          dieType: "d6", formula: `${ps.rerollCount}d6`,
          sourceId: ps.sourceId, sourceName: ps.sourceName,
          keptResults: ps.kept, results: [], successes: 0, banes: 0,
        });
        else if (ps && ps.kept.length > 0) segments.push({
          origin: "skill", count: 0, dieType: "d6", formula: "0d6",
          sourceId: ps.sourceId, sourceName: ps.sourceName,
          keptResults: ps.kept, results: [], successes: 0, banes: 0,
        });
      } else {
        segments.push({
          origin: "skill", count: skillDice, dieType: "d6", formula: `${skillDice}d6`,
          sourceId: skillItem?.id, sourceName: skillItem?.name,
          keptResults: [], results: [], successes: 0, banes: 0,
        });
      }
    }

    // Gear
    for (const gear of gearItems) {
      const bonus = gear.system.bonus ?? 0;
      if (bonus <= 0) continue;
      if (isPush) {
        const ps = pushSegment("gear", gear.id, gear.name);
        if (ps && ps.rerollCount > 0) segments.push({
          origin: "gear", count: ps.rerollCount,
          dieType: "d6", formula: `${ps.rerollCount}d6`,
          sourceId: gear.id, sourceName: gear.name,
          keptResults: ps.kept, results: [], successes: 0, banes: 0,
        });
      } else {
        segments.push({
          origin: "gear", count: bonus, dieType: "d6", formula: `${bonus}d6`,
          sourceId: gear.id, sourceName: gear.name,
          keptResults: [], results: [], successes: 0, banes: 0,
        });
      }
    }

    // Stress
    if (cfg.enableStress) {
      const stressVal = actor.stressLevel;
      if (stressVal > 0 || isPush) {
        if (isPush) {
          const ps = pushSegment("stress", null, "Stress");
          // Stress au push : même règle que les autres segments
          // banes gardés, succès gardés si keepSuccesses, reste re-rollé
          // + 1 dé supplémentaire (stress monte de 1)
          const prevKept    = ps?.kept ?? [];  // déjà filtrés par pushSegment (banes + succès si keepSuccesses)
          const prevResults = ps ? [...(ps.kept ?? []), ...(ps.rerollable ?? [])] : [];
          const extraDie    = 1; // push = +1 stress
          const totalDice   = (prevResults.length || stressVal) + extraDie;
          const rerollCount = totalDice - prevKept.length;
          if (totalDice > 0) segments.push({
            origin: "stress", count: Math.max(0, rerollCount),
            dieType: "d6", formula: `${Math.max(0, rerollCount)}d6`,
            keptResults: prevKept, results: [], successes: 0, banes: 0,
          });
        } else {
          segments.push({
            origin: "stress", count: stressVal, dieType: "d6", formula: `${stressVal}d6`,
            keptResults: [], results: [], successes: 0, banes: 0,
          });
        }
      }
    }

    Hooks.callAll("yze.preBuildSegments", segments, actor, {
      skillItem, attributeItem, gearItems, isPush, prevRoll,
    });

    return segments;
  }

  static _rerollableCount(prevRoll, origin, sourceId = null) {
    // Conservé pour compatibilité externe, mais plus utilisé en interne
    if (!prevRoll) return 0;
    const seg = prevRoll.segments?.find(
      s => s.origin === origin && (sourceId == null || s.sourceId === sourceId)
    );
    if (!seg?.results) return 0;
    const keepSuccesses = game.settings.get("yzegenerique", "keepSuccessesOnPush") ?? false;
    return seg.results.filter(r => {
      if (r === 1) return false;
      if (keepSuccesses && r === 6) return false;
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
      segments, roll, pushed,
      actorId:         actor.id,
      skillName:       skillItem?.name     ?? null,
      attributeName:   attributeItem?.name ?? null,
      skillItemId:     skillItem?.id       ?? null,
      attributeItemId: attributeItem?.id   ?? null,
      totalSuccesses: 0, totalBanes: 0, gearBanes: 0,
      stressBanes:    0,  // nouveaux banes stress uniquement (pas les gardés)
      success:        false,
    };

    for (const seg of segments) {
      seg.successes = 0;
      seg.banes     = 0;
      const successFn = seg.successFn ?? ((v) => v === 6);
      const baneFn    = seg.baneFn    ?? ((v) => v === 1);

      // Dés nouveaux (re-rollés)
      for (const val of (seg.results ?? [])) {
        if (successFn(val)) { seg.successes++; rollData.totalSuccesses++; }
        if (baneFn(val)) {
          seg.banes++;
          if (seg.origin !== "stress") rollData.totalBanes++;
          if (seg.origin === "gear")   rollData.gearBanes++;
          if (seg.origin === "stress") rollData.stressBanes++; // nouveau → peut triggeer panic
        }
      }

      // Dés gardés (banes + succès conservés du jet précédent)
      for (const val of (seg.keptResults ?? [])) {
        if (successFn(val)) { seg.successes++; rollData.totalSuccesses++; }
        if (baneFn(val)) {
          seg.banes++;
          if (seg.origin !== "stress") rollData.totalBanes++;
          if (seg.origin === "gear")   rollData.gearBanes++;
          // Les banes stress gardés ne déclenchent PAS panic
        }
      }
    }

    rollData.success = rollData.totalSuccesses > 0;
    return rollData;
  }

  /**
   * Applique le colorset "yze-stress" sur les Die objects du roll
   * correspondant aux segments de stress. DSN lit die.options.colorset.
   */
  static _applyStressColor(roll, segments) {
    if (!roll?.dice?.length) return;
    let dieIdx = 0;
    for (const seg of segments) {
      if ((seg.count ?? 0) <= 0 && (seg.keptResults?.length ?? 0) === 0) continue;
      const count = seg.count ?? 0;
      if (count <= 0) { dieIdx++; continue; }
      const die = roll.dice[dieIdx];
      if (die) {
        if (!die.options) die.options = {};
        if (seg.origin === "stress") die.options.colorset = "yze-stress";
        else if (seg.origin === "gear") die.options.colorset = "yze-gear";
      }
      dieIdx++;
    }
  }

  // ── Affichage chat ─────────────────────────────────────────────────

  static async _sendToChat(rollData, actor) {
    const label   = [rollData.attributeName, rollData.skillName].filter(Boolean).join(" / ");
    const rollId  = foundry.utils.randomID();
    const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";

    // ── Dés individuels par segment ────────────────────────────
    const diceDetailsHtml = rollData.segments
      .filter(s => (s.count > 0 || (s.keptResults?.length > 0)))
      .map(s => {
        const icons = { attribute: "⬡", skill: "◆", gear: "⚙", stress: "⚡", strand: "∞" };
        const icon  = icons[s.origin] ?? "●";
        const label = s.sourceName ?? s.origin;

        // Dés gardés (préfixe "kept")
        const keptDice = (s.keptResults ?? []).map(r => {
          const cls = r === 6 ? "yze-die--success yze-die--kept"
                    : r === 1 ? "yze-die--bane yze-die--kept"
                    :           "yze-die--neutral yze-die--kept";
          return `<span class="yze-die ${cls}" title="Kept">${r}</span>`;
        }).join("");

        // Nouveaux dés re-rollés
        const newDice = (s.results ?? []).map(r => {
          const cls = r === 6 ? "yze-die--success" : r === 1 ? "yze-die--bane" : "yze-die--neutral";
          return `<span class="yze-die ${cls}">${r}</span>`;
        }).join("");

        return `<div class="yze-dice-segment" data-origin="${s.origin}">
          <span class="yze-dice-label">${icon} ${label}</span>
          <span class="yze-dice-row">${keptDice}${keptDice && newDice ? '<span class="yze-dice-sep">|</span>' : ""}${newDice}</span>
        </div>`;
      }).join("");

    // ── Résumé compact des segments ────────────────────────────
    const segmentSummary = rollData.segments
      .filter(s => s.count > 0)
      .map(s => {
        const icons = { attribute: "⬡", skill: "◆", gear: "⚙", stress: "⚡", strand: "∞" };
        const baneStr = s.banes > 0 ? `<span class="yze-bane"> ${s.banes}✕</span>` : "";
        return `<span class="yze-segment" data-origin="${s.origin}">${icons[s.origin] ?? "●"} ${s.count}d${baneStr}</span>`;
      }).join(" ");

    const pushHint = (game.settings.get("yzegenerique", "keepSuccessesOnPush") ?? false)
      ? "Keeps successes"
      : "Re-rolls all non-bane dice";

    const content = `
      <div class="yze-roll-result yze-preset-${presetId}" data-roll-id="${rollId}"
           data-actor-id="${actor.id}"
           data-skill-id="${rollData.skillItemId ?? ""}"
           data-attribute-id="${rollData.attributeItemId ?? ""}">
        <div class="yze-roll-header">
          <span class="yze-roll-actor">${actor.name}</span>
          ${label ? `<span class="yze-roll-label">${label}</span>` : ""}
          ${rollData.pushed ? `<span class="yze-roll-pushed-badge">↻ Pushed</span>` : ""}
        </div>
        <div class="yze-roll-outcome ${rollData.success ? "success" : "failure"}">
          ${rollData.success
            ? `<span class="yze-roll-success-icon">✓</span>
               <span class="yze-roll-success-count">${rollData.totalSuccesses}</span>
               <span class="yze-roll-success-label">success${rollData.totalSuccesses > 1 ? "es" : ""}</span>`
            : `<span class="yze-roll-fail-icon">✗</span>
               <span class="yze-roll-fail-label">Failure</span>`
          }
          ${rollData.totalBanes > 0
            ? `<span class="yze-roll-banes">⚑ ${rollData.totalBanes} bane${rollData.totalBanes > 1 ? "s" : ""}</span>`
            : ""}
        </div>
        <div class="yze-roll-pool">${segmentSummary}</div>
        <details class="yze-roll-details">
          <summary>Show dice</summary>
          <div class="yze-roll-dice-detail">${diceDetailsHtml}</div>
        </details>
        ${rollData.stressBanes > 0 ? `
        <div class="yze-roll-panic">
          ⚡ Stress bane — Panic triggered
          <button class="yze-panic-btn" type="button" data-action="rollPanic" data-actor-id="${actor.id}">
            🎲 Roll Panic
          </button>
        </div>` : ""}
        ${!rollData.pushed ? `
        <div class="yze-roll-push-row">
          <button class="yze-push-btn" type="button" data-action="pushRoll" data-roll-id="${rollId}"
            ${rollData.stressBanes > 0 ? 'disabled title="Cannot push — Panic triggered"' : ""}>
            ↻ Push Roll
          </button>
          <span class="yze-push-hint">${rollData.stressBanes > 0
            ? "⚡ Cannot push after Panic"
            : pushHint}</span>
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
      flags:   rollFlags,
      rolls:   [rollData.roll],
      sound:   CONFIG.sounds.dice,
    };

    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined) {
      messageData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    } else if (CONST.CHAT_MESSAGE_TYPES?.ROLL !== undefined) {
      messageData.type = CONST.CHAT_MESSAGE_TYPES.ROLL;
    }

    // Ajouter dans la queue DSN pour colorisation
    if (rollData.roll && globalThis.YZE_DSN_QUEUE !== undefined) {
      globalThis.YZE_DSN_QUEUE.push({
        formula:  rollData.roll.formula ?? rollData.roll._formula ?? "",
        segments: rollData.segments,
      });
    }

    await ChatMessage.create(messageData);
  }
}
