// 部署配置（只在“前端静态站与后端 API 不同源”时需要修改）：
// 本地 / 单机同域部署：保持 apiBase 为空字符串（同源）。
// COS 静态托管 + SCF 函数 API：把 apiBase 改成函数 URL，例如
//   'https://xxxx-xxxx.gz.apigw.tencentcs.com' 或 SCF 函数 URL（不要带末尾斜杠）。
window.SP_CONFIG = {
  apiBase: 'https://1460916286-60rqecjtth.ap-guangzhou.tencentscf.com'
};
