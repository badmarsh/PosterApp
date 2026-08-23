import nextConfig from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "workspaces/**", "dist/**", "**/__tests__/**", "tests/**"],
  },
  ...nextConfig,
];

export default eslintConfig;
