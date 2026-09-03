import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  preview: {
    allowedHosts: true,
  },
  server: {
    allowedHosts: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      srcDirectory: "client",
      router: {
        routesDirectory: "routes",
        generatedRouteTree: "routeTree.gen.ts",
      },
      server: { entry: "server/index" },
    }),
    react(),
    tailwindcss(),
  ],
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        chunkFileNames: (chunkInfo) => {
          let name = chunkInfo.name;
          if (name === "dist" || name.startsWith("dist-") || name === "index") {
            const ids = chunkInfo.moduleIds || [];
            const radixPkg = ids.find((id) => id.includes("@radix-ui"));
            if (radixPkg) {
              const match = radixPkg.match(/@radix-ui\/react-([^\/]+)/);
              name = match ? `radix-${match[1]}` : "radix-ui";
            } else {
              name = "vendor";
            }
          }
          return `assets/${name}-[hash].js`;
        },
      },
    },
  },
});
