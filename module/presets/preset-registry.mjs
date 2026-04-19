/**
 * preset-registry.mjs — registre des presets YZE.
 *
 * Principes :
 *   - Les presets sont des profils d'application, pas des sources de vérité opérationnelles.
 *   - resolvePreset() fusionne le preset demandé avec le SRD par défaut.
 *   - Les world settings restent la seule source de vérité opérationnelle.
 * Foundry VTT V14
 */

import { EldritchAutomataPreset } from "./eldritch-automata/ea-preset.mjs";
import { SleepyHollowPreset }    from "./sleepy-hollow/sh-preset.mjs";

// ── Preset SRD par défaut ────────────────────────────────────────────

export const SRD_DEFAULT_PRESET = {
  id:      "srd-default",
  name:    "YZE SRD Generic",
  version: "1.0.0",

  rules: {
    damageSystem:      "healthResolve",
    pushVariant:       "damageStress",
    enableStress:      false,
    enableCriticals:   true,
    enableConditions:  false,
    enableDoomPoints:  false,
    enableWillpower:   false,
    enableEncumbrance: false,
  },

  sheet: {
    showHealth:      true,
    showResolve:     true,
    showStress:      false,
    showConditions:  false,
    showXP:          true,
    showEncumbrance: false,
    extraSections:   [],
    labelOverrides:  {},
  },

  // 4 attributs SRD de base
  attributes: [
    { slug: "strength", labelKey: "YZE.AttrStrength", category: "physical", initial: 2, stepRating: "C" },
    { slug: "agility",  labelKey: "YZE.AttrAgility",  category: "physical", initial: 2, stepRating: "C" },
    { slug: "wits",     labelKey: "YZE.AttrWits",     category: "mental",   initial: 2, stepRating: "C" },
    { slug: "empathy",  labelKey: "YZE.AttrEmpathy",  category: "mental",   initial: 2, stepRating: "C" },
  ],

  // 12 skills SRD de base
  skills: [
    { slug: "force",        labelKey: "YZE.AttrStrength", linkedAttribute: "strength", initial: 0 },
    { slug: "melee",        labelKey: "YZE.AttrAgility",  linkedAttribute: "strength", initial: 0 },
    { slug: "stamina",      labelKey: "YZE.AttrWits",     linkedAttribute: "strength", initial: 0 },
    { slug: "marksmanship", labelKey: "YZE.AttrEmpathy",  linkedAttribute: "agility",  initial: 0 },
    { slug: "mobility",     labelKey: "YZE.AttrEmpathy",  linkedAttribute: "agility",  initial: 0 },
    { slug: "stealth",      labelKey: "YZE.AttrEmpathy",  linkedAttribute: "agility",  initial: 0 },
    { slug: "crafting",     labelKey: "YZE.AttrEmpathy",  linkedAttribute: "wits",     initial: 0 },
    { slug: "observation",  labelKey: "YZE.AttrEmpathy",  linkedAttribute: "wits",     initial: 0 },
    { slug: "survival",     labelKey: "YZE.AttrEmpathy",  linkedAttribute: "wits",     initial: 0 },
    { slug: "healing",      labelKey: "YZE.AttrEmpathy",  linkedAttribute: "empathy",  initial: 0 },
    { slug: "insight",      labelKey: "YZE.AttrEmpathy",  linkedAttribute: "empathy",  initial: 0 },
    { slug: "persuasion",   labelKey: "YZE.AttrEmpathy",  linkedAttribute: "empathy",  initial: 0 },
  ],

  derivedStats: [],

  resources: {
    cssTheme:              null,
    criticalTablePhysical: null,
    criticalTableMental:   null,
    extraModules:          [],
    compendiums:           [],
  },

  onApply:   null,
  onMigrate: null,
};

// ── Registry ─────────────────────────────────────────────────────────

const _registry = new Map();

function register(preset) {
  if (_registry.has(preset.id)) {
    console.warn(`YZE Presets | Preset "${preset.id}" already registered. Skipped.`);
    return;
  }
  _registry.set(preset.id, preset);
}

export function getPreset(id)  { return _registry.get(id) ?? null; }
export function getAllPresets() { return Array.from(_registry.values()); }

/**
 * Résout un preset en le fusionnant avec le SRD par défaut.
 * Les champs définis dans le preset ont la priorité.
 * Les tableaux vides héritent du SRD.
 *
 * @param {string} id
 * @returns {object} Preset résolu
 */
export function resolvePreset(id) {
  const preset = getPreset(id);
  if (!preset) {
    console.warn(`YZE Presets | Preset "${id}" not found. Using SRD default.`);
    return SRD_DEFAULT_PRESET;
  }
  return {
    ...SRD_DEFAULT_PRESET,
    ...preset,
    rules:  { ...SRD_DEFAULT_PRESET.rules,  ...preset.rules  },
    sheet:  { ...SRD_DEFAULT_PRESET.sheet,  ...preset.sheet  },
    attributes:   preset.attributes?.length   ? preset.attributes   : SRD_DEFAULT_PRESET.attributes,
    skills:       preset.skills?.length       ? preset.skills       : SRD_DEFAULT_PRESET.skills,
    derivedStats: preset.derivedStats         ?? SRD_DEFAULT_PRESET.derivedStats ?? [],
    resources: { ...SRD_DEFAULT_PRESET.resources, ...(preset.resources ?? {}) },
  };
}

/**
 * Enregistre tous les presets connus.
 * Appelé dans init(), après registerSystemSettings().
 */
export function registerAllPresets() {
  register(SRD_DEFAULT_PRESET);
  register(EldritchAutomataPreset);
  register(SleepyHollowPreset);
}
