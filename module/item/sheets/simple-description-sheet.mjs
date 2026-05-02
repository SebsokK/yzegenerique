/**
 * SimpleDescriptionSheet — Special Trait, Weakness.
 * Foundry VTT V14
 */
import { YZESheetMixin } from "../../helpers/sheet-mixin.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class SimpleDescriptionSheet extends YZESheetMixin(HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2
)) {
  static DEFAULT_OPTIONS = {
    classes:  ["yzegenerique", "item", "simple-description"],
    position: { width: 460, height: 320 },
  };

  static PARTS = {
    main: {
      template: "systems/yzegenerique/templates/item/simple-description-sheet.hbs",
      scrollable: [".window-content"],
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item   = this.item;
    context.system = this.item.system;
    return context;
  }
}
