/**
 * RollDialog — pop-up avant chaque jet de compétence/attribut.
 * Permet de saisir un modificateur, des dés de Strand à épuiser,
 * et affiche le pool final.
 * Foundry VTT V14
 */

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class RollDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["yzegenerique", "roll-dialog"],
    position: { width: 360, height: "auto" },
    actions: {
      modUp:    RollDialog._onModUp,
      modDown:  RollDialog._onModDown,
      confirm:  RollDialog._onConfirm,
      cancel:   RollDialog._onCancel,
    },
  };

  static PARTS = {
    main: { template: "systems/yzegenerique/templates/ui/roll-dialog.hbs" },
  };

  constructor(actor, skillItem, attributeItem) {
    super();
    this._actor           = actor;
    this._skillItem       = skillItem;
    this._attributeItem   = attributeItem;
    this._modifier        = 0;
    this._selectedStrandId = "";
    this._resolve         = null;
  }

  get title() {
    const name = this._skillItem?.name ?? this._attributeItem?.name ?? "Roll";
    return `🎲 ${name}`;
  }

  /** Ouvre le dialog et retourne les options choisies, ou null si annulé. */
  static async prompt(actor, skillItem, attributeItem) {
    return new Promise(resolve => {
      const d = new RollDialog(actor, skillItem, attributeItem);
      d._resolve = resolve;
      d.render(true);
    });
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
    const isEA = presetId === "eldritch-automata";

    // Pool de base
    const attrDice  = this._attributeItem?.system?.value ?? 0;
    const skillDice = this._skillItem ? (this._actor.getSkillPool?.(this._skillItem) ?? 0) : 0;
    const base      = Math.max(attrDice, skillDice > 0 ? attrDice + skillDice : attrDice);
    const finalPool = Math.max(1, base + this._modifier);

    // Strands disponibles (EA seulement)
    const strands = isEA
      ? this._actor.items.filter(i => i.type === "strand" && !i.system.broken && (i.system.value ?? 1) > 0)
      : [];

    ctx.isEA          = isEA;
    ctx.presetId      = presetId;
    ctx.skillName     = this._skillItem?.name     ?? "—";
    ctx.attrName      = this._attributeItem?.name ?? "—";
    ctx.modifier      = this._modifier;
    const strandSelected = strands.find(s => s.id === this._selectedStrandId);
    ctx.selectedStrandId = this._selectedStrandId;
    ctx.finalPool     = finalPool + (strandSelected ? 2 : 0); // +2 dés par strand exhaust
    ctx.strands       = strands;
    ctx.hasStrands    = strands.length > 0;
    return ctx;
  }

  static _onModUp(event, target) {
    this._modifier++;
    this.render();
  }

  static _onModDown(event, target) {
    this._modifier--;
    this.render();
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Strand selector
    const strandSelect = this.element.querySelector(".roll-dialog-strand-select");
    if (strandSelect) {
      strandSelect.value = this._selectedStrandId;
      strandSelect.addEventListener("change", (e) => {
        this._selectedStrandId = e.target.value;
        this.render();
      });
    }
  }

  static _onConfirm(event, target) {
    this._resolve?.({
      modifier:          this._modifier,
      strandCount:       this._selectedStrandId ? 1 : 0,
      selectedStrandId:  this._selectedStrandId,
      cancelled:         false,
    });
    this.close();
  }

  static _onCancel(event, target) {
    this._resolve?.(null);
    this.close();
  }

  _onClose(options) {
    this._resolve?.(null);
    this._resolve = null;
  }
}
