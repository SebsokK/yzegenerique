/**
 * PresetApplier — applique un preset à un monde Foundry.
 *
 * Responsabilités :
 *   - Écrire les world settings depuis preset.rules
 *   - Injecter le CSS de thème dynamiquement
 *   - Créer/mettre à jour les Items de référence (compendium world.yze-reference)
 *   - Appeler onApply / onMigrate si définis
 *   - Demander un reload si damageSystem change
 *
 * Ce fichier n'est PAS importé au init().
 * Il est chargé dynamiquement dans le hook "ready" pour ré-appliquer le thème.
 * Foundry VTT V14
 */

import { resolvePreset } from "./preset-registry.mjs";

export class PresetApplier {

  /**
   * Point d'entrée principal. À appeler depuis la console GM ou un dialog dédié.
   *
   * @param {string}  presetId
   * @param {object}  [options]
   * @param {boolean} [options.createItems=true]
   * @param {boolean} [options.confirmReload=true]
   */
  static async apply(presetId, options = {}) {
    if (!game.user.isGM) {
      ui.notifications.error("YZE | Only the GM can apply a preset.");
      return;
    }

    const preset        = resolvePreset(presetId);
    const storedVersion = game.settings.get("yzegenerique", "activePresetVersion");
    const prevPresetId  = game.settings.get("yzegenerique", "activePresetId");

    // Détection de migration de version (même preset, version différente)
    const isVersionChange = prevPresetId === presetId
      && storedVersion !== ""
      && storedVersion !== preset.version;

    if (isVersionChange && typeof preset.onMigrate === "function") {
      await preset.onMigrate({
        presetId,
        fromVersion: storedVersion,
        toVersion:   preset.version,
        isPresetChange: false,
      });
    }

    // 1. Écriture des settings
    await PresetApplier._applySettings(preset);

    // 2. Items de référence
    if (options.createItems !== false) {
      await PresetApplier._createReferenceItems(preset);
    }

    // 3. Thème CSS
    PresetApplier._applyTheme(preset);

    // 4. Mémorisation
    await game.settings.set("yzegenerique", "activePresetId",      presetId);
    await game.settings.set("yzegenerique", "activePresetVersion", preset.version);

    // 5. Hook personnalisé du preset
    if (typeof preset.onApply === "function") await preset.onApply(preset);
    Hooks.callAll("yze.presetApplied", preset);

    // 6. Reload si nécessaire (damageSystem change les DataModels — requiresReload: true)
    if (options.confirmReload !== false) {
      const doReload = await Dialog.confirm({
        title:   "Preset Applied",
        content: "<p>A page reload is required to activate the new damage system. Reload now?</p>",
      });
      if (doReload) foundry.utils.debouncedReload();
    }
  }

  /**
   * Écrit les world settings depuis preset.rules.
   * Silencieux si un setting n'est pas encore enregistré.
   */
  static async _applySettings(preset) {
    const map = {
      damageSystem:        preset.rules.damageSystem,
      pushVariant:         preset.rules.pushVariant,
      enableStress:        preset.rules.enableStress,
      enableCriticals:     preset.rules.enableCriticals,
      enableConditions:    preset.rules.enableConditions,
      enableDoomPoints:    preset.rules.enableDoomPoints,
      enableWillpower:     preset.rules.enableWillpower,
      enableEncumbrance:   preset.rules.enableEncumbrance,
      // keepSuccessesOnPush est optionnel — présent sur SH, absent sur SRD/EA (défaut false)
      keepSuccessesOnPush: preset.rules.keepSuccessesOnPush ?? false,
      panicTableName:      preset.rules.panicTableName      ?? "",
    };
    for (const [key, value] of Object.entries(map)) {
      try {
        await game.settings.set("yzegenerique", key, value);
      } catch (e) {
        console.warn(`YZE Preset | Setting "${key}" not found or unwritable:`, e);
      }
    }
  }

  /**
   * Injecte le CSS de thème du preset.
   * Retire l'ancien thème si présent.
   * Ré-appelé dans le hook "ready" après chaque reload.
   *
   * IMPORTANT : L'injection CSS dynamique ne survit pas aux rechargements.
   * C'est pour cela qu'elle est ré-appliquée dans Hooks.once("ready").
   */
  static _applyTheme(preset) {
    document.getElementById("yze-preset-theme")?.remove();
    const cssTheme = preset.resources?.cssTheme;
    if (!cssTheme) return;
    const link = document.createElement("link");
    link.id   = "yze-preset-theme";
    link.rel  = "stylesheet";
    link.href = cssTheme;
    document.head.appendChild(link);
  }

  /**
   * Crée ou met à jour les Items de référence (attributs + skills) dans world.yze-reference.
   * Déduplication par slug — stratégie upsert.
   * Ne touche pas aux Items embedded sur les Actors existants.
   */
  static async _createReferenceItems(preset) {
    // Obtenir ou créer le compendium de référence
    let pack = game.packs.get("world.yze-reference");
    if (!pack) {
      pack = await CompendiumCollection.createCompendium({
        name:   "yze-reference",
        label:  "YZE — Reference",
        type:   "Item",
        system: "yzegenerique",
      });
    }

    // Index par slug
    await pack.getIndex({ fields: ["system.slug", "type"] });
    const existingBySlug = new Map(
      pack.index
        .filter(e => e.system?.slug)
        .map(e => [e.type + ":" + e.system.slug, e._id])
    );

    const toCreate = [];
    const toUpdate = [];

    const allDefs = [
      ...preset.attributes.map(d => ({ ...d, itemType: "attribute" })),
      ...preset.skills.map(d => ({ ...d, itemType: "skill" })),
    ];

    for (const def of allDefs) {
      const key  = def.itemType + ":" + def.slug;
      const data = PresetApplier._defToItemData(def);

      if (existingBySlug.has(key)) {
        toUpdate.push({ _id: existingBySlug.get(key), ...data });
      } else {
        toCreate.push(data);
      }
    }

    if (toCreate.length > 0) {
      await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
    }
    if (toUpdate.length > 0) {
      await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection });
    }

    ui.notifications.info(
      `YZE | ${toCreate.length} items created, ${toUpdate.length} updated in reference compendium.`
    );
  }

  static _defToItemData(def) {
    const name = game.i18n.localize(def.labelKey) || def.slug;
    if (def.itemType === "attribute") {
      return {
        name,
        type: "attribute",
        system: {
          value:      def.initial,
          current:    def.initial,
          stepRating: def.stepRating,
          category:   def.category,
          slug:       def.slug,
        },
      };
    }
    return {
      name,
      type: "skill",
      system: {
        value:           def.initial,
        linkedAttribute: def.linkedAttribute,
        slug:            def.slug,
      },
    };
  }

  /**
   * Résout les libellés overrides d'un preset pour usage dans les templates.
   * @param {object} labelOverrides
   * @returns {{ health: string, resolve: string, stress: string }}
   */
  static resolveLabels(labelOverrides = {}) {
    return {
      health:  game.i18n.localize(labelOverrides["YZE.Health"]  ?? "YZE.Health"),
      resolve: game.i18n.localize(labelOverrides["YZE.Resolve"] ?? "YZE.Resolve"),
      stress:  game.i18n.localize(labelOverrides["YZE.Stress"]  ?? "YZE.Stress"),
    };
  }
}
