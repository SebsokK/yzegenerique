/**
 * GearRoller — jets de dés pour Weapon et Armor.
 *
 * Weapon :
 *   Pool = attr.current + skill.value + bonusDice [+ stressDice si enableStress]
 *   Dommages = DR fixe + 1 par succès
 *   Stress dice : un bane sur stress die → bouton "Roll Panic"
 *   Push : banes sur attr/skill → handler de push (stress +1, dommages, etc.)
 *
 * Armor :
 *   Pool = armorRating D6 (non pushable, pas de stress dice)
 *   Chaque 6 absorbe 1 dégât
 *   Chaque 1 dégrade AR sauf si tous les dégâts sont absorbés
 *
 * Foundry VTT V14
 */

export class GearRoller {

  // ── Weapon ────────────────────────────────────────────────────────

  static async rollWeapon(actor, weaponItem, options = {}) {
    const sys      = weaponItem.system;
    const isPush   = options.pushed ?? false;
    const prevRoll = options.previousRoll ?? null;

    // Capturer la cible sélectionnée
    const targetToken = game.user.targets.first();
    const targetActor = targetToken?.actor ?? null;

    // ── Dialog de confirmation (uniquement sur le jet initial) ────
    let modifier = options.modifier ?? 0;
    let useAmmo  = false;

    if (!isPush) {
      // Vérifier les munitions AVANT d'ouvrir la dialog
      if (sys.isRanged && (sys.currentReloads ?? 0) <= 0 && (sys.maxReloads ?? 0) > 0) {
        const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
        // Utiliser Dialog V1 (universellement disponible en V14)
        const doReload = await new Promise(resolve => {
          new Dialog({
            title:   `Out of Ammunition`,
            content: `<div class="attack-dialog-body yze-preset-${presetId}">
              <div class="attack-dialog-weapon-name">🔫 ${weaponItem.name}</div>
              <p class="attack-dialog-ammo-msg">No ammunition remaining.<br>Reload before attacking.</p>
            </div>`,
            buttons: {
              reload: { icon: '<i class="fas fa-sync"></i>', label: "🔄 Reload", callback: () => resolve(true)  },
              cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel",    callback: () => resolve(false) },
            },
            default: "reload",
            close:   () => resolve(false),
          }).render(true);
        });
        if (doReload) {
          await weaponItem.update({ "system.currentReloads": sys.maxReloads ?? 0 });
          await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `<div class="yze-roll-result yze-preset-${presetId}">
              <div class="yze-roll-header">
                <span class="yze-roll-actor">${actor.name}</span>
                <span class="yze-roll-label">🔄 ${weaponItem.name} — Reload</span>
              </div>
            </div>`,
          });
        }
        return;
      }

