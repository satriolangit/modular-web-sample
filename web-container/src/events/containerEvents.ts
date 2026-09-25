export const containerEvents = {
  searchChanged: 'container.search.changed',
} as const;

export interface ContainerSearchPayload {
  query: string;
}
