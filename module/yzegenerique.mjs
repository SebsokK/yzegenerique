/**
 * yzegenerique.mjs — Point d'entrée YZE Générique
 *
 * Ordre d'initialisation impératif dans init() :
 *   1. registerSystemSettings()       ← settings lisibles après cette ligne
 *   2. Lecture de damageSystem / activePreset
 *   3. CONFIG.Actor.dataModels        ← doit être complet avant instanciation des Documents
 *   4. CONFIG.Item.dataModels
 *   5. registerSheets()
 *   6. registerAllPresets()
 *   7. registerHandlebarsHelpers()
 *
 * Foundry VTT V14 — ES Modules
 */

// ── Noyau ────────────────────────────────────────────────────────────
import { YZEActor }                  from "./actor/actor.mjs";
import { YZEItem }                   from "./item/item.mjs";
import { CharacterSheet }            from "./actor/sheets/character-sheet.mjs";
import { NpcSheet }                  from "./actor/sheets/npc-sheet.mjs";
import { AttributeSheet }            from "./item/sheets/attribute-sheet.mjs";
import { SkillSheet }                from "./item/sheets/skill-sheet.mjs";
import { YZEItemSheet }              from "./item/sheets/item-sheet.mjs";
import { registerSystemSettings }    from "./settings/system-settings.mjs";
import { registerHandlebarsHelpers } from "./helpers/handlebars-helpers.mjs";
import { DerivedStatsSystem }        from "./rules/derived-stats-system.mjs";
import { registerAllPresets }        from "./presets/preset-registry.mjs";

// ── DataModels Actor noyau ────────────────────────────────────────────
import { HealthResolveModel }        from "./actor/models/health-resolve-model.mjs";
import { AttributeDamageModel }      from "./actor/models/attribute-damage-model.mjs";
import { ConditionsModel }           from "./actor/models/conditions-model.mjs";

// ── DataModels Item noyau ─────────────────────────────────────────────
import { AttributeDataModel }        from "./item/models/attribute-model.mjs";
import { SkillDataModel }            from "./item/models/skill-model.mjs";
import { GearDataModel }             from "./item/models/gear-model.mjs";
import { WeaponDataModel }           from "./item/models/weapon-model.mjs";
import { ArmorDataModel }            from "./item/models/armor-model.mjs";
import { TagDataModel }              from "./item/models/tag-model.mjs";
import { SpecialtyDataModel }        from "./item/models/specialty-model.mjs";
import { ResourceDataModel }         from "./item/models/resource-model.mjs";

// ── EA Bloc 1 — DataModel Actor + Feuille Actor ───────────────────────
import { EaCharacterModel, EaNpcModel } from "./presets/eldritch-automata/models/ea-actor-model.mjs";
import { EaCharacterSheet }             from "./presets/eldritch-automata/sheets/ea-character-sheet.mjs";

// ── EA Bloc 2 — DataModels Item + Feuilles Item ───────────────────────
import { StrandDataModel }               from "./presets/eldritch-automata/models/strand-model.mjs";
import { TalentDataModel }               from "./presets/eldritch-automata/models/talent-model.mjs";
import { PilotArchetypeDataModel }       from "./presets/eldritch-automata/models/pilot-archetype-model.mjs";
import { AutomataArchetypeDataModel }    from "./presets/eldritch-automata/models/automata-archetype-model.mjs";
import { EaArchetypeSheet }              from "./presets/eldritch-automata/sheets/ea-archetype-sheet.mjs";
import { EaTalentSheet }                 from "./presets/eldritch-automata/sheets/ea-talent-sheet.mjs";
import { TalentSheet }                   from "./item/sheets/talent-sheet.mjs";
import { CriticalInjuryDataModel }       from "./item/models/critical-injury-model.mjs";
import { CriticalInjurySheet }           from "./item/sheets/critical-injury-sheet.mjs";
import { SpecialTraitDataModel }         from "./item/models/special-trait-model.mjs";
import { WeaknessDataModel }             from "./item/models/weakness-model.mjs";
import { SpecialAttackDataModel }        from "./item/models/special-attack-model.mjs";
import { SimpleDescriptionSheet }        from "./item/sheets/simple-description-sheet.mjs";
import { CriticalHandler }               from "./critical/critical-handler.mjs";
import { EaStrandSheet }                 from "./presets/eldritch-automata/sheets/ea-strand-sheet.mjs";
import { ResourceSheet }                 from "./item/sheets/resource-sheet.mjs";
import { WeaponSheet }                   from "./item/sheets/weapon-sheet.mjs";
import { ArmorSheet }                    from "./item/sheets/armor-sheet.mjs";
import { TagSheet }                      from "./item/sheets/tag-sheet.mjs";

