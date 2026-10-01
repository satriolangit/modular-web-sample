export const sampleEvents = {
  postCreated: 'module-sample.sample.postCreated',
} as const;

export type SampleEventName = (typeof sampleEvents)[keyof typeof sampleEvents];

export interface SamplePostCreatedPayload {
  id: number;
  title: string;
}
