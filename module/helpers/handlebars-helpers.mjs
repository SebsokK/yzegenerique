/**
 * registerHandlebarsHelpers — helpers Handlebars utilitaires.
 * Foundry VTT V14
 */

export function registerHandlebarsHelpers() {
  Handlebars.registerHelper("eq",  (a, b) => a === b);
  Handlebars.registerHelper("neq", (a, b) => a !== b);
  Handlebars.registerHelper("gt",  (a, b) => a > b);
  Handlebars.registerHelper("gte", (a, b) => a >= b);
  Handlebars.registerHelper("lt",  (a, b) => a < b);
  Handlebars.registerHelper("lte", (a, b) => a <= b);
  Handlebars.registerHelper("and", (a, b) => Boolean(a && b));
  Handlebars.registerHelper("or",  (a, b) => Boolean(a || b));
  Handlebars.registerHelper("not", (a)    => !a);

  // Utilitaire pour afficher une valeur avec un fallback
  Handlebars.registerHelper("default", (value, fallback) =>
    (value !== undefined && value !== null && value !== "") ? value : fallback
  );
}
