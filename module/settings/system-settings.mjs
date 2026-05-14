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
    scope: "world", config: true, type: Boolean, default: true,
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

  game.settings.register("yzegenerique", "rerollBanesOnPush", {
    name:    "YZE.SettingRerollBanesOnPush",
    hint:    "YZE.SettingRerollBanesOnPushHint",
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

  // ── Paramètres Free Attack (slugs configurables) ─────────────────
  game.settings.register("yzegenerique", "freeAttackMeleeAttr", {
    name: "Free Attack — Melee Attribute",
    hint: "Slug of the attribute used for Melee quick attack (e.g. 'strength')",
    scope: "world", config: true, type: String, default: "strength",
  });
  game.settings.register("yzegenerique", "freeAttackMeleeSkill", {
    name: "Free Attack — Melee Skill",
    hint: "Name of the skill used for Melee quick attack (e.g. 'melee')",
    scope: "world", config: true, type: String, default: "melee",
  });
  game.settings.register("yzegenerique", "freeAttackRangedAttr", {
    name: "Free Attack — Ranged Attribute",
    hint: "Slug of the attribute used for Ranged quick attack (e.g. 'agility')",
    scope: "world", config: true, type: String, default: "agility",
  });
  game.settings.register("yzegenerique", "freeAttackRangedSkill", {
    name: "Free Attack — Ranged Skill",
    hint: "Name of the skill used for Ranged quick attack (e.g. 'marksmanship')",
    scope: "world", config: true, type: String, default: "marksmanship",
  });

  // ── Dice So Nice — couleurs par type de dé ───────────────────────
  game.settings.register("yzegenerique", "dsnColorNormalFg",  { name: "DSN — Normal Dice foreground", hint: "Text color for attribute/skill dice",    scope: "world", config: true, type: String, default: "#c9a84c" });
  game.settings.register("yzegenerique", "dsnColorNormalBg",  { name: "DSN — Normal Dice background", hint: "Background color for attribute/skill dice", scope: "world", config: true, type: String, default: "#1a1208" });
  game.settings.register("yzegenerique", "dsnColorStressFg",  { name: "DSN — Stress Dice foreground", hint: "Text color for stress dice",          scope: "world", config: true, type: String, default: "#1a1208" });
  game.settings.register("yzegenerique", "dsnColorStressBg",  { name: "DSN — Stress Dice background", hint: "Background color for stress dice",    scope: "world", config: true, type: String, default: "#c9a84c" });
  game.settings.register("yzegenerique", "dsnColorGearFg",    { name: "DSN — Gear Dice foreground",   hint: "Text color for weapon bonus dice",    scope: "world", config: true, type: String, default: "#f0ead6" });
  game.settings.register("yzegenerique", "dsnColorGearBg",    { name: "DSN — Gear Dice background",   hint: "Background color for weapon bonus dice", scope: "world", config: true, type: String, default: "#5c3d2e" });
  game.settings.register("yzegenerique", "dsnLabelBane",       { name: "DSN — Bane symbol (face 1)",       hint: "Symbol on die face 1. Empty = number.", scope: "world", config: true, type: String, default: "⊘" });
  game.settings.register("yzegenerique", "dsnLabelSuccess",    { name: "DSN — Success symbol (face 6)",    hint: "Symbol on die face 6. Empty = number.", scope: "world", config: true, type: String, default: "★" });
  game.settings.register("yzegenerique", "dsnLabelStressBane", { name: "DSN — Stress Bane (stress face 1)", hint: "Symbol on stress die face 1. Empty = number.", scope: "world", config: true, type: String, default: "⚡" });
  game.settings.register("yzegenerique", "dsnShowMiddleFaces", {
    name: "DSN — Show numbers on faces 2-5",
    hint: "Show 2/3/4/5 on die faces. When off, these faces are blank.",
    scope: "world", config: true, type: Boolean, default: false,
  });

  // ── Couleurs du thème ────────────────────────────────────────────
  game.settings.register("yzegenerique", "themeColorAccent", {
    name: "Theme — Accent color (light)",
    hint: "Light color used for highlights, titles, pips, and rollcard buttons. Hex value e.g. #c9a84c",
    scope: "world", config: true, type: String, default: "#c9a84c",
  });
  game.settings.register("yzegenerique", "themeColorBg", {
    name: "Theme — Background color (dark)",
    hint: "Dark color used for sheet backgrounds and rollcard backgrounds. Hex value e.g. #1a1208",
    scope: "world", config: true, type: String, default: "#1a1208",
  });

  // ── Font titre ──────────────────────────────────────────────────
  game.settings.register("yzegenerique", "titleFont", {
    name: "Title Font",
    hint: "Font used for actor/item names and section titles. Loaded from Google Fonts.",
    scope: "world", config: true, type: String, default: "default",
    choices: {
      "default":           "Default (Cinzel Decorative)",
      "Grenze Gotisch":    "Grenze Gotisch — Gothic / Sleepy Hollow",
      "UnifrakturCook":    "UnifrakturCook — Fraktur Gothic",
      "Cinzel Decorative": "Cinzel Decorative — Roman Gothic",
      "Handjet":           "Handjet — Pixel / Eldritch Automata",
      "Orbitron":          "Orbitron — Sci-Fi",
      "Metal Mania":       "Metal Mania — Horror",
      "Creepster":         "Creepster — Slasher",
      "Nosifer":           "Nosifer — Dark Horror",
      "MedievalSharp":     "MedievalSharp — Medieval",
    },
  });
}
