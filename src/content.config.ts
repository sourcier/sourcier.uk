import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const posts = defineCollection({
  loader: glob({
    pattern: ["**/*.md", "!README.md"],
    base: "./collections/posts",
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      subTitle: z.string().optional(),
      description: z.string(),
      pubDate: z.coerce.date(),
      author: z.string(),
      cover: z
        .object({
          image: image(),
          alt: z.string(),
          thumbnail: z.string().optional(),
          // Where the subject sits in the source image (0-1, from top-left), so
          // card/hero/OG crops can derive object-position without re-guessing it.
          focalPoint: z
            .object({
              x: z.number().min(0).max(1),
              y: z.number().min(0).max(1),
            })
            .optional(),
          cropIntent: z
            .enum(["subject-center", "top-weighted", "wide-context"])
            .optional(),
        })
        .optional(),
      tags: z.array(z.string()),
      draft: z.boolean().default(false),
      history: z
        .array(
          z.object({
            datetime: z.coerce.date(),
            note: z.string(),
          }),
        )
        .optional(),
      credits: z
        .array(
          z.object({
            label: z.string(),
            text: z.string(),
            url: z.string().url().optional(),
          }),
        )
        .optional(),
    }),
});

export const collections = { posts };
