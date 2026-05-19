/**
 * CharacterSheet — feuille de personnage générique YZE.
 * Foundry VTT V14
 */

import { YZESheetMixin } from "../../helpers/sheet-mixin.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;


export class CharacterSheet extends YZESheetMixin(HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)) {

  static DEFAULT_OPTIONS = {
    form:     { submitOnChange: true },
    classes: ["yzegenerique", "actor", "character"],
    position: { width: 680, height: 700 },
    window:   { resizable: true },
    actions: {
      reloadWeapon:   CharacterSheet._onReloadWeapon,
      rollCiHealing:  CharacterSheet._onRollCiHealing,
      toggleAutoCalc: CharacterSheet._onToggleAutoCalc,
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
    context.gear       = await Promise.all(
      this.actor.items.filter(i => i.type === "gear").map(async g => {
        const tooltip = (g.system.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const gObj = g.toObject();
        gObj.id      = g.id;
        gObj.system  = g.system;
        gObj.tooltip = tooltip;
        return gObj;
      })
    );
    context.weapons    = await Promise.all(
      this.actor.items.filter(i => i.type === "weapon").map(async w => {
        const tags = (w.system.tagIds ?? [])
          .map(id => game.items.get(id))
          .filter(Boolean)
          .map(t => ({
            name: t.name,
            tooltip: (t.system.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
          }));
      const obj = w.toObject();
      obj.id           = w.id;
      obj.system       = w.system;
      obj.resolvedTags = tags;
      return obj;
      })
    );
    context.armors     = this.actor.items.filter(i => i.type === "armor");
    context.resources  = this.actor.items.filter(i => i.type === "resource");
    context.talents    = this.actor.items.filter(i => i.type === "talent");
    context.criticalInjuries = await Promise.all(
      this.actor.items.filter(i => i.type === "critical-injury").map(async ci => {
        const ht = ci.system.healingTime ?? "";
        // Calculer directement — ne pas dépendre du getter DataModel
        const isRollable = /^\d*d\d+$/i.test(ht.trim());
        const htEnriched = isRollable
          ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(
              `[[/r ${ht}]]{${ht}}`,
              { async: true, rolls: true }
            )
          : ht;
        return {
          id:                   ci.id,
          name:                 ci.name,
          system:               ci.system,
          isRollableHealingTime: isRollable,
          healingTimeEnriched:  htEnriched,
        };
      })
    );

    // ── Modificateurs actifs des CI (non soignées) ─────────────────
    const ciModById   = new Map();
    const ciModByName = new Map();
    for (const ci of this.actor.items.filter(i => i.type === "critical-injury")) {
      // Lire directement depuis system — le getter activeModifiers peut ne pas être dispo
      const healed    = ci.system.healed ?? false;
      const modifiers = ci.system.modifiers ?? [];
      if (healed) continue;
      for (const mod of modifiers) {
        if (!mod || mod.value === undefined || mod.value === null || mod.value === 0) continue;
        if (mod.targetId) {
          ciModById.set(mod.targetId, (ciModById.get(mod.targetId) ?? 0) + mod.value);
        }
        if (mod.targetName) {
          const key = mod.targetName.toLowerCase().trim();
          ciModByName.set(key, (ciModByName.get(key) ?? 0) + mod.value);
        }
      }
    }

    if (ciModByName.size > 0 || ciModById.size > 0) {
      console.log("YZE | CI mods by name:", Object.fromEntries(ciModByName));
      console.log("YZE | Actor skills:", this.actor.skills.map(s => s.name.toLowerCase()));
    }

    const getCIMod = (item) => {
      const byId   = ciModById.get(item.id) ?? 0;
      const byName = ciModByName.get(item.name.toLowerCase().trim()) ?? 0;
      return byId !== 0 ? byId : byName;
    };

    // ── Attributs avec CI modifiers ───────────────────────────────
    context.attributes = this._prepareAttributes(getCIMod);

    // ── Skills avec CI modifiers ───────────────────────────────────
    context.skills = this.actor.skills.map(skill => {
      const mod    = getCIMod(skill);
      const baseVal = skill.system.value ?? 0;
      const modVal  = Math.max(0, baseVal + mod);
      return {
        id:     skill.id,
        name:   skill.name,
        system: { ...skill.system, value: modVal },
        ciMod:  mod !== 0 ? mod : null,
        baseVal,
      };
    });

    context.enableStress = cfg.enableStress ?? false;

    // XP pips — 30 cases max, groupes de 5
    const xpTotal = this.actor.system.xp?.total ?? 0;
    const xpMax   = this.actor.system.xp?.max   ?? 30;
    const xpCap   = Math.min(xpMax, 30);
    context.xpPips = Array.from({ length: xpCap }, (_, i) => ({
      index:      i + 1,
      filled:     i < xpTotal,
      groupStart: i % 5 === 0 && i > 0,
    }));
    context.xpTotal = xpTotal;
    context.xpMax   = xpCap;
    context.biography  = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.actor._source.system.biography ?? "", { relativeTo: this.actor }
    );
    context.enriched = {};
    context.enriched.biography = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.actor._source.system.biography || '', { async: true });
    return context;
  }

  /** Prépare les attributs avec les pips et les CI modifiers. */
  _prepareAttributes(getCIMod = () => 0) {
    return this.actor.attributes.map(attr => {
      const val     = attr.system.value   ?? 2;
      const current = attr.system.current ?? val;
      const mod     = getCIMod(attr);
      const modCurrent = Math.max(0, current + mod);
      return {
        id:          attr.id,
        name:        attr.name,
        img:         attr.img,
        system:      { ...attr.system, current: modCurrent },
        ciMod:       mod !== 0 ? mod : null,
        baseCurrent: current,
        isMaxed:     modCurrent >= val && val > 0,
        pips:        CharacterSheet._buildPips(attr.id, val, modCurrent),
      };
    });
  }

  static _buildPips(attrId, max, current) {
    const pips = [];
    for (let i = 1; i <= max; i++) {
      pips.push({ index: i, filled: i <= current, attrId });
    }
    return pips;
  }

  // _onRender et _setupFormListeners viennent du mixin

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);

