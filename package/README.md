# Astro Image EXIF Loader

An Astro content collection loader that extracts EXIF metadata from images using exiftool-vendored, with optional Astro Assets integration for displaying the actual images.

## What it does

This package provides two main functions:

1. **Loader**: Creates an Astro content collection from your images and extracts EXIF metadata into structured data
2. **Importer**: Optionally enhances the collection entries with Astro Assets imports so you can display the actual images

The loader returns an array of EXIF data for each image. If you want to display the actual images using Astro's `<Image>` component, use the importer which adds a `src` property to each entry.

## Quick Start

### 1. Create a content collection with EXIF data

Configure your collection in `src/content.config.ts`:

```typescript
import { defineCollection } from "astro:content";
import { defineExifCollection } from "astro-image-exif-loader";

const images = defineCollection(
  defineExifCollection({
    imagesDir: { pattern: "**/*", base: "src/content/images" },
    presets: ["basic", "location"], // or use `tags` for specific fields
  }),
);

export const collections = { images };
```

### 2. Use the data in your pages

**Option A: Just EXIF data (no image display)**

```astro
---
// src/pages/gallery-data.astro
import { getCollection } from 'astro:content';

const images = await getCollection('images');
---

{images.map(image => (
  <div>
    <h3>{image.data.fileName}</h3>
    <p>Camera: {image.data.Make} {image.data.Model}</p>
    <p>ISO: {image.data.ISO}</p>
  </div>
))}
```

**Option B: EXIF data + actual images**

```ts
---
import { getCollection } from 'astro:content';
import { Image } from 'astro:assets';
import imageImporter from 'astro-image-exif-loader/importer';

const images = await imageImporter(await getCollection('images'));
---

{images.map(image => (
  <div>
    {image.defaultImport && <Image src={image.defaultImport} alt="" width={400} />}
    <p>Camera: {image.data.Make} {image.data.Model}</p>
    <p>ISO: {image.data.ISO}</p>
  </div>
))}
```

### Image Patterns

Configure where your images are located:

```typescript
defineExifCollection({
  imagesDir: {
    pattern: "**/*.{jpg,jpeg,png,tiff}",
    base: "src/content/photos",
  },
});
```

### Pattern Restrictions

**For the Loader (EXIF extraction)**: No restrictions - any valid glob pattern works

**For the Importer (Astro Assets)**: Must be under `/src/` due to Vite limitations

### `defineExifCollection(options)`

Creates a complete collection definition with both loader and schema.

**Options:**

- `imagesDir.pattern`: Glob pattern for matching images (default: `'**/*'`)
- `imagesDir.base`: Base directory path (default: `'src/content/images'`)
- `presets`: Array of preset groups to extract
- `tags`: Array of specific EXIF tag names to extract
- `extractAll`: Boolean to extract all available EXIF data
- `includeRawExif`: Boolean to include raw EXIF object (default: false)
