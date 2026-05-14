/**
 * YZECombatTracker — Initiative, Fast/Slow Actions, Drag & Drop
 *
 * Tous les presets :
 *   - Fast Action (⏩) et Slow Action (▶) dans le tracker
 *   - Reset automatique au nouveau round
 *   - Scrolling text sur les tokens
 *   - Drag & drop pour échanger les initiatives
 *
 * SH/H! : deck 1-10 sans remise
 * EA    : 1d6+Agility (PJ/NPC standard), Threat Level direct (Pilot/Automata)
 */

// ── Constantes ─────────────────────────────────────────────────────
const FLAG_SCOPE    = "yzegenerique";
const FLAG_SLOW     = "slowAction";
const FLAG_FAST     = "fastAction";

// ── Helpers ────────────────────────────────────────────────────────

function getPresetId() {
  try { return game.settings.get("yzegenerique", "activePresetId") ?? "srd-default"; }
  catch { return "srd-default"; }
}

function presetClass() {
  const p = getPresetId();
  if (p === "eldritch-automata") return "yze-combat-ea";
  if (p === "sleepy-hollow")     return "yze-combat-sh";
  if (p === "horror")            return "yze-combat-horror";
  return "yze-combat-default";
}

/** Fisher-Yates shuffle */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Scrolling text on a combatant's token */
async function scrollText(combatant, text) {
  if (!canvas?.ready) return;
  const token = combatant.token?.object ?? canvas.tokens.get(combatant.tokenId);
  if (!token) return;
  try {
    await token.showFloatingText(text, {
      duration:  1500,
      fontSize:  28,
      fill:      0xffffff,
      stroke:    0x000000,
      strokeThickness: 4,
    });
  } catch {
    // canvas.interface fallback
    try {
      canvas.interface.createScrollingText(token.center, text, {
        duration: 1500, fontSize: 28,
        fill: "#ffffff", stroke: "#000000", strokeThickness: 4,
      });
    } catch {}
  }
}

// ── Initiative ──────────────────────────────────────────────────────

/**
 * Calcule l'initiative d'un combatant selon le preset.
 * Retourne un nombre.
 */
export async function rollInitiativeForCombatant(combatant) {
  const actor    = combatant.actor;
  const presetId = getPresetId();

  if (!actor) return Math.floor(Math.random() * 10) + 1;

  if (presetId === "eldritch-automata") {
    return _rollInitiativeEA(actor);
  }
  // SH / H! / défaut → géré par le deck (ne pas appeler ce fn directement)
  return Math.floor(Math.random() * 10) + 1;
}

async function _rollInitiativeEA(actor) {
  if (actor.type === "npc") {
    const threatMode = actor.system.threatMode ?? "standard";
    if (threatMode === "pilot") {
      const tl = actor.items.find(i =>
        i.type === "attribute" && i.name.toLowerCase().includes("pilot")
      );
      return tl?.system?.value ?? 1;
    }
    if (threatMode === "automata") {
      const tl = actor.items.find(i =>
        i.type === "attribute" && i.name.toLowerCase().includes("automata")
      );
      return tl?.system?.value ?? 1;
    }
  }
  // Standard (PJ ou NPC agility) : 1d6 + agility
  const agiItem = actor.items.find(i =>
    i.type === "attribute" &&
    (i.name.toLowerCase().includes("agil") || i.system?.slug === "agility")
  );
  const agi = agiItem?.system?.value ?? 0;
  const die = Math.ceil(Math.random() * 6);
  return die + agi;
}

/**
 * Tire l'initiative pour tous les combatants et affiche une card de récap dans le chat.
 */
