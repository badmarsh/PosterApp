import nextConfig from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "workspaces/**", "dist/**", "**/__tests__/**", "tests/**"],
  },
  ...nextConfig,
  {
    rules: {
      // This application intentionally synchronizes UI state with external stores,
      // timers, media streams, and assistant runtime events in effects.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
