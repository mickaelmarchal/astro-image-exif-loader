import type { Loader } from "astro/loaders";
import { z } from "astro/zod";
import type { ZodTypeAny } from "astro/zod";
import { exiftool } from "exiftool-vendored";
import { stat } from "fs/promises";
import { relative, extname, resolve as pathResolve, basename } from "path";
import { glob as tinyglob } from "tinyglobby";
import picomatch from "picomatch";
import type {
  ExifToolTagKeys,
  ExifPresets,
  NarrowedExifData,
  MaybeUndefinedSelected,
} from "./types.js";
import {
  FILESYSTEM_LEAKY_TAGS,
  EXIF_PRESET_MAPPINGS,
  buildImageData,
} from "./utils.js";

function determineTagsToExtract(
  presets: ExifPresets[] = [],
  tags: ExifToolTagKeys[]
): Set<ExifToolTagKeys> {
  const tagsSet = new Set<ExifToolTagKeys>();

  for (const preset of presets) {
    if (EXIF_PRESET_MAPPINGS[preset]) {
      for (const tag of EXIF_PRESET_MAPPINGS[preset]) {
        tagsSet.add(tag);
      }
    }
  }

  for (const tag of tags) {
    tagsSet.add(tag);
  }

  return tagsSet;
}

export interface ExifDirectoryOptions {
  pattern: string | string[];
  base?: string;
}

export interface ExifLoaderOptions {
  imagesDir?: ExifDirectoryOptions;
  extensions?: string[];
  presets?: ExifPresets[];
  tags?: ExifToolTagKeys[];
  excludeTags?: ExifToolTagKeys[];
  extractAll?: boolean;
  includeRawExif?: boolean;
}

export function createExifLoader(options: ExifLoaderOptions = {}): Loader {
  const {
    imagesDir = {
      pattern: "**/*",
      base: "src/content/images",
    } as ExifDirectoryOptions,
    presets = [],
    tags = [],
    excludeTags = [],
    extractAll = false,
    includeRawExif = false,
  } = options;

  const tagsToExtract = extractAll
    ? null
    : determineTagsToExtract(presets, tags);
  const excludeTagsSet = new Set([...FILESYSTEM_LEAKY_TAGS, ...excludeTags]);

  return {
    name: "exif-gallery-loader",
    load: async ({ store, logger, config, watcher, generateDigest }) => {
      // Resolve base directory (we now require imagesDir.base explicitly for clarity)
      const dirCfg = imagesDir as ExifDirectoryOptions;
      const basePath = pathResolve(
        config.root.pathname,
        dirCfg.base || "src/content/images"
      );

      // Compute patterns
      const patterns = Array.isArray(dirCfg.pattern)
        ? dirCfg.pattern
        : [dirCfg.pattern];
      logger.info(
        `Loading images with EXIF data from ${patterns.join(
          ", "
        )} (base: ${basePath})`
      );

      // Globbing for initial files
      try {
        const files: string[] = await tinyglob(patterns, {
          cwd: basePath,
          expandDirectories: false,
          onlyFiles: true,
        });

        if (files.length === 0) {
          const patternList = patterns.join(", ");
          const msg = [
            "No images found for astro-exif loader.",
            `  base: ${basePath}`,
            `  pattern(s): ${patternList}`,
            'Make sure imagesDir.base is relative to your project root (e.g. "src/content/images")',
            'and pattern matches your files (e.g. "**/*" or "**/*.{jpg,jpeg,png}").',
          ].join("\n");
          logger.error(msg);
        }

        for (const rel of files) {
          const abs = pathResolve(basePath, rel);
          await processImage(
            abs,
            store,
            logger,
            generateDigest,
            config.root.pathname,
            tagsToExtract,
            excludeTagsSet,
            includeRawExif,
            basePath
          );
        }
      } catch (error: any) {
        logger.error(`Error globbing files: ${error.message}`);
      }

      // Watch for file changes in dev mode
      if (watcher) {
        watcher.add(basePath);

        const isMatch = picomatch(patterns);

        const matches = (changed: string) => {
          const absChanged = pathResolve(changed);
          const absBase = pathResolve(basePath);
          const sep = "/";
          if (!(absChanged === absBase || absChanged.startsWith(absBase + sep)))
            return false;
          const rel = relative(basePath, changed);
          return isMatch(rel);
        };

        const onAddOrChange = async (filePath: string) => {
          if (!matches(filePath)) return;
          logger.info(`File updated: ${filePath}`);
          await processImage(
            filePath,
            store,
            logger,
            generateDigest,
            config.root.pathname,
            tagsToExtract,
            excludeTagsSet,
            includeRawExif,
            basePath
          );
        };

        watcher.on("add", onAddOrChange);
        watcher.on("change", onAddOrChange);
        watcher.on("unlink", (filePath: string) => {
          if (!matches(filePath)) return;
          const rel = relative(basePath, filePath);
          const id = rel.replace(extname(rel), "");
          store.delete(id);
          logger.info(`File removed: ${filePath}`);
        });
      }
    },
  };
}

