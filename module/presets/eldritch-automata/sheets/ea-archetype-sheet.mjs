/**
 * EaArchetypeSheet — feuille Item partagée pour pilot-archetype et automata-archetype.
 * Foundry VTT V14
 */

import { YZESheetMixin } from "../../../helpers/sheet-mixin.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class EaArchetypeSheet extends YZESheetMixin(HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2)) {

  static DEFAULT_OPTIONS = {
    classes: ["yzegenerique", "ea-sheet", "item", "archetype"],
    position: { width: 540, height: 540 },
  };

  static PARTS = {
    main: {
      template: "systems/yzegenerique/templates/presets/eldritch-automata/ea-archetype-sheet.hbs",
      scrollable: [".window-content"],
    },
  };

  async _prepareContext(options) {
    const context   = await super._prepareContext(options);
    context.item    = this.item;
    context.system  = this.item.system;
    context.isPilot = this.item.type === "pilot-archetype";
    context.isAuto  = this.item.type === "automata-archetype";
    if (context.isPilot) {


    }
    if (context.isAuto) {
    }
    context.enriched = {};
    context.editable  = this.isEditable;
    context.enriched.description = await TextEditor.enrichHTML(this.item._source?.system?.description || '', { async: true });
    context.enriched.breakdownText = await TextEditor.enrichHTML(this.item._source?.system?.breakdownText || '', { async: true });
    context.enriched.strandTalentDescription = await TextEditor.enrichHTML(this.item._source?.system?.strandTalentDescription || '', { async: true });
    context.enriched.hopeTalentDescription = await TextEditor.enrichHTML(this.item._source?.system?.hopeTalentDescription || '', { async: true });
    context.enriched.berserkText = await TextEditor.enrichHTML(this.item._source?.system?.berserkText || '', { async: true });
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const form = this.element.querySelector("form");
    if (!form) return;
    form.addEventListener("change", (event) => {
      const input = event.target;
      if (!input.name) return;
      const value = input.type === "checkbox" ? input.checked
        : input.type === "number"             ? Number(input.value)
        : input.value;
      this.item.update({ [input.name]: value });
    });
  }
}
