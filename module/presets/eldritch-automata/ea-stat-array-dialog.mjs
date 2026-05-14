/**
 * EaStatArrayDialog — Pop-up skinnée EA pour choisir un stat array
 * lors du drop d'un archétype Pilot ou Automata sur une fiche.
 */

export class EaStatArrayDialog extends Dialog {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes:  ["dialog", "ea-dialog"],
      width:    420,
      height:   "auto",
    });
  }

  /**
   * Ouvre la dialog et retourne le stat array choisi, ou null si annulé.
   * @param {string} archetypeName
   * @param {string} archetypeType  "pilot" | "automata"
   * @param {{strength,agility,wits,empathy}} arrayA
   * @param {{strength,agility,wits,empathy}} arrayB
   * @param {boolean} hasExistingStats - true si l'actor a déjà des attributs modifiés
   * @returns {Promise<{array: object, confirmed: boolean} | null>}
   */
  static async prompt({ archetypeName, archetypeType, arrayA, arrayB, hasExistingStats }) {

    const label = (arr) =>
      `STR ${arr.strength} | AGI ${arr.agility} | WIT ${arr.wits} | EMP ${arr.empathy}`;

    const warning = hasExistingStats
      ? `<div class="ea-dialog-warning">
          ⚠ This actor already has modified attributes.
          Choosing a stat array will <strong>overwrite</strong> those values.
         </div>`
      : "";

    const content = `
      <div class="ea-dialog-body">
        <p class="ea-dialog-intro">
          <strong>${archetypeName}</strong> offers two stat arrays.
          Choose the one that fits your character concept.
        </p>
        ${warning}
        <div class="ea-array-choices">
          <button type="button" class="ea-array-btn" data-array="A">
            <span class="ea-array-label">Array A</span>
            <span class="ea-array-stats">${label(arrayA)}</span>
          </button>
          <button type="button" class="ea-array-btn" data-array="B">
            <span class="ea-array-label">Array B</span>
            <span class="ea-array-stats">${label(arrayB)}</span>
          </button>
        </div>
      </div>`;

    return new Promise(resolve => {
      new EaStatArrayDialog({
        title:   `${archetypeType === "pilot" ? "🧑 Pilot" : "🤖 Automata"} Archetype — ${archetypeName}`,
        content,
        buttons: {
          cancel: { label: "Cancel", callback: () => resolve(null) },
        },
        default: "cancel",
        close:   () => resolve(null),
        render:  (html) => {
          html.find(".ea-array-btn").on("click", (ev) => {
            const choice = ev.currentTarget.dataset.array;
            resolve({ array: choice === "A" ? arrayA : arrayB, confirmed: true });
            // Fermer le dialog
            html.closest(".dialog").find(".dialog-button.cancel").trigger("click");
          });
        },
      }).render(true);
    });
  }
}
