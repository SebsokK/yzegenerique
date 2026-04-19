/**
 * CharacterSheet — feuille de personnage générique YZE.
 * Foundry VTT V14
 */

import { YZESheetMixin } from "../../helpers/sheet-mixin.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class CharacterSheet extends YZESheetMixin(
  HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)
) {

  static DEFAULT_OPTIONS = {
    classes: ["yzegenerique", "actor", "character"],
    position: { width: 680, height: 720 },
    actions: {
      rollSkill:      CharacterSheet._onRollSkill,
      rollAttribute:  CharacterSheet._onRollAttribute,
      rollWeapon:     CharacterSheet._onRollWeapon,
      rollArmor:      CharacterSheet._onRollArmor,
      useReload:      CharacterSheet._onUseReload,
      resetReloads:   CharacterSheet._onResetReloads,
      itemCreate:     CharacterSheet._onItemCreate,
      itemEdit:       CharacterSheet._onItemEdit,
      itemDelete:     CharacterSheet._onItemDelete,
      pipClick:       CharacterSheet._onPipClick,
    },
  };

  static PARTS = {
    main: { template: "systems/yzegenerique/templates/actor/character-sheet.hbs", scrollable: [".window-content"]  },
  };

  async _prepareContext(options) {
    const context      = await super._prepareContext(options);
    const { getRuleConfig } = await import("../../rules/rule-config.mjs");
    const cfg = getRuleConfig();

    context.actor      = this.actor;
    context.system     = this.actor.system;
    context.attributes = this._prepareAttributes();
    context.skills     = this.actor.skills;
    context.gear       = this.actor.items.filter(i => i.type === "gear");
    context.weapons    = this.actor.items.filter(i => i.type === "weapon");
    context.armors     = this.actor.items.filter(i => i.type === "armor");
    context.resources  = this.actor.items.filter(i => i.type === "resource");
    context.talents    = this.actor.items.filter(i => i.type === "talent");
    context.enableStress = cfg.enableStress ?? false;
    context.biography  = await TextEditor.enrichHTML(
      this.actor._source.system.biography ?? "", { relativeTo: this.actor }
    );
    context.enriched = {};
    context.editable  = this.isEditable;
    context.enriched.biography = await TextEditor.enrichHTML(this.actor._source?.system?.biography || '', { async: true });
    return context;
  }

  /** Prépare les attributs avec les pips pour l'affichage. */
  _prepareAttributes() {
    return this.actor.attributes.map(attr => {
      const val     = attr.system.value   ?? 2;
      const current = attr.system.current ?? val;
      return {
        id:     attr.id,
        name:   attr.name,
        img:    attr.img,
        system: attr.system,
        pips:   CharacterSheet._buildPips(val, current),
      };
    });
  }

  static _buildPips(max, current) {
    const pips = [];
    for (let i = 1; i <= Math.max(max, 5); i++) {
      pips.push({ index: i, filled: i <= current, over: i > max });
    }
    return pips;
  }

  // _onRender et _setupFormListeners viennent du mixin

  static async _onRollSkill(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    if (itemId) await this.actor.rollSkill(itemId);
  }

  static async _onRollAttribute(event, target) {
    const attrId = target.dataset.attrId;
    if (attrId) await this.actor.rollAttribute(attrId);
  }

  static async _onItemCreate(event, target) {
    await this.actor.createEmbeddedDocuments("Item", [{
      name: game.i18n.localize("YZE.NewItem"),
      type: target.dataset.type ?? "gear",
    }]);
  }

  static async _onItemEdit(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    if (itemId) this.actor.items.get(itemId)?.sheet.render(true);
  }

  static async _onItemDelete(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (item) await item.deleteDialog();
  }

  /**
   * Clic sur un pip : modifie system.current de l'attribut.
   * data-item-id + data-pip-index sur le pip.
   */
  static async _onPipClick(event, target) {
    const itemId  = target.closest("[data-item-id]")?.dataset.itemId;
    const pipIdx  = Number(target.dataset.pipIndex);
    if (!itemId || isNaN(pipIdx)) return;

    const item    = this.actor.items.get(itemId);
    if (!item) return;

    const current = item.system.current ?? item.system.value;
    const newVal  = pipIdx === current ? pipIdx - 1 : pipIdx;
    await item.update({ "system.current": Math.max(0, Math.min(newVal, item.system.value)) });
  }

  static async _onRollWeapon(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (!item) return;
    const { GearRoller } = await import("../../dice/gear-roller.mjs");
    await GearRoller.rollWeapon(this.actor, item);
  }

  static async _onRollArmor(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (!item) return;
    const { GearRoller } = await import("../../dice/gear-roller.mjs");
    await GearRoller.rollArmor(this.actor, item);
  }

  static async _onUseReload(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (!item) return;
    const cur = item.system.currentReloads ?? 0;
    if (cur <= 0) { ui.notifications.warn("YZE | No reloads left."); return; }
    await item.update({ "system.currentReloads": cur - 1 });
  }

  static async _onResetReloads(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (!item) return;
    await item.update({ "system.currentReloads": item.system.maxReloads });
  }
}
