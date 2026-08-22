/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    turbopack: {
      root: process.cwd(),
    },
  },
}

export default nextConfig
