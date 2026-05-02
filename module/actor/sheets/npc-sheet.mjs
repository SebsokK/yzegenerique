/**
 * NpcSheet — feuille PNJ générique YZE.
 * Foundry VTT V14
 */
import { YZESheetMixin } from "../../helpers/sheet-mixin.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class NpcSheet extends YZESheetMixin(HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
)) {
  static DEFAULT_OPTIONS = {
    classes:  ["yzegenerique", "actor", "npc"],
    position: { width: 640, height: 700 },
    window:   { resizable: true },
    actions:  {
      rollAttribute:            NpcSheet._onRollAttribute,
      rollSkill:                NpcSheet._onRollSkill,
      rollWeapon:               NpcSheet._onRollWeapon,
      rollArmor:                NpcSheet._onRollArmor,
      rollSpecialAttack:        NpcSheet._onRollSpecialAttack,
      rollFreeAttack:           NpcSheet._onRollFreeAttack,
      openSpecialAttackTable:   NpcSheet._onOpenSpecialAttackTable,
      clearSpecialAttackTable:  NpcSheet._onClearSpecialAttackTable,
      createSpecialAttackTable: NpcSheet._onCreateSpecialAttackTable,
      toggleAutoCalc:           NpcSheet._onToggleAutoCalc,
      reloadWeapon:             NpcSheet._onReloadWeapon,
      itemCreate:               NpcSheet._onItemCreate,
      itemEdit:                 NpcSheet._onItemEdit,
      itemDelete:               NpcSheet._onItemDelete,
    },
  };

  static PARTS = {
    main: {
      template:   "systems/yzegenerique/templates/actor/npc-sheet.hbs",
      scrollable: [".tab-panel"],
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor   = this.actor;
    context.system  = this.actor.system;

    context.attributes = this.actor.attributes?.map(attr => {
      const val     = attr.system.value   ?? 2;
      const current = attr.system.current ?? val;
      const pips    = Array.from({ length: val }, (_, i) => ({
        index:  i + 1,
        filled: i < current,
        attrId: attr.id,
      }));
      return { id: attr.id, name: attr.name, system: attr.system, pips };
    }) ?? [];

    context.skills        = this.actor.skills ?? [];
    context.weapons       = this.actor.items.filter(i => i.type === "weapon");
    context.armors        = this.actor.items.filter(i => i.type === "armor");
    context.specialTraits = this.actor.items.filter(i => i.type === "special-trait");
    context.weaknesses    = this.actor.items.filter(i => i.type === "weakness");

    // RollTable liée + ses résultats
    const tableUuid = this.actor.system.specialAttackTableUuid ?? "";
    const table = tableUuid
      ? await fromUuid(tableUuid).catch(() => null)
      : null;
    context.specialAttackTable = table;
    context.specialAttackResults = table
      ? table.results.contents
          .slice()
          .sort((a, b) => (a.range?.[0] ?? 0) - (b.range?.[0] ?? 0))
          .map(entry => ({ range: entry.range, title: entry.name ?? null, body: entry.text ?? "" }))
      : [];

    // Biography / Description
    context.enriched = {};
    context.enriched.biography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.actor._source?.system?.biography ?? "",
      { async: true, relativeTo: this.actor }
    );

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this._initTabs();
    this._initTrackers();
    this._initDropZone();

    // Pips attributs
    this.element.addEventListener("click", async (event) => {
      const pip = event.target.closest(".yze-pip[data-pip-index]");
      if (!pip) return;
      const itemId = pip.dataset.itemId;
      const pipIdx = Number(pip.dataset.pipIndex);
      if (!itemId || isNaN(pipIdx)) return;
      const item = this.actor.items.get(itemId);
      if (!item) return;
      const max     = item.system.value   ?? 2;
      const current = item.system.current ?? max;
      const newVal  = (pipIdx <= current) ? pipIdx - 1 : pipIdx;
      await item.update({ "system.current": Math.max(0, Math.min(newVal, max)) });
    });
  }

  _initTabs() {
    const tabs   = this.element.querySelectorAll(".tab-btn");
    const panels = this.element.querySelectorAll(".tab-panel");
    const active = this._activeTab ?? "stats";
    tabs.forEach(t   => t.classList.toggle("active", t.dataset.tab === active));
    panels.forEach(p => p.classList.toggle("active", p.dataset.panel === active));
    tabs.forEach(btn => btn.addEventListener("click", () => {
      this._activeTab = btn.dataset.tab;
      tabs.forEach(t   => t.classList.toggle("active", t.dataset.tab === this._activeTab));
      panels.forEach(p => p.classList.toggle("active", p.dataset.panel === this._activeTab));
    }));
  }

  _initTrackers() {
    const setBar = (bar, val, max) => {
      const fill = bar.querySelector(".hdr-tracker-bar");
      if (!fill) return;
      const pct = Math.max(0, Math.min(1, val / (max || 1)));
      const r = Math.round(255 * (1 - pct));
      const g = Math.round(200 * pct);
      fill.style.width      = `${pct * 100}%`;
      fill.style.background = `rgb(${r},${g},40)`;
      fill.style.boxShadow  = `0 0 6px rgba(${r},${g},40,0.6)`;
    };
    this.element.querySelectorAll(".hdr-tracker").forEach(bar => {
      setBar(bar, Number(bar.dataset.value) || 0, Number(bar.dataset.max) || 1);
    });
    this.element.querySelectorAll(".hdr-resource input[type='number']").forEach(input => {
      input.addEventListener("input", () => {
        const wrap    = input.closest(".hdr-tracker-wrap");
        const tracker = wrap?.querySelector(".hdr-tracker");
        if (!tracker) return;
        const inputs = wrap.querySelectorAll("input[type='number']");
        setBar(tracker, Number(inputs[0]?.value) || 0, Number(inputs[1]?.value) || 1);
      });
    });
  }

  _initDropZone() {
    const dropZone = this.element.querySelector("#npc-sa-drop-zone");
    if (!dropZone) return;
    dropZone.addEventListener("dragover", e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "link";
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      let data;
      try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return; }
      if (data?.type !== "RollTable") return;
      const uuid = data.uuid;
      if (!uuid) return;
      await this.actor.update({ "system.specialAttackTableUuid": uuid });
    });
  }

  // ── Actions ─────────────────────────────────────────────────────

  static async _onReloadWeapon(event, target) {
    const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (!item) return;
    await item.update({ "system.currentReloads": item.system.maxReloads });
    const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="yze-roll-result yze-preset-${presetId}">
        <div class="yze-roll-header">
          <span class="yze-roll-actor">${this.actor.name}</span>
          <span class="yze-roll-label">🔄 ${item.name} — Reload</span>
        </div>
      </div>`,
    });
  }

  static async _onToggleAutoCalc(event, target) {
    const field   = target.dataset.field;
    const current = foundry.utils.getProperty(this.actor.system, field.replace("system.", ""));
    await this.actor.update({ [field]: !current });
  }

  static async _onRollFreeAttack(event, target) {
    const { AttackDialog } = await import("../../ui/attack-dialog.mjs");
    const result = await AttackDialog.promptFree(this.actor);
    if (!result) return;

    const presetId    = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
    const targetToken = game.user.targets.first();
    const targetActor = targetToken?.actor ?? null;
    const armor       = targetActor?.items.find(i => i.type === "armor" && !i.system.isDestroyed);

    const makeTargetBlock = (dmg) => {
      if (!targetActor) return "";
      return `<div class="yze-roll-target-block">
          <div class="yze-roll-target-header">
            🎯 <strong>${targetActor.name}</strong>
            <span class="yze-push-hint">${dmg} dmg incoming</span>
          </div>
          <div class="yze-roll-target-actions">
            ${armor ? `<button class="yze-armor-roll-btn" type="button"
              data-action="rollTargetArmor" data-target-actor-id="${targetActor.id}"
              data-armor-id="${armor.id}" data-damage="${dmg}">
              🛡 Roll Armor (${armor.name} AR ${armor.system.armorRating})</button>` : ""}
            <button class="yze-apply-dmg-btn" type="button"
              data-action="applyDamage" data-target-actor-id="${targetActor.id}"
              data-damage="${dmg}">💥 Apply ${dmg} Damage</button>
          </div></div>`;
    };

    // ── Mode dégâts fixes ───────────────────────────────────────
    if (result.fixedDamage !== undefined) {
      const dmg = result.fixedDamage;
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<div class="yze-roll-result yze-preset-${presetId}">
          <div class="yze-roll-header">
            <span class="yze-roll-actor">${this.actor.name}</span>
            <span class="yze-roll-label">⚔ Special Attack — Fixed</span>
          </div>
          <div class="yze-roll-outcome success">
            <span class="yze-roll-success-count">${dmg}</span>
            <span class="yze-roll-success-label">fixed damage</span>
          </div>
          ${makeTargetBlock(dmg)}
        </div>`,
      });
      return;
    }

    // ── Mode dés ────────────────────────────────────────────────
    if (!result.pool || result.pool <= 0) return;

    const roll = new Roll(`${result.pool}d6`);
    await roll.evaluate();

    const results    = roll.dice[0].results.map(r => r.result);
    const successes  = results.filter(r => r === 6).length;
    const banes      = results.filter(r => r === 1).length;
    const baseDamage = result.baseDamage ?? 0;
    const totalDmg   = successes > 0 ? baseDamage + successes : 0;

    const diceHtml = results.map(r => {
      const cls = r === 6 ? "yze-die--success" : r === 1 ? "yze-die--bane" : "yze-die--neutral";
      return `<span class="yze-die ${cls}">${r}</span>`;
    }).join("");

    const targetBlock = successes > 0 ? makeTargetBlock(totalDmg) : "";

    const content = `
      <div class="yze-roll-result yze-preset-${presetId}">
        <div class="yze-roll-header">
          <span class="yze-roll-actor">${this.actor.name}</span>
          <span class="yze-roll-label">⚔ Special Attack (${result.pool}d6)</span>
        </div>
        <div class="yze-roll-outcome ${successes > 0 ? "success" : "failure"}">
          ${successes > 0
            ? `<span class="yze-roll-success-icon">✓</span>
               <span class="yze-roll-success-count">${successes}</span>
               <span class="yze-roll-success-label">hit${successes > 1 ? "s" : ""}</span>
               ${baseDamage > 0 ? `<span class="yze-weapon-dmg">— <strong>${totalDmg}</strong> dmg</span>` : ""}`
            : `<span class="yze-roll-fail-icon">✗</span>
               <span class="yze-roll-fail-label">Miss</span>`}
          ${banes > 0 ? `<span class="yze-roll-banes">⚑ ${banes} bane${banes > 1 ? "s" : ""}</span>` : ""}
        </div>
        <details class="yze-roll-details"><summary>Show dice</summary>
          <div class="yze-roll-dice-detail">
            <div class="yze-dice-segment">
              <span class="yze-dice-label">⚔ attack</span>
              <span class="yze-dice-row">${diceHtml}</span>
            </div>
          </div>
        </details>
        ${targetBlock}
      </div>`;

    const msgData = {
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content, rolls: [roll],
    };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
      msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    await ChatMessage.create(msgData);
  }

  static async _onRollAttribute(event, target) {
    const attrId = target.dataset.attrId ?? target.closest("[data-attr-id]")?.dataset.attrId;
    if (attrId) await this.actor.rollAttribute(attrId);
  }

  static async _onRollSkill(event, target) {
    const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
    if (itemId) await this.actor.rollSkill(itemId);
  }

  static async _onRollWeapon(event, target) {
    const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (!item) return;
    const { GearRoller } = await import("../../dice/gear-roller.mjs");
    await GearRoller.rollWeapon(this.actor, item);
  }

  static async _onRollArmor(event, target) {
    const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (!item) return;
    const { GearRoller } = await import("../../dice/gear-roller.mjs");
    await GearRoller.rollArmor(this.actor, item);
  }

  static async _onRollSpecialAttack(event, target) {
    const tableUuid = this.actor.system.specialAttackTableUuid;
    if (!tableUuid) return;
    const table = await fromUuid(tableUuid).catch(() => null);
    if (!table) { ui.notifications.warn("YZE | RollTable not found."); return; }

    const roll = new Roll(table.formula ?? "1d6");
    await roll.evaluate();
    const result = roll.total;

    const entry = table.results.find(r => {
      const range = r.range ?? [r.rangeMin ?? 1, r.rangeMax ?? 6];
      return result >= range[0] && result <= range[1];
    }) ?? table.results.contents[0];

    const presetId  = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
    const raw = entry?.text ?? "—";
    const entryTitle = entry?.name ?? raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 50);
    const entryDesc  = entry?.name ? raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";

    const content = `
      <div class="yze-roll-result yze-preset-${presetId}">
        <div class="yze-roll-header">
          <span class="yze-roll-actor">${this.actor.name}</span>
          <span class="yze-roll-label">🎲 Special Attack — ${table.name}</span>
        </div>
        <div class="yze-roll-outcome success">
          <span class="yze-roll-success-count">${result}</span>
          <div style="display:flex;flex-direction:column;gap:2px;flex:1;padding-left:8px">
            <span class="yze-roll-label">${entryTitle}</span>
            ${entryDesc ? `<span style="font-size:0.85em;color:var(--yze-color-text);font-style:italic">${entryDesc}</span>` : ""}
          </div>
        </div>
      </div>`;

    const msgData = {
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content, rolls: [roll],
    };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
      msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    await ChatMessage.create(msgData);
  }

  static async _onOpenSpecialAttackTable(event, target) {
    const uuid = this.actor.system.specialAttackTableUuid;
    if (!uuid) return;
    const table = await fromUuid(uuid).catch(() => null);
    table?.sheet?.render(true);
  }

  static async _onClearSpecialAttackTable(event, target) {
    await this.actor.update({ "system.specialAttackTableUuid": "" });
  }

  static async _onCreateSpecialAttackTable(event, target) {
    // V14 : type doit être "text" (string) pas 0 (number)
    const tableDoc = await RollTable.create({
      name:        `${this.actor.name} — Special Attacks`,
      formula:     "1d6",
      description: `Special attacks for ${this.actor.name}`,
      results: Array.from({ length: 6 }, (_, i) => ({
        type:   "text",
        text:   `Attack ${i + 1} — describe it here`,
        range:  [i + 1, i + 1],
        weight: 1,
        drawn:  false,
      })),
    });
    await this.actor.update({ "system.specialAttackTableUuid": tableDoc.uuid });
    tableDoc.sheet?.render(true);
  }

  static async _onItemCreate(event, target) {
    const type = target.dataset.type;
    if (!type) return;
    const names = {
      attribute: "New Attribute", skill: "New Skill",
      weapon: "New Weapon", armor: "New Armor",
      "special-trait": "New Trait", weakness: "New Weakness",
    };
    const items = await this.actor.createEmbeddedDocuments("Item", [{
      name: names[type] ?? "New Item", type,
    }]);
    items[0]?.sheet?.render(true);
  }

  static async _onItemEdit(event, target) {
    const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
    this.actor.items.get(itemId)?.sheet?.render(true);
  }

  static async _onItemDelete(event, target) {
    const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (item) await item.deleteDialog();
  }
}
