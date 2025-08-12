// Main exports
export {
  createExifLoader,
  exifSchema,
  defineExifCollection,
} from "./loader.js";
export { default as imageImporter } from "./importer.js";

// Re-export types
export type { ExifLoaderOptions } from "./loader.js";
export type { ExifToolTagKeys, ExifPresets } from "./types.js";
// Importer is a plain module; no integration types
export type * from "./types.js";
export { exifTags } from "./types.js";
