import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    loader: "src/loader.ts",
    importer: "src/importer.ts",
    types: "src/types.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["astro", "exiftool-vendored", "picomatch", "tinyglobby"],
});
