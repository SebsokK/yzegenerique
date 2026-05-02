/**
 * TagSheet — feuille Item pour les tags.
 * Foundry VTT V14
 */

import { YZESheetMixin } from "../../helpers/sheet-mixin.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;


export class TagSheet extends YZESheetMixin(HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2)) {

  static DEFAULT_OPTIONS = {
    classes: ["yzegenerique", "item", "tag"],
    position: { width: 380, height: 280 },
  };

  static PARTS = {
    main: { template: "systems/yzegenerique/templates/item/tag-sheet.hbs", scrollable: [".window-content"]  },
  };

  async _prepareContext(options) {
    const context  = await super._prepareContext(options);
    context.item   = this.item;
    context.system = this.item.system;
    context.enriched = {};
    context.enriched.description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.item._source.system.description || '', { async: true });
    return context;
  }
}
