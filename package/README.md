# Astro Image EXIF Loader

An Astro content collection loader that extracts EXIF metadata from images using exiftool-vendored.

## What it does

This package provides two main functions:

1. **Loader**: Creates an Astro content collection from your images and extracts EXIF metadata. Each entry's `id` is the filename with extension (e.g., "photo.jpg").
2. **Importer**: Extends the collection entries with a `entry.defaultImport` property, which includes the actual import of the image for use with Astro Image Optimization. Only works for images under `/src/`. Optional.

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

**Just EXIF data**

```astro
---
import { getCollection, getEntry } from 'astro:content';

const imageData = await getCollection('images');
const filenameData = await getEntry("images", "filename.jpg");
---

{imageData.map(datum => (
  <div>
    <h3>{datum.data.fileName}</h3>
    <p>Camera: {datum.data.Make} {datum.data.Model}</p>
    <p>ISO: {datum.data.ISO}</p>
  </div>
))}
```

**EXIF data + Astro image optimization**

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
- `excludeTags`: Array of EXIF tag names to exclude from presets/tags
- `extractAll`: Boolean to extract all available EXIF data
- `includeRawExif`: Boolean to include raw EXIF object (default: false)

You can combine `presets` and `tags` together. Use `excludeTags` to remove specific tags from presets:

```typescript
defineExifCollection({
  presets: ["camera", "exposure"],
  tags: ["GPSAltitude"],
  excludeTags: ["Make"],
});
```

### Available Preset Tags

**`basic`**:

- `FileSize`
- `ImageWidth`
- `ImageHeight`

**`camera`**:

- `Make`, `Model`
- `LensModel`, `Lens`, `LensID`, `LensInfo`
- `LensSerialNumber`, `SerialNumber`, `BodySerialNumber`, `CameraSerialNumber`
- `LensMake`, `MaxAperture`, `MinFocalLength`, `MaxFocalLength`

**`exposure`**:

- `ISO`, `FNumber`
- `ExposureTime`, `ShutterSpeed`
- `FocalLength`, `FocalLengthIn35mmFormat`
- `Flash`, `WhiteBalance`, `ExposureMode`, `MeteringMode`

**`datetime`**:

- `DateTimeOriginal`, `CreateDate`, `DateTime`

**`location`**:

- `GPSLatitude`, `GPSLongitude`, `GPSAltitude`
- `Country`, `State`, `City`, `Location`, `Sub-location`
- `GPSAreaInformation`, `Country-PrimaryLocationCode`, `Province-State`

**`technical`**:

- `ColorSpace`, `Orientation`, `Software`
- `SceneType`, `SceneCaptureType`

**`metadata`**:

- `Artist`, `Copyright`, `ImageDescription`
- `Keywords`, `Title`, `Subject`
