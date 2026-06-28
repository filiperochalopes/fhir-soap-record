import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  server: {
    // Server-to-server callbacks (e.g. the Docs app webhook) reach this
    // container by its Docker network alias, so the Host header is
    // "fhir-soap-record". Vite rejects unknown hosts with 403, so allow it.
    allowedHosts: ["fhir-soap-record", "localhost"],
  },
  build: {
    rollupOptions: {
      external: ["@prisma/client"],
    },
  },
});

