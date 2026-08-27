---
status: current
owner: dashboard
last_verified: 2026-08-01
layer: api
module: Dashboard
feature: WeatherWidget
doc_type: current-contract
canonical: true
---

# Mira 工作台天气数据契约

Mira 工作台通过无 `/api` 前缀的后端路由 `GET /dashboard/weather` 获取天气数据。开发环境中的 `/api` 仅由 Vite 代理添加。

天气来源保持为 IP 定位与 Open-Meteo：

- IP 定位提供城市、纬度与经度。
- Open-Meteo 提供当前温度、WMO `weather_code`、`is_day` 和当日最高/最低温。
- 后端缓存天气快照 15 分钟。

响应中的天气 Widget 数据包含：

- `weatherCode: number | null`：Open-Meteo WMO 天气码；不可用或加载状态为 `null`。
- `isDay: boolean | null`：Open-Meteo 昼夜状态；不可用或加载状态为 `null`。
- `weather`：面向用户的中文天气描述。
- `temperature`：当前摄氏温度展示值。
- `forecast`：当日最低与最高温展示值。

前端使用 `weatherCode + isDay` 映射本地打包的 Meteocons 动画 SVG。启用 `prefers-reduced-motion: reduce` 时改用同图标的静态 SVG，不请求运行时 CDN。
