import type { Config } from "@react-router/dev/config";

export default {
  ssr: false,
  prerender: ["/", "/help"],
  splitRouteModules: true,
} satisfies Config;
