/**
 * getRuleConfig — lecture de la configuration active des règles.
 * Source unique de vérité : les world settings.
 * Ne lit jamais les presets directement.
 * Foundry VTT V14
 */

export function getRuleConfig() {
  return {
    // diceMode retiré — D6 pool uniquement dans ce module
    damageSystem:        game.settings.get("yzegenerique", "damageSystem"),
    pushVariant:         game.settings.get("yzegenerique", "pushVariant"),
    enableStress:        game.settings.get("yzegenerique", "enableStress"),
    enableCriticals:     game.settings.get("yzegenerique", "enableCriticals"),
    enableConditions:    game.settings.get("yzegenerique", "enableConditions"),
    enableDoomPoints:    game.settings.get("yzegenerique", "enableDoomPoints"),
    enableWillpower:     game.settings.get("yzegenerique", "enableWillpower"),
    enableEncumbrance:   game.settings.get("yzegenerique", "enableEncumbrance"),
    keepSuccessesOnPush: game.settings.get("yzegenerique", "keepSuccessesOnPush"),
    panicTableName:      game.settings.get("yzegenerique", "panicTableName") || "",
  };
}
