/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@aweermarket/types', '@aweermarket/validation'],
  reactStrictMode: true
};

export default nextConfig;
