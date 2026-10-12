// IAM's rule for a Key's name, as the key widget counts it: at most 32 characters. A mirror of
// `keyNameLength` (src/domains/iam/iam.ts), which sits outside IAM's door: HEX-115 puts the rule at its
// door, and this file goes, the widget reading it there as Mapping's `previewLimit` is read
// (hexframe-app-design-system-v1/decisions.md, in .run/registers/). IAM still says no on the field.

/** The most characters a Key's name holds. */
export const nameLimit = 32