// ── Table de correspondance damageSystem → DataModels noyau ──────────
const CORE_ACTOR_MODELS = {
  healthResolve:   { character: HealthResolveModel,   npc: HealthResolveModel   },
  attributeDamage: { character: AttributeDamageModel, npc: AttributeDamageModel },
  conditions:      { character: ConditionsModel,       npc: ConditionsModel      },
};

// ─────────────────────────────────────────────────────────────────────

Hooks.once("init", () => {
  console.log("YZE Générique | init");

  // ── 1. Settings en premier ─────────────────────────────────────────
  registerSystemSettings();

  const damageSystem = game.settings.get("yzegenerique", "damageSystem");
  const activePreset = game.settings.get("yzegenerique", "activePresetId");

  // ── 2. Classes Document ────────────────────────────────────────────
  CONFIG.Actor.documentClass = YZEActor;
  CONFIG.Item.documentClass  = YZEItem;

  // ── 3. DataModels Actor ────────────────────────────────────────────
  // EA fournit ses propres DataModels — pas de couche intermédiaire.
  if (damageSystem === "custom" && activePreset === "eldritch-automata") {
    CONFIG.Actor.dataModels = {
      character: EaCharacterModel,
      npc:       EaNpcModel,
    };
  } else {
    CONFIG.Actor.dataModels = CORE_ACTOR_MODELS[damageSystem]
      ?? CORE_ACTOR_MODELS.healthResolve;
  }

  // ── 4. DataModels Item noyau ───────────────────────────────────────
  CONFIG.Item.dataModels = {
    attribute: AttributeDataModel,
    skill:     SkillDataModel,
    gear:      GearDataModel,
    weapon:    WeaponDataModel,
    armor:     ArmorDataModel,
    tag:       TagDataModel,
    specialty: SpecialtyDataModel,
    resource:  ResourceDataModel,
  };

  // ── 5. DataModels Item EA (Bloc 2 — conditionnel) ─────────────────
  if (activePreset === "eldritch-automata") {
    Object.assign(CONFIG.Item.dataModels, {
      "strand":             StrandDataModel,
      "talent":             TalentDataModel,
      "critical-injury":    CriticalInjuryDataModel,
      "special-trait":      SpecialTraitDataModel,
      "weakness":           WeaknessDataModel,
      "special-attack":     SpecialAttackDataModel,
      "pilot-archetype":    PilotArchetypeDataModel,
      "automata-archetype": AutomataArchetypeDataModel,
    });
  }

  // ── 6. Feuilles Actor ──────────────────────────────────────────────
  Actors.unregisterSheet("core", ActorSheet);

  // Feuille générique — disponible mais non par défaut si EA actif
  Actors.registerSheet("yzegenerique", CharacterSheet, {
    types:       ["character"],
    makeDefault: activePreset !== "eldritch-automata",
    label:       "YZE.SheetCharacter",
  });
  Actors.registerSheet("yzegenerique", NpcSheet, {
    types:       ["npc"],
    makeDefault: true,
    label:       "YZE.SheetNpc",
  });

  // Feuille EA — enregistrée uniquement si EA actif
  if (activePreset === "eldritch-automata") {
    Actors.registerSheet("yzegenerique", EaCharacterSheet, {
      types:       ["character"],
      makeDefault: true,
      label:       "YZE.EA.SheetCharacter",
    });
  }

  // ── 7. Feuilles Item noyau ─────────────────────────────────────────
  Items.unregisterSheet("core", ItemSheet);

  Items.registerSheet("yzegenerique", AttributeSheet, {
    types: ["attribute"], makeDefault: true, label: "YZE.SheetAttribute",
  });
  Items.registerSheet("yzegenerique", SkillSheet, {
    types: ["skill"], makeDefault: true, label: "YZE.SheetSkill",
  });
  Items.registerSheet("yzegenerique", ResourceSheet, {
    types: ["resource"], makeDefault: true, label: "YZE.SheetResource",
  });
  Items.registerSheet("yzegenerique", WeaponSheet, {
    types: ["weapon"], makeDefault: true, label: "YZE.SheetWeapon",
  });
  Items.registerSheet("yzegenerique", ArmorSheet, {
    types: ["armor"], makeDefault: true, label: "YZE.SheetArmor",
  });
  Items.registerSheet("yzegenerique", TagSheet, {
    types: ["tag"], makeDefault: true, label: "YZE.SheetTag",
  });
  Items.registerSheet("yzegenerique", YZEItemSheet, {
    types: ["gear", "specialty"], makeDefault: true, label: "YZE.SheetItem",
  });

  // ── 8. Feuilles Item EA (Bloc 2 — conditionnelles) ─────────────────
  Items.registerSheet("yzegenerique", SimpleDescriptionSheet, {
    types:       ["special-trait", "weakness", "special-attack"],
    makeDefault: true,
    label:       "YZE.SheetSimpleDescription",
  });

  Items.registerSheet("yzegenerique", CriticalInjurySheet, {
    types:       ["critical-injury"],
    makeDefault: true,
    label:       "YZE.SheetCriticalInjury",
  });

  // TalentSheet — défaut pour tous les presets
  Items.registerSheet("yzegenerique", TalentSheet, {
    types:       ["talent"],
    makeDefault: true,
    label:       "YZE.SheetTalent",
  });

  if (activePreset === "eldritch-automata") {
    Items.registerSheet("yzegenerique", EaArchetypeSheet, {
      types:       ["pilot-archetype", "automata-archetype"],
      makeDefault: true,
      label:       "YZE.EA.SheetArchetype",
    });
    Items.registerSheet("yzegenerique", EaTalentSheet, {
      types:       ["talent"],
      makeDefault: false,
      label:       "YZE.EA.SheetTalent",
    });
    Items.registerSheet("yzegenerique", EaStrandSheet, {
      types:       ["strand"],
      makeDefault: true,
      label:       "YZE.EA.SheetStrand",
    });
  }

  // ── 9. Presets ─────────────────────────────────────────────────────
  registerAllPresets();

  // ── 10. Helpers Handlebars ─────────────────────────────────────────
  registerHandlebarsHelpers();

  console.log(
    `YZE Générique | init done | damageSystem: ${damageSystem} | preset: ${activePreset}`
  );
});

