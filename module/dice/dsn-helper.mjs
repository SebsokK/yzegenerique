/**
 * DSNHelper — applique les couleurs de stress sur les dés via Dice So Nice.
 * Appelle game.dice3d.showForRoll() manuellement avec les options par segment,
 * puis retourne le Roll sans `rolls` dans le message (pour éviter le double affichage).
 */

export class DSNHelper {
  /**
   * Affiche les dés via DSN avec colorset stress sur les segments de stress.
   * Retourne true si DSN a été appelé manuellement, false sinon.
   */
  static async showRoll(roll, segments) {
    if (!game.dice3d || !roll?.dice?.length) return false;

    try {
      // Construire les options par die-group
      // roll.dice[] correspond à l'ordre des segments (un Die par groupe de dés)
      const themes = [];
      let dieGroupIdx = 0;

      for (const seg of segments) {
        if ((seg.count ?? 0) <= 0) continue;
        const isStress = seg.origin === "stress";
        themes.push({
          colorset: isStress ? "yze-stress" : undefined,
        });
        dieGroupIdx++;
      }

      // showForRoll(roll, user, synchronize, whisperData, blind, chatMessageData, options)
      await game.dice3d.showForRoll(
        roll,
        game.user,
        true,    // synchronize
        null,    // whisperData
        false,   // blind
        null,    // chatMessageData
        {
          themes,
        }
      );
      return true;
    } catch(e) {
      console.warn("YZE | DSN showForRoll failed:", e);
      return false;
    }
  }
}
