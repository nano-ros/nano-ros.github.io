import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://nano-ros.github.io',

  integrations: [
    starlight({
      title: 'nano-ros',
      tagline: 'Deterministic ROS 2 for embedded and real-time systems',

      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/nano-ros',
        },
      ],

      editLink: {
        baseUrl: 'https://github.com/nano-ros/nano-ros.github.io/edit/main/',
      },

      sidebar: [
        {
          label: 'Architecture',
          items: [
            {
              autogenerate: {
                directory: 'architecture',
              },
            },
          ],
        },
      ],
    }),

    sitemap(),
  ],
});
