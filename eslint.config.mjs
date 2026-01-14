// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // TypeScript strict rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/promise-function-async': 'error',

      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-exports': [
        'error',
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],

      // Naming conventions
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'interface', format: ['PascalCase'] },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'class', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE'] },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'UPPER_CASE'],
        },
        { selector: 'method', format: ['camelCase'] },
        { selector: 'function', format: ['camelCase'] },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
      ],

      // Code quality
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'explicit', overrides: { constructors: 'no-public' } },
      ],
      '@typescript-eslint/member-ordering': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowNullableBoolean: true },
      ],

      // NestJS specific - allow decorated empty classes (modules)
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true },
      ],

      // General strict rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],

      // Prettier - uses .prettierrc as single source of truth
      'prettier/prettier': 'error',
    },
  },
  // Relaxed rules for test, mock, and stub files
  {
    files: [
      '**/*.spec.ts',
      '**/*.test.ts',
      '**/*.mock.ts',
      '**/*.stub.ts',
      '**/test/**/*.ts',
      '**/__tests__/**/*.ts',
      '**/__mocks__/**/*.ts',
    ],
    rules: {
      // Allow any in tests for mocking flexibility
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      // Relax function/method requirements in tests
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Allow floating promises in test assertions
      '@typescript-eslint/no-floating-promises': 'off',

      // Relax naming conventions for test doubles
      '@typescript-eslint/naming-convention': 'off',

      // Allow empty functions (useful for mock implementations)
      '@typescript-eslint/no-empty-function': 'off',

      // Allow magic numbers in test data
      '@typescript-eslint/no-magic-numbers': 'off',

      // Allow unbound methods (common in Jest matchers)
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  // Relaxed rules for TypeORM migration files
  {
    files: ['**/migrations/**/*.ts', '**/*-migration.ts', '**/*.migration.ts'],
    rules: {
      // Migration class names follow timestamp pattern (e.g., Migration1705123456789)
      '@typescript-eslint/naming-convention': 'off',

      // Allow empty down() for irreversible migrations
      '@typescript-eslint/no-empty-function': 'off',

      // Migrations are simple classes, no need for explicit accessibility
      '@typescript-eslint/explicit-member-accessibility': 'off',

      // Allow console.log for migration progress logging
      'no-console': 'off',

      // QueryRunner methods return Promise<void>, require-await not needed
      '@typescript-eslint/require-await': 'off',

      // Raw SQL queries might need relaxed type checking
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',

      // Migration classes implement MigrationInterface
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
);
