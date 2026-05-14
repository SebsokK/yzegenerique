/**
 * CriticalHandler — tire une Critical Injury via D66 et envoie un message thématique.
 * Foundry VTT V14
 */

export class CriticalHandler {

  static async roll(actor, { injuryType = "standard" } = {}) {
    const presetId  = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
    const tableName = CriticalHandler._tableNameForPreset(presetId, injuryType);

    // D66 : deux D6 séparés pour Dice So Nice
    const d1 = new Roll("1d6");
    const d2 = new Roll("1d6");
    await d1.evaluate();
    await d2.evaluate();
    const tens  = d1.dice[0].results[0].result;
    const units = d2.dice[0].results[0].result;
    const d66   = tens * 10 + units;

    const ciItem = await CriticalHandler._findInjuryItem(d66, presetId, injuryType);

    const actorName  = actor?.name ?? "Unknown";
    const injName    = ciItem?.name ?? `Result ${d66}`;
    const lethal     = ciItem?.system?.lethal ?? false;
    const effect     = ciItem?.system?.effect ?? ciItem?.system?.effects ?? "";
    const timeLimit  = ciItem?.system?.timeLimit ?? "";
    const healingTime = ciItem?.system?.healingTime ?? "";

    // UUID drag-droppable — lien Foundry natif
    const uuidLink = ciItem
      ? `<a class="content-link" draggable="true" data-link data-uuid="${ciItem.uuid}" data-id="${ciItem.id}" data-type="Item" data-tooltip="Item"><i class="fas fa-suitcase"></i>${injName}</a>`
      : `<strong>${injName}</strong>`;

    // Healing time — inline roll Foundry natif [[/r Xd6]]
    let healingDisplay = healingTime;
    if (healingTime && /^\d*d\d+$/i.test(healingTime.trim())) {
      const unit = timeLimit || "days";
      healingDisplay = `[[/r ${healingTime.toLowerCase()}]] ${unit}`;
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
          ${timeLimit && !healingTime ? `<span class="yze-segment">⏱ ${timeLimit}</span>` : ""}
          ${healingTime ? `<span class="yze-segment">🩹 ${healingDisplay}</span>` : ""}
        </div>` : ""}
      </div>`;

    const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      rawContent, { async: true, rolls: true, relativeTo: actor ?? undefined }
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

  static _tableNameForPreset(presetId, injuryType = "standard") {
    if (presetId === "eldritch-automata") {
      return injuryType === "automata"
        ? "EA — Critical Injuries (Automata)"
        : "EA — Critical Injuries (Pilot)";
    }
    return {
      "sleepy-hollow": "Sleepy Hollow — Critical Injuries",
    }[presetId] ?? "Critical Injuries";
  }

  static async _findInjuryItem(d66, presetId, injuryType = "standard") {
    // Chercher d'abord dans le monde (items importés) — UUID monde = drag-drop fiable
    const worldItem = game.items.find(i => i.type === "critical-injury" && i.system.d66 === d66);
    if (worldItem) return worldItem;

    // Fallback : chercher dans le compendium
    const packMap = {
      "sleepy-hollow":              "yzegenerique.sh-critical-injuries",
      "eldritch-automata:pilot":    "yzegenerique.ea-critical-injuries",
      "eldritch-automata:automata": "yzegenerique.ea-critical-automata",
    };
    const key = presetId === "eldritch-automata"
      ? `eldritch-automata:${injuryType}`
      : presetId;
    const packName = packMap[key];
    if (packName) {
      const pack = game.packs.get(packName);
      if (pack) {
        await pack.getIndex({ fields: ["system.d66"] });
        const entry = pack.index.find(e => e.system?.d66 === d66);
        if (entry) return await pack.getDocument(entry._id);
      }
    }
    return null;
  }
}