Hooks.once("ready", async () => {
  console.log("YZE Générique | ready");

  // Ré-application du thème CSS du preset au rechargement
  import("./presets/preset-applier.mjs").then(({ PresetApplier }) => {
    import("./presets/preset-registry.mjs").then(({ resolvePreset }) => {
      const presetId = game.settings.get("yzegenerique", "activePresetId");
      PresetApplier._applyTheme(resolvePreset(presetId));
    });
  });

  // Handler global pour le bouton "Push" dans les messages de chat
  document.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-action='pushRoll']");
    if (btn) {
      if (btn.disabled) return;
      const messageId = btn.closest("[data-message-id]")?.dataset.messageId;
      if (!messageId) return;
      const message = game.messages.get(messageId);
      if (!message) return;
      const savedRoll = message.getFlag("yzegenerique", "rollData");
      if (!savedRoll) { ui.notifications.warn("YZE | Cannot push: roll data not found."); return; }
      if (savedRoll.pushed) { ui.notifications.warn("YZE | You can only push once."); return; }
      const actor = game.actors.get(savedRoll.actorId);
      if (!actor) { ui.notifications.warn("YZE | Actor not found."); return; }
      // Désactiver immédiatement
      btn.disabled = true;
      btn.textContent = "↻ Pushed";
      const skillItem     = savedRoll.skillItemId     ? actor.items.get(savedRoll.skillItemId)     : null;
      const attributeItem = savedRoll.attributeItemId ? actor.items.get(savedRoll.attributeItemId) : null;
      const { YZEDiceRoller } = await import("./dice/dice-roller.mjs");
      await YZEDiceRoller.rollSkill(actor, skillItem, attributeItem, {
        pushed: true, previousRoll: savedRoll,
      });
      return;
    }

    // Push de jet d'arme
    const weaponBtn = event.target.closest("[data-action='pushWeaponRoll']");
    if (weaponBtn) {
      if (weaponBtn.disabled) return;
      const messageId = weaponBtn.closest("[data-message-id]")?.dataset.messageId;
      if (!messageId) return;
      const message = game.messages.get(messageId);
      if (!message) return;
      const saved = message.getFlag("yzegenerique", "weaponRoll");
      if (!saved || saved.pushed) {
        ui.notifications.warn(saved?.pushed ? "YZE | Already pushed." : "YZE | Roll data not found.");
        return;
      }
      const actor  = game.actors.get(saved.actorId);
      const weapon = actor?.items.get(saved.weaponId);
      if (!actor || !weapon) { ui.notifications.warn("YZE | Actor or weapon not found."); return; }
      weaponBtn.disabled = true;
      weaponBtn.textContent = "↻ Pushed";
      const { GearRoller } = await import("./dice/gear-roller.mjs");
      await GearRoller.rollWeapon(actor, weapon, {
        pushed: true,
        previousRoll: { segments: saved.segments ?? [] },
      });
    }

    // ── Roll Target Armor ──────────────────────────────────────────
    const armorBtn = event.target.closest("[data-action='rollTargetArmor']");
    if (armorBtn) {
      if (armorBtn.disabled) return;
      armorBtn.disabled = true;
      const targetActorId = armorBtn.dataset.targetActorId;
      const armorId       = armorBtn.dataset.armorId;
      const incomingDmg   = Number(armorBtn.dataset.damage);
      const targetActor   = game.actors.get(targetActorId);
      const armorItem     = targetActor?.items.get(armorId);
      if (!targetActor || !armorItem) {
        ui.notifications.warn("YZE | Target or armor not found.");
        return;
      }
      const { GearRoller } = await import("./dice/gear-roller.mjs");
      await GearRoller.rollArmor(targetActor, armorItem, { incomingDamage: incomingDmg, targetActor });
      armorBtn.textContent = "🛡 Rolled";
      // Griser Apply Damage sur la même rollcard
      const parentCard = armorBtn.closest(".yze-roll-result");
      const applyBtn   = parentCard?.querySelector("[data-action='applyDamage']");
      if (applyBtn && !applyBtn.disabled) {
        applyBtn.disabled = true;
        applyBtn.textContent = "💥 See armor roll";
      }
      return;
    }

    // ── Apply Damage ───────────────────────────────────────────────
    const dmgBtn = event.target.closest("[data-action='applyDamage']");
    if (dmgBtn) {
      if (dmgBtn.disabled) return;
      dmgBtn.disabled = true;
      const targetActorId = dmgBtn.dataset.targetActorId;
      const damage        = Number(dmgBtn.dataset.damage);
      const targetActor   = game.actors.get(targetActorId);
      if (!targetActor) { ui.notifications.warn("YZE | Target not found."); return; }

      const currentHp = targetActor.system.health?.value ?? 0;
      const newHp     = Math.max(0, currentHp - damage);

      // Mettre à jour via le token actif si disponible (pour les acteurs non-liés)
      const activeToken = targetActor.getActiveTokens()[0];
      if (activeToken && !targetActor.prototypeToken.actorLink) {
        await activeToken.actor.update({ "system.health.value": newHp });
      } else {
        await targetActor.update({ "system.health.value": newHp });
      }

      await ChatMessage.create({
        speaker: {},
        content: `<div class="yze-roll-result yze-preset-${game.settings.get("yzegenerique", "activePresetId") ?? "srd-default"}">
          <div class="yze-roll-header">
            <span class="yze-roll-label">💥 Damage Applied</span>
          </div>
          <div class="yze-roll-outcome failure">
            <span class="yze-roll-success-icon">−${damage}</span>
            <span class="yze-roll-success-label">HP to <strong>${targetActor.name}</strong></span>
            <span class="yze-push-hint">${currentHp} → ${newHp}</span>
          </div>
          ${newHp <= 0 ? `
          <div class="yze-roll-critical-row">
            <button class="yze-critical-btn" type="button"
              data-action="rollCriticalInjury"
              data-actor-id="${targetActor.id}">
              🩸 Roll Critical Injury
            </button>
            <span class="yze-push-hint">${targetActor.name} is down!</span>
          </div>` : ""}
        </div>`,
      });
      dmgBtn.textContent = `💥 Applied (${newHp} HP left)`;
      return;
    }

    const critBtn = event.target.closest("[data-action='rollCriticalInjury']");
    if (critBtn) {
      if (critBtn.disabled) return;
      critBtn.disabled = true;
      critBtn.textContent = "🩸 Rolling…";
      const actorId = critBtn.dataset.actorId;
      const actor   = game.actors.get(actorId);
      await CriticalHandler.roll(actor ?? null);
      critBtn.textContent = "🩸 Rolled";
      return;
    }

    // Bouton Roll Panic depuis le message de roll
    const panicBtn = event.target.closest("[data-action='rollPanic']");
    if (panicBtn) {
      if (panicBtn.disabled) return;
      const actorId = panicBtn.dataset.actorId;
      const actor   = game.actors.get(actorId);
      if (!actor) { ui.notifications.warn("YZE | Actor not found for panic roll."); return; }
      // Désactiver immédiatement
      panicBtn.disabled = true;
      panicBtn.textContent = "✓ Rolled";
      const { PanicHandler } = await import("./panic/panic-handler.mjs");
      await PanicHandler.trigger(actor, {});
    }
  });

  // API publique minimale
  game.yze = {
    version:       "0.1.0",
    rollCritical:  (actor) => CriticalHandler.roll(actor),
  };

  // Ajouter la classe preset sur le body pour le CSS global
  const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
  document.body.classList.add(`yze-preset-${presetId}`);

  // Appliquer la font titre
  YZEApplyTitleFont();
  // Appliquer les couleurs du thème
  YZEApplyThemeColors();

  // ── Hook Panic ─────────────────────────────────────────────────────
  // Déclenché par push-stress-dice.mjs quand stressBanes > 0
  Hooks.on("yze.triggerPanic", async (actor, rollData) => {
    const { PanicHandler } = await import("./panic/panic-handler.mjs");
    await PanicHandler.trigger(actor, rollData);
  });
});

