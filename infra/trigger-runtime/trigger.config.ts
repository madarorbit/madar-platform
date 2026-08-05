import { defineConfig } from '@trigger.dev/sdk';

const project = process.env.TRIGGER_PROJECT_REF?.trim();
if (!project) throw new Error('TRIGGER_PROJECT_REF is required for the MADAR Trigger.dev runtime.');

export default defineConfig({
  project,
  dirs: ['./src'],
  maxDuration: 600,
});
