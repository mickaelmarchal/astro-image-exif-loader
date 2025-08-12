import type { Tags } from "exiftool-vendored";
import type { ExifToolTagKeys, ExifPresets } from "./types.js";

// Tags that may leak filesystem information and should be filtered out by default
export const FILESYSTEM_LEAKY_TAGS: ExifToolTagKeys[] = [
  "Directory",
  "FileName",
  "FileModifyDate",
  "FileAccessDate",
  "FileInodeChangeDate",
  "FilePermissions",
  "FileType",
  "FileTypeExtension",
  "MIMEType",
  "ExifToolVersion",
  "SourceFile",
];

export const EXIF_PRESET_MAPPINGS: Record<ExifPresets, ExifToolTagKeys[]> = {
  basic: ["FileSize", "ImageWidth", "ImageHeight"],
  camera: [
    "Make",
    "Model",
    "LensModel",
    "Lens",
    "LensID",
    "LensInfo",
    "LensSerialNumber",
    "SerialNumber",
    "BodySerialNumber",
    "CameraSerialNumber",
    "LensMake",
    "MaxAperture",
    "MinFocalLength",
    "MaxFocalLength",
  ],
  exposure: [
    "ISO",
    "FNumber",
    "ExposureTime",
    "ShutterSpeed",
    "FocalLength",
    "FocalLengthIn35mmFormat",
    "Flash",
    "WhiteBalance",
    "ExposureMode",
    "MeteringMode",
  ],
  datetime: ["DateTimeOriginal", "CreateDate", "DateTime"],
  location: [
    "GPSLatitude",
    "GPSLongitude",
    "GPSAltitude",
    "Country",
    "State",
    "City",
    "Location",
    "Sub-location",
    "GPSAreaInformation",
    "Country-PrimaryLocationCode",
    "Province-State",
  ],
  technical: [
    "ColorSpace",
    "Orientation",
    "Software",
    "SceneType",
    "SceneCaptureType",
  ],
  metadata: [
    "Artist",
    "Copyright",
    "ImageDescription",
    "Keywords",
    "Title",
    "Subject",
  ],
};

export function toSerializable(value: any): any {
  if (value === null || value === undefined) return null;

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date || (value && typeof value.toDate === "function")) {
    try {
      return value instanceof Date
        ? value.toISOString()
        : value.toDate().toISOString();
    } catch {
      return String(value);
    }
  }

  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }

  if (value && typeof value.valueOf === "function") {
    const primitiveValue = value.valueOf();
    if (
      typeof primitiveValue === "number" ||
      typeof primitiveValue === "string"
    ) {
      return primitiveValue;
    }
  }

  if (value && typeof value.num === "number" && typeof value.den === "number") {
    return value.num / value.den;
  }

  return String(value);
}

export function buildImageData(
  tags: Tags,
  fileName: string,
  mtime: string,
  fileSize: number,
  tagsToExtract: Set<ExifToolTagKeys> | null,
  excludeTags: Set<ExifToolTagKeys>,
  includeRawExif: boolean,
): any {
  const data: any = {
    fileName,
    mtime,
  };

  if (tagsToExtract === null) {
    // Extract all tags except excluded ones
    for (const [tagName, tagValue] of Object.entries(tags)) {
      if (
        tagValue !== null &&
        tagValue !== undefined &&
        !excludeTags.has(tagName as ExifToolTagKeys)
      ) {
        data[tagName] = toSerializable(tagValue);
      }
    }
    data.FileSize = fileSize;
  } else if (tagsToExtract.size > 0) {
    // Extract only specified tags, excluding any that are in excludeTags
    for (const tagName of tagsToExtract) {
      if (!excludeTags.has(tagName)) {
        const tagValue = tags[tagName];
        if (tagValue !== null && tagValue !== undefined) {
          data[tagName] = toSerializable(tagValue);
        }
      }
    }

    if (tagsToExtract.has("FileSize") && !excludeTags.has("FileSize")) {
      data.FileSize = fileSize;
    }
  }

  if (includeRawExif) {
    data.rawExif = {};
    for (const [tagName, tagValue] of Object.entries(tags)) {
      if (tagValue !== null && tagValue !== undefined) {
        data.rawExif[tagName] = toSerializable(tagValue);
      }
    }
  }

  return data;
}
