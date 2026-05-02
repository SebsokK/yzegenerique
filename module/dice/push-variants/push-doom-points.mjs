/**
 * PushDoomPoints — variante : Doom Points (SRD p.9).
 * Chaque push → GM gagne 1 Doom Point.
 * TODO: socket pour les joueurs non-GM.
 * Foundry VTT V14
 */

export class PushDoomPoints {
  async apply(rollData, actor, _context = {}) {
    if (game.user.isGM) {
      const current = game.settings.get("yzegenerique", "doomPoints") ?? 0;
      await game.settings.set("yzegenerique", "doomPoints", current + 1);
    }
    // TODO: socket.emit pour incrémenter côté GM si l'utilisateur n'est pas GM
    await ChatMessage.create({
      content: `<em>${actor.name} pushes their roll. The GM gains 1 Doom Point.</em>`,
      speaker: ChatMessage.getSpeaker({ actor }),
    });
  }
}
