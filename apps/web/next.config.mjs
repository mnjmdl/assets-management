/** @type {import('next').NextConfig} */
const nextConfig = {
  // Support hosting under subpath e.g. https://app.bd.crystal-martin.com/assets
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
};

export default nextConfig;

