/**
 * Preset Eldritch Automata.
 * Configure uniquement le noyau — aucune logique métier.
 * Foundry VTT V14
 */

export const EldritchAutomataPreset = {
  id:      "eldritch-automata",
  name:    "Eldritch Automata",
  version: "0.1.0",

  rules: {
    damageSystem:      "custom",      // EA utilise EaCharacterModel
    pushVariant:       "stressDice",  // [CONFIRMÉ]
    enableStress:      true,          // [CONFIRMÉ]
    enableCriticals:   true,          // [CONFIRMÉ]
    enableConditions:  false,
    enableDoomPoints:  false,
    enableWillpower:   false,
    enableEncumbrance: false,
    panicTableName:    "Eldritch Automata — Panic",
  },

  sheet: {
    showHealth:      true,   // [CONFIRMÉ]
    showResolve:     false,  // [CONFIRMÉ] absent EA
    showStress:      true,   // [CONFIRMÉ]
    showConditions:  false,  // [SUPPOSÉ]
    showXP:          true,   // [CONFIRMÉ]
    showEncumbrance: false,  // [TODO]
    extraSections:   [],     // Sections EA branchées sur items : activées par blocs ultérieurs
    labelOverrides:  {},
  },

  // [CONFIRMÉ] 4 attributs SRD standard
  attributes: [
    { slug: "strength", labelKey: "YZE.AttrStrength", category: "physical", initial: 2, stepRating: "C" },
    { slug: "agility",  labelKey: "YZE.AttrAgility",  category: "physical", initial: 2, stepRating: "C" },
    { slug: "wits",     labelKey: "YZE.AttrWits",     category: "mental",   initial: 2, stepRating: "C" },
    { slug: "empathy",  labelKey: "YZE.AttrEmpathy",  category: "mental",   initial: 2, stepRating: "C" },
  ],

  // [CONFIRMÉ] 12 skills EA listés dans le Preview
  skills: [
    { slug: "machinery",     labelKey: "YZE.EA.SkillMachinery",   linkedAttribute: "strength", initial: 0 },
    { slug: "endure",        labelKey: "YZE.EA.SkillEndure",       linkedAttribute: "strength", initial: 0 },
    { slug: "close-combat",  labelKey: "YZE.EA.SkillCloseCombat",  linkedAttribute: "strength", initial: 0 },
    { slug: "pilot",         labelKey: "YZE.EA.SkillPilot",        linkedAttribute: "agility",  initial: 0 },
    { slug: "mobility",      labelKey: "YZE.EA.SkillMobility",     linkedAttribute: "agility",  initial: 0 },
    { slug: "ranged-combat", labelKey: "YZE.EA.SkillRangedCombat", linkedAttribute: "agility",  initial: 0 }, // [SUPPOSÉ] lien Agility
    { slug: "observation",   labelKey: "YZE.EA.SkillObservation",  linkedAttribute: "wits",     initial: 0 },
    { slug: "science",       labelKey: "YZE.EA.SkillScience",      linkedAttribute: "wits",     initial: 0 },
    { slug: "survival",      labelKey: "YZE.EA.SkillSurvival",     linkedAttribute: "wits",     initial: 0 },
    { slug: "manipulate",    labelKey: "YZE.EA.SkillManipulate",   linkedAttribute: "empathy",  initial: 0 },
    { slug: "command",       labelKey: "YZE.EA.SkillCommand",      linkedAttribute: "empathy",  initial: 0 },
    { slug: "medical",       labelKey: "YZE.EA.SkillMedical",      linkedAttribute: "empathy",  initial: 0 },
  ],

  // Formules déclaratives — résolues par DerivedStatsSystem.
  // ORDRE SIGNIFICATIF : ego doit précéder egoField (ego_max en dépend).
  // [CONFIRMÉ] toutes les formules ci-dessous (section "Substats" du Preview)
  derivedStats: [
    { key: "health",     label: "YZE.EA.Health",    formula: "strength + agility"     },
    { key: "stability",  label: "YZE.EA.Stability",  formula: "wits"                   },
    { key: "ego",        label: "YZE.EA.Ego",        formula: "empathy"                },
    { key: "durability", label: "YZE.EA.Durability", formula: "strength + agility + 5" },
    { key: "egoField",   label: "YZE.EA.EgoField",   formula: "ego_max"                },
    // stress formula null = valeur manuelle, DerivedStatsSystem ne la touche pas
    { key: "stress",     label: "YZE.EA.Stress",     formula: null                     },
  ],

  resources: {
    cssTheme: "systems/yzegenerique/module/presets/eldritch-automata/ea-theme.css",
    criticalTablePhysical: null, // [TODO] table critique pilote physique
    criticalTableMental:   null, // [TODO] existence non confirmée dans le Preview fourni
    criticalTableAutomata: null, // [CONFIRMÉ existe — TODO référence compendium]
    extraModules:          [],   // Alimenté dans les blocs suivants (ea-mental-state, ea-strands, etc.)
    compendiums:           [],   // [TODO] après création des compendiums EA
  },

  onApply:   null, // [TODO] après validation du DerivedStatsSystem en production
  onMigrate: null,
};
