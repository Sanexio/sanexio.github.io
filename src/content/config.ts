import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    organs: z.array(z.enum(['herz-male', 'leber-male', 'niere-male', 'lunge-male', 'carotis-left', 'schilddruese-spl-manix'])).default([]),
    description: z.string(),
    pubDate: z.coerce.date(),
    stagingNote: z.string(),
    /** Optional link to `dht-phases.ts` id */
    dhtPhaseId: z.enum(['sebana', 'bloody-check', 'health-graph', 'juvantis']).optional(),
  }),
});

export const collections = { blog };
