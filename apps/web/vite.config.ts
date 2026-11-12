import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const env = loadEnv(mode, root, "");
  return {
    server: {
      host: "127.0.0.1",
      port: Number(env.WEB_PORT || 5173),
      strictPort: true,
      proxy: {
        "/openapi.json": {
          target: `http://127.0.0.1:${env.API_PORT || 8000}`,
        },
        "/api": {
          target: `http://127.0.0.1:${env.API_PORT || 8000}`,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    build: { target: "es2022", sourcemap: true },
  };
});
