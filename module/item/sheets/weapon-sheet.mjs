/**
 * WeaponSheet — feuille Item pour les armes.
 *
 * Gestion des tags :
 *   - Drag & drop d'un Item "tag" depuis l'ItemDirectory → association
 *   - Création inline → crée un Item "tag" global et l'associe immédiatement
 *   - Édition → ouvre la feuille du tag global
 *   - Suppression → dissocie (ne supprime pas l'item global)
 *
 * Foundry VTT V14
 */

import { YZESheetMixin } from "../../helpers/sheet-mixin.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;


export class WeaponSheet extends YZESheetMixin(HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2)) {

  static DEFAULT_OPTIONS = {
    form:     { submitOnChange: true },
    classes: ["yzegenerique", "item", "weapon"],
    position: { width: 480, height: 600 },
    actions: {
      rollAttack:   WeaponSheet._onRollAttack,
      createTag:    WeaponSheet._onCreateTag,
      editTag:      WeaponSheet._onEditTag,
      removeTag:    WeaponSheet._onRemoveTag,
      useReload:    WeaponSheet._onUseReload,
      resetReloads: WeaponSheet._onResetReloads,
    },
    dragDrop: [{ dragSelector: null, dropSelector: "form" }],
  };

  static PARTS = {
    main: { template: "systems/yzegenerique/templates/item/weapon-sheet.hbs", scrollable: [".window-content"]  },
  };



  _onRender(context, options) {
    super._onRender(context, options);
    if (this._tagHookFn) {
      Hooks.off("updateItem", this._tagHookFn);
      Hooks.off("deleteItem", this._tagHookFn);
    }
    const tagIds = new Set(this.item.system.tagIds ?? []);
    this._tagHookFn = (item) => {
      if (tagIds.has(item.id)) this.render();
    };
    Hooks.on("updateItem", this._tagHookFn);
    Hooks.on("deleteItem", this._tagHookFn);
  }

  _onClose(options) {
    if (super._onClose) super._onClose(options);
    if (this._tagHookFn) {
      Hooks.off("updateItem", this._tagHookFn);
      Hooks.off("deleteItem", this._tagHookFn);
      this._tagHookFn = null;
    }
  }

  async _prepareContext(options) {
    const context  = await super._prepareContext(options);
    context.item   = this.item;
    context.system = this.item.system;
    context.isRanged    = this.item.system.isRanged;
    context.isOutOfAmmo = this.item.system.isOutOfAmmo;
    context.tags = await WeaponSheet._resolveTags(this.item.system.tagIds ?? []);
    const actor = this.item.actor;
    if (actor) {
      context.actorAttributes = actor.attributes.map(a => ({
        id: a.id, slug: a.system.slug || a.name.toLowerCase(), label: a.name,
      }));
      context.actorSkills = actor.skills.map(s => ({
        id: s.id, slug: s.system.slug || s.name.toLowerCase(), label: s.name,
      }));
    } else {
      context.actorAttributes = [];
      context.actorSkills     = [];
    }
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

  // ── Drop d'un tag depuis l'ItemDirectory ──────────────────────────
  async _onDrop(event) {
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain")); }
    catch { return; }
    if (data.type !== "Item") return;
    const dropped = await fromUuid(data.uuid).catch(() => game.items.get(data.id));
    if (!dropped || dropped.type !== "tag") return;
    const ids = foundry.utils.deepClone(this.item.system.tagIds ?? []);
    const newId = dropped.id;
    if (ids.includes(newId)) return;
    await this.item.update({ "system.tagIds": [...ids, newId] });
  }

  // ── Créer un tag inline ───────────────────────────────────────────
  // Crée un Item "tag" global dans le world, puis l'associe à cette weapon.
  // Ouvre automatiquement sa feuille pour saisie du nom.
  static async _onCreateTag(event, target) {
    const created = await Item.create({ name: "New Tag", type: "tag" });
    if (!created) return;
    const ids = foundry.utils.deepClone(this.item.system.tagIds ?? []);
    await this.item.update({ "system.tagIds": [...ids, created.id] });
    created.sheet.render(true);
  }

  // ── Éditer un tag ─────────────────────────────────────────────────
  static async _onEditTag(event, target) {
    const tagId = target.closest("[data-tag-id]")?.dataset.tagId ?? target.dataset.tagId;
    game.items.get(tagId)?.sheet.render(true);
  }

  // ── Dissocier un tag ──────────────────────────────────────────────
  // Retire uniquement l'association — l'Item tag global est conservé.
  static async _onRemoveTag(event, target) {
    const tagId = target.closest("[data-tag-id]")?.dataset.tagId ?? target.dataset.tagId;
    const ids   = foundry.utils.deepClone(this.item.system.tagIds ?? []).filter(id => id !== tagId);
    await this.item.update({ "system.tagIds": ids });
  }

  // ── Roll / Reload ─────────────────────────────────────────────────
  static async _onRollAttack(event, target) {
    const actor = this.item.actor;
    if (!actor) { ui.notifications.warn("YZE | Weapon must be on an Actor."); return; }
    if (this.item.system.isOutOfAmmo) { ui.notifications.warn(`YZE | ${this.item.name} is out of ammo.`); return; }
    const { GearRoller } = await import("../../dice/gear-roller.mjs");
    await GearRoller.rollWeapon(actor, this.item);
  }

  static async _onUseReload(event, target) {
    const cur = this.item.system.currentReloads;
    if (cur <= 0) { ui.notifications.warn("YZE | No reloads left."); return; }
    await this.item.update({ "system.currentReloads": cur - 1 });
  }

  static async _onResetReloads(event, target) {
    await this.item.update({ "system.currentReloads": this.item.system.maxReloads });
  }
}