async function processImage(
  filePath: string,
  store: any,
  logger: any,
  generateDigest: any,
  rootPath: string = "",
  tagsToExtract: Set<ExifToolTagKeys> | null,
  excludeTags: Set<ExifToolTagKeys>,
  includeRawExif: boolean,
  basePath?: string
) {
  try {
    // Always compute relative path from provided basePath (required) for uniqueness/importing
    const relFromBase = basePath
      ? relative(basePath, filePath).replace(/\\/g, "/")
      : relative(rootPath, filePath).replace(/\\/g, "/");
    // Determine if file is within the project's src directory for importer support
    const srcRoot = pathResolve(rootPath, "src");
    const insideSrc =
      filePath.startsWith(srcRoot + "/") || filePath === srcRoot;
    const srcPath = insideSrc
      ? relative(srcRoot, filePath).replace(/\\/g, "/")
      : ""; // blank when outside src so importer knows it's not importable
    const fileNameOnly = basename(relFromBase); // no path in the file name for users
    const id = relFromBase.replace(extname(relFromBase), "");

    // Check if file has changed using mtime
    const stats = await stat(filePath);
    const mtime = stats.mtime.toISOString();

    // Check existing entry
    const existingEntry = store.get(id);
    if (existingEntry && existingEntry.data.mtime === mtime) {
      // File hasn't changed, skip processing
      return;
    }

    logger.info(`Processing file: ${relFromBase}`);

    // Extract EXIF data using exiftool-vendored - let exiftool decide if it's supported
    let tags;
    try {
      tags = await exiftool.read(filePath);
    } catch (error: any) {
      const msg = `EXIF read failed for ${relFromBase}: ${error.message}`;
      logger.warn(msg);
      tags = {};
    }

    // Create image data object based on selected fields
    const imageData = buildImageData(
      tags,
      fileNameOnly,
      mtime,
      stats.size,
      tagsToExtract,
      excludeTags,
      includeRawExif
    );
    // Preserve full relative path for importing while exposing simple fileName
    imageData.srcPath = srcPath; // blank if outside src

    // Generate content digest
    const digest = generateDigest(imageData);

    // Store the entry with filePath that Astro can use for asset imports
    const success = store.set({
      id,
      data: imageData,
      digest,
      filePath: relative(rootPath, filePath),
    });

    if (success) {
      logger.info(
        `Processed ${relFromBase} (${imageData.width || "?"}x${
          imageData.height || "?"
        })`
      );
    } else {
      logger.debug(`Skipped ${relFromBase} (no changes)`);
    }
  } catch (error: any) {
    logger.error(`Failed to process image ${filePath}: ${error.message}`);
  }
}

// Build a Zod schema that matches the selected EXIF tags so Astro provides
// strong typing for `entry.data`. It's really just meant for the key being available in the IDE, TO DO decide if this should be the atual type from exiftool-vendored 
export function exifSchema<
  const TSel extends readonly ExifToolTagKeys[] | undefined = undefined,
  const PSel extends readonly ExifPresets[] | undefined = undefined
>(
  zod: typeof z,
  _options: Pick<ExifLoaderOptions, "includeRawExif"> = {}
): z.ZodObject<
  any,
  any,
  any,
  NarrowedExifData<MaybeUndefinedSelected<TSel, PSel>>
> {
  const scalar = zod.union([zod.string(), zod.number(), zod.boolean()]);
  const val = zod.union([scalar, scalar.array()]).nullable().optional();
  const base = zod
    .object({
      fileName: zod.string(),
      mtime: zod.string(),
      srcPath: zod.string().optional(),
      rawExif: zod.record(val).optional(),
    })
    .catchall(val);
  return base as unknown as z.ZodObject<
    any,
    any,
    any,
    NarrowedExifData<MaybeUndefinedSelected<TSel, PSel>>
  >;
}

// Convenience helper: one-liner to define a collection with the loader and matching schema
export interface ExifCollectionDefinition<S extends ZodTypeAny = ZodTypeAny> {
  loader: Loader;
  schema: S;
}

/**
 * Convenience helper to define an EXIF collection with loader and matching schema.
 * Provides type-safe EXIF data extraction with automatic TypeScript narrowing.
 *
 * Options:
 * - imagesDir: Configure directory scanning with pattern and base path
 * - presets: Use predefined EXIF tag groups like "camera", "exposure", "location"
 * - tags: Specify individual EXIF tags to extract
 * - extractAll: Extract all available EXIF data with full TypeScript support
 * - includeRawExif: Include complete unfiltered EXIF data in rawExif property
 * - excludeTags: Filter out specific tags like GPS coordinates for privacy
 *
 * Returns a collection definition with loader and schema for use in Astro content config.
 */
export function defineExifCollection<
  const TSel extends readonly ExifToolTagKeys[] | undefined = undefined,
  const PSel extends readonly ExifPresets[] | undefined = undefined,
  O extends Omit<ExifLoaderOptions, "tags" | "presets"> = Omit<
    ExifLoaderOptions,
    "tags" | "presets"
  >
>(
  options: O & { tags?: TSel; presets?: PSel } = {} as any
): ExifCollectionDefinition<
  z.ZodObject<
    any,
    any,
    any,
    NarrowedExifData<MaybeUndefinedSelected<TSel, PSel>>
  >
> {
  const loader = createExifLoader(options as unknown as ExifLoaderOptions);
  const schema = exifSchema<TSel, PSel>(z, options);
  return { loader, schema };
}
