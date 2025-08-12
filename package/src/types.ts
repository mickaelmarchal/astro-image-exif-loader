import type { Tags } from "exiftool-vendored";

// Type-safe EXIF field keys based on exiftool-vendored Tags interface
export type ExifToolTagKeys = keyof Tags;

// Predefined presets for common use cases
export type ExifPresets =
  | "location"
  | "camera"
  | "exposure"
  | "datetime"
  | "technical"
  | "metadata"
  | "basic";

// Type-level preset-to-tag mapping to enable type narrowing when presets are provided
// This mirrors EXIF_PRESET_MAPPINGS but as a type, intersected with ExifToolTagKeys for safety.
export type ExifPresetTagMap = {
  basic: Extract<ExifToolTagKeys, "FileSize" | "ImageWidth" | "ImageHeight">;
  camera: Extract<
    ExifToolTagKeys,
    | "Make"
    | "Model"
    | "LensModel"
    | "Lens"
    | "LensID"
    | "LensInfo"
    | "LensSerialNumber"
    | "SerialNumber"
    | "BodySerialNumber"
    | "CameraSerialNumber"
    | "LensMake"
    | "LensSpecification"
    | "MaxAperture"
    | "MinFocalLength"
    | "MaxFocalLength"
  >;
  exposure: Extract<
    ExifToolTagKeys,
    | "ISO"
    | "FNumber"
    | "ExposureTime"
    | "ShutterSpeed"
    | "FocalLength"
    | "FocalLengthIn35mmFormat"
    | "Flash"
    | "WhiteBalance"
    | "ExposureMode"
    | "MeteringMode"
  >;
  datetime: Extract<
    ExifToolTagKeys,
    "DateTimeOriginal" | "CreateDate" | "DateTime"
  >;
  location: Extract<
    ExifToolTagKeys,
    | "GPSLatitude"
    | "GPSLongitude"
    | "GPSAltitude"
    | "Country"
    | "State"
    | "City"
    | "Location"
    | "Sub-location"
    | "GPSAreaInformation"
    | "Country-PrimaryLocationCode"
    | "Province-State"
  >;
  technical: Extract<
    ExifToolTagKeys,
    "ColorSpace" | "Orientation" | "Software" | "SceneType" | "SceneCaptureType"
  >;
  metadata: Extract<
    ExifToolTagKeys,
    | "Artist"
    | "Copyright"
    | "ImageDescription"
    | "Keywords"
    | "Title"
    | "Subject"
  >;
};

// Compute the union of tag keys for a set of presets
export type PresetsToTagUnion<PSel extends readonly ExifPresets[] | undefined> =
  PSel extends readonly ExifPresets[] ? ExifPresetTagMap[PSel[number]] : never;

// Combine explicit tags[] and presets[] selections into an element type for a readonly array
export type CombinedSelectedTagElement<
  TSel extends readonly ExifToolTagKeys[] | undefined,
  PSel extends readonly ExifPresets[] | undefined,
> =
  | (TSel extends readonly ExifToolTagKeys[] ? TSel[number] : never)
  | PresetsToTagUnion<PSel>;

// If neither tags nor presets are provided, keep undefined to preserve the wide output type
export type MaybeUndefinedSelected<
  TSel extends readonly ExifToolTagKeys[] | undefined,
  PSel extends readonly ExifPresets[] | undefined,
> = [TSel] extends [undefined]
  ? [PSel] extends [undefined]
    ? undefined
    : ReadonlyArray<CombinedSelectedTagElement<TSel, PSel>>
  : ReadonlyArray<CombinedSelectedTagElement<TSel, PSel>>;

// EXIF data structure types
export interface ExifLocation {
  coordinates: {
    latitude: number;
    longitude: number;
    altitude: number | null;
  } | null;
  country: string | null;
  state: string | null;
  city: string | null;
  location: string | null;
  sublocation: string | null;
  gpsAreaInformation: string | null;
  countryCode: string | null;
  provinceState: string | null;
}

export interface ExifMetadata {
  artist: string | null;
  copyright: string | null;
  description: string | null;
  keywords: string | string[] | null;
  rating: number | null;
  title: string | null;
  subject: string | string[] | null;
}

// Base EXIF data interface - always includes these fields
export interface BaseExifData {
  fileName: string;
  mtime: string;
}

