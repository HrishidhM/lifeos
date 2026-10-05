import vitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [...vitals, ...typescript, { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] }, { rules: { "@next/next/no-page-custom-font": "off" } }];
export default config;
