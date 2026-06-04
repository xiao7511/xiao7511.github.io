// functions/config.js
export async function onRequestGet(context) {
  const env = context.env;

  // 1. 容错读取
  const supabaseUrl = env.SUPABASE_URL || "";
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || "";

  // 2. 如果后台真的没配好变量，返回标准的 JSON 报错，而不是让 Cloudflare 抛出通用错误
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({ 
        error: "Cloudflare Pages 环境变量缺失！请检查 Settings -> Environment variables" 
      }), 
      {
        status: 500,
        headers: { "Content-Type": "application/json;charset=UTF-8" }
      }
    );
  }

  // 3. 正常返回
  return new Response(
    JSON.stringify({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: supabaseAnonKey
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json;charset=UTF-8" }
    }
  );
}