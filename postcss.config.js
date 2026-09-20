import { fileURLToPath } from 'node:url'

// Caminho do tailwind.config.js resolvido a partir deste arquivo, e não do
// diretório de onde o Vite foi chamado.
export default {
  plugins: {
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
}
