export const sampleModals = {
  info: 'module-sample.info',
} as const;

export type SampleModalName = (typeof sampleModals)[keyof typeof sampleModals];

export interface SampleInfoModalPayload {
  title: string;
  message: string;
}
