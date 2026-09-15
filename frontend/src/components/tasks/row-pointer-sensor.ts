import { PointerSensor } from "@dnd-kit/core";

/**
 * A pointer sensor for rows that can be picked up from ANYWHERE on the card,
 * not only by the grip.
 *
 * Grabbing a whole card is what people expect from a Jira backlog or a Trello
 * list, and a 20px grip is a small target to aim for across a long list. What
 * keeps a whole-card drag from eating clicks is the sensor's `distance`
 * constraint (set where it is used): a press that does not move 6px is a click,
 * so the title still opens the drawer and the checkbox still ticks.
 *
 * WHAT MAY NOT START A DRAG is the one thing added here. The row's popovers —
 * the story-points buttons, the ⋯ menu, a listbox — render as DOM children of
 * the row even though they paint in the top layer, so a press inside one would
 * otherwise bubble up and a slightly unsteady click on "5" would pick the whole
 * task up. Text fields are excluded for the same reason: selecting text is a drag
 * of its own.
 *
 * Keyboard dragging is unchanged and stays on the grip, which is the row's
 * activator node — `KeyboardSensor` only starts from that element, so Space on
 * the focused title button still opens it.
 */
const NO_DRAG = 'input, textarea, select, [contenteditable="true"], [role="menu"], [role="dialog"], [role="listbox"], [data-no-dnd]';

export class RowPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event }: { nativeEvent: PointerEvent }) =>
        event.isPrimary && event.button === 0 && !(event.target as Element | null)?.closest?.(NO_DRAG),
    },
  ];
}
