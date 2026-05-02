/**
 * EaStrandSheet — feuille Item pour les Strands EA.
 * Foundry VTT V14
 */

import { YZESheetMixin } from "../../../helpers/sheet-mixin.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;


export class EaStrandSheet extends YZESheetMixin(HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2)) {

  static DEFAULT_OPTIONS = {
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
    context.descriptionRaw = this.item._source.system.description ?? "";
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
