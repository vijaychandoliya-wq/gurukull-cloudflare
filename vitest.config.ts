import {defineConfig} from 'vitest/config';
export default defineConfig({test:{coverage:{provider:'v8',reporter:['text-summary','lcov','json-summary'],include:['workers/api/src/security.ts','workers/api/src/password-management.ts','workers/api/src/email-delivery.ts','workers/jobs/src/outbox-consumer.ts'],thresholds:{lines:75,statements:68,functions:80,branches:60}}}});
