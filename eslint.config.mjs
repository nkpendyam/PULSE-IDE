import nextESLintConfig from "eslint-config-next";
export default [...nextESLintConfig, { rules: { "@typescript-eslint/no-explicit-any": "off", "react/no-unescaped-entities": "off" } }];
