/**
 * NpcSheet — feuille PNJ générique YZE.
 * Foundry VTT V14
 */

import { YZESheetMixin } from "../../helpers/sheet-mixin.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class NpcSheet extends YZESheetMixin(HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)) {

  static DEFAULT_OPTIONS = {
    classes: ["yzegenerique", "actor", "npc"],
    position: { width: 480, height: 400 },
  };

  static PARTS = {
    main: {
      template: "systems/yzegenerique/templates/actor/npc-sheet.hbs",
      scrollable: [".window-content"],
    },
  };

  async _prepareContext(options) {
    const context     = await super._prepareContext(options);
    context.actor     = this.actor;
    context.system    = this.actor.system;
    context.enriched = {};
    context.editable  = this.isEditable;
    context.enriched.biography = await TextEditor.enrichHTML(this.actor._source?.system?.biography || '', { async: true });
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
      this.actor.update({ [input.name]: value });
    });
  }
}
