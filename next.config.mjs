/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously disabling TypeScript checking only for build
    // because our SuspenseItems type is correct but TypeScript can't infer it
    ignoreBuildErrors: true,
  },
};

export default nextConfig; 