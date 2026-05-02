/**
 * ArmorSheet — feuille Item pour les armures.
 * Même modèle de tags que WeaponSheet.
 * Foundry VTT V14
 */

import { YZESheetMixin } from "../../helpers/sheet-mixin.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;


export class ArmorSheet extends YZESheetMixin(HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2)) {

  static DEFAULT_OPTIONS = {
    classes: ["yzegenerique", "item", "armor"],
    position: { width: 440, height: 460 },
    actions: {
      rollDefense: ArmorSheet._onRollDefense,
      createTag:   ArmorSheet._onCreateTag,
      editTag:     ArmorSheet._onEditTag,
      removeTag:   ArmorSheet._onRemoveTag,
    },
    dragDrop: [{ dragSelector: null, dropSelector: "form" }],
  };

  static PARTS = {
    main: { template: "systems/yzegenerique/templates/item/armor-sheet.hbs", scrollable: [".window-content"]  },
  };

  async _prepareContext(options) {
    const context  = await super._prepareContext(options);
    context.item   = this.item;
    context.system = this.item.system;
    context.isDestroyed = this.item.system.isDestroyed;
    context.isDamaged   = this.item.system.armorRating < this.item.system.armorRatingMax;
    context.tags = await ArmorSheet._resolveTags(this.item.system.tagIds ?? []);
    context.enriched = {};
    context.enriched.description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.item._source.system.description || '', { async: true });
    return context;
  }

  static async _resolveTags(tagIds) {
    const tags = [];
    for (const id of tagIds) {
      const item = game.items.get(id) ?? (await fromUuid(id).catch(() => null));
      if (item?.type === "tag") tags.push({
        id: item.id, name: item.name,
        description: item.system.description ?? "",
      });
    }
    return tags;
  }

  async _onDrop(event) {
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); }
    catch { return; }
    if (data.type !== "Item") return;
    const dropped = await fromUuid(data.uuid).catch(() => game.items.get(data.id));
    if (!dropped || dropped.type !== "tag") return;
    const ids = foundry.utils.deepClone(this.item.system.tagIds ?? []);
    if (ids.includes(dropped.id)) return;
    await this.item.update({ "system.tagIds": [...ids, dropped.id] });
  }

  static async _onCreateTag(event, target) {
    const created = await Item.create({ name: "New Tag", type: "tag" });
    if (!created) return;
    const ids = foundry.utils.deepClone(this.item.system.tagIds ?? []);
    await this.item.update({ "system.tagIds": [...ids, created.id] });
    created.sheet.render(true);
  }

  static async _onEditTag(event, target) {
    const tagId = target.closest("[data-tag-id]")?.dataset.tagId ?? target.dataset.tagId;
    game.items.get(tagId)?.sheet.render(true);
  }

  static async _onRemoveTag(event, target) {
    const tagId = target.closest("[data-tag-id]")?.dataset.tagId ?? target.dataset.tagId;
    const ids   = foundry.utils.deepClone(this.item.system.tagIds ?? []).filter(id => id !== tagId);
    await this.item.update({ "system.tagIds": ids });
  }

  static async _onRollDefense(event, target) {
    const actor = this.item.actor;
    if (!actor) { ui.notifications.warn("YZE | Armor must be on an Actor."); return; }
    const { GearRoller } = await import("../../dice/gear-roller.mjs");
    await GearRoller.rollArmor(actor, this.item);
  }
}
