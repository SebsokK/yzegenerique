/**
 * CriticalInjurySheet — feuille Item pour les blessures critiques.
 * Foundry VTT V14
 */
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class CriticalInjurySheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2
) {
  static DEFAULT_OPTIONS = {
    form:     { submitOnChange: true },
    classes:  ["yzegenerique", "item", "critical-injury"],
    position: { width: 480, height: 420 },
    actions:  {
      rollHealing:       CriticalInjurySheet._onRollHealing,
      removeModifier:    CriticalInjurySheet._onRemoveModifier,
    },
  };

  static PARTS = {
    main: {
      template:   "systems/yzegenerique/templates/item/critical-injury-sheet.hbs",
      scrollable: [".window-content"],
    },
  };

  async _prepareContext(options) {
    const context  = await super._prepareContext(options);
    context.item   = this.item;
    context.system = this.item.system;
    context.document = this.item;

    const ht = this.item.system.healingTime ?? "";
    const htEnriched = this.item.system.isRollableHealingTime
      ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(
          `[[/r ${this.item.system.healingFormula}]]{${ht}}`,
          { async: true, rolls: true }
        )
      : ht;
    context.healingTimeEnriched = htEnriched;
    return context;
  }

  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    this._initModifierDrop();
  }

  async _onSubmit(event, { updateData } = {}) {
    const el = event?.target ?? event?.submitter;
    if (el?.name && event?.type !== "submit") {
      const value = el.type === "checkbox" ? el.checked
        : el.type === "number" ? (isNaN(Number(el.value)) ? 0 : Number(el.value))
        : el.value;
      return this.document.update({ [el.name]: value });
    }
    return super._onSubmit(event, { updateData });
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Sauvegarde directe sur chaque champ — plus fiable que submitOnChange en V14
    this.element.querySelectorAll("input, select, textarea").forEach(el => {
      if (!el.name) return;
      const evType = (el.type === "checkbox") ? "change" : "change";
      el.addEventListener(evType, async () => {
        const value = el.type === "checkbox" ? el.checked
          : el.type === "number" ? (isNaN(Number(el.value)) ? 0 : Number(el.value))
          : el.value;
        await this.document.update({ [el.name]: value });
      });
    });

    // Rebrancher les inputs de modificateurs
    this._initModifierInputs();
  }

  /** Zone de drop pour attributs/skills */
  _initModifierDrop() {
    const dropZone = this.element.querySelector("#ci-modifiers-drop");
    if (!dropZone) return;

    dropZone.addEventListener("dragover", e => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("drag-over");
    });
    dropZone.addEventListener("drop", async e => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");

      let data;
      try { data = JSON.parse(e.dataTransfer.getData("text/plain")); }
      catch { return; }

      if (data.type !== "Item") return;

      const item = await fromUuid(data.uuid).catch(() => null);
      if (!item) return;
      if (!["attribute", "skill"].includes(item.type)) {
        ui.notifications.warn("YZE | Drop an attribute or skill to add a modifier.");
        return;
      }

      // Vérifier si déjà présent
      const existing = this.item.system.modifiers ?? [];
      if (existing.some(m => m.targetId === item.id)) {
        ui.notifications.warn(`YZE | ${item.name} is already in the modifiers list.`);
        return;
      }

      const newMod = {
        targetId:   item.id,
        targetName: item.name,
        targetType: item.type,   // "attribute" ou "skill"
        value:      -1,          // défaut -1
      };

      await this.item.update({
        "system.modifiers": [...existing, newMod],
      });
    });
  }

  /** Inputs de valeur des modificateurs */
  _initModifierInputs() {
    this.element.querySelectorAll(".ci-mod-value").forEach(input => {
      input.addEventListener("change", async () => {
        const idx  = Number(input.dataset.modIndex);
        const mods = foundry.utils.deepClone(this.item.system.modifiers ?? []);
        if (!mods[idx]) return;
        mods[idx].value = Number(input.value) || 0;
        await this.item.update({ "system.modifiers": mods });
      });
    });
  }

  static async _onRemoveModifier(event, target) {
    const idx  = Number(target.dataset.modIndex);
    const mods = foundry.utils.deepClone(this.item.system.modifiers ?? []);
    mods.splice(idx, 1);
    await this.item.update({ "system.modifiers": mods });
  }

  static async _onRollHealing(event, target) {
    const formula = this.item.system.healingFormula;
    if (!formula) return;
    const roll = new Roll(formula);
    await roll.evaluate();

    // Mettre à jour healingTime sur l'item avec la valeur rollée
    const resultText = `${roll.total} day${roll.total > 1 ? "s" : ""}`;
    await this.item.update({ "system.healingTime": resultText });

    const msgData = {
      speaker: ChatMessage.getSpeaker({ actor: this.item.parent }),
      content: `<div class="yze-roll-result">
        <div class="yze-roll-header">
          <span class="yze-roll-label">🩹 ${this.item.name} — Healing Time</span>
        </div>
        <div class="yze-roll-outcome success">
          <span class="yze-roll-success-count">${roll.total}</span>
          <span class="yze-roll-success-label">days</span>
        </div>
      </div>`,
      rolls: [roll],
    };
    if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
      msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
    await ChatMessage.create(msgData);
  }
}
