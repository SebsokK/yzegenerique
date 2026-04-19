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
      // Push : re-roller uniquement les non-banes de chaque segment
      for (const seg of (prevRoll.segments ?? [])) {
        const rerollable = (seg.results ?? []).filter(r => {
          if (r === 1) return false;
          if (keepSuccesses && r === 6) return false;
          return true;
        });
        if (rerollable.length > 0) {
          segments.push({ origin: seg.origin, count: rerollable.length });
        }
      }
      // Stress dice au push : stressLevel + 1 (car push-stress-dice va incrémenter)
      if (enableStress && stressLevel > 0) {
        segments.push({ origin: "stress", count: stressLevel + 1 });
      }
    } else {
      // Jet initial
      const attrDice  = attrItem?.system.dicePoolContribution  ?? 0;
      const skillDice = skillItem?.system.dicePoolContribution ?? 0;
      const bonusDice = sys.bonusDice ?? 0;
      if (attrDice  > 0) segments.push({ origin: "attribute", count: attrDice });
      if (skillDice > 0) segments.push({ origin: "skill",     count: skillDice });
      if (bonusDice > 0) segments.push({ origin: "gear",      count: bonusDice });
      if (enableStress && stressLevel > 0)
        segments.push({ origin: "stress", count: stressLevel });
    }

    const totalDice = segments.reduce((s, seg) => s + seg.count, 0);
    if (totalDice <= 0) {
      ui.notifications.warn(isPush ? "YZE | Nothing to re-roll." : "YZE | Empty attack pool.");
      return;
    }

    // Lancer tous les dés d'un coup
    const roll = new Roll(`${totalDice}d6`);
    await roll.evaluate();
    const allResults = roll.dice[0].results.map(r => r.result);

    // Distribuer les résultats par segment
    let cursor = 0;
    for (const seg of segments) {
      seg.results = allResults.slice(cursor, cursor + seg.count);
      seg.successes = seg.results.filter(r => r === 6).length;
      seg.banes     = seg.results.filter(r => r === 1).length;
      cursor += seg.count;
    }

    const totalSuccesses = segments.reduce((s, seg) => s + seg.successes, 0);
    const totalBanes     = segments.reduce((s, seg) =>
      seg.origin !== "stress" ? s + seg.banes : s, 0);
    const stressBanes    = segments.find(s => s.origin === "stress")?.banes ?? 0;

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

    await GearRoller._sendWeaponToChat(actor, weaponItem, {
      roll, segments, totalSuccesses, totalBanes, stressBanes, damageDealt, dr,
      attrName:  attrItem?.name  ?? sys.linkedAttribute ?? "—",
      skillName: skillItem?.name ?? sys.linkedSkill     ?? "—",
      pushed: isPush,
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

    if (arDegradation > 0) {
      await armorItem.update({ "system.armorRating": Math.max(0, ar - arDegradation) });
    }

    await GearRoller._sendArmorToChat(actor, armorItem, {
      roll, results, absorbed, banes, arDegradation,
      incomingDamage, remainingDmg,
      arBefore: ar, arAfter: Math.max(0, ar - arDegradation),
    });
  }

  // ── Chat ──────────────────────────────────────────────────────────

  static async _sendWeaponToChat(actor, weaponItem, data) {
    const { roll, segments, totalSuccesses, totalBanes, stressBanes,
            damageDealt, dr, attrName, skillName, pushed } = data;

    // Rendu des dés par segment avec couleurs distinctes
    const segmentHtml = segments.map(seg => {
      const icon = { attribute: "⬡", skill: "◆", gear: "⚙", stress: "⚡" }[seg.origin] ?? "●";
      const diceHtml = seg.results.map(r =>
        r === 6 ? `<span class="yze-success">${r}</span>`
        : r === 1 ? `<span class="yze-bane">${r}</span>`
        : `<span class="yze-neutral">${r}</span>`
      ).join(" ");
      return `<span class="yze-seg-label">${icon}</span> ${diceHtml}`;
    }).join("  ");

    const rollId = foundry.utils.randomID();

    const content = `
      <div class="yze-roll-result yze-weapon-roll" data-roll-id="${rollId}"
           data-actor-id="${actor.id}"
           data-weapon-id="${weaponItem.id}">
        ${pushed ? `<div class="yze-roll-pushed-badge">↻ Pushed</div>` : ""}
        <div class="yze-roll-label">⚔ ${weaponItem.name}
          <span class="yze-roll-label-sub">${attrName} / ${skillName}</span>
        </div>
        <div class="yze-roll-outcome ${totalSuccesses > 0 ? "success" : "failure"}">
          ${totalSuccesses > 0
            ? `✓ ${totalSuccesses} hit${totalSuccesses > 1 ? "s" : ""} — <strong>${damageDealt}</strong> dmg (${dr} + ${totalSuccesses})`
            : "✗ Miss"
          }
        </div>
        <div class="yze-roll-dice">${segmentHtml}</div>
        ${totalBanes > 0 ? `<div class="yze-roll-banes">⚑ ${totalBanes} bane${totalBanes > 1 ? "s" : ""}</div>` : ""}
        ${stressBanes > 0 ? `
        <div class="yze-roll-panic">
          ⚡ Stress bane — Panic triggered
          <button class="yze-panic-btn" type="button"
            data-action="rollPanic"
            data-actor-id="${actor.id}">
            🎲 Roll Panic
          </button>
        </div>` : ""}
        ${!pushed ? `<div class="yze-roll-push-row">
          <button class="yze-push-btn" type="button"
            data-action="pushWeaponRoll"
            data-roll-id="${rollId}">
            ↻ Push Attack
          </button>
          <span class="yze-push-hint">${
            (game.settings.get("yzegenerique", "keepSuccessesOnPush") ?? false)
              ? "Keeps successes, re-rolls non-bane dice"
              : "Re-rolls all non-bane dice"
          }</span>
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

    const msgData = { speaker: ChatMessage.getSpeaker({ actor }), content, flags, rolls: [roll] };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
      msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    await ChatMessage.create(msgData);
  }

  static async _sendArmorToChat(actor, armorItem, data) {
    const { roll, results, absorbed, banes, arDegradation,
            incomingDamage, remainingDmg, arBefore, arAfter } = data;

    const resultStr = results.map(r =>
      r === 6 ? `<span class="yze-success">${r}</span>`
      : r === 1 ? `<span class="yze-bane">${r}</span>`
      : `<span class="yze-neutral">${r}</span>`
    ).join(" ");

    const degradeNote = arDegradation > 0
      ? `<div class="yze-armor-degrade">⚑ AR degraded: ${arBefore} → ${arAfter}</div>`
      : banes > 0
        ? `<div class="yze-armor-safe">✓ All damage absorbed — AR intact</div>`
        : "";

    const content = `
      <div class="yze-roll-result yze-armor-roll">
        <div class="yze-roll-label">🛡 ${armorItem.name}
          <span class="yze-roll-label-sub">AR ${arBefore}d6</span>
        </div>
        <div class="yze-roll-outcome ${absorbed > 0 ? "success" : "failure"}">
          ${absorbed > 0
            ? `✓ Absorbed ${absorbed}${incomingDamage > 0 ? ` — ${remainingDmg} remaining` : ""}`
            : "✗ No absorption"
          }
        </div>
        <div class="yze-roll-dice">${resultStr}</div>
        ${degradeNote}
        <div class="yze-armor-note"><em>Cannot be pushed.</em></div>
      </div>`;

    const msgData = { speaker: ChatMessage.getSpeaker({ actor }), content, rolls: [roll] };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
      msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    await ChatMessage.create(msgData);
  }
}
