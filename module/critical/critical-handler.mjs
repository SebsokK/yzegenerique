/**
 * CriticalHandler — tire une Critical Injury via D66 et envoie un message thématique.
 * Foundry VTT V14
 */

export class CriticalHandler {

  static async roll(actor) {
    const presetId  = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
    const tableName = CriticalHandler._tableNameForPreset(presetId);

    // D66 : deux D6 séparés pour Dice So Nice
    const d1 = new Roll("1d6");
    const d2 = new Roll("1d6");
    await d1.evaluate();
    await d2.evaluate();
    const tens  = d1.dice[0].results[0].result;
    const units = d2.dice[0].results[0].result;
    const d66   = tens * 10 + units;

    const ciItem = await CriticalHandler._findInjuryItem(d66, presetId);

    const actorName  = actor?.name ?? "Unknown";
    const injName    = ciItem?.name ?? `Result ${d66}`;
    const lethal     = ciItem?.system?.lethal ?? false;
    const effect     = ciItem?.system?.effect ?? "";
    const timeLimit  = ciItem?.system?.timeLimit ?? "";
    const healingTime = ciItem?.system?.healingTime ?? "";

    // UUID drag-droppable — Foundry enrichit automatiquement @UUID[...]{label}
    const uuidLink = ciItem
      ? `@UUID[${ciItem.uuid}]{${injName}}`
      : `**${injName}**`;

    // Healing time — inline roll Foundry natif [[/r Xd6]]
    let healingDisplay = healingTime;
    if (healingTime && /^\d*d\d+$/i.test(healingTime.trim())) {
      healingDisplay = `[[/r ${healingTime.toLowerCase()}]] days`;
    }

    // Le contenu passe par enrichHTML pour résoudre @UUID et [[/r ...]]
    const rawContent = `
      <div class="yze-roll-result yze-preset-${presetId} yze-critical-roll">
        <div class="yze-roll-header">
          <span class="yze-roll-actor">${actorName}</span>
          <span class="yze-roll-label">🩸 Critical Injury — ${tableName}</span>
        </div>
        <div class="yze-roll-outcome ${lethal ? "failure" : "success"}">
          <span class="yze-roll-success-count">${d66}</span>
          <div class="ci-roll-body">
            <span class="ci-roll-name">${uuidLink}${lethal ? ' <span class="ci-lethal-tag">⚠ LETHAL</span>' : ""}</span>
            ${effect ? `<span class="ci-roll-effect">${effect}</span>` : ""}
          </div>
        </div>
        ${timeLimit || healingTime ? `
        <div class="yze-roll-pool">
          ${timeLimit ? `<span class="yze-segment">⏱ ${timeLimit}</span>` : ""}
          ${healingTime ? `<span class="yze-segment">🩹 ${healingDisplay}</span>` : ""}
        </div>` : ""}
      </div>`;

    const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      rawContent, { async: true, rolls: true }
    );

    const msgData = {
      speaker: actor ? ChatMessage.getSpeaker({ actor }) : {},
      content: enriched,
      rolls:   [d1, d2],
    };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
      msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;

    await ChatMessage.create(msgData);
    return { d66, ciItem };
  }

  static _tableNameForPreset(presetId) {
    return {
      "sleepy-hollow":     "Sleepy Hollow — Critical Injuries",
      "eldritch-automata": "Eldritch Automata — Critical Injuries",
    }[presetId] ?? "Critical Injuries";
  }

  static async _findInjuryItem(d66, presetId) {
    const packMap = {
      "sleepy-hollow": "yzegenerique.sh-critical-injuries",
    };
    const packName = packMap[presetId];
    if (packName) {
      const pack = game.packs.get(packName);
      if (pack) {
        await pack.getIndex({ fields: ["system.d66"] });
        const entry = pack.index.find(e => e.system?.d66 === d66);
        if (entry) return await pack.getDocument(entry._id);
      }
    }
    return game.items.find(i => i.type === "critical-injury" && i.system.d66 === d66) ?? null;
  }
}
