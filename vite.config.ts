import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["Pawpal_logo.png", "logo.jpg", "vite.svg"],
      manifest: {
        name: "Pawpal - Pet Adoption Platform",
        short_name: "Pawpal",
        description: "Connect with pet lovers and find your perfect companion",
        theme_color: "#7c3aed",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/Pawpal_logo.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/Pawpal_logo.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ],
        categories: ["lifestyle", "social", "pets"],
        shortcuts: [
          {
            name: "Browse Pets",
            short_name: "Browse",
            description: "Browse available pets for adoption",
            url: "/home",
            icons: [{ src: "/Pawpal_logo.png", sizes: "96x96" }]
          },
          {
            name: "Create Post",
            short_name: "Create",
            description: "Create a new pet adoption post",
            url: "/create-post",
            icons: [{ src: "/Pawpal_logo.png", sizes: "96x96" }]
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp}"],
        runtimeCaching: [
          {
            // Only cache public storage assets, never auth/database APIs.
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-static-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      },
      devOptions: {
        // Keep service worker off in local dev to prevent stale auth behavior.
        enabled: false,
        type: "module"
      }
    })
  ],
  // base: process.env.VITE_BASE_PATH || "/Smart-Pet",
  base: "/",
});
