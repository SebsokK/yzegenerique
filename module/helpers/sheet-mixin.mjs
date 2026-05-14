/**
 * YZESheetMixin — mixin partagé pour toutes les feuilles YZE.
 * Foundry VTT V14
 */

// ── Helpers focus — fonctions locales à la closure, pas des méthodes statiques ──
// (Les méthodes statiques sur la classe anonyme retournée ne sont pas accessibles
//  via le nom de la factory — on les déclare ici comme fonctions ordinaires.)

function _focusKey(el) {
  if (el.name) return `actor:${el.name}`;
  if (el.dataset?.itemId && el.dataset?.field)
    return `item:${el.dataset.itemId}:${el.dataset.field}`;
  return null;
}

function _findByFocusKey(root, key) {
  if (!root || !key) return null;
  const [type, ...rest] = key.split(":");
  if (type === "actor") {
    return root.querySelector(`[name="${rest.join(":")}"]`);
  }
  if (type === "item") {
    const [itemId, field] = [rest[0], rest.slice(1).join(":")];
    return root.querySelector(`[data-item-id="${itemId}"][data-field="${field}"]`);
  }
  return null;
}

export function YZESheetMixin(Base) {
  return class extends Base {

    // Avec submitOnChange:true, Foundry appelle _onSubmit à chaque changement.
    // On surcharge pour ne mettre à jour QUE le champ modifié.
    async _onSubmit(event, { updateData } = {}) {
      const el = event?.target ?? event?.submitter;
      if (el?.name && event?.type !== "submit") {
        // Changement d'un champ unique — update partiel
        const value = el.type === "checkbox" ? el.checked
          : el.type === "number" ? (isNaN(Number(el.value)) ? 0 : Number(el.value))
          : el.value;
        // Skip les champs data-item-id (gérés par les listeners item)
        if (el.dataset.itemId) return;
        return this.document.update({ [el.name]: value });
      }
      // Submit complet (fermeture fenêtre etc.) — comportement natif
      return super._onSubmit(event, { updateData });
    }

    static DEBOUNCE_MS = 400;

    _debounceTimers = {};
    _itemHookFn     = null;
    _savedScrollTop  = 0;
    _savedFocusKey   = null;
    _savedFocusValue = null;

    // ── Cycle de vie ──────────────────────────────────────────────

    async _preRender(context, options) {
      if (super._preRender) await super._preRender(context, options);

      const scrollable = this.element?.querySelector(".yze-sheet");
      if (scrollable) this._savedScrollTop = scrollable.scrollTop;

      const focused = this.element?.querySelector(":focus");
      if (focused) {
        const key = _focusKey(focused);
        if (key) {
          this._savedFocusKey   = key;
          this._savedFocusValue = focused.value;
        }
      }
    }

    _onRender(context, options) {
      super._onRender(context, options);

      const scrollable = this.element?.querySelector(".yze-sheet");
      if (scrollable && this._savedScrollTop > 0) {
        scrollable.scrollTop = this._savedScrollTop;
      }

      if (this._savedFocusKey) {
        const el = _findByFocusKey(this.element, this._savedFocusKey);
        if (el) {
          el.focus();
          if (el.type === "text" || el.type === "number") el.select();
        }
        this._savedFocusKey   = null;
        this._savedFocusValue = null;
      }

      this._setupFormListeners();
      this._setupImgListeners();

      // Brancher le bouton d'édition ProseMirror (a.editor-edit)
      this.element.querySelectorAll("a.editor-edit").forEach(btn => {
        btn.addEventListener("click", async (event) => {
          event.preventDefault();
          const editorDiv  = btn.closest(".editor");
          const contentDiv = editorDiv?.querySelector(".editor-content[data-edit]");
          if (!contentDiv) return;

          const path     = contentDiv.dataset.edit;
          const fieldKey = path.replace("system.", "");
          const doc      = this.document;
          const src      = doc?._source?.system?.[fieldKey] ?? doc?._source?.[fieldKey] ?? "";

          // Cacher le bouton d'édition
          btn.style.display = "none";

          let pmEditor = null;
          try {
            pmEditor = await foundry.applications.ux.TextEditor.implementation.create({
              target:      contentDiv,
              fieldName:   path,
              document:    doc,
              engine:      "prosemirror",
              collaborate: false,
              editable:    true,
            }, src);
          } catch(err) {
            console.error("[YZEMixin] Editor activation failed:", err);
            btn.style.display = "";
            return;
          }

          // Ajouter un bouton Save
          const saveBtn = document.createElement("button");
          saveBtn.type      = "button";
          saveBtn.className = "yze-editor-save";
          saveBtn.innerHTML = "✓ Save";
          editorDiv.appendChild(saveBtn);

          saveBtn.addEventListener("click", async () => {
            // contentDiv devient le nœud ProseMirror lui-même après init
            const html = contentDiv.innerHTML ?? "";
            await doc.update({ [path]: html });
            // Re-render la feuille pour repasser en mode lecture
            this.render();
          });
        });
      });

      this._unbindItemHooks();
      this._bindItemHooks();
    }

    _onClose(options) {
      if (super._onClose) super._onClose(options);
      this._unbindItemHooks();
      for (const t of Object.values(this._debounceTimers)) clearTimeout(t);
      this._debounceTimers = {};
    }

    _bindItemHooks() {
      if (!this.document?.id) return;
      this._unbindItemHooks();
      const actorId = this.document.id;
      this._itemHookFn = (item) => {
        if (item?.parent?.id === actorId) this.render({ force: true });
      };
      Hooks.on("updateItem", this._itemHookFn);
      Hooks.on("createItem", this._itemHookFn);
      Hooks.on("deleteItem", this._itemHookFn);

      // Re-render quand l'acteur lui-même est mis à jour (health, stress, etc.)
      this._actorHookFn = (actor) => {
        if (actor?.id === actorId) this.render({ force: true });
      };
      Hooks.on("updateActor", this._actorHookFn);
    }

    _unbindItemHooks() {
      if (this._itemHookFn) {
        Hooks.off("updateItem", this._itemHookFn);
        Hooks.off("createItem", this._itemHookFn);
        Hooks.off("deleteItem", this._itemHookFn);
        this._itemHookFn = null;
      }
      if (this._actorHookFn) {
        Hooks.off("updateActor", this._actorHookFn);
        this._actorHookFn = null;
      }
    }

    // ── Image picker ──────────────────────────────────────────────

    /**
     * Branche un FilePicker sur chaque image [data-edit="img"].
     * Compatible ApplicationV2 / V14 — remplace le mécanisme legacy data-edit.
     */
    _setupImgListeners() {
      this.element?.querySelectorAll("[data-edit='img']").forEach(img => {
        img.style.cursor = "pointer";
        img.addEventListener("click", async () => {
          const current = this.document.img ?? "";
          const fp = new FilePicker({
            type:     "image",
            current,
            callback: async (path) => {
              await this.document.update({ img: path });
            },
          });
          fp.browse(current);
        });
      });
    }

    // ── Form listeners ────────────────────────────────────────────

    _setupFormListeners() {
      const form = this.element?.querySelector("form");
      if (!form) return;

      // Inputs actor (name sans data-item-id)
      form.querySelectorAll("input[name]:not([data-item-id]), textarea[name]:not([data-item-id]), select[name]:not([data-item-id])").forEach(el => {
        // blur : sauvegarde quand le champ perd le focus (toujours fiable)
        el.addEventListener("blur", (event) => {
          const inp = event.currentTarget;
          this._debouncedActorUpdate(inp.name, this._readInputValue(inp));
        });
        // change : pour les select et checkbox (déclenche immédiatement)
        el.addEventListener("change", (event) => {
          const inp = event.currentTarget;
          this._debouncedActorUpdate(inp.name, this._readInputValue(inp));
        });
      });

      // Inputs item (data-item-id + data-field)
      form.querySelectorAll("[data-item-id][data-field]").forEach(el => {
        el.addEventListener("change", (event) => {
          const inp = event.currentTarget;
          this._debouncedItemUpdate(inp.dataset.itemId, inp.dataset.field, this._readInputValue(inp));
        });
      });
    }

    // ── Debounce ──────────────────────────────────────────────────

    _debouncedActorUpdate(field, value) {
      const key = `actor:${field}`;
      clearTimeout(this._debounceTimers[key]);
      this._debounceTimers[key] = setTimeout(() => {
        this.document.update({ [field]: value });
        delete this._debounceTimers[key];
      }, this.constructor.DEBOUNCE_MS);
    }

    _debouncedItemUpdate(itemId, field, value) {
      const key = `item:${itemId}:${field}`;
      clearTimeout(this._debounceTimers[key]);
      this._debounceTimers[key] = setTimeout(() => {
        const item = this.document.items?.get(itemId)
          ?? (this.item?.id === itemId ? this.item : null);
        if (item) item.update({ [field]: value });
        delete this._debounceTimers[key];
      }, this.constructor.DEBOUNCE_MS);
    }

    _readInputValue(input) {
      return input.type === "checkbox" ? input.checked
        : input.type === "number"      ? Number(input.value)
        : input.value;
    }
  };
}
