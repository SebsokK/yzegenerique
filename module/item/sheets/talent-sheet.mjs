/**
 * TalentSheet — feuille Item pour les talents (tous presets).
 * Foundry VTT V14
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class TalentSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["yzegenerique", "item", "talent"],
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
    context.document = this.item;

    console.log("[TalentSheet] editable:", this.isEditable);
    console.log("[TalentSheet] description raw:", this.item._source.system.description);

    context.enriched = {};
    context.enriched.description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.item._source.system.description || "",
      { async: true, relativeTo: this.item }
    );

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    this.element.querySelectorAll("a.editor-edit").forEach(btn => {
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        const editorDiv  = btn.closest(".editor");
        const contentDiv = editorDiv?.querySelector(".editor-content[data-edit]");
        if (!contentDiv) return;

        const path     = contentDiv.dataset.edit;
        const fieldKey = path.replace("system.", "");
        const src      = this.item._source?.system?.[fieldKey] ?? "";

        btn.style.display = "none";

        try {
          await foundry.applications.ux.TextEditor.implementation.create({
            target:      contentDiv,
            fieldName:   path,
            document:    this.item,
            engine:      "prosemirror",
            collaborate: false,
            editable:    true,
          }, src);
        } catch(err) {
          console.error("[TalentSheet] Editor activation failed:", err);
          btn.style.display = "";
          return;
        }

        const saveBtn = document.createElement("button");
        saveBtn.type      = "button";
        saveBtn.className = "yze-editor-save";
        saveBtn.innerHTML = "✓ Save";
        editorDiv.appendChild(saveBtn);

        saveBtn.addEventListener("click", async () => {
          const html = contentDiv.innerHTML ?? "";
          await this.item.update({ [path]: html });
          this.render();
        });
      });
    });
  }
}
