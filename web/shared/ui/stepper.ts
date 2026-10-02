// The number stepper's behaviour (web/shared/markup/stepper.ts places its markup): a tap on − or +
// steps the hidden field's value by one, clamped to the bounds, writes it back (field and shown
// number) and hands the new value to the page, which dispatches its own intent; the paint writes
// the state's value and disables a button at its bound. The bounds are the page's (`StepperSpec`),
// the value the state's: nothing here is remembered.
import {
  listenId,
  readValue,
  requireId,
  setDisabled,
  setText,
  setValue,
  type DocumentLike,
} from '../edge/dom.ts';
import { stepperIds } from '../markup/stepper.ts';

export type StepperSpec = Readonly<{ id: string; min: number; max: number }>;

/** `value` moved by `delta`, kept in [min, max]; a value that is no number counts as `min`. */
export const stepped = (value: number, delta: number, spec: StepperSpec): number =>
  Math.min(spec.max, Math.max(spec.min, (Number.isFinite(value) ? value : spec.min) + delta));

/** The shown number, the field and the two buttons for `value` (clamped first). */
export const paintStepper = (doc: DocumentLike, spec: StepperSpec, value: number): void => {
  const ids = stepperIds(spec.id);
  const v = stepped(value, 0, spec);
  setText(requireId(doc, ids.num), String(v));
  setValue(requireId(doc, spec.id), String(v));
  setDisabled(requireId(doc, ids.dec), v <= spec.min);
  setDisabled(requireId(doc, ids.inc), v >= spec.max);
};

/** − and +: the field's value stepped, painted, and handed to `onChange` when it moved. */
export const bindStepper = (
  doc: DocumentLike,
  spec: StepperSpec,
  onChange: (value: number) => void,
): void => {
  const ids = stepperIds(spec.id);
  const step = (delta: number) => (): void => {
    const before = stepped(Number(readValue(requireId(doc, spec.id))), 0, spec);
    const after = stepped(before, delta, spec);
    paintStepper(doc, spec, after);
    if (after !== before) onChange(after);
  };
  listenId(doc, ids.dec, 'click', step(-1));
  listenId(doc, ids.inc, 'click', step(1));
};
