import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode, command }) => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const env = loadEnv(mode, root, "");
  return {
    define: {
      "import.meta.env.VITE_API_REFERENCE_URL": JSON.stringify(
        env.VITE_API_REFERENCE_URL || (command === "serve"
          ? `http://127.0.0.1:${env.API_PORT || 8000}/docs` : "/api/docs"),
      ),
    },
    server: {
      host: "127.0.0.1",
      port: Number(env.WEB_PORT || 5173),
      strictPort: true,
      proxy: {
        "/api": {
          target: `http://127.0.0.1:${env.API_PORT || 8000}`,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    build: { target: "es2022", sourcemap: true },
  };
});
