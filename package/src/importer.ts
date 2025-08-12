import type { ImportedExifCollectionEntry } from "./types.js";
export default async function imageImporter<
  Entry extends {
    id: string;
    collection: string;
    data: any;
  }
>(
  entries: Entry[]
): Promise<Array<ImportedExifCollectionEntry<Entry["data"]>>> {
  const files = import.meta.glob("/src/**/*", { eager: false });

  const missing = entries.filter((e: any) => !e.data?.srcPath);
  if (missing.length === entries.length) {
    throw new Error(
      "astro-image-exif-loader: The importer only works for images under /src."
    );
  } else if (missing.length > 0) {
    console.warn(`astro-image-exif-loader: ${missing.length} entries missing`);
  }

  return Promise.all(
    entries.map(async (entry) => {
      const relPath = (entry as any).data?.srcPath as string | undefined;
      if (!relPath) {
        console.warn(
          "astro-image-exif-loader: entry missing srcPath: ",
          entry.id
        );
        return { ...entry, defaultImport: null } as ImportedExifCollectionEntry<
          Entry["data"]
        >;
      }
      const imagePath = relPath.startsWith("/")
        ? `/${relPath.replace(/^\//, "")}`
        : `/src/${relPath}`;

      const filesMap = files as Record<string, () => Promise<any>>;
      const importer = filesMap[imagePath];

      let defaultImport: any = null;
      if (importer) {
        try {
          const mod = await importer();
          defaultImport = mod?.default ?? null;
        } catch (err) {
          console.warn(
            "astro-image-exif-loader: failed to import image module: ",
            imagePath,
            err
          );
        }
      } else {
        console.warn(
          "astro-image-exif-loader: no importer found for: ",
          imagePath
        );
      }

      return {
        ...entry,
        defaultImport,
      } as ImportedExifCollectionEntry<Entry["data"]>;
    })
  );
}
