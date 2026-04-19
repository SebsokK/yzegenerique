/**
 * TalentSheet — feuille Item pour les talents (tous presets).
 * Foundry VTT V14 — utilise {{editor}} natif Foundry.
 */

import { YZESheetMixin } from "../../helpers/sheet-mixin.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class TalentSheet extends YZESheetMixin(
  HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2)
) {

  static DEFAULT_OPTIONS = {
    classes: ["yzegenerique", "item", "talent"],
    position: { width: 500, height: 520 },
  };

  static PARTS = {
    main: {
      template:   "systems/yzegenerique/templates/item/talent-sheet.hbs",
      scrollable: [".window-content"],
    },
  };

  async _prepareContext(options) {
    const context   = await super._prepareContext(options);
    context.item    = this.item;
    context.system  = this.item.system;
    context.editable = this.isEditable;

    console.log("[TalentSheet] system.description:", this.item._source?.system?.description);

    context.enriched = {};
    context.enriched.description = await TextEditor.enrichHTML(
      this.item._source?.system?.description || "",
      { async: true }
    );

    return context;
  }
}
