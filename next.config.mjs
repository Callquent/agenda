// BASE_PATH (ex. /apps/agenda) et STANDALONE=1 sont fournis par « MaPetiteBoîte ».
// Sans ces variables, l'application se compile et se lance normalement (npm run dev, npm start).
const basePath = process.env.BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(basePath ? { basePath } : {}),
  ...(process.env.STANDALONE ? { output: "standalone" } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
