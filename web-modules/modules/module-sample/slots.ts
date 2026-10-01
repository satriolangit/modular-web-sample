export const sampleSlots = {
  overviewPanel: 'module-sample.overviewPanel',
} as const;

export type SampleSlotName = (typeof sampleSlots)[keyof typeof sampleSlots];
