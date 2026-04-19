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
      const messageId = btn.closest("[data-message-id]")?.dataset.messageId;
      if (!messageId) return;
      const message = game.messages.get(messageId);
      if (!message) return;
      const savedRoll = message.getFlag("yzegenerique", "rollData");
      if (!savedRoll) { ui.notifications.warn("YZE | Cannot push: roll data not found."); return; }
      if (savedRoll.pushed) { ui.notifications.warn("YZE | You can only push once."); return; }
      const actor = game.actors.get(savedRoll.actorId);
      if (!actor) { ui.notifications.warn("YZE | Actor not found."); return; }
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
      const { GearRoller } = await import("./dice/gear-roller.mjs");
      await GearRoller.rollWeapon(actor, weapon, {
        pushed: true,
        previousRoll: { segments: saved.segments ?? [] },
      });
    }

    // Bouton Roll Panic depuis le message de roll
    const panicBtn = event.target.closest("[data-action='rollPanic']");
    if (panicBtn) {
      const actorId = panicBtn.dataset.actorId;
      const actor   = game.actors.get(actorId);
      if (!actor) { ui.notifications.warn("YZE | Actor not found for panic roll."); return; }
      const { PanicHandler } = await import("./panic/panic-handler.mjs");
      await PanicHandler.trigger(actor, {});
    }
  });

  // API publique minimale
  game.yze = { version: "0.1.0" };

  // ── Hook Panic ─────────────────────────────────────────────────────
  // Déclenché par push-stress-dice.mjs quand stressBanes > 0
  Hooks.on("yze.triggerPanic", async (actor, rollData) => {
    const { PanicHandler } = await import("./panic/panic-handler.mjs");
    await PanicHandler.trigger(actor, rollData);
  });
});
