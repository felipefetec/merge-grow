import { defineConfig } from 'vite';

export default defineConfig({
  // Base path para GitHub Pages (nome do repositório)
  base: '/merge-grow/',
  // Pasta de assets estáticos
  publicDir: 'public',
  build: {
    // Pasta de saída do build de produção
    outDir: 'dist',
  },
  server: {
    port: 3000,
    open: true,
    // Expor na rede local — permite acesso de outros dispositivos
    host: '0.0.0.0',
  },
});
