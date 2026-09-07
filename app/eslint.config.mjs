import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'temp-export/**',
      'temp-export-verify/**',
      'assets/**',
      '*.config.js',
      'metro.config.js',
    ],
  },
  { rules: { '@typescript-eslint/no-explicit-any': 'off' } },
);
