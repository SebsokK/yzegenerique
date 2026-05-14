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

  // ── Initiative — formule minimale pour éviter l'erreur StringTerm ──
  CONFIG.Combat.initiative = { formula: "1d6", decimals: 0 };

  // Surcharger Combat.rollInitiative pour utiliser notre système YZE
  Combat.prototype.rollInitiative = async function(ids, options = {}) {
    const { rollInitiativeForCombatant } = await import("./combat/combat-tracker.mjs");
    const combatantIds = typeof ids === "string" ? [ids] : (ids ?? []);
    const updates = (await Promise.all(
      combatantIds.map(async id => {
        const c = this.combatants.get(id);
        if (!c) return null;
        return { _id: id, initiative: await rollInitiativeForCombatant(c) };
      })
    )).filter(Boolean);
    if (updates.length) await this.updateEmbeddedDocuments("Combatant", updates);
    return this;
  };

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

  const isEA = activePreset === "eldritch-automata";

  // Feuille générique — toujours disponible
  Actors.registerSheet("yzegenerique", CharacterSheet, {
    types:       ["character"],
    makeDefault: !isEA,
    label:       "YZE.SheetCharacter",
  });

  // Feuille EA — toujours enregistrée, default si EA actif
  Actors.registerSheet("yzegenerique", EaCharacterSheet, {
    types:       ["character"],
    makeDefault: isEA,
    label:       "YZE.EA.SheetCharacter",
  });

  Actors.registerSheet("yzegenerique", NpcSheet, {
    types:       ["npc"],
    makeDefault: true,
    label:       "YZE.SheetNpc",
  });

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

  // ── Migration : ajouter les formules manquantes sur les resources EA existantes
  const activePreset = (() => { try { return game.settings.get("yzegenerique", "activePresetId"); } catch { return ""; } })();
  if (activePreset === "eldritch-automata" && game.user.isGM) {
    const formulaMap = {
      "health":    "strength + agility",
      "stability": "wits",
      "ego":       "empathy",
      "durability":"strength + agility + 5",
      "ego-field": "ego_max",
    };
    for (const actor of game.actors.filter(a => a.type === "character")) {
      const resources = actor.items.filter(i => i.type === "resource" && !i.system.formula);
      if (!resources.length) continue;
      const updates = resources
        .filter(r => formulaMap[r.system.slug])
        .map(r => ({ _id: r.id, "system.formula": formulaMap[r.system.slug] }));
      if (updates.length) {
        await actor.updateEmbeddedDocuments("Item", updates);
        console.log(`YZE | Patched ${updates.length} resource formulas on ${actor.name}`);
      }
    }
  }

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
      const targetTokenId = dmgBtn.dataset.targetTokenId;
      const damage        = Number(dmgBtn.dataset.damage);
      // Résoudre l'acteur : token non-lié en priorité, sinon acteur prototype
      let targetActor = null;
      if (targetTokenId) {
        const tokenDoc = canvas.scene?.tokens?.get(targetTokenId);
        targetActor = tokenDoc?.actor ?? null;
      }
      if (!targetActor) targetActor = game.actors.get(targetActorId);
      if (!targetActor) { ui.notifications.warn("YZE | Target not found."); return; }

      const presetId    = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
      const isEA        = presetId === "eldritch-automata";
      const inAutomata  = isEA && (targetActor.system.ea?.inAutomata ?? true);

      if (inAutomata) {
        // ── EA Automata mode : Ego Field → Durability ──────────────
        // Ego Field : item resource (PJ) ou champ direct system.egoField (NPC EA)
        const egoFieldRes = targetActor.items.find(i =>
          i.type === "resource" && i.system.slug === "ego-field"
        );
        const durRes = targetActor.items.find(i =>
          i.type === "resource" && i.system.slug === "durability"
        );

        const egoVal = egoFieldRes?.system.value ?? targetActor.system.egoField?.value ?? 0;
        const egoMax = egoFieldRes?.system.max   ?? targetActor.system.egoField?.max   ?? 0;
        const durVal = durRes?.system.value       ?? targetActor.system.health?.value   ?? 0;

        let remainingDmg  = damage;
        let durDmg        = 0;
        let egoFieldPierced = false;

        // L'Ego Field est un SEUIL, pas une ressource qui se vide.
        // Il soustrait sa valeur des dommages entrants.
        // Si les dommages dépassent l'Ego Field → percé, reste appliqué à Durability.
        // L'Ego Field ne perd PAS de valeur ici — seule la Dégradation peut réduire son max.
        if (egoVal > 0) {
          remainingDmg = damage - egoVal;
          if (remainingDmg > 0) {
            egoFieldPierced = true;
            durDmg = remainingDmg;
          } else {
            // Dommages absorbés entièrement par l'Ego Field
            remainingDmg = 0;
          }
        } else {
          // Ego Field à 0 (max dégradé) → tout va en Durability
          egoFieldPierced = false;
          durDmg = damage;
        }

        const newDur = Math.max(0, durVal - durDmg);

        // Mettre à jour SEULEMENT la Durability — l'Ego Field ne change pas de valeur
        if (durRes && durDmg > 0) {
          await targetActor.updateEmbeddedDocuments("Item", [{ _id: durRes.id, "system.value": newDur }]);
        } else if (durDmg > 0) {
          // NPC EA : pas d'items resource, mettre à jour system.health.value directement
          await targetActor.update({ "system.health.value": newDur });
        }
        // Forcer le re-render de toutes les fiches ouvertes de cet acteur
        for (const sheet of Object.values(targetActor.apps ?? {})) {
          if (sheet?.rendered) sheet.render({ force: true });
        }

        // Rollcard EA
        const piercedBlock = egoFieldPierced ? `
          <div class="yze-roll-critical-row">
            <button class="yze-critical-btn" type="button"
              data-action="rollEgoFieldDegradation"
              data-actor-id="${targetActor.id}"
              data-token-id="${targetTokenId ?? ""}"
              data-ego-current="${egoVal}">
              ⚡ Ego Field Degradation (${egoVal}d)
            </button>
          </div>` : "";

        // Pour les NPCs EA, pas de bouton Critical Injury — ils sont juste Broken
        const isNpc = targetActor.type === "npc";
        const brokenBlock = newDur <= 0 ? `
          <div class="yze-roll-critical-row">
            ${isNpc ? "" : `<button class="yze-critical-btn" type="button"
              data-action="rollCriticalInjury"
              data-actor-id="${targetActor.id}"
              data-injury-type="automata">
              🤖 Roll Automata Critical Injury
            </button>`}
            <span class="yze-push-hint">${targetActor.name}'s Automata is Broken!</span>
          </div>` : "";

        await ChatMessage.create({
          speaker: {},
          content: `<div class="yze-roll-result yze-preset-${presetId}">
            <div class="yze-roll-header">
              <span class="yze-roll-label">💥 Damage Applied — ${targetActor.name}</span>
            </div>
            <div class="yze-roll-outcome ${egoFieldPierced ? "failure" : ""}">
              <span class="yze-roll-success-icon">🛡 Ego Field ${egoVal}</span>
              <span class="yze-roll-success-label">${egoFieldPierced
                ? `<strong style='color:#c83f6a'>PIERCED</strong> — ${damage - egoVal} dmg past shield`
                : `absorbed all ${damage} dmg`}</span>
            </div>
            ${durDmg > 0 ? `<div class="yze-roll-outcome failure">
              <span class="yze-roll-success-icon">⚙ ${targetActor.type === "npc" ? "Health" : "Durability"}</span>
              <span class="yze-roll-success-label">${durVal} → ${newDur}</span>
            </div>` : ""}
            ${piercedBlock}
            ${brokenBlock}
          </div>`,
        });
        dmgBtn.textContent = `💥 Applied (${targetActor.type === "npc" ? "HP" : "Dur"}: ${newDur})`;

      } else {
        // ── Mode standard (Pilote hors robot, SH, H!) ─────────────
        // EA Pilot Only : la Health est un item resource, pas system.health
        const healthRes = isEA
          ? targetActor.items.find(i => i.type === "resource" && i.system?.slug === "health")
          : null;

        const currentHp = healthRes?.system.value ?? targetActor.system.health?.value ?? 0;
        const newHp     = Math.max(0, currentHp - damage);

        if (healthRes) {
          // EA : mettre à jour l'item resource Health
          await targetActor.updateEmbeddedDocuments("Item", [{ _id: healthRes.id, "system.value": newHp }]);
          // Forcer re-render
          for (const sheet of Object.values(targetActor.apps ?? {})) {
            if (sheet?.rendered) sheet.render({ force: true });
          }
        } else {
          const activeToken = targetActor.getActiveTokens()[0];
          if (activeToken && !targetActor.prototypeToken?.actorLink) {
            await activeToken.actor.update({ "system.health.value": newHp });
          } else {
            await targetActor.update({ "system.health.value": newHp });
          }
        }

        const injuryType = isEA ? "pilot" : "standard";
        await ChatMessage.create({
          speaker: {},
          content: `<div class="yze-roll-result yze-preset-${presetId}">
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
                data-actor-id="${targetActor.id}"
                data-injury-type="${injuryType}">
                🩸 Roll Critical Injury${isEA ? " (Pilot)" : ""}
              </button>
              <span class="yze-push-hint">${targetActor.name} is down!</span>
            </div>` : ""}
          </div>`,
        });
        dmgBtn.textContent = `💥 Applied (${newHp} HP left)`;
      }
      return;
    }

    const critBtn = event.target.closest("[data-action='rollCriticalInjury']");
    if (critBtn) {
      if (critBtn.disabled) return;
      critBtn.disabled = true;
      critBtn.textContent = "🩸 Rolling…";
      const actorId    = critBtn.dataset.actorId;
      const injuryType = critBtn.dataset.injuryType ?? "standard";
      const actor      = game.actors.get(actorId);
      await CriticalHandler.roll(actor ?? null, { injuryType });
      critBtn.textContent = injuryType === "automata" ? "🤖 Rolled" : "🩸 Rolled";
      return;
    }

    // ── Ego Field Degradation ──────────────────────────────────────
    const egoBtn = event.target.closest("[data-action='rollEgoFieldDegradation']");
    if (egoBtn) {
      if (egoBtn.disabled) return;
      egoBtn.disabled = true;
      egoBtn.textContent = "⚡ Rolling…";
      const actorId  = egoBtn.dataset.actorId;
      const tokenId  = egoBtn.dataset.tokenId;
      const egoCurrent = Number(egoBtn.dataset.egoCurrent) || 1;

      // Résoudre l'acteur via le token si disponible (NPC non-lié)
      let actor = null;
      if (tokenId) {
        const tokenDoc = canvas.scene?.tokens?.get(tokenId);
        actor = tokenDoc?.actor ?? null;
      }
      if (!actor) actor = game.actors.get(actorId);
      if (!actor) { ui.notifications.warn("YZE | Actor not found."); return; }

      // Roll egoCurrent d6 (valeur actuelle = nombre de dés)
      const roll   = await new Roll(`${egoCurrent}d6`).evaluate();
      const ones   = roll.dice[0].results.filter(r => r.result === 1).length;
      const presetId = "eldritch-automata";

      const egoRes = actor.items.find(i =>
        i.type === "resource" && i.system.slug === "ego-field"
      );
      // La dégradation réduit la VALUE (le rating courant), pas le max théorique
      const currentEgoVal = egoRes?.system.value
        ?? actor.system.egoField?.value
        ?? egoCurrent;
      const newEgoVal = Math.max(0, currentEgoVal - ones);

      if (ones > 0) {
        if (egoRes) {
          // PJ EA : item resource ego-field — réduire seulement value
          await egoRes.update({ "system.value": newEgoVal });
        } else if (actor.system.egoField !== undefined) {
          // NPC EA : champ direct system.egoField — réduire seulement value
          await actor.update({ "system.egoField.value": newEgoVal });
        }
      }

      const faces = roll.dice[0].results.map(r =>
        `<span style="color:${r.result === 1 ? "#c83f3f" : "inherit"}">${r.result}</span>`
      ).join(" ");

      const msgData = {
        speaker: ChatMessage.getSpeaker({ actor }),
        rolls:   [roll],
        content: `<div class="yze-roll-result yze-preset-${presetId}">
          <div class="yze-roll-header">
            <span class="yze-roll-actor">${actor.name}</span>
            <span class="yze-roll-label">⚡ Ego Field Degradation</span>
          </div>
          <div class="yze-roll-outcome ${ones > 0 ? "failure" : ""}">
            <span class="yze-roll-success-icon">[${faces}]</span>
            <span class="yze-roll-success-label">
              ${ones > 0
                ? `${ones} bane${ones > 1 ? "s" : ""} — Ego Field: ${currentEgoVal} → ${newEgoVal}`
                : "No degradation — Ego Field holds"}
            </span>
          </div>
          ${newEgoVal <= 0 ? `<div class="yze-roll-outcome failure" style="font-size:0.85em">
            ⚠ Ego Field fully degraded — normal weapons now affect the Automata!
          </div>` : ""}
        </div>`,
      };
      if (CONST.CHAT_MESSAGE_STYLES?.ROLL !== undefined)
        msgData.style = CONST.CHAT_MESSAGE_STYLES.ROLL;
      await ChatMessage.create(msgData);
      egoBtn.textContent = `⚡ Rolled (${ones} bane${ones !== 1 ? "s" : ""}${ones > 0 ? `, EF: ${newEgoVal}` : ""})`;
      return;
    }

    // Bouton Roll Panic depuis le message de roll
    const panicBtn = event.target.closest("[data-action='rollPanic']");
    if (panicBtn) {

    // ── End Berserk ────────────────────────────────────────────────
    const endBerserkBtn = event.target.closest("[data-action='endBerserk']");
    if (endBerserkBtn) {
      const actorId = endBerserkBtn.dataset.actorId;
      const actor   = game.actors.get(actorId);
      if (actor) {
        await actor.update({ "system.ea.inBerserk": false });
        endBerserkBtn.textContent = "✓ Berserk Ended";
        endBerserkBtn.disabled = true;
      }
      return;
    }

    // ── Roll Permanent Trauma ──────────────────────────────────────
    const traumaBtn = event.target.closest("[data-action='rollPermanentTrauma']");
    if (traumaBtn) {
      if (traumaBtn.disabled) return;
      traumaBtn.disabled = true;
      traumaBtn.textContent = "🧠 Rolling…";
      const actorId = traumaBtn.dataset.actorId;
      const actor   = game.actors.get(actorId);
      const { TraumaHandler } = await import("./panic/trauma-handler.mjs");
      await TraumaHandler.rollTrauma(actor ?? null);
      traumaBtn.textContent = "🧠 Rolled";
      return;
    }
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

  // Nettoyer les anciennes classes preset et ajouter la nouvelle
  const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
  document.body.classList.forEach(cls => {
    if (cls.startsWith("yze-preset-")) document.body.classList.remove(cls);
  });
  document.body.classList.add(`yze-preset-${presetId}`);

  // Précharger Handjet pour EA (évite le flash de police au premier rendu)
  if (presetId === "eldritch-automata") {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Handjet:wght@100..900&display=swap";
    link.dataset.yzeEaFont = "1";
    if (!document.querySelector("link[data-yze-ea-font]"))
      document.head.appendChild(link);

    // Forcer la sheet EA sur tous les acteurs character existants
    if (game.user.isGM) {
      for (const actor of game.actors.filter(a => a.type === "character")) {
        const current = actor.getFlag("core", "sheetClass");
        if (current !== "yzegenerique.EaCharacterSheet") {
          await actor.setFlag("core", "sheetClass", "yzegenerique.EaCharacterSheet");
        }
      }
    }
  } else if (game.user.isGM) {
    // Hors EA — remettre la sheet générique si elle était forcée EA
    for (const actor of game.actors.filter(a => a.type === "character")) {
      const current = actor.getFlag("core", "sheetClass");
      if (current === "yzegenerique.EaCharacterSheet") {
        await actor.setFlag("core", "sheetClass", "yzegenerique.CharacterSheet");
      }
    }
  }

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
// ── Sync Strand level → maxValue ────────────────────────────────────
Hooks.on("updateItem", async (item, changes) => {
  if (item.type !== "strand") return;
  const newLevel = foundry.utils.getProperty(changes, "system.level");
  if (newLevel === undefined) return;
  // maxValue = level, reset value to level if it exceeds
  const currentValue = item.system.value ?? 1;
  await item.update({
    "system.maxValue": newLevel,
    "system.value":    Math.min(currentValue, newLevel),
  });
});

// ── Berserk EA : déclenché quand Ego resource tombe à 0 ──────────────
Hooks.on("updateItem", async (item, changes) => {
  if (!game.user.isGM) return;
  if (item.type !== "resource") return;
  if (item.system?.slug !== "ego") return;

  const actor = item.parent;
  if (!actor || actor.type !== "character") return;

  const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "";
  if (presetId !== "eldritch-automata") return;

  const newVal = foundry.utils.getProperty(changes, "system.value");
  if (newVal === undefined || newVal > 0) return;

  // Ego vient de tomber à 0
  const alreadyBerserk = actor.system.ea?.inBerserk ?? false;
  if (alreadyBerserk) return;

  await actor.update({ "system.ea.inBerserk": true });

  const presetIdForCard = "eldritch-automata";
  const automataArchetype = actor.items.find(i => i.type === "automata-archetype");
  const berserkSummary = berserkText
    ? berserkText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) + "…"
    : `Act according to your Automata's Berserk text. Durability is restored to max.`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="yze-roll-result yze-preset-${presetIdForCard}">
      <div class="yze-roll-header">
        <span class="yze-roll-actor">${actor.name}</span>
        <span class="yze-roll-label">⚡ BERSERKING</span>
      </div>
      <div class="yze-roll-outcome failure" style="padding:6px 12px;font-size:0.9em">
        <strong>Ego = 0 — Automata Berserking!</strong>
        <span style="display:block;font-size:0.8em;margin-top:4px;opacity:0.8">${berserkSummary}</span>
      </div>
      <div class="yze-roll-critical-row">
        <button class="yze-critical-btn" type="button"
          data-action="endBerserk" data-actor-id="${actor.id}">
          ✓ End Berserk
        </button>
      </div>
    </div>`,
  });
});

// ── Mort automatique à 0 HP — via item resource (EA PJs Health/Durability) ──
Hooks.on("updateItem", async (item, changes) => {
  if (!game.user.isGM) return;
  if (item.type !== "resource") return;
  const slug = item.system?.slug ?? "";
  if (slug !== "health" && slug !== "durability") return;
  const actor = item.parent;
  if (!actor || actor.type !== "character") return;
  const newVal = foundry.utils.getProperty(changes, "system.value");
  if (newVal === undefined) return;

  const presetId = (() => { try { return game.settings.get("yzegenerique", "activePresetId"); } catch { return ""; } })();
  const isEA = presetId === "eldritch-automata";

  for (const token of actor.getActiveTokens()) {
    if (isEA && slug === "durability") {
      // EA Durability = 0 → "Out of Order" (pas Dead)
      try {
        const tokenDoc = token.document;
        const isOutOfOrder = tokenDoc.hasStatusEffect("unconscious");
        if (newVal <= 0 && !isOutOfOrder) {
          await tokenDoc.toggleActiveEffect({ statusId: "unconscious" }, { overlay: true });
        } else if (newVal > 0 && isOutOfOrder) {
          await tokenDoc.toggleActiveEffect({ statusId: "unconscious" }, { overlay: true });
        }
      } catch(e) {
        // Fallback V14
        try {
          await token.actor?.toggleStatusEffect("unconscious", { overlay: true, active: newVal <= 0 });
        } catch(e2) {
          console.warn("YZE | Out of Order status failed:", e2);
        }
      }
    } else {
      // Health = 0 → Dead
      await _applyDeadStatus(token.document, newVal);
    }
  }
});

// ── Mort automatique à 0 HP ─────────────────────────────────────────
Hooks.on("updateActor", async (actor, changes) => {
  if (!game.user.isGM) return;

  const newHp = foundry.utils.getProperty(changes, "system.health.value");
  if (newHp === undefined) return;

  // Acteur synthétique (token non-lié) → agir sur son token spécifique
  if (actor.isToken) {
    const tokenDoc = actor.token;
    if (!tokenDoc) return;
    await _applyDeadStatus(tokenDoc, newHp);
    return;
  }

  // Acteur prototype (lié ou non) → parcourir tous les tokens actifs
  // Pour les non-liés : chaque token a ses propres HP, on vérifie le HP du token
  for (const token of actor.getActiveTokens()) {
    const tokenHp = actor.prototypeToken?.actorLink
      ? newHp  // lié : tous partagent la même valeur
      : (token.actor?.system?.health?.value ?? newHp); // non-lié : HP individuel du token
    await _applyDeadStatus(token.document, tokenHp);
  }
});

async function _applyDeadStatus(tokenDoc, hp) {
  try {
    const isDead = tokenDoc.hasStatusEffect("dead");
    if (hp <= 0 && !isDead)
      await tokenDoc.toggleActiveEffect({ statusId: "dead" }, { overlay: true });
    else if (hp > 0 && isDead)
      await tokenDoc.toggleActiveEffect({ statusId: "dead" }, { overlay: true });
  } catch(e) {
    try {
      await tokenDoc.actor?.toggleStatusEffect("dead", { overlay: true, active: hp <= 0 });
    } catch(e2) {
      console.warn("YZE | Could not toggle dead status:", e2);
    }
  }
}

// ── Mort automatique à 0 HP — tokens NON-LIÉS (NPCs individuels) ────
Hooks.on("updateToken", async (tokenDoc, changes) => {
  if (!game.user.isGM) return;
  if (tokenDoc.actorLink) return;

  const newHp = foundry.utils.getProperty(changes, "actorData.system.health.value")
    ?? foundry.utils.getProperty(changes, "delta.system.health.value");
  if (newHp === undefined) return;

  try {
    const isDead = tokenDoc.hasStatusEffect("dead");
    if (newHp <= 0 && !isDead)
      await tokenDoc.toggleActiveEffect({ statusId: "dead" }, { overlay: true });
    else if (newHp > 0 && isDead)
      await tokenDoc.toggleActiveEffect({ statusId: "dead" }, { overlay: true });
  } catch(e) {
    console.warn("YZE | Could not toggle dead status on token:", e);
  }
});

// ── Permanent Trauma EA : Stress atteint 10 ─────────────────────────
Hooks.on("updateActor", async (actor, changes) => {
  if (!game.user.isGM) return;
  if (actor.type !== "character") return;
  const presetId = (() => { try { return game.settings.get("yzegenerique", "activePresetId"); } catch { return ""; } })();
  if (presetId !== "eldritch-automata") return;

  const newStress = foundry.utils.getProperty(changes, "system.stress");
  if (newStress !== undefined && newStress >= 10) {
    // Ne pas auto-roller — proposer le roll dans le chat
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="yze-roll-result yze-preset-eldritch-automata">
        <div class="yze-roll-header">
          <span class="yze-roll-actor">${actor.name}</span>
          <span class="yze-roll-label">🧠 Stress Level 10</span>
        </div>
        <div class="yze-roll-outcome failure" style="padding:8px 12px">
          ${actor.name} has reached Stress 10. At the next lull of action, roll for Permanent Trauma.
        </div>
        <div class="yze-roll-critical-row">
          <button class="yze-critical-btn" type="button"
            data-action="rollPermanentTrauma"
            data-actor-id="${actor.id}">
            🧠 Roll Permanent Trauma Check
          </button>
        </div>
      </div>`,
    });
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

  const activePreset = (() => { try { return game.settings.get("yzegenerique", "activePresetId"); } catch { return ""; } })();

  // Chercher dans la queue pour les rolls avec segments (joueurs)
  if (globalThis.YZE_DSN_QUEUE?.length) {
    const formula = roll.formula ?? roll._formula ?? "";
    const idx = globalThis.YZE_DSN_QUEUE.findIndex(e => e.formula === formula);
    if (idx !== -1) {
      const { segments } = globalThis.YZE_DSN_QUEUE.splice(idx, 1)[0];
      if (segments?.length) {
        let dieIdx = 0;
        for (const seg of segments) {
          const count = seg.count ?? 0;
          if (count <= 0) continue;
          // roll.dice[dieIdx] = un DiceTerm par segment (ex: 4d6, 3d6, 1d6...)
          const die = roll.dice[dieIdx];
          if (die) {
            if (!die.options) die.options = {};
            if (seg.origin === "stress") {
              die.options.colorset = "yze-stress";
            } else if (seg.origin === "gear") {
              die.options.colorset = "yze-gear";
            } else if (seg.origin === "strand") {
              die.options.colorset = "yze-strand";
            } else {
              die.options.colorset = "yze-normal";
            }
          }
          dieIdx++; // un DiceTerm par segment dans roll.dice
        }
        return;
      }
    }
  }

  // Fallback : si preset EA, appliquer yze-normal sur tous les dés non colorés
  if (activePreset === "eldritch-automata") {
    for (const die of roll.dice) {
      if (!die.options) die.options = {};
      if (!die.options.colorset) {
        die.options.colorset = "yze-normal";
      }
    }
  }
});

