/**
 * PanicHandler — gestion du Panic Roll via RollTable Compendium.
 *
 * Mécanique :
 *   - Résultat = D6 + Stress Level actuel
 *   - Cherche la table dans le compendium "yzegenerique.panic-tables"
 *     puis en fallback dans le world
 *   - Le nom de la table est déclaré dans le preset : preset.rules.panicTableName
 *
 * Foundry VTT V14
 */

export class PanicHandler {

  /**
   * Déclenche un panic roll pour l'acteur donné.
   * @param {YZEActor} actor
   * @param {object}   rollData
   */
  static async trigger(actor, rollData) {
    const { getRuleConfig } = await import("../rules/rule-config.mjs");
    const cfg       = getRuleConfig();
    const tableName = cfg.panicTableName;

    // D6 + Stress Level
    const dieRoll   = new Roll("1d6");
    await dieRoll.evaluate();
    const dieResult = dieRoll.dice[0].results[0].result;
    const stressLevel = actor.stressLevel;
    const total     = dieResult + stressLevel;

    const table = await PanicHandler._findTable(tableName);

    if (!table) {
      await PanicHandler._sendFallbackToChat(actor, dieResult, stressLevel, total, tableName);
      return;
    }

    const entry    = PanicHandler._findEntry(table, total);
    const entryText = entry
      ? (entry.text ?? entry.name ?? "—")
      : `Result ${total} (no matching entry found)`;

    await PanicHandler._sendPanicToChat(actor, dieResult, stressLevel, total, entryText, table.name);
  }

  /**
   * Cherche dans le compendium système en priorité, puis dans le world.
   */
  static async _findTable(tableName) {
    if (!tableName) return null;

    // 1. Compendium système
    const pack = game.packs.get("yzegenerique.panic-tables");
    if (pack) {
      const index = await pack.getIndex();
      const entry = index.find(e => e.name === tableName);
      if (entry) return await pack.getDocument(entry._id);
    }

    // 2. World (table importée ou custom)
    const worldTable = game.tables.find(t => t.name === tableName);
    if (worldTable) return worldTable;

    console.warn(`YZE Panic | Table "${tableName}" not found.`);
    return null;
  }

  /**
   * Trouve l'entrée couvrant le résultat donné.
   */
  static _findEntry(table, total) {
    if (!table?.results) return null;
    for (const result of table.results) {
      const r = result.range ?? [result.rangeMin ?? 1, result.rangeMax ?? 99];
      if (Array.isArray(r) && r.length === 2 && total >= r[0] && total <= r[1]) return result;
    }
    return null;
  }

  /**
   * Message chat avec le résultat de la table.
   * Pas de champ "type" — V14 gère le style par défaut automatiquement.
   */
  static async _sendPanicToChat(actor, dieResult, stressLevel, total, entryText, tableName) {
    const content = `
      <div class="yze-panic-roll">
        <div class="yze-panic-header">
          ⚡ <strong>PANIC</strong>
          <span class="yze-panic-table-name">${tableName}</span>
        </div>
        <div class="yze-panic-dice">
          🎲 ${dieResult} + Stress ${stressLevel}
          = <strong class="yze-panic-total">${total}</strong>
        </div>
        <div class="yze-panic-result">${entryText}</div>
      </div>`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      rolls:   [],
    });
  }

  /**
   * Fallback sans table configurée.
   */
  static async _sendFallbackToChat(actor, dieResult, stressLevel, total, tableName) {
    const content = `
      <div class="yze-panic-roll">
        <div class="yze-panic-header">⚡ <strong>PANIC</strong></div>
        <div class="yze-panic-dice">
          🎲 ${dieResult} + Stress ${stressLevel}
          = <strong class="yze-panic-total">${total}</strong>
        </div>
        <div class="yze-panic-result yze-panic-no-table">
          <em>No panic table found for "${tableName || "—"}".
          Check the Panic Table Name setting or add the table to the compendium.</em>
        </div>
      </div>`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
    });
  }
}