// ── Mort automatique à 0 HP ──────────────────────────────────────────
Hooks.on("updateActor", async (actor, changes) => {
  if (!game.user.isGM) return;
  const newHp = foundry.utils.getProperty(changes, "system.health.value");
  if (newHp === undefined) return;

  for (const token of actor.getActiveTokens()) {
    try {
      // V14 : toggleStatusEffect sur le TokenDocument
      const isDead = token.document.hasStatusEffect("dead");
      if (newHp <= 0 && !isDead) {
        await token.document.toggleActiveEffect({ statusId: "dead" }, { overlay: true });
      } else if (newHp > 0 && isDead) {
        await token.document.toggleActiveEffect({ statusId: "dead" }, { overlay: true });
      }
    } catch(e) {
      // Fallback V14 alternatif
      try {
        await token.actor.toggleStatusEffect("dead", { overlay: true, active: newHp <= 0 });
      } catch(e2) {
        console.warn("YZE | Could not toggle dead status:", e2);
      }
    }
  }
});

// ── Mort instantanée sur CI avec instantDeath ────────────────────────
Hooks.on("createItem", async (item, options, userId) => {
  if (item.type !== "critical-injury") return;
  if (!item.system?.instantDeath) return;
  if (userId !== game.user.id) return;

  const actor = item.parent;
  if (!actor) return;

  // Mettre HP à 0
  await actor.update({ "system.health.value": 0 });

  // Appliquer le statut Dead via ActiveEffect
  const deadId = CONFIG.specialStatusEffects?.DEFEATED ?? "dead";
  const existing = actor.effects.find(e =>
    e.statuses?.has(deadId) || e.getFlag("core", "statusId") === deadId
  );
  if (!existing) {
    try {
      await actor.toggleStatusEffect(deadId, { active: true });
    } catch {
      await ActiveEffect.create({
        name:     "Dead",
        icon:     "icons/svg/skull.svg",
        statuses: [deadId],
      }, { parent: actor });
    }
  }

  // Message en chat
  const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
  await ChatMessage.create({
    speaker: {},
    content: `<div class="yze-roll-result yze-preset-${presetId}">
      <div class="yze-roll-header">
        <span class="yze-roll-label">💀 ${actor.name} — Instant Death</span>
      </div>
      <div class="yze-roll-outcome failure">
        <span class="yze-roll-fail-icon">💀</span>
        <span class="yze-roll-fail-label">${item.name}</span>
      </div>
    </div>`,
  });
});
// ── Cache DSN — file FIFO des segments par ordre de création ─────────
// DSN appelle diceSoNiceRollStart dans l'ordre de création des messages
globalThis.YZE_DSN_QUEUE = []; // [{ formula, segments }]

