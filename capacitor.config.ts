import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.paintmate.app',
  appName: 'PaintMate',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https'
  }
};

export default config;
