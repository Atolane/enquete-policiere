import { defineConfig } from 'vite';

export default defineConfig({
  /* IMPORTANT pour le partage du jeu plus tard.
     './' produit des chemins RELATIFS dans le build final. Le jeu fonctionne
     donc aussi bien a la racine d'un domaine (Netlify, Vercel) que dans un
     sous-dossier (GitHub Pages : monpseudo.github.io/enquete-policiere/).
     Avec la valeur par defaut '/', le jeu serait casse sur GitHub Pages. */
  base: './',

  server: {
    /* Accessible depuis une autre machine du reseau local (utile pour tester
       sur un telephone ou un autre ordinateur). */
    host: true,
    open: false,
  },

  build: {
    outDir: 'dist',
    target: 'es2022',
    /* Three.js pese environ 700 Ko avant compression : c'est normal et attendu.
       On releve le seuil d'avertissement pour ne pas polluer la sortie du build. */
    chunkSizeWarningLimit: 1000,
  },
});
