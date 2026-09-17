/** @type {import('next').NextConfig} */
const distDir = process.env.VERCEL ? ".next" : process.env.NODE_ENV === "development" ? ".next-dev" : ".next-build";
const nextConfig = { reactStrictMode: true, distDir };
export default nextConfig;
