import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import starlightLlmsTxt from 'starlight-llms-txt';

export default defineConfig({
  site: 'https://nano-ros.github.io',

  integrations: [
    starlight({
      title: 'nano-ros',
      tagline: 'Deterministic ROS 2 for embedded and real-time systems',

      plugins: [starlightLlmsTxt()],

      head: [
        {
          tag: 'meta',
          attrs: {
            name: 'google-site-verification',
            content: 'YUGSHLc1KkWeyHXkeWQncuZoT7tUlhlzuPmSjUde2W8',
          },
        },
      ],

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