Hooks.on("diceSoNiceRollStart", (messageId, context) => {
  const roll = context?.roll;
  if (!roll?.dice?.length) return;
  if (!globalThis.YZE_DSN_QUEUE?.length) return;

  // Trouver l'entrée dont la formule correspond
  const formula = roll.formula ?? roll._formula ?? "";
  const idx = globalThis.YZE_DSN_QUEUE.findIndex(e => e.formula === formula);
  if (idx === -1) return;

  const { segments } = globalThis.YZE_DSN_QUEUE.splice(idx, 1)[0];
  if (!segments?.length) return;

  let dieIdx = 0;
  for (const seg of segments) {
    if ((seg.count ?? 0) <= 0) { dieIdx++; continue; }
    const die = roll.dice[dieIdx];
    if (die) {
      if (!die.options) die.options = {};
      if (seg.origin === "stress")         die.options.colorset = "yze-stress";
      else if (seg.origin === "gear")      die.options.colorset = "yze-gear";
      else                                 die.options.colorset = "yze-normal";
    }
    dieIdx++;
  }
});

Hooks.on("preCreateActor", (actor, data) => {
  if (data.type === "character") {
    actor.updateSource({
      "prototypeToken.actorLink":   true,
      "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    });
  }
});

// ── Dice So Nice — colorsets YZE depuis settings ─────────────────────
Hooks.once("diceSoNiceReady", (dice3d) => {
  const g = (key, def) => { try { return game.settings.get("yzegenerique", key) || def; } catch { return def; } };

  const normalFg  = g("dsnColorNormalFg",  "#c9a84c");
  const normalBg  = g("dsnColorNormalBg",  "#1a1208");
  const stressFg  = g("dsnColorStressFg", "#1a1208");
  const stressBg  = g("dsnColorStressBg", "#c9a84c");
  const gearFg    = g("dsnColorGearFg",   "#f0ead6");
  const gearBg    = g("dsnColorGearBg",   "#5c3d2e");
  const lBane     = g("dsnLabelBane",      "☠");
  const lSuccess  = g("dsnLabelSuccess",   "✦");
  const lStress   = g("dsnLabelStressBane","⚡");

  const showMiddle = g("dsnShowMiddleFaces", false);
  const mid = (n) => showMiddle ? String(n) : " ";

  const makeLabel = (bane, success) =>
    [bane||"1", mid(2), mid(3), mid(4), mid(5), success||"6"];

  const colorsets = [
    { name:"yze-normal", description:"YZE — Normal", category:"Year Zero Engine",
      foreground: normalFg, background: normalBg,
      outline: normalFg, edge: normalBg, texture:"none", material:"plastic", font:"Arial Black" },
    { name:"yze-stress", description:"YZE — Stress", category:"Year Zero Engine",
      foreground: stressFg, background: stressBg,
      outline: stressBg, edge: stressBg, texture:"none", material:"plastic", font:"Arial Black" },
    { name:"yze-gear",   description:"YZE — Gear Bonus", category:"Year Zero Engine",
      foreground: gearFg, background: gearBg,
      outline: gearBg, edge: gearBg, texture:"none", material:"plastic", font:"Arial Black" },
  ];

  for (const cs of colorsets) {
    try { dice3d.addColorset(cs, "none"); }
    catch(e) { console.warn(`YZE | DSN colorset ${cs.name}:`, e); }
  }

  // Tenter d'enregistrer les presets de dés avec labels
  // Requiert addSystem — silently skip si non disponible
  try {
    if (typeof dice3d.addSystem === "function") {
      dice3d.addSystem({ id: "yze",        name: "YZE — Normal" },      "none"); // au choix du joueur
      dice3d.addSystem({ id: "yze-stress", name: "YZE — Stress" },      "none");
      dice3d.addSystem({ id: "yze-gear",   name: "YZE — Gear Bonus" },  "none");

      dice3d.addDicePreset({ type:"d6", system:"yze",
        labels: makeLabel(lBane, lSuccess), colorset:"yze-normal" });
      dice3d.addDicePreset({ type:"d6", system:"yze-stress",
        labels: makeLabel(lStress, lSuccess), colorset:"yze-stress" });
      dice3d.addDicePreset({ type:"d6", system:"yze-gear",
        labels: makeLabel(lBane, lSuccess), colorset:"yze-gear" });

      console.log("YZE | DSN systems + presets registered");
    }
  } catch(e) {
    console.info("YZE | DSN addSystem not available — labels skipped");
  }

  console.log("YZE | DSN colorsets registered");
});

// ── Application de la font titre ─────────────────────────────────────
function YZEApplyTitleFont() {
  const font = game.settings.get("yzegenerique", "titleFont") ?? "default";
  const fontName = font === "default" ? "Cinzel Decorative" : font;

  // Retirer les anciens imports YZE font
  document.querySelectorAll("link[data-yze-font]").forEach(el => el.remove());
  document.querySelectorAll("style[data-yze-font]").forEach(el => el.remove());

  // Charger la font depuis Google Fonts
  const slug = fontName.replace(/ /g, "+");
  const link = document.createElement("link");
  link.rel          = "stylesheet";
  link.href         = `https://fonts.googleapis.com/css2?family=${slug}:wght@400;700&display=swap`;
  link.dataset.yzeFont = "1";
  document.head.appendChild(link);

  // Appliquer via CSS variable
  const style = document.createElement("style");
  style.dataset.yzeFont = "1";
  style.textContent = `
    :root { --yze-font-title: "${fontName}", "Cinzel Decorative", serif !important; }
    .yze-sheet .header-name,
    .yze-sheet .section-title,
    .yze-sheet .tab-btn,
    .yze-sheet .attr-name,
    .yze-roll-header .yze-roll-label,
    .yze-roll-header .yze-roll-actor {
      font-family: "${fontName}", "Cinzel Decorative", serif !important;
    }
  `;
  document.head.appendChild(style);
  console.log(`YZE | Title font applied: ${fontName}`);
}

// Ré-appliquer quand le setting change
// ── Application des couleurs du thème ────────────────────────────────
function YZEApplyThemeColors() {
  const g = (key, def) => { try { return game.settings.get("yzegenerique", key) || def; } catch { return def; } };
  const accent = g("themeColorAccent", "#c9a84c");
  const bg     = g("themeColorBg",     "#1a1208");

  document.querySelectorAll("style[data-yze-theme]").forEach(el => el.remove());

  const style = document.createElement("style");
  style.dataset.yzeTheme = "1";
  style.textContent = `
    :root {
      --yze-color-accent:  ${accent} !important;
      --yze-color-bg:      ${bg} !important;
      --yze-color-surface: color-mix(in srgb, ${bg} 85%, white 15%) !important;
    }
  `;
  document.head.appendChild(style);
}

Hooks.on("updateSetting", (setting) => {
  if (setting.key === "yzegenerique.titleFont") YZEApplyTitleFont();
  if (setting.key === "yzegenerique.themeColorAccent" ||
      setting.key === "yzegenerique.themeColorBg") YZEApplyThemeColors();
  if (setting.key?.startsWith("yzegenerique.dsnColor") && game.dice3d) {
    const g = (key, def) => { try { return game.settings.get("yzegenerique", key) || def; } catch { return def; } };
    const colorsets = [
      { name:"yze-normal", foreground: g("dsnColorNormalFg","#c9a84c"), background: g("dsnColorNormalBg","#1a1208"),
        outline: g("dsnColorNormalFg","#c9a84c"), edge: g("dsnColorNormalBg","#1a1208"),
        description:"YZE — Normal", category:"Year Zero Engine", texture:"none", material:"plastic", font:"Arial Black" },
      { name:"yze-stress", foreground: g("dsnColorStressFg","#1a1208"), background: g("dsnColorStressBg","#c9a84c"),
        outline: g("dsnColorStressBg","#c9a84c"), edge: g("dsnColorStressBg","#c9a84c"),
        description:"YZE — Stress", category:"Year Zero Engine", texture:"none", material:"plastic", font:"Arial Black" },
      { name:"yze-gear",   foreground: g("dsnColorGearFg","#f0ead6"),   background: g("dsnColorGearBg","#5c3d2e"),
        outline: g("dsnColorGearBg","#5c3d2e"), edge: g("dsnColorGearBg","#5c3d2e"),
        description:"YZE — Gear", category:"Year Zero Engine", texture:"none", material:"plastic", font:"Arial Black" },
    ];
    for (const cs of colorsets) {
      try { game.dice3d.addColorset(cs, "none"); } catch {}
    }
    console.log("YZE | DSN colorsets updated from settings");
  }
});