Hooks.on("preCreateActor", (actor, data) => {
  if (data.type === "character") {
    actor.updateSource({
      "prototypeToken.actorLink":   true,
      "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    });
  } else if (data.type === "npc") {
    actor.updateSource({
      "prototypeToken.actorLink":   false,
      "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.HOSTILE,
    });
  }
});

// ── Auto-création des ressources EA sur un nouvel acteur ─────────────
Hooks.on("createActor", async (actor, options, userId) => {
  if (userId !== game.user.id) return;
  if (actor.type !== "character") return;

  const activePreset = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
  if (activePreset !== "eldritch-automata") return;

  // Assigner la feuille EA si elle n'est pas déjà forcée
  const currentSheet = actor.getFlag("core", "sheetClass");
  if (currentSheet !== "yzegenerique.EaCharacterSheet") {
    await actor.setFlag("core", "sheetClass", "yzegenerique.EaCharacterSheet");
  }

  // Importer les attributs EA depuis le compendium si absents
  const hasAttributes = actor.items.some(i => i.type === "attribute");
  if (!hasAttributes) {
    await YZEImportEaItemsFromPack(actor, "ea-attributes");
  }

  // Importer les skills EA depuis le compendium si absents
  const hasSkills = actor.items.some(i => i.type === "skill");
  if (!hasSkills) {
    await YZEImportEaItemsFromPack(actor, "ea-skills");
  }

  // Ne pas recréer si les ressources existent déjà
  const hasResources = actor.items.some(i => i.type === "resource");
  if (hasResources) return;

  await YZECreateEaResources(actor);
});

/**
 * Importe tous les items d'un pack EA sur un acteur.
 * @param {Actor} actor
 * @param {string} packName  e.g. "ea-attributes", "ea-skills"
 */
async function YZEImportEaItemsFromPack(actor, packName) {
  try {
    const pack = game.packs.get(`yzegenerique.${packName}`);
    if (!pack) {
      console.warn(`YZE | Pack not found: yzegenerique.${packName}`);
      return;
    }
    const docs = await pack.getDocuments();
    if (!docs.length) return;

    const itemData = docs.map(doc => {
      const d = doc.toObject();
      // Réinitialiser l'ID pour éviter les conflits
      delete d._id;
      return d;
    });

    await actor.createEmbeddedDocuments("Item", itemData);
    console.log(`YZE | Imported ${itemData.length} items from ${packName} onto ${actor.name}`);
  } catch(err) {
    console.error(`YZE | Failed to import from ${packName}:`, err);
  }
}

/**
 * Crée les ressources EA de base sur un acteur.
 * Appelé à la création ou via le bouton "Initialize" sur la fiche EA.
 */
async function YZECreateEaResources(actor) {
  const str = actor.items.find(i => i.type === "attribute" && i.system?.slug === "strength")?.system?.value ?? 2;
  const agi = actor.items.find(i => i.type === "attribute" && i.system?.slug === "agility")?.system?.value ?? 2;
  const wit = actor.items.find(i => i.type === "attribute" && i.system?.slug === "wits")?.system?.value ?? 2;
  const emp = actor.items.find(i => i.type === "attribute" && i.system?.slug === "empathy")?.system?.value ?? 2;

  const resources = [
    // Pilot
    { name: "Health",     slug: "health",    category: "pilot",    formula: "strength + agility", value: str + agi,     max: str + agi,     min: 0 },
    { name: "Stability",  slug: "stability", category: "pilot",    formula: "wits",               value: wit,           max: wit,           min: 0 },
    { name: "Ego",        slug: "ego",       category: "pilot",    formula: "empathy",             value: emp,           max: emp,           min: 0 },
    // Automata
    { name: "Durability", slug: "durability",category: "automata", formula: "strength + agility + 5", value: str + agi + 5, max: str + agi + 5, min: 0 },
    { name: "Ego Field",  slug: "ego-field", category: "automata", formula: "ego_max",            value: emp,           max: emp,           min: 0 },
  ];

  const itemData = resources.map(r => ({
    name: r.name,
    type: "resource",
    img:  "icons/svg/d20-black.svg",
    system: {
      slug:     r.slug,
      category: r.category,
      formula:  r.formula,
      value:    r.value,
      max:      r.max,
      min:      r.min,
      description: "",
    },
  }));

  await actor.createEmbeddedDocuments("Item", itemData);
  ui.notifications.info(`YZE | EA resources initialized for ${actor.name}.`);
}

// Exposer pour le bouton "Initialize" de la fiche EA
globalThis.YZECreateEaResources = YZECreateEaResources;

// ── Dice So Nice — colorsets YZE depuis settings ─────────────────────
Hooks.once("diceSoNiceReady", (dice3d) => {
  const g = (key, def) => { try { return game.settings.get("yzegenerique", key) || def; } catch { return def; } };

  const activePreset = (() => { try { return game.settings.get("yzegenerique", "activePresetId"); } catch { return "srd-default"; } })();
  const isEA = activePreset === "eldritch-automata";

  // Couleurs : EA utilise le violet, les autres utilisent les settings configurables
  const normalFg  = isEA ? "#c8c8e0" : g("dsnColorNormalFg",  "#c9a84c");
  const normalBg  = isEA ? "#0b0b12" : g("dsnColorNormalBg",  "#1a1208");
  const stressFg  = isEA ? "#0b0b12" : g("dsnColorStressFg", "#1a1208");
  const stressBg  = isEA ? "#6a3fc8" : g("dsnColorStressBg", "#c9a84c");
  const gearFg    = isEA ? "#c8c8e0" : g("dsnColorGearFg",   "#f0ead6");
  const gearBg    = isEA ? "#1a0a3a" : g("dsnColorGearBg",   "#5c3d2e");

  const rerollBanesActive = (() => { try { return game.settings.get("yzegenerique", "rerollBanesOnPush") ?? false; } catch { return false; } })();

  const lBane    = g("dsnLabelBane",       "⊘");  // ⊘ par défaut
  const lSuccess = g("dsnLabelSuccess",    "★");  // ★ par défaut
  const lStress  = g("dsnLabelStressBane", "⚡");  // ⚡ par défaut
  // En EA (rerollBanes actif), les dés normaux ont la face 1 vide (pas de bane)
  const lNormal1 = rerollBanesActive ? " " : lBane;

  const showMiddle = g("dsnShowMiddleFaces", false);
  const mid = (n) => showMiddle ? String(n) : " ";

  const makeLabel = (face1, success) =>
    [face1||"1", mid(2), mid(3), mid(4), mid(5), success||"6"];

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
    // Strand dice — violet EA, succès sur 1 ET 6
    { name:"yze-strand", description:"YZE — Strand", category:"Year Zero Engine",
      foreground: "#6a3fc8", background: "#adf182",
      outline: "#6a3fc8", edge: "#7ab85a", texture:"none", material:"plastic", font:"Arial Black" },
  ];

  for (const cs of colorsets) {
    try { dice3d.addColorset(cs, "none"); }
    catch(e) { console.warn(`YZE | DSN colorset ${cs.name}:`, e); }
  }

  // Tenter d'enregistrer les presets de dés avec labels
  // Requiert addSystem — silently skip si non disponible
  try {
    if (typeof dice3d.addSystem === "function") {
      dice3d.addSystem({ id: "yze",        name: "YZE — Normal" },      "none");
      dice3d.addSystem({ id: "yze-stress", name: "YZE — Stress" },      "none");
      dice3d.addSystem({ id: "yze-gear",   name: "YZE — Gear Bonus" },  "none");
      dice3d.addSystem({ id: "yze-strand", name: "YZE — Strand" },      "none");

      dice3d.addDicePreset({ type:"d6", system:"yze",
        labels: makeLabel(lNormal1, lSuccess), colorset:"yze-normal" });
      dice3d.addDicePreset({ type:"d6", system:"yze-stress",
        labels: makeLabel(lStress, lSuccess), colorset:"yze-stress" });
      dice3d.addDicePreset({ type:"d6", system:"yze-gear",
        labels: makeLabel(lNormal1, lSuccess), colorset:"yze-gear" });
      // Strand : succès sur 1 ET 6 → les deux faces ont l'icône succès ★
      dice3d.addDicePreset({ type:"d6", system:"yze-strand",
        labels: [lSuccess, " ", " ", " ", " ", lSuccess], colorset:"yze-strand" });

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

// ══════════════════════════════════════════════════════════════════════
// COMBAT — Initiative, Fast/Slow Actions, Drag & Drop
// ══════════════════════════════════════════════════════════════════════

// ── Lancement du combat → initiative ──────────────────────────────
// Initiative tirée manuellement via le bouton "Draw Initiative" dans le tracker

// ── Nouveau round → reset des actions ────────────────────────────
Hooks.on("updateCombat", async (combat, changes) => {
  if (!game.user.isGM) return;
  if (changes.round === undefined) return;
  if (changes.round <= 1) return; // pas au premier round
  const { resetActions } = await import("./combat/combat-tracker.mjs");
  await resetActions(combat);
});

// ── Render du tracker → boutons Fast/Slow + drag & drop ──────────
Hooks.on("renderCombatTracker", (app, html, data) => {
  const combat = data.combat;
  if (!combat) return;

  // V14 : html peut être un HTMLElement ou jQuery-like — normaliser
  const root = html instanceof HTMLElement ? html : (html[0] ?? html);

  const presetId = game.settings.get("yzegenerique", "activePresetId") ?? "srd-default";
  const presetClass = presetId === "eldritch-automata" ? "yze-combat-ea"
    : presetId === "sleepy-hollow" ? "yze-combat-sh"
    : presetId === "horror" ? "yze-combat-horror"
    : "yze-combat-default";

  // Ajouter classe preset sur le tracker
  root.querySelector("#combat-tracker")?.classList.add("yze-combat-tracker", presetClass);

  // Pour chaque combatant, ajouter les boutons Fast/Slow
  for (const combatant of combat.combatants) {
    const li = root.querySelector(`[data-combatant-id="${combatant.id}"]`);
    if (!li) continue;

    const slowActive = combatant.getFlag("yzegenerique", "slowAction") ?? true;
    const fastActive = combatant.getFlag("yzegenerique", "fastAction") ?? true;

    // Ajouter classe preset sur le li du combatant pour le CSS
    li.classList.add(presetClass);

    // Créer le conteneur d'actions
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "yze-combatant-actions";
    actionsDiv.innerHTML = `
      <button class="yze-action-btn yze-slow-btn ${slowActive ? "yze-action--active" : "yze-action--spent"}"
        data-combatant-id="${combatant.id}" data-action-type="slowAction"
        title="Slow Action${slowActive ? " (available)" : " (used)"}">▶</button>
      <button class="yze-action-btn yze-fast-btn ${fastActive ? "yze-action--active" : "yze-action--spent"}"
        data-combatant-id="${combatant.id}" data-action-type="fastAction"
        title="Fast Action${fastActive ? " (available)" : " (used)"}">▶▶</button>
    `;

    // Insérer après le nom du combatant
    const controls = li.querySelector(".combatant-controls");
    if (controls) controls.before(actionsDiv);
    else li.appendChild(actionsDiv);

    // Click listeners
    actionsDiv.querySelectorAll(".yze-action-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cId     = btn.dataset.combatantId;
        const type    = btn.dataset.actionType;
        const current = game.combat;
        if (!current) return;
        const c = current.combatants.get(cId);
        if (!c) return;
        const { toggleAction } = await import("./combat/combat-tracker.mjs");
        await toggleAction(c, type);
      });
    });
  }

  // ── Bouton Draw Initiative ────────────────────────────────────
  // Uniquement si aucune initiative n'est encore tirée
  const hasInitiative = combat.combatants.some(c => c.initiative !== null);
  const trackerHeader = root.querySelector(".combat-tracker-header, .directory-header, header.combat-header")
    ?? root.querySelector(".combat-controls")
    ?? root.querySelector("nav.directory-header");

  // Chercher ou créer la zone de boutons du tracker
  let drawBtn = root.querySelector(".yze-draw-initiative-btn");
  if (!drawBtn) {
    drawBtn = document.createElement("button");
    drawBtn.className = "yze-draw-initiative-btn";
    drawBtn.title = hasInitiative ? "Re-draw Initiative" : "Draw Initiative";
    drawBtn.innerHTML = hasInitiative ? "↺ Re-draw" : "🎲 Draw Initiative";
    drawBtn.style.cssText = "font-size:0.78em;padding:3px 8px;margin:4px 6px;cursor:pointer;border-radius:3px;border:1px solid rgba(255,255,255,0.2);background:transparent;color:inherit;width:calc(100% - 12px);display:block;";
    // Insérer après le header
    const insertAfter = root.querySelector(".combat-tracker-header")
      ?? root.querySelector("header")
      ?? root.querySelector("ol#combat-tracker")?.previousElementSibling;
    if (insertAfter) insertAfter.after(drawBtn);
    else root.prepend(drawBtn);

    drawBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentCombat = game.combat;
      if (!currentCombat) return;
      const { drawInitiative } = await import("./combat/combat-tracker.mjs");
      await drawInitiative(currentCombat);
    });
  }
  const combatantEls = root.querySelectorAll(".combatant[data-combatant-id]");
  combatantEls.forEach(el => {
    el.setAttribute("draggable", "true");

    el.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", el.dataset.combatantId);
      el.classList.add("yze-dragging");
    });

    el.addEventListener("dragend", () => {
      el.classList.remove("yze-dragging");
    });

    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.classList.add("yze-drag-over");
    });

    el.addEventListener("dragleave", () => {
      el.classList.remove("yze-drag-over");
    });

    el.addEventListener("drop", async (e) => {
      e.preventDefault();
      el.classList.remove("yze-drag-over");
      const draggedId = e.dataTransfer.getData("text/plain");
      const targetId  = el.dataset.combatantId;
      if (draggedId === targetId) return;
      const current = game.combat;
      if (!current) return;
      const cA = current.combatants.get(draggedId);
      const cB = current.combatants.get(targetId);
      if (!cA || !cB) return;
      const { swapInitiative } = await import("./combat/combat-tracker.mjs");
      await swapInitiative(cA, cB);
    });
  });
});

