// Where an interaction the list reads as outside it landed: in the field it suggests for, a click there
// being the user typing on or moving the caret, never a click away that ends the search. Pure.

/** Whether `target`, where an interaction landed, is the field or inside it; never without a field. */
export const inField = (field: Node | null, target: EventTarget | null): boolean =>
  target instanceof Node && field?.contains(target) === true
