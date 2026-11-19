import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // The Groq key is read here, on the dev server. It is never sent to the browser:
  // the page calls /api/groq/chat/completions and the server adds the key on the way out.
  const groqKey = loadEnv(mode, process.cwd(), '').GROQ_API_KEY;
  return {
    plugins: [react(), tailwindcss()],
    define: { __GROQ__: Boolean(groqKey) },
    server: {
      proxy: groqKey
        ? {
            '/api/groq/chat/completions': {
              target: 'https://api.groq.com',
              changeOrigin: true,
              rewrite: () => '/openai/v1/chat/completions',
              headers: { Authorization: `Bearer ${groqKey}` },
            },
          }
        : undefined,
    },
  };
});
