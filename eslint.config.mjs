import nextConfig from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "workspaces/**", "dist/**", ".qwen/**", "**/__tests__/**", "tests/**"],
  },
  // Inject the no-explicit-any rule into the nextConfig entry that already
  // registers the @typescript-eslint plugin, so the rule resolves without
  // installing @typescript-eslint/eslint-plugin as a direct dependency.
  ...nextConfig.map((cfg) => {
    if (cfg.plugins && "@typescript-eslint" in cfg.plugins) {
      return {
        ...cfg,
        rules: {
          ...cfg.rules,
          // C-N1: flag explicit `: any` before flipping to error.
          // Currently ~60 in lib/ + ~10 in app/api. Contracts.ts alone has 32.
          "@typescript-eslint/no-explicit-any": "warn",
        },
      };
    }
    return cfg;
  }),
  {
    rules: {
      // This application intentionally synchronizes UI state with external stores,
      // timers, media streams, and assistant runtime events in effects.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
