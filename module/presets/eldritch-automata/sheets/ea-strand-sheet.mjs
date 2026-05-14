/**
 * EaStrandSheet — feuille Item pour les Strands EA.
 * Foundry VTT V14
 */

import { YZESheetMixin } from "../../../helpers/sheet-mixin.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;


export class EaStrandSheet extends YZESheetMixin(HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2)) {

  static DEFAULT_OPTIONS = {
    form:    { submitOnChange: true },
    classes: ["yzegenerique", "ea-sheet", "item", "strand"],
    position: { width: 440, height: 360 },
  };

  static PARTS = {
    main: {
      template: "systems/yzegenerique/templates/presets/eldritch-automata/ea-strand-sheet.hbs",
      scrollable: [".window-content"],
    },
  };

  async _prepareContext(options) {
    const context  = await super._prepareContext(options);
    context.item   = this.item;
    context.system = this.item.system;
    context.editable = this.isEditable;
    context.enriched = {};
    context.enriched.memory = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.item._source.system.memory ?? "", { async: true }
    );
    context.enriched.notes = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.item._source.system.notes ?? "", { async: true }
    );
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
  }
}
