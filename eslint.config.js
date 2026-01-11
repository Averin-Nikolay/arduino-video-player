// eslint.config.js
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: process.cwd(),
});

export default [
  // Базовые рекомендуемые правила ESLint
  ...compat.extends('eslint:recommended'),

  // Node файлы
  {
    files: ['main.js', 'config.js', 'utils/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'script', // CommonJS
    },
    env: {
      node: true,
      es2021: true,
    },
    rules: {
      'no-console': 'off',          // разрешаем console.log
      'semi': ['error', 'always'],  // точка с запятой обязательна
      'quotes': ['error', 'single'],// одинарные кавычки
      'no-unused-vars': ['warn'],   // предупреждение для неиспользуемых переменных
      'eqeqeq': ['error', 'always'],// строгое сравнение
    },
  },

  // Renderer / browser файлы
  {
    files: ['renderer/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
    },
    env: {
      browser: true,
      es2021: true,
    },
    rules: {
      'no-console': 'warn',         // предупреждение для console
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'no-unused-vars': ['warn'],
      'eqeqeq': ['error', 'always'],
    },
  },

  // Общие правила для всех файлов
  {
    files: ['**/*.js'],
    rules: {
      'indent': ['error', 2],       // 2 пробела отступ
      'comma-dangle': ['error', 'always-multiline'], // запятые в списках
      'brace-style': ['error', '1tbs', { 'allowSingleLine': true }],
    },
  },
];