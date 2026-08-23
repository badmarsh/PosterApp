import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [".next/*", "node_modules/*", "workspaces/*", "dist/*", "**/__tests__/**", "tests/*"],
  },
];

export default eslintConfig;
