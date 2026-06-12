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
            { label: 'System Overview',          slug: 'architecture/overview' },
            { label: 'Introduction',             slug: 'architecture/introduction' },
            { label: 'ros2_HDL',                 slug: 'architecture/ros2-hdl' },
            { label: 'Runtime',                  slug: 'architecture/runtime' },
            { label: 'MCU Companion',            slug: 'architecture/mcu-companion' },
            { label: 'FDIR',                     slug: 'architecture/fdir' },
            { label: 'Multi-Instance',           slug: 'architecture/multi-instance' },
            { label: 'Transport Overview',       slug: 'architecture/transport-overview' },
            { label: 'T1 / T2 / T3 — zenoh',    slug: 'architecture/zenoh' },
            { label: 'T0 — SpaceWire / CCSDS',  slug: 'architecture/t0-spacewire' },
            { label: 'T4 — MIL-STD-1553B',      slug: 'architecture/t4-1553b' },
            { label: 'Ti — Local (MCU ↔ FPGA)', slug: 'architecture/ti-local' },
            { label: 'Tx — Standalone',          slug: 'architecture/tx-standalone' },
            { label: 'Space Targets',            slug: 'architecture/space' },
            { label: 'Platform Matrix',          slug: 'architecture/platform-matrix' },
          ],
        },
      ],
    }),

    sitemap(),
  ],
});