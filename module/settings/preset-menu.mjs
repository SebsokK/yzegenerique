/**
 * PresetMenu — Interface UI pour appliquer un preset YZE.
 * Accessible depuis Paramètres système Foundry → "Choisir un preset de jeu".
 * Compatible avec les 3 presets : Eldritch Automata, Horror, Sleepy Hollow.
 * Foundry VTT V14
 */

import { getAllPresets, resolvePreset } from "../presets/preset-registry.mjs";
import { PresetApplier }               from "../presets/preset-applier.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class PresetMenu extends HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id:      "yze-preset-menu",
    classes: ["yzegenerique", "preset-menu"],
    tag:     "div",
    window: {
      title:     "YZE — Choose Game Preset",
      resizable: false,
    },
    position: { width: 480, height: "auto" },
    actions: {
      applyPreset: PresetMenu._onApplyPreset,
    },
  };

  static PARTS = {
    main: {
      template: "systems/yzegenerique/templates/settings/preset-menu.hbs",
      scrollable: [".window-content"],
    },
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const activeId = game.settings.get("yzegenerique", "activePresetId");

    context.presets = getAllPresets().map(p => ({
      id:       p.id,
      name:     p.name,
      version:  p.version,
      active:   p.id === activeId,
      // Description courte pour l'UI
      description: PresetMenu._presetDescription(p.id),
    }));

    context.activePresetId = activeId;
    return context;
  }

  static _presetDescription(id) {
    const descriptions = {
      "srd-default":       "Generic YZE — Health & Resolve, no stress, standard push.",
      "eldritch-automata": "Mechs vs Horrors — Stress dice, Stability, Ego, Strands.",
      "sleepy-hollow":     "18th-century gothic horror — 16 skills, Stress dice, successes kept on push.",
      "horror": "Horror RPG — 12 skills, Stress dice, same YZE rules as Sleepy Hollow.",
    };
    return descriptions[id] ?? "No description available.";
  }

  /**
   * Handler du bouton "Apply".
   * Appelle PresetApplier.apply() avec confirmation de reload.
   */
  static async _onApplyPreset(event, target) {
    const presetId = target.dataset.presetId;
    if (!presetId) return;

    const currentId = game.settings.get("yzegenerique", "activePresetId");
    if (presetId === currentId) {
      ui.notifications.info(`YZE | Preset "${presetId}" is already active.`);
      return;
    }

    await this.close();
    await PresetApplier.apply(presetId, { confirmReload: true });
  }
}
