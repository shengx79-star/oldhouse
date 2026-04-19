#!/usr/bin/env node
/**
 * 露营地用地搜索脚本
 * 搜索区域：
 * 1. 宇野港周辺（玉野市）- 小型精品・アート路線・直島客流活用
 * 2. 渋川海岸（玉野市）- 海辺リゾート・直島連動
 * 3. 王子が岳（玉野市/倉敷市）- 高単価景観型グランピング
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "camping_properties.json");

const SEARCH_AREAS = [
  {
    id: "uno_port",
    name: "宇野港周辺",
    concept: "小型精品・アート路線・直島客流活用",
    keywords: ["玉野市 宇野 土地", "宇野港 キャンプ場", "玉野市 露営地 売地", "宇野 グランピング 土地"],
  },
  {
    id: "shibukawa",
    name: "渋川海岸",
    concept: "海辺度假感・直島連動・バランス最良",
    keywords: ["渋川海岸 土地", "玉野市 渋川 売地", "渋川 キャンプ場 用地", "渋川海水浴場 周辺 土地"],
  },
  {
    id: "ojigadake",
    name: "王子が岳",
    concept: "高単価景観型グランピング・小規模高収益",
    keywords: ["王子が岳 土地", "王子ヶ岳 売地", "玉野市 王子 山林", "倉敷市 王子ヶ岳 キャンプ"],
  },
];

// 露营地用地的共通搜索条件
const CAMPING_KEYWORDS = [
  "キャンプ場 開設可能",
  "グランピング 用地",
  "露営地 売土地",
  "アウトドア施設 用地",
  "農地転用 キャンプ",
  "山林 売地",
  "原野 売地",
  "旅館業許可 取得可能",
];

function saveResults(properties) {
  let existingData = { properties: [], lastUpdated: "" };
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    } catch (e) {
      console.log("読取失敗、新規ファイル作成");
    }
  }

  const existingIds = new Set(existingData.properties.map(p => p.id));
  const newProperties = properties.filter(p => !existingIds.has(p.id));
  const updatedProperties = [...existingData.properties, ...newProperties];

  const data = {
    properties: updatedProperties,
    lastUpdated: new Date().toISOString(),
    totalCount: updatedProperties.length,
    newCount: newProperties.length,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), "utf-8");
  console.log(`保存完了：計${updatedProperties.length}件、新規${newProperties.length}件`);
  return data;
}

function generateReport(properties) {
  const today = new Date().toISOString().split("T")[0];

  let report = `# 瀬戸内エリア 露営地・キャンプ場用地レポート

**更新日：${today}**
**搜索区域：宇野港周辺 / 渋川海岸 / 王子が岳（玉野市・倉敷市）**
**用途：グランピング・キャンプ場・アウトドア施設開発**

---

## エリア別候補地

`;

  const areaMap = {};
  for (const area of SEARCH_AREAS) {
    areaMap[area.id] = { ...area, properties: [] };
  }

  for (const p of properties) {
    if (areaMap[p.areaId]) {
      areaMap[p.areaId].properties.push(p);
    }
  }

  for (const area of SEARCH_AREAS) {
    const areaData = areaMap[area.id];
    report += `### ${area.name}
*コンセプト：${area.concept}*

`;

    if (areaData.properties.length === 0) {
      report += "現在この区域の候補地なし\n\n";
      continue;
    }

    areaData.properties.forEach((p, i) => {
      report += `#### ${i + 1}. ${p.name}

| 項目 | 詳細 |
|------|------|
| **価格** | **${p.price}** |
| **住所** | ${p.address} |
| **土地面積** | ${p.landArea} |
| **用途地域** | ${p.zoning || "要確認"} |
| **接道条件** | ${p.roadAccess || "要確認"} |
| **キャンプ適性** | ${p.campingNote || "要現地確認"} |
| **景観・環境** | ${p.scenery || "-"} |

`;
      if (p.url) {
        report += `**[物件詳細](${p.url})**\n`;
      }
      report += `---\n\n`;
    });
  }

  report += `## 候補地比較表

| # | エリア | 物件名 | 価格 | 面積 | 用途地域 | コンセプト適合 |
|:-:|--------|--------|-----:|-----:|:--------:|:------------:|
`;

  properties.forEach((p, i) => {
    const area = SEARCH_AREAS.find(a => a.id === p.areaId);
    report += `| ${i + 1} | ${area ? area.name : "-"} | ${p.name.substring(0, 15)} | **${p.price}** | ${p.landArea || "-"} | ${p.zoning || "?"} | ${p.fitScore || "?"} |
`;
  });

  report += `

---
## エリア特性まとめ

| エリア | 強み | ターゲット | 推定単価 |
|--------|------|-----------|---------|
| 宇野港周辺 | 直島アートフェリー客流・港の雰囲気 | アート好きインバウンド | 高 |
| 渋川海岸 | 海水浴場隣接・アクセス良好 | ファミリー・カップル | 中〜高 |
| 王子が岳 | 360度パノラマ景観・独占感 | 富裕層グランピング | 最高 |

---
*本レポートは参考情報です。実際の開発には農地転用・旅館業許可・消防法・建築基準法の確認が必要です*
`;

  return report;
}

async function tavilySearch(query, apiKey) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: 5,
      include_answer: true,
    }),
  });
  if (!res.ok) throw new Error(`Tavily API error: ${res.status}`);
  return res.json();
}

async function searchWithTavily() {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.log("TAVILY_API_KEY 未设置，跳过网络搜索");
    return [];
  }

  const properties = [];
  let idCounter = 1;

  for (const area of SEARCH_AREAS) {
    console.log(`\n搜索区域：${area.name}`);
    for (const keyword of area.keywords.slice(0, 2)) {
      try {
        const result = await tavilySearch(
          `${keyword} 売地 岡山県 キャンプ場 グランピング 用地`,
          apiKey
        );
        for (const item of (result.results || [])) {
          properties.push({
            id: `camping_${area.id}_${idCounter++}`,
            areaId: area.id,
            name: item.title || keyword,
            address: area.name,
            price: "要確認",
            landArea: "要確認",
            zoning: "要確認",
            roadAccess: "要確認",
            campingNote: result.answer || "",
            scenery: "",
            url: item.url || "",
            fitScore: "要確認",
          });
        }
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`検索エラー [${keyword}]: ${e.message}`);
      }
    }
  }

  return properties;
}

async function main() {
  console.log("露営地用地搜索開始...");

  const properties = await searchWithTavily();
  const data = saveResults(properties);

  const report = generateReport(properties);
  const reportPath = path.join(DATA_DIR, "camping_report.md");
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`レポート生成完了：${reportPath}`);

  return data;
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, generateReport, saveResults, SEARCH_AREAS, CAMPING_KEYWORDS };
