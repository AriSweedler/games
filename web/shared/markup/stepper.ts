// The shell's number stepper (the owner, 2026-10-02: "the player choice should not be a dropdown
// but a number with - and + buttons on the side so you can increase and decrease"): the markup a
// game's page.ts places in its host card and its pass-and-play panel, one per count it asks for.
// The hidden input `#<id>` is the form value the page's start options read (`readValue`), the
// `output` shows it, and the two buttons step it between `min` and `max` (web/shared/ui/stepper.ts
// binds and paints them). Each button is a 44px target (shell.css `.stepper-btn`). Pure: a string.

/** One stepper: the hidden field's id (its parts are `<id>Dec`, `<id>Num`, `<id>Inc`), its label, its bounds and its first value. */
export type StepperMarkup = Readonly<{
  id: string;
  label: string;
  min: number;
  max: number;
  value: number;
  /** What the count is of, for the buttons' labels ("Fewer players", "More players"). */
  noun: string;
}>;

/** The parts' ids for the field `id`. */
export const stepperIds = (id: string): Readonly<{ dec: string; num: string; inc: string }> => ({
  dec: `${id}Dec`,
  num: `${id}Num`,
  inc: `${id}Inc`,
});

/** The stepper's markup, every line prefixed with `indent`. */
export const stepperHtml = (s: StepperMarkup, indent = ''): string => {
  const ids = stepperIds(s.id);
  const n = String(s.value);
  return [
    `<div class="stepper" data-min="${String(s.min)}" data-max="${String(s.max)}">`,
    `  <span class="stepper-label">${s.label}</span>`,
    `  <div class="stepper-row">`,
    `    <button type="button" class="stepper-btn" id="${ids.dec}" aria-label="Fewer ${s.noun}"${s.value <= s.min ? ' disabled' : ''}>−</button>`,
    `    <output class="stepper-num" id="${ids.num}" aria-live="polite">${n}</output>`,
    `    <button type="button" class="stepper-btn" id="${ids.inc}" aria-label="More ${s.noun}"${s.value >= s.max ? ' disabled' : ''}>+</button>`,
    `  </div>`,
    `  <input type="hidden" id="${s.id}" value="${n}" />`,
    `</div>`,
  ]
    .map((line) => `${indent}${line}`)
    .join('\n');
};
