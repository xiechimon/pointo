import { defineConfig } from "vite"

// 部署在 https://xiechimon.github.io/pointo/，所有资源都走 /pointo/ 前缀。
export default defineConfig({
  base: "/pointo/",
})
