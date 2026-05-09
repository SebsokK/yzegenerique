/**
 * EaCharacterSheet — feuille de personnage Eldritch Automata.
 * Foundry VTT V14
 */

import { YZESheetMixin } from "../../../helpers/sheet-mixin.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;


export class EaCharacterSheet extends YZESheetMixin(HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)) {

  static DEFAULT_OPTIONS = {
    classes: ["yzegenerique", "ea-sheet", "actor", "character"],
    position: { width: 740, height: 820 },
    dragDrop: [{ dragSelector: null, dropSelector: ".yze-sheet" }],
    actions: {
      rollSkill:       EaCharacterSheet._onRollSkill,
      rollAttribute:   EaCharacterSheet._onRollAttribute,
      rollWeapon:      EaCharacterSheet._onRollWeapon,
      rollArmor:       EaCharacterSheet._onRollArmor,
      useReload:       EaCharacterSheet._onUseReload,
      resetReloads:    EaCharacterSheet._onResetReloads,
      itemCreate:      EaCharacterSheet._onItemCreate,
      itemEdit:        EaCharacterSheet._onItemEdit,
      itemDelete:      EaCharacterSheet._onItemDelete,
      pipClick:        EaCharacterSheet._onPipClick,
      initResources:   EaCharacterSheet._onInitResources,
    },
  };

