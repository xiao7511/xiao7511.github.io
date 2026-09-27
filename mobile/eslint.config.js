import eslint from '@eslint/js';
import vue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'android/**', 'ios/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/essential'],
  { files: ['**/*.vue'], languageOptions: { parserOptions: { parser: tseslint.parser }, globals: { URLSearchParams: 'readonly' } } },
  { rules: { 'vue/multi-word-component-names': 'off' } }
];
