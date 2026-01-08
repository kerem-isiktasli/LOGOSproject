import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { resolve } from 'path';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'LOGOS',
    executableName: 'logos',
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin', 'linux']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: resolve(__dirname, 'src/main/index.ts'),
          config: resolve(__dirname, 'vite.main.config.ts'),
          target: 'main',
        },
        {
          entry: resolve(__dirname, 'src/main/preload.ts'),
          config: resolve(__dirname, 'vite.preload.config.ts'),
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: resolve(__dirname, 'vite.renderer.config.ts'),
        },
      ],
    }),
  ],
};

export default config;