  static PARTS = {
    main: {
      template: "systems/yzegenerique/templates/presets/eldritch-automata/ea-character-sheet.hbs",
      scrollable: [".window-content"],
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.actor      = this.actor;
    context.system     = this.actor.system;
    context.attributes = this._prepareAttributes();
    context.skills     = this.actor.skills;
    context.gear             = this.actor.items.filter(i => i.type === "gear");
    context.criticalInjuries = this.actor.items.filter(i => i.type === "critical-injury");
    context.weapons    = await Promise.all(
      this.actor.items.filter(i => i.type === "weapon").map(async w => ({
        id: w.id, name: w.name, system: w.system,
        tags: await EaCharacterSheet._resolveTags(w.system.tagIds ?? []),
      }))
    );
    context.armors     = await Promise.all(
      this.actor.items.filter(i => i.type === "armor").map(async a => ({
        id: a.id, name: a.name, system: a.system,
        tags: await EaCharacterSheet._resolveTags(a.system.tagIds ?? []),
      }))
    );

    const allResources = this.actor.items.filter(i => i.type === "resource");
    context.resources         = allResources;
    context.pilotResources    = allResources.filter(r => r.system.category === "pilot");
    context.automataResources = allResources.filter(r => r.system.category === "automata");
    context.generalResources  = allResources.filter(r =>
      r.system.category !== "pilot" && r.system.category !== "automata"
    );
    context.hasResources = allResources.length > 0;

    context.inBreakdown = this.actor.system.ea?.inBreakdown ?? false;
    context.inBerserk   = this.actor.system.ea?.inBerserk   ?? false;
    context.strands         = this.actor.items.filter(i => i.type === "strand");
    context.pilotTalents    = this.actor.items.filter(i => i.type === "talent" && i.system.talentSource === "pilot");
    context.automataTalents = this.actor.items.filter(i => i.type === "talent" && i.system.talentSource === "automata");
    context.generalTalents  = this.actor.items.filter(i => i.type === "talent" && (i.system.talentSource === "general" || !i.system.talentSource));
    context.hasTalents      = context.pilotTalents.length > 0 || context.automataTalents.length > 0 || context.generalTalents.length > 0;
    context.pilotArchetype    = this.actor.items.get(this.actor.system.ea?.pilotArchetypeId)
      ?? this.actor.items.find(i => i.type === "pilot-archetype") ?? null;
    context.automataArchetype = this.actor.items.get(this.actor.system.ea?.automataArchetypeId)
      ?? this.actor.items.find(i => i.type === "automata-archetype") ?? null;

    if (context.pilotArchetype && context.inBreakdown) {
    }
    if (context.automataArchetype && context.inBerserk) {
    }
    const xpTotal = this.actor.system.xp?.total ?? 0;
    context.xpPips = Array.from({ length: 15 }, (_, i) => ({
      index:  i + 1,
      filled: i < xpTotal,
    }));

    context.enriched = {};
    context.enriched.biography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.actor._source.system.biography || '', { async: true });
    context.enriched.breakdownText = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.actor._source.system.breakdownText || '', { async: true });
    context.enriched.berserkText = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.actor._source.system.berserkText || '', { async: true });
    return context;
  }

  _prepareAttributes() {
    return this.actor.attributes.map(attr => {
      const val     = attr.system.value   ?? 2;
      const current = attr.system.current ?? val;
      return {
        id:     attr.id,
        name:   attr.name,
        img:    attr.img,
        system: attr.system,
        pips:   EaCharacterSheet._buildPips(attr.id, val, current),
      };
    });
  }

  static _buildPips(attrId, max, current) {
    const pips = [];
    for (let i = 1; i <= Math.max(max, 5); i++) {
      pips.push({ attrId, index: i, filled: i <= current, over: i > max });
    }
    return pips;
  }

  // _onRender + _setupFormListeners viennent du mixin

  _onRender(context, options) {
    super._onRender(context, options);

    // ── Onglets ────────────────────────────────────────────────────
    const tabs   = this.element.querySelectorAll(".tab-btn");
    const panels = this.element.querySelectorAll(".tab-panel");
    const activeTab = this._activeTab ?? "character";
    tabs.forEach(t   => t.classList.toggle("active", t.dataset.tab === activeTab));
    panels.forEach(p => p.classList.toggle("active", p.dataset.panel === activeTab));
    tabs.forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.tab;
        this._activeTab = target;
        tabs.forEach(t   => t.classList.toggle("active", t.dataset.tab === target));
        panels.forEach(p => p.classList.toggle("active", p.dataset.panel === target));
      });
    });

    // ── XP pips ────────────────────────────────────────────────────
    this.element.addEventListener("click", async (event) => {
      const pip = event.target.closest(".xp-pip[data-xp-index]");
      if (!pip) return;
      const idx     = Number(pip.dataset.xpIndex);
      const current = this.actor.system.xp?.total ?? 0;
      const newVal  = (idx <= current) ? idx - 1 : idx;
      await this.actor.update({ "system.xp.total": Math.max(0, newVal) });
    });
  }

  async _onDrop(event) {
    event.preventDefault();
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch { return; }

    if (data.type !== "Item") return;

    // Résoudre l'item source
    let srcItem;
    try {
      srcItem = await fromUuid(data.uuid);
    } catch { return; }
    if (!srcItem) return;

    const itemType = srcItem.type;

    // Types acceptés sur cet actor
    const accepted = [
      "attribute", "skill", "talent", "strand",
      "pilot-archetype", "automata-archetype",
      "weapon", "armor", "gear", "critical-injury",
      "resource", "tag",
    ];
    if (!accepted.includes(itemType)) {
      ui.notifications.warn(`YZE | Item type "${itemType}" cannot be dropped here.`);
      return;
    }

    // Si c'est un talent sans source définie, demander pilot ou automata
    if (itemType === "talent") {
      const src = srcItem.system?.talentSource;
      if (!src || src === "general") {
        const src2 = await new Promise(resolve => {
          new Dialog({
            title:   `Talent Source — ${srcItem.name}`,
            content: `<p>Assign <strong>${srcItem.name}</strong> as a Pilot or Automata talent?</p>`,
            buttons: {
              pilot:   { icon: "<i class='fas fa-user'></i>",  label: "Pilot",    callback: () => resolve("pilot")   },
              automata:{ icon: "<i class='fas fa-robot'></i>", label: "Automata", callback: () => resolve("automata") },
              cancel:  { icon: "<i class='fas fa-times'></i>", label: "Cancel",   callback: () => resolve(null)       },
            },
            default: "pilot",
            close:   () => resolve(null),
          }).render(true);
        });
        if (!src2) return;
        const itemData2 = srcItem.toObject();
        itemData2.system.talentSource = src2;
        await this.actor.createEmbeddedDocuments("Item", [itemData2]);
        return;
      }
    }
    if (itemType === "pilot-archetype" && this.actor.items.find(i => i.type === "pilot-archetype")) {
      ui.notifications.warn("YZE | A pilot archetype is already assigned.");
      return;
    }
    if (itemType === "automata-archetype" && this.actor.items.find(i => i.type === "automata-archetype")) {
      ui.notifications.warn("YZE | An automata archetype is already assigned.");
      return;
    }

    // Si l'item vient déjà de cet actor, ne pas le dupliquer
    if (srcItem.parent?.id === this.actor.id) return;

    const itemData = srcItem.toObject();
    const created  = await this.actor.createEmbeddedDocuments("Item", [itemData]);

    // Enregistrer l'archetype ID si besoin
    if (created.length > 0) {
      const item = created[0];
      if (itemType === "pilot-archetype")
        await this.actor.update({ "system.ea.pilotArchetypeId": item.id });
      else if (itemType === "automata-archetype")
        await this.actor.update({ "system.ea.automataArchetypeId": item.id });
    }
  }

  static async _onRollSkill(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    if (itemId) await this.actor.rollSkill(itemId);
  }

  static async _onRollAttribute(event, target) {
    const attrId = target.dataset.attrId;
    if (attrId) await this.actor.rollAttribute(attrId);
  }

  static async _onItemCreate(event, target) {
    const type     = target.dataset.type ?? "gear";
    const source   = target.dataset.talentSource;
    const category = target.dataset.category;
    const data     = { name: game.i18n.localize("YZE.NewItem"), type };
    if (type === "talent"   && source)   data["system.talentSource"] = source;
    if (type === "resource" && category) data["system.category"]     = category;

    const created = await this.actor.createEmbeddedDocuments("Item", [data]);
    if (created.length > 0) {
      const item = created[0];
      if (type === "pilot-archetype" && !this.actor.system.ea?.pilotArchetypeId)
        await this.actor.update({ "system.ea.pilotArchetypeId": item.id });
      else if (type === "automata-archetype" && !this.actor.system.ea?.automataArchetypeId)
        await this.actor.update({ "system.ea.automataArchetypeId": item.id });
      item.sheet.render(true);
    }
  }

  static async _onItemEdit(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    if (itemId) this.actor.items.get(itemId)?.sheet.render(true);
  }

  static async _onItemDelete(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    await item.deleteDialog();
    if (item.type === "pilot-archetype" && this.actor.system.ea?.pilotArchetypeId === itemId)
      await this.actor.update({ "system.ea.pilotArchetypeId": "" });
    else if (item.type === "automata-archetype" && this.actor.system.ea?.automataArchetypeId === itemId)
      await this.actor.update({ "system.ea.automataArchetypeId": "" });
  }

  static async _onPipClick(event, target) {
    const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
    const pipIdx = Number(target.dataset.pipIndex);
    if (!itemId || isNaN(pipIdx)) return;
    const item    = this.actor.items.get(itemId);
    if (!item) return;
    const current = item.system.current ?? item.system.value;
    const newVal  = pipIdx === current ? pipIdx - 1 : pipIdx;
    await item.update({ "system.current": Math.max(0, Math.min(newVal, item.system.value)) });
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

  static async _onRollWeapon(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const { GearRoller } = await import("../../../dice/gear-roller.mjs");
    await GearRoller.rollWeapon(this.actor, item);
  }

  static async _onRollArmor(event, target) {
    const itemId = target.closest("[data-item-id]")?.dataset.itemId ?? target.dataset.itemId;
    if (!itemId) return;
    const item = this.actor.items.get(itemId);
    if (!item) return;
    const { GearRoller } = await import("../../../dice/gear-roller.mjs");
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

  static async _onInitResources(event, target) {
    if (typeof globalThis.YZECreateEaResources === "function") {
      await globalThis.YZECreateEaResources(this.actor);
    }
  }
}
