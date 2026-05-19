/**
 * AttackDialog — confirmation avant un jet d'attaque.
 * Modes : normal (arme), free (pool libre), fixed (dégâts fixes sans dés).
 * Foundry VTT V14
 */
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class AttackDialog extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    classes:  ["yzegenerique", "attack-dialog"],
    position: { width: 300, height: "auto" },
    window:   { title: "Roll Attack", minimizable: false },
    actions:  {
      modUp:    AttackDialog._onModUp,
      modDown:  AttackDialog._onModDown,
      confirm:  AttackDialog._onConfirm,
      cancel:   AttackDialog._onCancel,
    },
  };

  static PARTS = {
    main: { template: "systems/yzegenerique/templates/ui/attack-dialog.hbs" },
  };

  constructor(actor, weaponItem, options = {}) {
    super(options);
    this._actor            = actor;
    this._weapon           = weaponItem ?? null;
    this._modifier         = 0;
    this._useAmmo          = weaponItem?.system?.isRanged ?? false;
    this._freeMode         = false;
    this._fixedMode        = false;
    this._fixedDmg         = 0;
    this._selectedStrandId = "";
    this._resolve          = null;
  }

  /** Dialog normale — jet d'arme avec modificateur. */
  static async prompt(actor, weaponItem) {
    return new Promise(resolve => {
      const d = new AttackDialog(actor, weaponItem);
      d._resolve = resolve;
      d.render(true);
    });
  }

  /** Dialog libre — pool de dés sans arme. */
  static async promptFree(actor) {
    // Lire les slugs depuis les settings configurables
    const meleeAttr    = game.settings.get("yzegenerique", "freeAttackMeleeAttr")   || "strength";
    const meleeSkill   = game.settings.get("yzegenerique", "freeAttackMeleeSkill")  || "melee";
    const rangedAttr   = game.settings.get("yzegenerique", "freeAttackRangedAttr")  || "agility";
    const rangedSkill  = game.settings.get("yzegenerique", "freeAttackRangedSkill") || "marksmanship";

    const getPool = (attrSlug, skillSlug) => {
      const attrItem  = actor.getAttributeBySlug?.(attrSlug);
      const skillItem = actor.skills?.find(s =>
        s.name.toLowerCase().includes(skillSlug.toLowerCase())
      );
      return (attrItem?.system.dicePoolContribution ?? 0) + (skillItem?.system.value ?? 0);
    };

    const quickAttacks = [
      { label: "Melee",  pool: getPool(meleeAttr,  meleeSkill)  },
      { label: "Ranged", pool: getPool(rangedAttr, rangedSkill) },
    ].filter(q => q.pool > 0);

    return new Promise(resolve => {
      const d          = new AttackDialog(actor, null);
      d._freeMode      = true;
      d._modifier      = 3;
      d._baseDamage    = 0;
      d._quickAttacks  = quickAttacks;
      d._resolve       = resolve;
      d.render(true);
    });
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.freeMode    = this._freeMode;
    ctx.fixedMode   = this._fixedMode;
    ctx.modifier    = this._modifier;
    ctx.fixedDmg    = this._fixedDmg;
    ctx.useAmmo     = this._useAmmo;
    ctx.isRanged    = this._weapon?.system?.isRanged ?? false;
    ctx.weaponName  = this._weapon?.name ?? (this._freeMode ? "Free Attack" : "Attack");
    ctx.presetId    = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
    ctx.quickAttacks = this._quickAttacks ?? [];

    if (this._freeMode) {
      ctx.finalPool  = Math.max(1, this._modifier);
      ctx.baseDamage = this._baseDamage ?? 0;
    } else if (this._fixedMode) {
      ctx.finalPool = 0;
    } else {
      const attrItem  = this._weapon?.system?.linkedAttribute
        ? this._actor.getAttributeBySlug(this._weapon.system.linkedAttribute) : null;
      const skillItem = this._weapon?.system?.linkedSkill
        ? this._actor.skills?.find(s =>
            (s.system.slug || s.name.toLowerCase()) === this._weapon.system.linkedSkill?.toLowerCase()
          ) : null;
      const base     = (attrItem?.system.dicePoolContribution ?? 0)
                     + (skillItem?.system.dicePoolContribution ?? 0)
                     + (this._weapon?.system?.bonusDice ?? 0);
      ctx.basePool   = base;
      ctx.finalPool  = Math.max(1, base + this._modifier);
      const modLabel = this._modifier !== 0 ? ` (${this._modifier > 0 ? "+" : ""}${this._modifier})` : "";
      ctx.finalPoolLabel = `${ctx.finalPool}d${modLabel}`;
    }
    const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
    const isEA = presetId === "eldritch-automata";
    if (isEA && this._actor) {
      ctx.isEA   = true;
      ctx.strands = this._actor.items
        .filter(i => i.type === "strand" && !i.system.broken && (i.system.value ?? 1) > 0)
        .map(s => ({ id: s.id, name: s.name, targetName: s.system.targetName }));
      ctx.hasStrands        = ctx.strands.length > 0;
      ctx.selectedStrandId  = this._selectedStrandId;
    }
    return ctx;
  }

  static _onModUp(event, target) {
    if (this._fixedMode) {
      if (this._fixedDmg >= 50) return;
      this._fixedDmg++;
    } else {
      const max = this._freeMode ? 20 : 10;
      if (this._modifier >= max) return;
      this._modifier++;
    }
    this.render();
  }

  static _onModDown(event, target) {
    if (this._fixedMode) {
      if (this._fixedDmg <= 0) return;
      this._fixedDmg--;
    } else {
      const min = this._freeMode ? 1 : -10;
      if (this._modifier <= min) return;
      this._modifier--;
    }
    this.render();
  }

  static _onConfirm(event, target) {
    if (this._fixedMode) {
      this._resolve?.({ fixedDamage: this._fixedDmg });
    } else if (this._freeMode) {
      this._resolve?.({ pool: Math.max(1, this._modifier), baseDamage: this._baseDamage ?? 0 });
    } else {
      this._resolve?.({
        modifier:         this._modifier,
        useAmmo:          this._useAmmo,
        strandCount:      this._selectedStrandId ? 1 : 0,
        selectedStrandId: this._selectedStrandId ?? "",
      });
    }
    this._resolve = null;
    this.close();
  }

  static _onCancel(event, target) {
    this._resolve?.(null);
    this._resolve = null;
    this.close();
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Boutons rapides
    this.element.querySelectorAll(".attack-dialog-quick-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const pool = Number(btn.dataset.pool);
        if (!isNaN(pool) && pool > 0) {
          this._modifier = pool;
          this.render();
        }
      });
    });

    // Toggle free/fixed mode
    const modeToggle = this.element.querySelector(".attack-dialog-mode-toggle");
    if (modeToggle) {
      modeToggle.addEventListener("change", () => {
        this._fixedMode = modeToggle.value === "fixed";
        if (this._fixedMode && this._fixedDmg === 0) this._fixedDmg = 3;
        this.render();
      });
    }

    // Checkbox useAmmo
    const chk = this.element.querySelector(".attack-dialog-ammo-check");
    if (chk) {
      chk.checked = this._useAmmo;
      chk.addEventListener("change", () => { this._useAmmo = chk.checked; });
    }

    // Base damage input (free mode)
    const dmgInput = this.element.querySelector(".attack-dialog-base-dmg");
    if (dmgInput) {
      dmgInput.value = this._baseDamage ?? 0;
      dmgInput.addEventListener("change", () => {
        this._baseDamage = Math.max(0, Number(dmgInput.value) || 0);
      });
    }

    this.element.addEventListener("keydown", e => {
      if (e.key === "Enter")  AttackDialog._onConfirm.call(this, e, null);
      if (e.key === "Escape") AttackDialog._onCancel.call(this, e, null);
    });

    // Strand selector
    const strandSel = this.element.querySelector(".roll-dialog-strand-select");
    if (strandSel) {
      strandSel.value = this._selectedStrandId ?? "";
      strandSel.addEventListener("change", (e) => {
        this._selectedStrandId = e.target.value;
        this.render();
      });
    }
  }

  _onClose(options) {
    super._onClose(options);
    this._resolve?.(null);
    this._resolve = null;
  }
}