      const { AttackDialog } = await import("../ui/attack-dialog.mjs");
      const result = await AttackDialog.prompt(actor, weaponItem);
      if (!result) return;
      modifier = result.modifier;
      useAmmo  = result.useAmmo;
    }

    // Résolution attribut et skill
    const attrItem  = sys.linkedAttribute
      ? actor.getAttributeBySlug(sys.linkedAttribute) : null;
    const skillItem = sys.linkedSkill
      ? actor.skills.find(s =>
          (s.system.slug || s.name.toLowerCase()) === sys.linkedSkill.toLowerCase()
        ) : null;

    if (!attrItem && !skillItem && (sys.bonusDice ?? 0) === 0) {
      ui.notifications.warn(`YZE | ${weaponItem.name} has no linked attribute, skill, or bonus dice.`);
      return;
    }

    const { getRuleConfig } = await import("../rules/rule-config.mjs");
    const cfg = getRuleConfig();
    const enableStress   = cfg.enableStress ?? false;
    const keepSuccesses  = cfg.keepSuccessesOnPush ?? false;
    const stressLevel    = enableStress ? actor.stressLevel : 0;

    // ── Calcul du pool segmenté ────────────────────────────────────
    // Chaque segment : { origin, count, results }
    const segments = [];

    if (isPush && prevRoll) {
      // Push : conserver banes (1) + succès (6) si keepSuccesses, re-roller le reste
      for (const seg of (prevRoll.segments ?? [])) {
        const allResults = [...(seg.results ?? []), ...(seg.keptResults ?? [])];
        const kept       = allResults.filter(r => r === 1 || (keepSuccesses && r === 6));
        const rerollable = allResults.filter(r => r !== 1 && !(keepSuccesses && r === 6));

        if (rerollable.length > 0 || kept.length > 0) {
          segments.push({
            origin:      seg.origin,
            count:       rerollable.length,
            keptResults: kept,
            results:     [],
            successes:   0,
            banes:       0,
            sourceId:    seg.sourceId ?? null,
            sourceName:  seg.sourceName ?? null,
          });
        }
      }
      // Stress dice au push
      if (enableStress && stressLevel > 0) {
        const prevStress  = prevRoll.segments?.find(s => s.origin === "stress");
        const keptStress  = (prevStress?.results ?? []).filter(r => r === 1);
        const newCount    = Math.max(0, stressLevel + 1 - keptStress.length);
        segments.push({
          origin: "stress", count: newCount,
          keptResults: keptStress, results: [], successes: 0, banes: 0,
        });
      }
    } else {
      // Jet initial
      const attrDice  = (attrItem ? actor.getAttributePool(attrItem) : 0)  ?? 0;
      const skillDice = (skillItem ? actor.getSkillPool(skillItem) : 0) ?? 0;
      const bonusDice = sys.bonusDice ?? 0;
      // Modificateur s'applique sur attr+skill+bonus, pas sur stress
      const modifiedDice = Math.max(1, attrDice + skillDice + bonusDice + modifier);
      // On reconstruit les segments en respectant les proportions
      // Simplification : on ajoute le modificateur sur le segment attr en priorité
      const attrFinal   = Math.max(0, attrDice + modifier);
      const skillFinal  = skillDice;
      const bonusFinal  = bonusDice;
      // Si le modificateur réduit trop, on garantit au moins 1 dé total
      const totalBase = attrFinal + skillFinal + bonusFinal;
      if (attrFinal  > 0) segments.push({ origin: "attribute", count: attrFinal,  results: [], successes: 0, banes: 0, keptResults: [] });
      if (skillFinal > 0) segments.push({ origin: "skill",     count: skillFinal, results: [], successes: 0, banes: 0, keptResults: [] });
      if (bonusFinal > 0) segments.push({ origin: "gear",      count: bonusFinal, results: [], successes: 0, banes: 0, keptResults: [] });
      // Si tout à zéro (modificateur très négatif), forcer 1 dé attr
      if (totalBase <= 0) segments.push({ origin: "attribute", count: 1, results: [], successes: 0, banes: 0, keptResults: [] });
      if (enableStress && stressLevel > 0)
        segments.push({ origin: "stress", count: stressLevel, results: [], successes: 0, banes: 0, keptResults: [] });
    }

    const totalDice = segments.reduce((s, seg) => s + seg.count, 0);
    if (totalDice <= 0) {
      ui.notifications.warn(isPush ? "YZE | Nothing to re-roll." : "YZE | Empty attack pool.");
      return;
    }

    // Lancer les dés — UN groupe par segment pour que DSN puisse colorer séparément
    const formula = segments
      .filter(s => s.count > 0)
      .map(s => `${s.count}d6`)
      .join(" + ");
    const roll = new Roll(formula);
    await roll.evaluate();

    // Distribuer les résultats par segment
    let dieGroupIdx = 0;
    for (const seg of segments) {
      if (seg.count <= 0) continue;
      const die = roll.dice[dieGroupIdx];
      seg.results = die ? die.results.map(r => r.result) : [];
      dieGroupIdx++;
      const allDice = [...seg.results, ...(seg.keptResults ?? [])];
      seg.successes = allDice.filter(r => r === 6).length;
      seg.banes     = allDice.filter(r => r === 1).length;
    }

    const totalSuccesses = segments.reduce((s, seg) => s + seg.successes, 0);
    const totalBanes     = segments.reduce((s, seg) =>
      seg.origin !== "stress" ? s + seg.banes : s, 0);
    // stressBanes : uniquement les NOUVEAUX banes stress (pas les keptResults)
    const stressSeg   = segments.find(s => s.origin === "stress");
    const stressBanes = stressSeg ? stressSeg.results.filter(r => r === 1).length : 0;

    // Dommages : DR fixe + 1 par succès
    const dr          = sys.damage ?? 0;
    const damageDealt = totalSuccesses > 0 ? dr + totalSuccesses : 0;

    // ── Effets du push ─────────────────────────────────────────────
    if (isPush) {
      if (cfg.pushVariant === "stressDice") {
        // Push stress dice : stress +1 via le handler dédié
        const { getPushHandler } = await import("./push-handler.mjs");
        const handler = getPushHandler("stressDice");
        await handler.apply({ stressBanes, pushed: true, actorId: actor.id }, actor, {});
      } else if (totalBanes > 0) {
        // Autres variantes : appliquer les banes normalement
        const { getPushHandler } = await import("./push-handler.mjs");
        const handler = getPushHandler(cfg.pushVariant);
        const rollData = {
          segments: segments.map(s => ({
            origin: s.origin, results: s.results,
            sourceId: s.origin === "attribute" ? attrItem?.id : null,
            banes: s.banes, successes: s.successes, count: s.count,
          })),
          totalBanes, gearBanes: 0, stressBanes,
          pushed: true, actorId: actor.id,
        };
        await handler.apply(rollData, actor, { gearItems: [] });
      }
    }

    // ── Déduction munitions ────────────────────────────────────────
    if (!isPush && useAmmo && sys.isRanged) {
      const current = sys.currentReloads ?? 0;
      if (current > 0) {
        await weaponItem.update({ "system.currentReloads": current - 1 });
      }
    }

    // Coloriser les dés par segment avant l'animation DSN
    if (roll?.dice?.length) {
      let dieIdx = 0;
      for (const seg of segments) {
        if ((seg.count ?? 0) <= 0) continue;
        const die = roll.dice[dieIdx];
        if (die) {
          if (!die.options) die.options = {};
          if (seg.origin === "stress") die.options.colorset = "yze-stress";
          else if (seg.origin === "gear") die.options.colorset = "yze-gear";
        }
        dieIdx++;
      }
    }

    await GearRoller._sendWeaponToChat(actor, weaponItem, {
      roll, segments, totalSuccesses, totalBanes, stressBanes, damageDealt, dr,
      attrName:    attrItem?.name  ?? sys.linkedAttribute ?? "—",
      skillName:   skillItem?.name ?? sys.linkedSkill     ?? "—",
      pushed:      isPush,
      targetActor,
    });
  }

  // ── Armor ─────────────────────────────────────────────────────────

  static async rollArmor(actor, armorItem, options = {}) {
    const sys = armorItem.system;
    const ar  = sys.armorRating ?? 0;

    if (ar <= 0) {
      ui.notifications.warn(`YZE | ${armorItem.name} is destroyed (AR = 0).`);
      return;
    }

    const roll = new Roll(`${ar}d6`);
    await roll.evaluate();

    const results  = roll.dice[0].results.map(r => r.result);
    const absorbed = results.filter(r => r === 6).length;
    const banes    = results.filter(r => r === 1).length;

    const incomingDamage = options.incomingDamage ?? 0;
    const remainingDmg   = Math.max(0, incomingDamage - absorbed);
    const arDegradation  = remainingDmg > 0 ? banes : 0;
    const targetActor    = options.targetActor ?? null;

    if (arDegradation > 0) {
      await armorItem.update({ "system.armorRating": Math.max(0, ar - arDegradation) });
    }

    await GearRoller._sendArmorToChat(actor, armorItem, {
      roll, results, absorbed, banes, arDegradation,
      incomingDamage, remainingDmg,
      arBefore: ar, arAfter: Math.max(0, ar - arDegradation),
      targetActor,
    });
  }

  // ── Chat ──────────────────────────────────────────────────────────

  static async _sendWeaponToChat(actor, weaponItem, data) {
    const { roll, segments, totalSuccesses, totalBanes, stressBanes,
            damageDealt, dr, attrName, skillName, pushed, targetActor } = data;

    const rollId   = foundry.utils.randomID();
    const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";

    const diceDetailsHtml = segments.filter(s => s.count > 0 || (s.keptResults?.length > 0)).map(s => {
      const icons = { attribute: "⬡", skill: "◆", gear: "⚙", stress: "⚡" };
      const keptDice = (s.keptResults ?? []).map(r => {
        const cls = r === 6 ? "yze-die--success yze-die--kept"
                  : r === 1 ? "yze-die--bane yze-die--kept"
                  :           "yze-die--neutral yze-die--kept";
        return `<span class="yze-die ${cls}" title="Kept">${r}</span>`;
      }).join("");
      const newDice = (s.results ?? []).map(r => {
        const cls = r === 6 ? "yze-die--success" : r === 1 ? "yze-die--bane" : "yze-die--neutral";
        return `<span class="yze-die ${cls}">${r}</span>`;
      }).join("");
      const sep = keptDice && newDice ? '<span class="yze-dice-sep">|</span>' : "";
      return `<div class="yze-dice-segment" data-origin="${s.origin}"><span class="yze-dice-label">${icons[s.origin] ?? "●"} ${s.origin}</span><span class="yze-dice-row">${keptDice}${sep}${newDice}</span></div>`;
    }).join("");

    const segmentSummary = segments.filter(s => s.count > 0).map(s => {
      const icons = { attribute: "⬡", skill: "◆", gear: "⚙", stress: "⚡" };
      const baneStr = s.banes > 0 ? `<span class="yze-bane"> ${s.banes}✕</span>` : "";
      return `<span class="yze-segment" data-origin="${s.origin}">${icons[s.origin] ?? "●"} ${s.count}d${baneStr}</span>`;
    }).join(" ");

    const pushHint = (game.settings.get("yzegenerique", "keepSuccessesOnPush") ?? false)
      ? "Keeps successes" : "Re-rolls all non-bane dice";

    // ── Bloc ciblage ───────────────────────────────────────────────
    let targetBlock = "";
    if (totalSuccesses > 0 && targetActor) {
      const targetArmors = targetActor.items.filter(i =>
        i.type === "armor" && !i.system.isDestroyed
      );
      const hasArmor = targetArmors.length > 0;
      const targetArmorId = hasArmor ? targetArmors[0].id : "";

      targetBlock = `
        <div class="yze-roll-target-block">
          <div class="yze-roll-target-header">
            🎯 <strong>${targetActor.name}</strong>
            <span class="yze-push-hint">${damageDealt} dmg incoming</span>
          </div>
          <div class="yze-roll-target-actions">
            ${hasArmor ? `
            <button class="yze-armor-roll-btn" type="button"
              data-action="rollTargetArmor"
              data-target-actor-id="${targetActor.id}"
              data-armor-id="${targetArmorId}"
              data-damage="${damageDealt}">
              🛡 Roll Armor (${targetArmors[0].name} AR ${targetArmors[0].system.armorRating})
            </button>` : ""}
            <button class="yze-apply-dmg-btn" type="button"
              data-action="applyDamage"
              data-target-actor-id="${targetActor.id}"
              data-damage="${damageDealt}">
              💥 Apply ${damageDealt} Damage
            </button>
          </div>
        </div>`;
    } else if (totalSuccesses > 0 && !targetActor) {
      targetBlock = `
        <div class="yze-roll-target-block yze-roll-target-none">
          <span class="yze-push-hint">💡 Select a target token to apply damage</span>
        </div>`;
    }

    const content = `
      <div class="yze-roll-result yze-weapon-roll yze-preset-${presetId}" data-roll-id="${rollId}"
           data-actor-id="${actor.id}" data-weapon-id="${weaponItem.id}">
        <div class="yze-roll-header">
          <span class="yze-roll-actor">${actor.name}</span>
          <span class="yze-roll-label">⚔ ${weaponItem.name}</span>
          <span class="yze-roll-label-sub">${attrName} / ${skillName}</span>
          ${pushed ? `<span class="yze-roll-pushed-badge">↻ Pushed</span>` : ""}
        </div>
        <div class="yze-roll-outcome ${totalSuccesses > 0 ? "success" : "failure"}">
          ${totalSuccesses > 0
            ? `<span class="yze-roll-success-icon">✓</span>
               <span class="yze-roll-success-count">${totalSuccesses}</span>
               <span class="yze-roll-success-label">hit${totalSuccesses > 1 ? "s" : ""}</span>
               <span class="yze-weapon-dmg">— <strong>${damageDealt}</strong> dmg</span>`
            : `<span class="yze-roll-fail-icon">✗</span><span class="yze-roll-fail-label">Miss</span>`}
          ${totalBanes > 0 ? `<span class="yze-roll-banes">⚑ ${totalBanes} bane${totalBanes > 1 ? "s" : ""}</span>` : ""}
        </div>
        <div class="yze-roll-pool">${segmentSummary}</div>
        <details class="yze-roll-details"><summary>Show dice</summary>
          <div class="yze-roll-dice-detail">${diceDetailsHtml}</div>
        </details>
        ${targetBlock}
        ${stressBanes > 0 ? `<div class="yze-roll-panic">⚡ Stress bane
          <button class="yze-panic-btn" type="button" data-action="rollPanic" data-actor-id="${actor.id}">🎲 Roll Panic</button>
        </div>` : ""}
        ${!pushed ? `<div class="yze-roll-push-row">
          <button class="yze-push-btn" type="button" data-action="pushWeaponRoll" data-roll-id="${rollId}"
            ${stressBanes > 0 ? 'disabled title="Cannot push — Panic triggered"' : ""}>
            ↻ Push Attack
          </button>
          <span class="yze-push-hint">${stressBanes > 0 ? "⚡ Cannot push after Panic" : pushHint}</span>
        </div>` : ""}
        ${totalSuccesses >= 2 ? `
        <div class="yze-roll-critical-row">
          <button class="yze-critical-btn" type="button"
            data-action="rollCriticalInjury"
            data-actor-id="${actor.id}">
            🩸 Roll Critical Injury
          </button>
          <span class="yze-push-hint">${totalSuccesses} hits</span>
        </div>` : ""}
      </div>`;

    const flags = {
      yzegenerique: {
        weaponRoll: {
          actorId:  actor.id,
          weaponId: weaponItem.id,
          segments: segments.map(s => ({
            origin: s.origin, results: s.results, count: s.count,
          })),
          pushed, rollId,
        },
      },
    };

    // Ajouter dans la queue DSN pour colorisation
    if (roll && globalThis.YZE_DSN_QUEUE !== undefined) {
      globalThis.YZE_DSN_QUEUE.push({
        formula:  roll.formula ?? roll._formula ?? "",
        segments,
      });
    }

    const msgData = { speaker: ChatMessage.getSpeaker({ actor }), content, flags, rolls: [roll], sound: CONFIG.sounds.dice };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
      msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    await ChatMessage.create(msgData);
  }

  static async _sendArmorToChat(actor, armorItem, data) {
    const { roll, results, absorbed, banes, arDegradation,
            incomingDamage, remainingDmg, arBefore, arAfter, targetActor } = data;

    const presetId  = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";

    const diceHtml = results.map(r => {
      const cls = r === 6 ? "yze-die--success" : r === 1 ? "yze-die--bane" : "yze-die--neutral";
      return `<span class="yze-die ${cls}">${r}</span>`;
    }).join("");

    const degradeNote = arDegradation > 0
      ? `<span class="yze-roll-banes">⚑ AR degraded: ${arBefore} → ${arAfter}</span>`
      : "";

    // Bouton Apply Damage sur les dégâts restants après armure
    let applyBlock = "";
    if (targetActor) {
      const dmg = remainingDmg;
      applyBlock = `
        <div class="yze-roll-target-block">
          <div class="yze-roll-target-header">
            🎯 <strong>${targetActor.name}</strong>
            <span class="yze-push-hint">${dmg} dmg after armor</span>
          </div>
          <div class="yze-roll-target-actions">
            ${dmg > 0
              ? `<button class="yze-apply-dmg-btn" type="button"
                  data-action="applyDamage"
                  data-target-actor-id="${targetActor.id}"
                  data-damage="${dmg}">
                  💥 Apply ${dmg} Damage
                </button>`
              : `<span class="yze-push-hint">✓ All damage absorbed</span>`
            }
          </div>
        </div>`;
    }

    const content = `
      <div class="yze-roll-result yze-armor-roll yze-preset-${presetId}">
        <div class="yze-roll-header">
          <span class="yze-roll-actor">${actor.name}</span>
          <span class="yze-roll-label">🛡 ${armorItem.name}</span>
          <span class="yze-roll-label-sub">AR ${arBefore}d6</span>
        </div>
        <div class="yze-roll-outcome ${absorbed > 0 ? "success" : "failure"}">
          ${absorbed > 0
            ? `<span class="yze-roll-success-icon">✓</span>
               <span class="yze-roll-success-count">${absorbed}</span>
               <span class="yze-roll-success-label">absorbed${remainingDmg > 0 ? ` — ${remainingDmg} remaining` : ""}</span>`
            : `<span class="yze-roll-fail-icon">✗</span>
               <span class="yze-roll-fail-label">No absorption</span>`}
          ${degradeNote}
        </div>
        <details class="yze-roll-details"><summary>Show dice</summary>
          <div class="yze-roll-dice-detail">
            <div class="yze-dice-segment">
              <span class="yze-dice-label">🛡 armor</span>
              <span class="yze-dice-row">${diceHtml}</span>
            </div>
          </div>
        </details>
        ${applyBlock}
        <div class="yze-armor-note"><em>Cannot be pushed.</em></div>
      </div>`;

    const msgData = { speaker: ChatMessage.getSpeaker({ actor }), content, rolls: [roll], sound: CONFIG.sounds.dice };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
      msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    await ChatMessage.create(msgData);
  }
}
