import { z } from 'zod';

export const IMAGE_SEARCH_PER_PAGE = 15;
export const IMAGE_SEARCH_MAX_PAGE = 50;
export const IMAGE_SEARCH_KEYWORD_MAX_LENGTH = 100;

export const imageSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'キーワードを入力してください')
    .max(IMAGE_SEARCH_KEYWORD_MAX_LENGTH, 'キーワードが長すぎます'),
  page: z.coerce
    .number()
    .int('page は整数で指定してください')
    .min(1, 'page は 1 以上で指定してください')
    .max(IMAGE_SEARCH_MAX_PAGE, `page は ${IMAGE_SEARCH_MAX_PAGE} 以下で指定してください`)
    .optional(),
});

export type ImageSearchQuery = z.infer<typeof imageSearchQuerySchema>;

export const SUPPORTED_IMAGE_SEARCH_PROVIDERS = ['pexels'] as const;
export type ImageSearchProviderId = (typeof SUPPORTED_IMAGE_SEARCH_PROVIDERS)[number];

export const imageSearchAttributionSchema = z.object({
  photographer: z.string().min(1),
  photographerUrl: z.string().url(),
  sourceUrl: z.string().url(),
});

export const imageSearchResultSchema = z.object({
  id: z.string().min(1),
  thumbnailUrl: z.string().url(),
  imageUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string(),
  provider: z.enum(SUPPORTED_IMAGE_SEARCH_PROVIDERS),
  attribution: imageSearchAttributionSchema,
});

export type ImageSearchResult = z.infer<typeof imageSearchResultSchema>;

export const imageSearchResponseSchema = z.object({
  results: z.array(imageSearchResultSchema),
  page: z.number().int().min(1),
  hasNextPage: z.boolean(),
  provider: z.enum(SUPPORTED_IMAGE_SEARCH_PROVIDERS),
});

export type ImageSearchResponse = z.infer<typeof imageSearchResponseSchema>;

export const imageSearchErrorResponseSchema = z.object({
  error: z.string().min(1),
});

export type ImageSearchErrorResponse = z.infer<typeof imageSearchErrorResponseSchema>;
