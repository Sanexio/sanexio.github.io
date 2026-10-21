import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    stagingNote: z.string(),
    /** Optional link to `dht-phases.ts` id */
    dhtPhaseId: z.enum(['sebana', 'bloody-check', 'health-graph', 'juvantis']).optional(),
  }),
});

export const collections = { blog };