// Optional field interfaces
export interface BasicExifData {
  fileSize: number;
  width: number | null;
  height: number | null;
}

export interface CameraExifData {
  make: string | null;
  model: string | null;
  lens: string | null;
}

export interface ExposureExifData {
  iso: number | string | null;
  aperture: number | string | null;
  shutterSpeed: number | string | null;
  focalLength: number | string | null;
  focalLength35mm: number | string | null;
  flash: number | string | null;
  whiteBalance: number | string | null;
  exposureMode: number | string | null;
  meteringMode: number | string | null;
}

export interface DateTimeExifData {
  dateTime: string | null;
}

export interface LocationExifData {
  location: ExifLocation;
}

export interface TechnicalExifData {
  colorSpace: number | string | null;
  orientation: number | string | null;
  quality: number | string | null;
  software: string | null;
  sceneMode: number | string | null;
}

export interface MetadataExifData {
  metadata: ExifMetadata;
}

export interface RawExifData {
  rawExif: ExifMetadata;
}

// Complete EXIF data type (all fields included)
export interface CompleteExifData
  extends BaseExifData,
    BasicExifData,
    CameraExifData,
    ExposureExifData,
    DateTimeExifData,
    LocationExifData,
    TechnicalExifData,
    MetadataExifData {}

// Utility type to build EXIF data based on field options
export type ExifData<T extends Record<string, boolean | undefined>> =
  BaseExifData &
    (T["basic"] extends false ? {} : BasicExifData) &
    (T["camera"] extends true ? CameraExifData : {}) &
    (T["exposure"] extends true ? ExposureExifData : {}) &
    (T["datetime"] extends true ? DateTimeExifData : {}) &
    (T["location"] extends true ? LocationExifData : {}) &
    (T["technical"] extends true ? TechnicalExifData : {}) &
    (T["metadata"] extends true ? MetadataExifData : {});

// Enhanced collection entry with image source
export interface ImportedExifCollectionEntry<T = any> {
  id: string;
  collection: string;
  data: T;
  defaultImport: import("astro").ImageMetadata | null;
}
// Runtime serialization shape for tag values (mirrors logic in toSerializable)
export type SerializableValue<T> = T extends Date
  ? string
  : T extends { toDate(): any }
    ? string
    : T extends (infer U)[]
      ? SerializableValue<U>[]
      : T extends { num: number; den: number }
        ? number
        : T extends string | number | boolean
          ? T
          : string | number | boolean | null;

// All EXIF tags (optional) mapped to their serialized output type
export type AllSerializedExifTags = {
  [K in ExifToolTagKeys]?: SerializableValue<Tags[K]> | null | undefined;
};

// Base fields always present + optional common convenience fields user may expect
export interface BaseAlwaysFields {
  fileName: string;
  mtime: string;
  FileSize?: number; // we ensure this gets set when requested or needed
  // Path relative to the project src root (e.g. "content/images/photo.jpg") for importing
  // Optional: present only when the image is inside the project's /src directory
  srcPath?: string;
}

export type UniversalExifData = BaseAlwaysFields & AllSerializedExifTags;
// Raw EXIF shape used in output when includeRawExif is enabled
export type RawExifShape = {
  rawExif?: Record<
    string,
    string | number | boolean | (string | number | boolean)[] | null | undefined
  >;
};

// Narrowed data type based on a readonly tuple of selected tag keys
export type NarrowedExifData<T extends readonly ExifToolTagKeys[] | undefined> =
  BaseAlwaysFields &
    (T extends readonly any[]
      ? Pick<AllSerializedExifTags, T[number]>
      : T extends undefined
        ? {} // No additional EXIF tags when undefined (no presets/tags specified)
        : AllSerializedExifTags) &
    RawExifShape;

// Helper to capture literal tag unions without requiring `as const`
export function exifTags<T extends readonly ExifToolTagKeys[]>(...tags: T): T {
  return tags;
}
// Helper to infer data type from a collection definition produced by defineExifCollection
// Usage: type ImageData = InferExifData<typeof collections.images>;
export type InferExifData<T> = T extends { schema: infer S }
  ? S extends { _type: infer U }
    ? U
    : S extends { shape: infer R }
      ? { [K in keyof R]: any }
      : unknown
  : unknown;
