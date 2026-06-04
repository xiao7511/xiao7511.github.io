// functions/config.js
export async function onRequestGet(context) {
  // 从 Cloudflare Pages 的环境变量中读取钥匙
  const env = context.env;

  const configData = {
    SUPABASE_URL: env.SUPABASE_URL || "",
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY || ""
  };

  // 校验环境变量
  if (!configData.SUPABASE_URL || !configData.SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Cloudflare Pages 环境变量未配置！" }), {
      status: 500,
      headers: { "Content-Type": "application/json;charset=UTF-8" },
    });
  }

  // 直接回传配置，因为同源，前端 fetch 时甚至不需要写死域名，更不需要处理跨域
  return new Response(JSON.stringify(configData), {
    status: 200,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    },
  });
}