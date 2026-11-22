import { defineProject } from 'vitest/config';

// DATA_DIR=':memory:' so servers started by tests never write a database file (story 8.1)
export default defineProject({ test: { include: ['src/**/*.test.ts'], env: { DATA_DIR: ':memory:' } } });