    // ── XP pips — une seule fois ──────────────────────────────────
    this.element.addEventListener("click", async (event) => {
      const pip = event.target.closest(".xp-pip[data-xp-index]");
      if (!pip) return;
      const idx     = Number(pip.dataset.xpIndex);
      const current = this.actor.system.xp?.total ?? 0;
      const newVal  = (idx <= current) ? idx - 1 : idx;
      await this.actor.update({ "system.xp.total": Math.max(0, newVal) });
    });

    // ── Pips attributs — une seule fois ──────────────────────────
    this.element.addEventListener("click", async (event) => {
      const pip = event.target.closest(".yze-pip[data-pip-index]");
      if (!pip) return;
      event.preventDefault();
      event.stopPropagation();
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



  _onRender(context, options) {
    super._onRender(context, options);
    const tabs   = this.element.querySelectorAll(".tab-btn");
    const panels = this.element.querySelectorAll(".tab-panel");

    // Restaurer l'onglet actif (défaut : "character")
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

    // ── Trackers Health / Resolve ─────────────────────────────────
    this.element.querySelectorAll(".hdr-tracker").forEach(bar => {
      const val = Number(bar.dataset.value) || 0;
      const max = Number(bar.dataset.max)   || 1;
      const pct = Math.max(0, Math.min(1, val / max));
      const fill = bar.querySelector(".hdr-tracker-bar");
      if (!fill) return;
      fill.style.width = `${pct * 100}%`;
      // Couleur : vert → orange → rouge selon le pourcentage
      const r = Math.round(255 * (1 - pct));
      const g = Math.round(200 * pct);
      fill.style.background = `rgb(${r}, ${g}, 40)`;
      fill.style.boxShadow  = pct > 0.5
        ? `0 0 6px rgba(${r}, ${g}, 40, 0.6)`
        : `0 0 6px rgba(${r}, 60, 40, 0.8)`;
    });

    // Mettre à jour les trackers quand les inputs changent
    this.element.querySelectorAll(".hdr-resource input[type='number']").forEach(input => {
      input.addEventListener("input", () => {
        const wrap    = input.closest(".hdr-tracker-wrap");
        const tracker = wrap?.querySelector(".hdr-tracker");
        if (!tracker) return;
        const allInputs = wrap.querySelectorAll("input[type='number']");
        const val = Number(allInputs[0]?.value) || 0;
        const max = Number(allInputs[1]?.value) || 1;
        const pct = Math.max(0, Math.min(1, val / max));
        const fill = tracker.querySelector(".hdr-tracker-bar");
        if (!fill) return;
        fill.style.width = `${pct * 100}%`;
        const r = Math.round(255 * (1 - pct));
        const g = Math.round(200 * pct);
        fill.style.background = `rgb(${r}, ${g}, 40)`;
        fill.style.boxShadow  = `0 0 6px rgba(${r}, ${g}, 40, 0.6)`;
      });
    });
  }

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
    const field    = target.dataset.field;
    const current  = foundry.utils.getProperty(this.actor.system, field.replace("system.", ""));
    await this.actor.update({ [field]: !current });
  }

  static async _onRollCiHealing(event, target) {
    const itemId = target.dataset.itemId ?? target.closest("[data-item-id]")?.dataset.itemId;
    const item   = this.actor.items.get(itemId);
    if (!item) return;
    const ht = item.system.healingTime ?? "";
    const formula = item.system.healingFormula ?? ht;
    if (!formula) return;
    const roll = new Roll(formula);
    await roll.evaluate();

    // Utiliser timeLimit comme unité si défini, sinon "days"
    const unit = item.system.timeLimit?.trim() || "days";
    const resultText = `${roll.total} ${unit}`;

    // Mettre à jour healingTime avec la valeur rollée
    await item.update({ "system.healingTime": resultText });

    const msgData = {
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div class="yze-roll-result">
        <div class="yze-roll-header">
          <span class="yze-roll-actor">${this.actor.name}</span>
          <span class="yze-roll-label">🩹 ${item.name} — Healing Time</span>
        </div>
        <div class="yze-roll-outcome success">
          <span class="yze-roll-success-count">${roll.total}</span>
          <span class="yze-roll-success-label">${unit}</span>
        </div>
      </div>`,
      rolls: [roll],
    };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
      msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    await ChatMessage.create(msgData);
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
    const itemId = target.dataset.itemId;
    const pipIdx = Number(target.dataset.pipIndex);
    console.log("[PipClick] itemId:", itemId, "pipIdx:", pipIdx, "target:", target);
    if (!itemId || isNaN(pipIdx)) return;

    const item = this.actor.items.get(itemId);
    if (!item) return;

    const max  = item.system.value ?? 2;
    // Si on clique sur le dernier pip rempli → descend d'un, sinon monte jusqu'à pipIdx
    const current = item.system.current ?? max;
    const newVal  = (pipIdx <= current) ? pipIdx - 1 : pipIdx;
    await item.update({ "system.current": Math.max(0, Math.min(newVal, max)) });
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
