/**
 * TraumaHandler — gestion du Permanent Trauma EA.
 *
 * Déclenchement : Stress = 10 OU Breakdown.
 * Mécanisme :
 *   1. Roll d'Empathy (attribut seul, pas de skill)
 *   2. Si échec (0 succès) → roll D6 sur la table EA — Permanent Trauma
 *
 * Foundry VTT V14
 */

export class TraumaHandler {

  static TRAUMA_TABLE_NAME = "EA — Permanent Trauma";

  /**
   * Propose au joueur de faire le roll de Trauma.
   * @param {YZEActor} actor
   */
  static async trigger(actor) {
    const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "";
    if (presetId !== "eldritch-automata") return;

    // Trouver l'attribut Empathy
    const empathy = actor.items.find(i =>
      i.type === "attribute" &&
      (i.name.toLowerCase().includes("empathy") || i.system.slug === "empathy")
    );
    const empVal = empathy?.system?.value ?? 1;

    // Roll Empathy
    const roll = await new Roll(`${empVal}d6`).evaluate();
    const successes = roll.dice[0].results.filter(r => r.result === 6).length;

    const msgData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls:   [roll],
      content: `<div class="yze-roll-result yze-preset-eldritch-automata">
        <div class="yze-roll-header">
          <span class="yze-roll-actor">${actor.name}</span>
          <span class="yze-roll-label">🧠 Permanent Trauma Check</span>
        </div>
        <div class="yze-roll-outcome ${successes > 0 ? "success" : "failure"}">
          <span class="yze-roll-success-icon">${successes > 0 ? "✓" : "✗"}</span>
          <span class="yze-roll-success-label">
            Empathy (${empVal}d) — ${successes > 0 ? `${successes} success${successes > 1 ? "es" : ""} — No trauma` : "Failed — Roll for Trauma"}
          </span>
        </div>
        ${successes === 0 ? `
        <div class="yze-roll-critical-row">
          <button class="yze-critical-btn" type="button"
            data-action="rollPermanentTrauma"
            data-actor-id="${actor.id}">
            🧠 Roll Permanent Trauma (D6)
          </button>
        </div>` : ""}
      </div>`,
    };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
      msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    await ChatMessage.create(msgData);
  }

  /**
   * Roll D6 sur la table de Trauma.
   */
  static async rollTrauma(actor) {
    const table = await TraumaHandler._findTable();
    const roll  = await new Roll("1d6").evaluate();
    const result = roll.dice[0].results[0].result;

    let entryText = `Result ${result}`;
    if (table) {
      const entry = table.results?.find(r => {
        const range = r.range ?? [1, 6];
        return result >= range[0] && result <= range[1];
      });
      if (entry) entryText = entry.text ?? entryText;
    }

    const msgData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      rolls:   [roll],
      content: `<div class="yze-roll-result yze-preset-eldritch-automata">
        <div class="yze-roll-header">
          <span class="yze-roll-actor">${actor.name}</span>
          <span class="yze-roll-label">🧠 Permanent Trauma</span>
        </div>
        <div class="yze-panic-result" style="padding:8px 12px">
          <strong>${result}</strong> — ${entryText}
        </div>
      </div>`,
    };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
      msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    await ChatMessage.create(msgData);
  }

  static async _findTable() {
    const pack = game.packs.get("yzegenerique.ea-critical-tables");
    if (pack) {
      const index = await pack.getIndex();
      const entry = index.find(e => e.name === TraumaHandler.TRAUMA_TABLE_NAME);
      if (entry) return await pack.getDocument(entry._id);
    }
    return game.tables.find(t => t.name === TraumaHandler.TRAUMA_TABLE_NAME) ?? null;
  }
}
