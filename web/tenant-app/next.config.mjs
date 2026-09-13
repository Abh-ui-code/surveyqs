/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  // @surveyqs/shared ships untranspiled TypeScript (package.json main/types
  // point straight at src/index.ts) -- without this, webpack hits raw type
  // syntax from node_modules and fails to parse it.
  transpilePackages: ["@surveyqs/shared"],
};

export default nextConfig;
