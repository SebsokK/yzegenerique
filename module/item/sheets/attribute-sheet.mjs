/**
 * AttributeSheet — feuille Item pour les attributs.
 * Foundry VTT V14
 *
 * V14 : DocumentSheetV2 intercepte les changements de formulaire via
 * _onChangeForm, mais uniquement si le template a un <form> à la racine
 * du PART. On surcharge _onRender pour brancher le submit automatique
 * sur chaque changement de champ.
 */

import { YZESheetMixin } from "../../helpers/sheet-mixin.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;


export class AttributeSheet extends YZESheetMixin(HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2)) {

  static DEFAULT_OPTIONS = {
    classes: ["yzegenerique", "item", "attribute"],
    position: { width: 400, height: 320 },
  };

  static PARTS = {
    main: { template: "systems/yzegenerique/templates/item/attribute-sheet.hbs", scrollable: [".window-content"]  },
  };

  async _prepareContext(options) {
    const context  = await super._prepareContext(options);
    context.item   = this.item;
    context.system = this.item.system;
    return context;
  }

  /**
   * Branche un listener "change" sur le formulaire pour déclencher
   * la sauvegarde automatique à chaque modification de champ.
   * Compatible V14 : on lit les données du formulaire et on appelle item.update().
   */
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

      // Si on change system.value, synchroniser system.current si current >= value actuelle
      if (input.name === "system.value") {
        const newVal = Number(input.value);
        const currentCurrent = this.item.system.current ?? this.item.system.value;
        // Si current était égal à l'ancienne value (jamais modifié manuellement), on suit
        if (currentCurrent >= this.item.system.value) {
          this.item.update({ "system.value": newVal, "system.current": newVal });
          return;
        }
      }
      this.item.update({ [input.name]: value });
    });
  }
}
