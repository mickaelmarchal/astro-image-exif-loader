import { defineCollection } from "astro:content";
import { defineExifCollection } from "astro-image-exif-loader";

const images = defineCollection(
  defineExifCollection({
    imagesDir: { pattern: "**/*", base: "src/content/images" },
    // Use the new presets and tags API
    // presets: ["camera"],
    // Or use specific tags for type safety:
    extractAll: true,
    // includeRawExif: true,
  })
);

export const collections = {
  images,
};
