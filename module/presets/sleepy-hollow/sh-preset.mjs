/**
 * Preset Sleepy Hollow.
 *
 * Règles confirmées depuis le corebook :
 *   - 4 attributs SRD standard
 *   - 16 skills (vs 12 pour SRD)
 *   - Health = Strength + Agility (éditable manuellement)
 *   - Stress Level : commence à 0, monte au push et sur événements
 *   - Push : les succès (6) sont CONSERVÉS ("leave them on the table")
 *     → keepSuccessesOnPush = true dans les rules du preset
 *   - Stress Dice ajoutés au pool au push (= Stress Level actuel)
 *     → pushVariant = "stressDice"
 *   - Panic Table : D6 + Stress Level si bane sur un stress die
 *   - Broken : Health = 0 → incapacité
 *   - Pas de Resolve séparé
 *
 * Foundry VTT V14
 */

export const SleepyHollowPreset = {
  id:      "sleepy-hollow",
  name:    "Sleepy Hollow",
  version: "0.1.0",

  rules: {
    damageSystem:        "healthResolve",
    pushVariant:         "stressDice",
    enableStress:        true,
    enableCriticals:     true,
    enableConditions:    false,
    enableDoomPoints:    false,
    enableWillpower:     false,
    enableEncumbrance:   false,
    // Propagé dans system-settings au moment de l'apply
    keepSuccessesOnPush: true,
    panicTableName:      "Sleepy Hollow — Panic",
  },

  sheet: {
    showHealth:      true,
    showResolve:     false,
    showStress:      true,
    showConditions:  false,
    showXP:          true,
    showEncumbrance: false,
    extraSections:   [],
    labelOverrides:  {},
  },

  attributes: [
    { slug: "strength", labelKey: "YZE.AttrStrength", category: "physical", initial: 2, stepRating: "C" },
    { slug: "agility",  labelKey: "YZE.AttrAgility",  category: "physical", initial: 2, stepRating: "C" },
    { slug: "wits",     labelKey: "YZE.AttrWits",     category: "mental",   initial: 2, stepRating: "C" },
    { slug: "empathy",  labelKey: "YZE.AttrEmpathy",  category: "mental",   initial: 2, stepRating: "C" },
  ],

  skills: [
    { slug: "force",           labelKey: "YZE.SH.SkillForce",          linkedAttribute: "strength", initial: 0 },
    { slug: "melee",           labelKey: "YZE.SH.SkillMelee",          linkedAttribute: "strength", initial: 0 },
    { slug: "stamina",         labelKey: "YZE.SH.SkillStamina",        linkedAttribute: "strength", initial: 0 },
    { slug: "marksmanship",    labelKey: "YZE.SH.SkillMarksmanship",   linkedAttribute: "agility",  initial: 0 },
    { slug: "mobility",        labelKey: "YZE.SH.SkillMobility",       linkedAttribute: "agility",  initial: 0 },
    { slug: "stealth",         labelKey: "YZE.SH.SkillStealth",        linkedAttribute: "agility",  initial: 0 },
    { slug: "crafting",        labelKey: "YZE.SH.SkillCrafting",       linkedAttribute: "wits",     initial: 0 },
    { slug: "lore-knowledge",  labelKey: "YZE.SH.SkillLoreKnowledge",  linkedAttribute: "wits",     initial: 0 },
    { slug: "observation",     labelKey: "YZE.SH.SkillObservation",    linkedAttribute: "wits",     initial: 0 },
    { slug: "survival",        labelKey: "YZE.SH.SkillSurvival",       linkedAttribute: "wits",     initial: 0 },
    { slug: "animal-handling", labelKey: "YZE.SH.SkillAnimalHandling", linkedAttribute: "empathy",  initial: 0 },
    { slug: "healing",         labelKey: "YZE.SH.SkillHealing",        linkedAttribute: "empathy",  initial: 0 },
    { slug: "insight",         labelKey: "YZE.SH.SkillInsight",        linkedAttribute: "empathy",  initial: 0 },
    { slug: "leadership",      labelKey: "YZE.SH.SkillLeadership",     linkedAttribute: "empathy",  initial: 0 },
    { slug: "performance",     labelKey: "YZE.SH.SkillPerformance",    linkedAttribute: "empathy",  initial: 0 },
    { slug: "persuasion",      labelKey: "YZE.SH.SkillPersuasion",     linkedAttribute: "empathy",  initial: 0 },
  ],

  derivedStats: [
    { key: "health", label: "YZE.SH.Health", formula: "strength + agility" },
    // stress = manuel, DerivedStatsSystem ne le touche pas (formula null)
    { key: "stress", label: "YZE.SH.Stress", formula: null },
  ],

  resources: {
    cssTheme:    "systems/yzegenerique/module/presets/sleepy-hollow/sh-theme.css",
    criticalTablePhysical: null,
    extraModules: [],
    compendiums:  [],
  },

  onApply: null,
  onMigrate: null,
};
