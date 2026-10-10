export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // Mobile-first: wider layouts use min-width media queries (docs/spec/general.md, GEN-1).
    'media-feature-range-notation': 'prefix',
    // Vite resolves plain string imports.
    'import-notation': 'string',
    // Needed on iOS Safari.
    'property-no-vendor-prefix': [true, { ignoreProperties: ['text-size-adjust'] }],
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*$',
      { message: 'Use kebab-case class names' },
    ],
  },
};
