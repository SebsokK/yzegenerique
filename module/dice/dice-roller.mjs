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
      actor, skillItem, attributeItem, gearItems, modifier, isPush, prevRoll, cfg, options,
    });

    if (segments.length === 0 || segments.every(s => s.count === 0)) {
      ui.notifications.warn("YZE | Empty dice pool — action impossible.");
      return null;
    }

    // 2. Formule et roll Foundry
    // Construire la formule uniquement depuis les segments avec count > 0
    const rollableSegments = segments.filter(s => (s.count ?? 0) > 0);

    if (rollableSegments.length === 0) {
      // Tous les dés sont gardés — pas besoin de roller, construire le résultat depuis keptResults
      const rollData = YZEDiceRoller._buildRollData(
        segments, null, isPush, actor, skillItem, attributeItem
      );
      await YZEDiceRoller._sendToChat(actor, skillItem, attributeItem, rollData, isPush);
      return rollData;
    }

    const formula = rollableSegments.map(s => s.formula ?? `${s.count}d6`).join(" + ");
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

  static _buildSegments({ actor, skillItem, attributeItem, gearItems, modifier, isPush, prevRoll, cfg, options = {} }) {
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
      const rerollBanes = game.settings.get("yzegenerique", "rerollBanesOnPush") ?? false;

      // Strand dice : succès sur 1 ET 6 → les deux sont gardés au push
      if (origin === "strand") {
        const kept       = allResults.filter(r => r === 1 || r === 6);
        const rerollable = allResults.filter(r => r !== 1 && r !== 6);
        return { origin, sourceId, sourceName, kept, rerollable, rerollCount: rerollable.length,
          successFn: (v) => v === 1 || v === 6, baneFn: () => false };
      }

      // Règle YZE : les succès (6) sont TOUJOURS gardés au push, tous types de dés
      // Les banes (1) sont gardés sauf si rerollBanes est activé (EA)
      const kept       = allResults.filter(r => r === 6 || (!rerollBanes && r === 1));
      const rerollable = allResults.filter(r => r !== 6 && (rerollBanes || r !== 1));

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

    // Strand dice (EA — succès sur 1 ET 6, pas de stress)
    // Règle : 1 strand exhaust = +2 dés de strand
    const strandExhausts = options?.strandCount ?? 0;
    const strandCount = strandExhausts * 2;
    if (strandCount > 0 && !isPush) {
      segments.push({
        origin:      "strand",
        count:       strandCount,
        dieType:     "d6",
        formula:     `${strandCount}d6`,
        sourceId:    null,
        sourceName:  "Strand",
        keptResults: [],
        results:     [],
        successes:   0,
        banes:       0,
        // Strand dice : succès sur 1 ET 6
        successFn:   (v) => v === 1 || v === 6,
        baneFn:      () => false,
      });
    }

    // Au push : re-roller les dés de strand non-gardés (1 ET 6 sont tous deux gardés)
    if (isPush) {
      const ps = pushSegment("strand", null, "Strand");
      if (ps && (ps.rerollCount > 0 || ps.kept.length > 0)) {
        segments.push({
          origin: "strand", count: ps.rerollCount,
          keptResults: ps.kept, results: [], successes: 0, banes: 0,
          successFn: (v) => v === 1 || v === 6,
          baneFn:    () => false,
        });
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
    if (!roll) return; // pas de nouveaux dés — tout gardé depuis keptResults
    // Uniquement les segments avec count > 0 correspondent à des DiceTerms dans roll.dice
    const rollableSegs = segments.filter(s => (s.count ?? 0) > 0);
    for (let i = 0; i < rollableSegs.length; i++) {
      const term = roll.dice[i];
      rollableSegs[i].results = term?.results.map(r => r.result) ?? [];
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

    // EA avec rerollBanes actif = pas de bane sur les dés normaux (seulement stress)
    const rerollBanes = (() => { try { return game.settings.get("yzegenerique", "rerollBanesOnPush") ?? false; } catch { return false; } })();

    for (const seg of segments) {
      seg.successes = 0;
      seg.banes     = 0;
      const successFn = seg.successFn ?? ((v) => v === 6);
      // En EA (rerollBanes), les 1 ne sont des banes que sur les dés stress
      const defaultBaneFn = rerollBanes && seg.origin !== "stress"
        ? () => false
        : (v) => v === 1;
      const baneFn    = seg.baneFn ?? defaultBaneFn;

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
    const isEA = presetId === "eldritch-automata";

    // Fonction de rendu d'une face — icônes pour tous les presets
    const rerollBanesActive = (() => { try { return game.settings.get("yzegenerique", "rerollBanesOnPush") ?? false; } catch { return false; } })();
    const renderFace = (r, isStress = false, isStrand = false) => {
      if (r === 6) return "★";
      if (r === 1) {
        if (isStrand) return "★";           // strand : 1 = succès
        if (isStress) return "⚡";           // stress : 1 = bane stress
        if (rerollBanesActive) return String(r); // EA normal : 1 = neutre, afficher le chiffre
        return "⊘";                          // SH/H! normal : 1 = bane
      }
      return String(r); // faces neutres : afficher le chiffre
    };

    // ── Dés individuels par segment ────────────────────────────
    const diceDetailsHtml = rollData.segments
      .filter(s => (s.count > 0 || (s.keptResults?.length > 0)))
      .map(s => {
        const icons = { attribute: "⬡", skill: "◆", gear: "⚙", stress: "⚡", strand: "∞" };
        const icon  = icons[s.origin] ?? "●";
        const label = s.sourceName ?? s.origin;

        // Dés gardés (préfixe "kept")
        const keptDice = (s.keptResults ?? []).map(r => {
          const isBaneKept = r === 1 && (s.origin === "stress" || !rerollBanesActive);
          const clsKept = r === 6 || (r === 1 && s.origin === "strand") ? "yze-die--success yze-die--kept"
                        : isBaneKept ? "yze-die--bane yze-die--kept"
                        : "yze-die--neutral yze-die--kept";
          return `<span class="yze-die ${clsKept}" title="${r}">${renderFace(r, s.origin === "stress", s.origin === "strand")}</span>`;
        }).join("");

        // Nouveaux dés re-rollés
        const newDice = (s.results ?? []).map(r => {
          const isBaneNew = r === 1 && (s.origin === "stress" || !rerollBanesActive);
          const clsNew = r === 6 || (r === 1 && s.origin === "strand") ? "yze-die--success"
                       : isBaneNew ? "yze-die--bane" : "yze-die--neutral";
          return `<span class="yze-die ${clsNew}" title="${r}">${renderFace(r, s.origin === "stress", s.origin === "strand")}</span>`;
        }).join("");

        return `<div class="yze-dice-segment" data-origin="${s.origin}">
          <span class="yze-dice-label">${icon} ${label}</span>
          <span class="yze-dice-row">${keptDice}${newDice}</span>
        </div>`;
      }).join("");

    // ── Résumé compact des segments — icônes pour tous les presets ─
    const segmentSummary = rollData.segments
      .filter(s => s.count > 0)
      .map(s => {
        const allResults = [...(s.keptResults ?? []), ...(s.results ?? [])];
        const dice = allResults.map(r => {
          const isBaneInline = r === 1 && (s.origin === "stress" || !rerollBanesActive);
          const cls = r === 6 || (r === 1 && s.origin === "strand") ? "yze-die--success" : isBaneInline ? "yze-die--bane" : "yze-die--neutral";
          return `<span class="yze-die ${cls}" data-origin="${s.origin}" title="${r}">${renderFace(r, s.origin === "stress", s.origin === "strand")}</span>`;
        }).join("");
        return `<span class="yze-segment" data-origin="${s.origin}">${dice}</span>`;
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
          ${rollData.totalBanes > 0 && !rerollBanesActive
            ? `<span class="yze-roll-banes">⊘ ${rollData.totalBanes} bane${rollData.totalBanes > 1 ? "s" : ""}</span>`
            : ""}
        </div>
        <details class="yze-roll-details">
          <summary class="yze-roll-details-summary">Show dice</summary>
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
