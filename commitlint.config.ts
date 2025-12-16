import type { UserConfig } from '@commitlint/types';

const scopes = [
  'api',
  'web',
  'database',
  'shared-types',
  'config',
  'python',
  'deps',
  'turbo',
  'root',
  'ci',
] as const;

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Scope must be from the allowed list
    'scope-enum': [2, 'always', [...scopes]],
    // Scope is required
    'scope-empty': [2, 'never'],
    // Subject (description) rules
    'subject-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-max-length': [2, 'always', 72],
    // Type rules
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'type-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
    // Body and footer rules
    'body-max-line-length': [2, 'always', 100],
    'footer-max-line-length': [2, 'always', 100],
  },
};

export default config;
