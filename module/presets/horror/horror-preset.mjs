/**
 * horror-preset.mjs — Preset "Horror RPG"
 * Mêmes mécaniques que Sleepy Hollow.
 * Couleurs : fond cendré #282c2f, accent pêche #f9764e
 */
export const HorrorPreset = {
  id:      "horror",
  name:    "Horror RPG",
  version: "1.0.0",

  rules: {
    damageSystem:        "healthResolve",
    pushVariant:         "stressDice",
    enableStress:        true,
    enableCriticals:     true,
    enableConditions:    false,
    enableDoomPoints:    false,
    enableWillpower:     false,
    enableEncumbrance:   false,
    keepSuccessesOnPush: true,
    panicTableName:      "Horror RPG — Panic",
  },

  sheet: {
    showHealth:      true,
    showResolve:     false,
    showStress:      true,
    showConditions:  false,
    showXP:          true,
    showEncumbrance: false,
    labelOverrides:  {},
  },

  labelOverrides: {},

  // Attributs identiques à SH
  attributes: [
    { slug: "strength", labelKey: "YZE.Strength", category: "physical", initial: 2 },
    { slug: "agility",  labelKey: "YZE.Agility",  category: "physical", initial: 2 },
    { slug: "wits",     labelKey: "YZE.Wits",     category: "mental",   initial: 2 },
    { slug: "empathy",  labelKey: "YZE.Empathy",  category: "mental",   initial: 2 },
  ],

  // 12 skills Horror RPG
  skills: [
    { slug: "force",         labelKey: "Force",         linkedAttribute: "strength", initial: 0 },
    { slug: "melee",         labelKey: "Melee",         linkedAttribute: "strength", initial: 0 },
    { slug: "stamina",       labelKey: "Stamina",       linkedAttribute: "strength", initial: 0 },
    { slug: "marksmanship",  labelKey: "Marksmanship",  linkedAttribute: "agility",  initial: 0 },
    { slug: "mobility",      labelKey: "Mobility",      linkedAttribute: "agility",  initial: 0 },
    { slug: "stealth",       labelKey: "Stealth",       linkedAttribute: "agility",  initial: 0 },
    { slug: "crafting",      labelKey: "Crafting",      linkedAttribute: "wits",     initial: 0 },
    { slug: "observation",   labelKey: "Observation",   linkedAttribute: "wits",     initial: 0 },
    { slug: "survival",      labelKey: "Survival",      linkedAttribute: "wits",     initial: 0 },
    { slug: "healing",       labelKey: "Healing",       linkedAttribute: "empathy",  initial: 0 },
    { slug: "insight",       labelKey: "Insight",       linkedAttribute: "empathy",  initial: 0 },
    { slug: "persuasion",    labelKey: "Persuasion",    linkedAttribute: "empathy",  initial: 0 },
  ],

  quickAttacks: [
    { id: "melee",  label: "Melee",  attrSlug: "strength", skillSlug: "melee" },
    { id: "ranged", label: "Ranged", attrSlug: "agility",  skillSlug: "marksmanship" },
  ],

  // Couleurs DSN
  dsnColors: {
    stressFg: "#282c2f", stressBg: "#f9764e",
    gearFg:   "#f9764e", gearBg:   "#3d2020",
  },
  dsnLabels: {
    bane: "☠", success: "✦", stressBane: "⚡",
  },

  titleFont:   "Metal Mania",
  themeColors: { accent: "#f9764e", bg: "#282c2f" },

  resources: {
    cssTheme:    "systems/yzegenerique/module/presets/horror/horror-theme.css",
    criticalTablePhysical: null,
    extraModules: [],
    compendiums:  [],
  },

  onApply: null,
};
