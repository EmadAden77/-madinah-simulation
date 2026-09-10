/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isGitHubPages ? '/-madinah-simulation' : '',
  assetPrefix: isGitHubPages ? '/-madinah-simulation/' : '',
};

export default nextConfig;