export async function drawInitiative(combat) {
  if (!game.user.isGM) return;
  const presetId = getPresetId();

  let updates;
  if (presetId === "eldritch-automata") {
    // EA : roll individuel pour chaque combatant
    updates = await Promise.all(
      combat.combatants.contents.map(async c => ({
        _id:        c.id,
        initiative: await rollInitiativeForCombatant(c),
      }))
    );
  } else {
    // SH/H! : deck sans remise
    const combatants = combat.combatants.contents;
    let deck = [];
    while (deck.length < combatants.length) {
      deck = [...deck, ...shuffle([1,2,3,4,5,6,7,8,9,10])];
    }
    updates = combatants.map((c, i) => ({ _id: c.id, initiative: deck[i] }));
  }

  await combat.updateEmbeddedDocuments("Combatant", updates);

  // Récupérer les combatants avec leur initiative dans l'ordre
  const sorted = [...combat.combatants.contents]
    .map(c => ({ name: c.name, init: updates.find(u => u._id === c.id)?.initiative ?? 0 }))
    .sort((a, b) => b.init - a.init);

  const rows = sorted.map(c =>
    `<div class="yze-initiative-row">
      <span class="yze-initiative-name">${c.name}</span>
      <span class="yze-initiative-value">${c.init}</span>
    </div>`
  ).join("");

  const presetLabel = presetId === "eldritch-automata" ? "Eldritch Automata"
    : presetId === "sleepy-hollow" ? "Sleepy Hollow"
    : presetId === "horror" ? "Horror!"
    : "Initiative";

  await ChatMessage.create({
    content: `<div class="yze-roll-result yze-preset-${presetId}">
      <div class="yze-roll-header">
        <span class="yze-roll-label">🎲 ${presetLabel} — Initiative</span>
      </div>
      <div class="yze-initiative-list" style="padding:6px 12px">
        ${rows}
      </div>
      <div style="padding:4px 12px;font-size:0.75em;opacity:0.5">
        ${presetId === "eldritch-automata" ? "1d6 + Agility / Threat Level" : "Cards 1–10 (no duplicates)"}
      </div>
    </div>`,
  });
}

/**
 * Distribution du deck 1-10 pour SH/H!
 * Appelé quand le combat démarre.
 */
export async function dealInitiativeDeck(combat) {
  const combatants = combat.combatants.contents;
  if (!combatants.length) return;

  // Générer assez de cartes (par tranches de 10)
  let deck = [];
  while (deck.length < combatants.length) {
    deck = [...deck, ...shuffle([1,2,3,4,5,6,7,8,9,10])];
  }

  const updates = combatants.map((c, i) => ({
    _id:        c.id,
    initiative: deck[i],
  }));
  await combat.updateEmbeddedDocuments("Combatant", updates);
}

// ── Fast/Slow Actions ───────────────────────────────────────────────

export async function toggleAction(combatant, actionType) {
  const current = combatant.getFlag(FLAG_SCOPE, actionType) ?? true;
  const newVal  = !current;
  await combatant.setFlag(FLAG_SCOPE, actionType, newVal);

  // Scrolling text
  const label = actionType === FLAG_SLOW ? "Slow Action" : "Fast Action";
  const sign  = newVal ? "+" : "−";
  await scrollText(combatant, `${sign} ${label}`);
}

export async function resetActions(combat) {
  const updates = combat.combatants.contents.map(c => ({
    _id:   c.id,
    flags: {
      [FLAG_SCOPE]: {
        [FLAG_SLOW]: true,
        [FLAG_FAST]: true,
      }
    }
  }));
  if (updates.length) {
    await combat.updateEmbeddedDocuments("Combatant", updates);
  }
}

// ── Drag & Drop initiative swap ─────────────────────────────────────

export async function swapInitiative(combatantA, combatantB) {
  const initA = combatantA.initiative;
  const initB = combatantB.initiative;
  if (initA === null || initB === null) return;

  const combat = combatantA.combat;
  if (!combat) return;

  await combat.updateEmbeddedDocuments("Combatant", [
    { _id: combatantA.id, initiative: initB },
    { _id: combatantB.id, initiative: initA },
  ]);

  // Chat notification
  const presetId = getPresetId();
  await ChatMessage.create({
    content: `<div class="yze-roll-result yze-preset-${presetId}" style="padding:8px 12px">
      🔀 <strong>${combatantA.name}</strong> (${initB}) ⇄ <strong>${combatantB.name}</strong> (${initA})
      <span style="font-size:0.8em;opacity:0.6;display:block">Initiative swapped by ${game.user.name}</span>
    </div>`,
  });
}

