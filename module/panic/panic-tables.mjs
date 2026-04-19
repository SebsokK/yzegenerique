/**
 * panic-tables.mjs — données des tables de panique.
 *
 * Format entries : { range: [min, max], text: "...", name: "..." }
 * range = [inclusive min, inclusive max] du résultat D6 + Stress Level.
 *
 * Foundry VTT V14
 */

// ── Sleepy Hollow — D6 + Stress Level ─────────────────────────────
export const SH_PANIC_TABLE = {
  name:        "Sleepy Hollow — Panic",
  description: "Roll D6 + Stress Level. Triggered when a bane appears on a Stress Die.",
  formula:     "1d6",
  entries: [
    { range: [1,  6],  name: "Keeping it Together", text: "<strong>Keeping it Together.</strong> You manage to keep your nerves in check. Barely." },
    { range: [7,  7],  name: "Nervous Twitch",       text: "<strong>Nervous Twitch.</strong> You and all PCs in Short range gain a Stress point." },
    { range: [8,  8],  name: "Trembling",             text: "<strong>Trembling.</strong> You tremble uncontrollably. All skill rolls using Agility suffer a −2 modifier." },
    { range: [9,  9],  name: "Drop Item",             text: "<strong>Drop Item.</strong> You drop a weapon or other important item — the GM decides which one." },
    { range: [10, 10], name: "Freeze",                text: "<strong>Freeze.</strong> You're frozen by fear or stress for one round, losing your next turn." },
    { range: [11, 11], name: "Seek Cover",            text: "<strong>Seek Cover.</strong> You must use your next action to move away from danger and find a safe spot. If you have an enemy at Engaged range you must make a retreat roll. You lose one Stress point, but all other PCs in Short range gain one Stress point. After one round, you can act normally." },
    { range: [12, 12], name: "Scream",                text: "<strong>Scream.</strong> You scream for one round, losing your next turn. You lose one Stress point, but every PC who hears your scream must make an immediate Panic Roll." },
    { range: [13, 13], name: "Flee",                  text: "<strong>Flee.</strong> You must flee to a safe place and refuse to leave it. You won't attack anyone and won't attempt anything dangerous. You lose one Stress point, but every PC who sees you flee must make an immediate Panic Roll." },
    { range: [14, 14], name: "Berserk",               text: "<strong>Berserk.</strong> You must immediately attack the nearest person or creature, friendly or not. You won't stop until you or the target is broken. Every PC who witnesses your rampage must make an immediate Panic Roll." },
    { range: [15, 99], name: "Catatonic",             text: "<strong>Catatonic.</strong> You collapse to the floor and can't talk or move, staring blankly into oblivion." },
  ],
};

// ── Eldritch Automata — D6 + Stress Level ─────────────────────────
export const EA_PANIC_TABLE = {
  name:        "Eldritch Automata — Panic",
  description: "Roll D6 + Stress Level. Triggered when a bane appears on a Stress Die.",
  formula:     "1d6",
  entries: [
    { range: [1,  6],  name: "Stable",         text: "<strong>Stable.</strong> You are keeping it together." },
    { range: [7,  7],  name: "Trembling",       text: "<strong>Trembling.</strong> You start to tremble. Modification −1 to all rolls for Agility for the rest of the scene." },
    { range: [8,  8],  name: "Anxious",         text: "<strong>Anxious.</strong> <em>Stability</em> reduces by 1." },
    { range: [9,  9],  name: "Sullen",          text: "<strong>Sullen.</strong> <em>Ego</em> reduces by 1." },
    { range: [10, 10], name: "Shaking",         text: "<strong>Shaking.</strong> The fear is starting to get to you. The Stress Level of yourself and all of your friendly PCs in <em>Short</em> Range of you, increase by 1." },
    { range: [11, 11], name: "Freeze Up",       text: "<strong>Freeze Up.</strong> You tense up in fear, losing your next <em>Slow</em> Action. Your Stress Level and all other friendly PCs in <em>Short</em> Range of you, increase by 1." },
    { range: [12, 12], name: "Scream",          text: "<strong>Scream.</strong> You scream for 1 Round, losing your next <em>Slow</em> Action. Your Stress is reduced by 1, but every friendly character who hears your screams must roll for <strong>Panic</strong>." },
    { range: [13, 13], name: "Run Away",        text: "<strong>Run Away.</strong> You can't do this anymore, you have to run. You must flee from danger until you are in what is deemed a safe place. You do not roll a retreat roll. Your <em>Stress</em> Level is decreased by 1 but all other friendly PCs roll <strong>Panic</strong>." },
    { range: [14, 14], name: "Hallucinations", text: "<strong>Hallucinations.</strong> You are suffering from powerful hallucinations and are unsure what is real or not. The GM determines the details. Reduce your <em>Stability</em> and <em>Ego</em> by 1." },
    { range: [15, 15], name: "Berserk",         text: "<strong>Berserk.</strong> Your fight or flight response kicks in, and you can't fly. You immediately enter your <em>Berserk</em> state if you're piloting an Automata. If you are not, you become Enraged, attacking the nearest thing near you until you are subdued. Reduce your <em>Stability</em> by 1." },
    { range: [16, 99], name: "BSOD",            text: "<strong>BSOD.</strong> Your mind needs to go away for a second. You stare off into space, not able to speak or move or take any action. Only by someone taking a <em>Slow</em> Action to physically shake and call out to you can you return. Reduce your <em>Stability</em> by 1." },
  ],
};

/**
 * Crée ou met à jour une RollTable dans le world à partir des données ci-dessus.
 * Appelé à "ready" si la table n'existe pas encore.
 *
 * @param {object} tableData — SH_PANIC_TABLE ou EA_PANIC_TABLE
 * @returns {Promise<RollTable>}
 */
export async function ensurePanicTable(tableData) {
  if (!game.user.isGM) return null;

  // Ne pas recréer si elle existe déjà
  const existing = game.tables.find(t => t.name === tableData.name);
  if (existing) return existing;

  const results = tableData.entries.map((e, i) => ({
    type:               "text",   // V14 : chaîne, pas entier
    text:               e.text,
    name:               e.name,
    range:              e.range,
    drawn:              false,
    weight:             e.range[1] - e.range[0] + 1,
    documentCollection: "",
    documentId:         null,
    img:                "icons/svg/d20-black.svg",
    _id:                foundry.utils.randomID(),
  }));

  const table = await RollTable.create({
    name:        tableData.name,
    description: tableData.description,
    formula:     tableData.formula,
    replacement: true,
    displayRoll: true,
    results,
  });

  console.log(`YZE | Panic table "${tableData.name}" created in world.`);
  return table;
}
