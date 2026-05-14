/**
 * DataModels Actor pour Eldritch Automata.
 * Utilisés quand damageSystem = "custom" + activePreset = "eldritch-automata".
 * Foundry VTT V14
 */

const { fields } = foundry.data;

/** Champ réutilisable value / max. */
function resourceField() {
  return new fields.SchemaField({
    value:    new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
    max:      new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
    autoCalc: new fields.BooleanField({ required: false, initial: true }),
  });
}

export class EaCharacterModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      // ── Identité ─────────────────────────────────────────────────
      archetype: new fields.StringField({ required: false, initial: "" }),
      biography:     new fields.HTMLField({ required: false, initial: "" }),
      breakdownText: new fields.HTMLField({ required: false, initial: "" }),
      berserkText:   new fields.HTMLField({ required: false, initial: "" }),
      notes:     new fields.StringField({ required: false, initial: "" }),
      xp: new fields.SchemaField({
        total: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
        spent: new fields.NumberField({ required: true, initial: 0, min: 0, integer: true }),
      }),

      // ── Ressources Pilot ─────────────────────────────────────────
      // [CONFIRMÉ] Health = STR + AGI (calculé par DerivedStatsSystem)
      health: resourceField(),
      // [CONFIRMÉ] Stability = Wits, Breakdown à 0
      stability: resourceField(),
      // [CONFIRMÉ] Ego = Empathy, Berserk à 0
      ego: resourceField(),
      // [CONFIRMÉ] Stress : manuel, 0–10, non dérivé
      stress: new fields.NumberField({ required: true, initial: 0, min: 0, max: 10, integer: true }),

      // ── Ressources Automata ──────────────────────────────────────
      // [CONFIRMÉ] Durability = STR + AGI + 5
      durability: resourceField(),
      // [CONFIRMÉ] EgoField = max Ego, refresh après Shift de repos
      egoField: resourceField(),

      // ── Flags d'état EA ──────────────────────────────────────────
      // Lus par la feuille pour l'affichage conditionnel.
      // Modifiés par ea-mental-state.mjs (bloc 3).
      ea: new fields.SchemaField({
        inBreakdown:         new fields.BooleanField({ initial: false }),
        inBerserk:           new fields.BooleanField({ initial: false }),
        inAutomata:          new fields.BooleanField({ initial: true }),
        panicCascadeActive:  new fields.BooleanField({ initial: false }),
        pilotArchetypeId:    new fields.StringField({ initial: "" }),
        automataArchetypeId: new fields.StringField({ initial: "" }),
        chosenPilotArray:    new fields.ObjectField({ required: false, nullable: true, initial: null }),
        chosenAutomataArray: new fields.ObjectField({ required: false, nullable: true, initial: null }),
      }),

      // ── Champ générique DerivedStatsSystem ───────────────────────
      derived: new fields.ObjectField({ required: false, initial: {} }),
    };
  }

  /** [CONFIRMÉ] Pilot Broken = Health à 0. */
  get isPilotBroken()    { return this.health.value    <= 0; }

  /** [CONFIRMÉ] Automata Broken = Durability à 0. */
  get isAutomataBroken() { return this.durability.value <= 0; }

  static migrateData(source) {
    return super.migrateData(source);
  }
}

/**
 * DataModel NPC pour EA.
 * [CONFIRMÉ] Les ennemis ont Health et EgoField.
 * [TODO] Les Horrors ont-ils Stability/Ego ? Non confirmé dans le Preview fourni.
 */
export class EaNpcModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      archetype:   new fields.StringField({ required: false, initial: "" }),
      // "standard" = Agility roll, "pilot" = Threat Level Pilot, "automata" = Threat Level Automata
      threatMode:  new fields.StringField({ required: false, initial: "standard" }),
      description: new fields.HTMLField({ required: false, initial: "" }),
      health:      resourceField(),
      egoField:    resourceField(),
      derived:     new fields.ObjectField({ required: false, initial: {} }),
    };
  }
}
