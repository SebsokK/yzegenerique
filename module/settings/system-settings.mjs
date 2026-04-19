/**
 * registerSystemSettings — enregistrement de tous les world settings.
 * Doit être appelé EN PREMIER dans init(), avant toute lecture de setting.
 * Le module est limité aux jeux YZE à pool de D6.
 * Foundry VTT V14
 */

import { PresetMenu } from "./preset-menu.mjs";

export function registerSystemSettings() {

  // ── Menu de sélection de preset ──────────────────────────────────
  game.settings.registerMenu("yzegenerique", "presetMenu", {
    name:       "Game Preset",
    label:      "Choose Game Preset",
    hint:       "Select and apply a YZE game preset (Eldritch Automata, Horror, Sleepy Hollow...)",
    icon:       "fas fa-dice-d6",
    type:       PresetMenu,
    restricted: true,
  });

  // diceMode supprimé — le module est D6 pool uniquement.

  game.settings.register("yzegenerique", "damageSystem", {
    name: "YZE.SettingDamageSystem",
    hint: "YZE.SettingDamageSystemHint",
    scope: "world", config: true, type: String,
    choices: {
      healthResolve:   "YZE.HealthResolve",
      attributeDamage: "YZE.AttributeDamage",
      conditions:      "YZE.Conditions",
      custom:          "YZE.Custom",
    },
    default: "healthResolve",
    requiresReload: true,
  });

  game.settings.register("yzegenerique", "pushVariant", {
    name: "YZE.SettingPushVariant",
    hint: "YZE.SettingPushVariantHint",
    scope: "world", config: true, type: String,
    choices: {
      damageStress:    "YZE.PushDamageStress",
      attributeDamage: "YZE.PushAttributeDamage",
      stressDice:      "YZE.PushStressDice",
      conditions:      "YZE.PushConditions",
      doomPoints:      "YZE.PushDoomPoints",
    },
    default: "damageStress",
  });

  game.settings.register("yzegenerique", "enableStress", {
    name: "YZE.SettingEnableStress",
    hint: "YZE.SettingEnableStressHint",
    scope: "world", config: true, type: Boolean, default: false,
  });

  game.settings.register("yzegenerique", "enableCriticals", {
    name: "YZE.SettingEnableCriticals",
    scope: "world", config: true, type: Boolean, default: true,
  });

  game.settings.register("yzegenerique", "keepSuccessesOnPush", {
    name:    "YZE.SettingKeepSuccessesOnPush",
    hint:    "YZE.SettingKeepSuccessesOnPushHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: false,
  });

  game.settings.register("yzegenerique", "enableConditions", {
    name: "YZE.SettingEnableConditions",
    scope: "world", config: true, type: Boolean, default: false,
  });

  // Settings non exposés dans l'UI — gérés par les presets
  game.settings.register("yzegenerique", "enableDoomPoints",  { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register("yzegenerique", "enableWillpower",   { scope: "world", config: false, type: Boolean, default: false });
  game.settings.register("yzegenerique", "enableEncumbrance", { scope: "world", config: false, type: Boolean, default: false });

  game.settings.register("yzegenerique", "activePresetId", {
    scope: "world", config: false, type: String, default: "srd-default",
  });
  game.settings.register("yzegenerique", "activePresetVersion", {
    scope: "world", config: false, type: String, default: "",
  });
  game.settings.register("yzegenerique", "panicTableName", {
    name:  "YZE.SettingPanicTable",
    hint:  "YZE.SettingPanicTableHint",
    scope: "world", config: true, type: String,
    default: "",
  });

  game.settings.register("yzegenerique", "doomPoints", {
    scope: "world", config: false, type: Number, default: 0,
  });
}
