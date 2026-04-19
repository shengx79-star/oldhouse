#!/usr/bin/env node
/**
 * キャンプ場候補地搜索脚本
 * 条件：1000坪（約3300㎡）以上、海が見える、瀬戸内エリア
 * 区域：宇野港周辺 / 渋川海岸 / 王子が岳（玉野市・倉敷市）
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "camping_properties.json");

const SEARCH_AREAS = [
  {
    id: "uno_port",
    name: "宇野港周辺",
    concept: "直島フェリー客流・アート路線・海望キャンプ",
    keywords: [
      "玉野市 宇野 海が見える 大規模 土地 売地 1000坪",
      "玉野市 宇野港周辺 山林 原野 売地 海望",
    ],
  },
  {
    id: "shibukawa",
    name: "渋川海岸",
    concept: "海辺キャンプ・ファミリー向け・直島連動",
    keywords: [
      "玉野市 渋川 海沿い 大規模土地 キャンプ場用地 売地",
      "玉野市 渋川海岸 1000坪以上 土地 売買 海見える",
    ],
  },
  {
    id: "ojigadake",
    name: "王子が岳",
    concept: "パノラマ海景・高単価グランピング・絶景サイト",
    keywords: [
      "王子ヶ岳 周辺 山林 大規模 売地 海望 グランピング",
      "玉野市 倉敷市 王子が岳 1000坪 土地 売買 瀬戸内海",
    ],
  },
];

// 広域検索クエリ（エリアを絞らず瀬戸内全体）
const BROAD_QUERIES = [
  "岡山県 玉野市 海が見える 1000坪以上 土地 売地 キャンプ場",
  "瀬戸内海 海望 大規模土地 グランピング キャンプ場 岡山 売買",
  "玉野市 山林 原野 海景 大型 売地 アウトドア施設",
  "岡山県 海沿い キャンプ場候補地 1000坪 売土地",
];

function saveResults(properties) {
  let existingData = { properties: [], lastUpdated: "" };
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    } catch (e) {}
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

  let report = `# 瀬戸内 キャンプ場候補地レポート

**更新日：${today}**
**検索条件：1000坪（約3300㎡）以上・海が見える・キャンプ場開発適地**
**対象エリア：宇野港周辺 / 渋川海岸 / 王子が岳（玉野市・倉敷市）**

---

## エリア別候補地

`;

  const areaMap = {};
  for (const area of SEARCH_AREAS) {
    areaMap[area.id] = { ...area, properties: [] };
  }
  const broadResults = [];

  for (const p of properties) {
    if (areaMap[p.areaId]) {
      areaMap[p.areaId].properties.push(p);
    } else {
      broadResults.push(p);
    }
  }

  for (const area of SEARCH_AREAS) {
    const areaData = areaMap[area.id];
    report += `### ${area.name}
*コンセプト：${area.concept}*

`;

    if (areaData.properties.length === 0) {
      report += "本日この区域の候補地なし\n\n---\n\n";
      continue;
    }

    areaData.properties.forEach((p, i) => {
      report += `#### ${i + 1}. ${p.name}

| 項目 | 詳細 |
|------|------|
| **価格** | **${p.price}** |
| **所在地** | ${p.address} |
| **土地面積** | ${p.landArea} |
| **坪数** | ${p.tsubo || "要確認"} |
| **海景・眺望** | ${p.seaView || "要現地確認"} |
| **用途地域** | ${p.zoning || "要確認"} |
| **接道・アクセス** | ${p.roadAccess || "要確認"} |
| **キャンプ適性評価** | ${p.campingNote || "要現地確認"} |

`;
      if (p.url) report += `[物件詳細](${p.url})\n`;
      report += `---\n\n`;
    });
  }

  if (broadResults.length > 0) {
    report += `### その他エリア（広域検索結果）\n\n`;
    broadResults.forEach((p, i) => {
      report += `#### ${i + 1}. ${p.name}

| 項目 | 詳細 |
|------|------|
| **価格** | **${p.price}** |
| **所在地** | ${p.address} |
| **土地面積** | ${p.landArea} |
| **坪数** | ${p.tsubo || "要確認"} |
| **海景・眺望** | ${p.seaView || "要現地確認"} |
| **キャンプ適性評価** | ${p.campingNote || "要現地確認"} |

`;
      if (p.url) report += `[物件詳細](${p.url})\n`;
      report += `---\n\n`;
    });
  }

  report += `## 候補地比較表

| # | エリア | 物件名 | 価格 | 面積（坪） | 海景 | 総合評価 |
|:-:|--------|--------|-----:|----------:|:----:|:------:|
`;

  properties.forEach((p, i) => {
    const area = SEARCH_AREAS.find(a => a.id === p.areaId);
    report += `| ${i + 1} | ${area ? area.name : "広域"} | ${p.name.substring(0, 15)} | **${p.price}** | ${p.tsubo || "?"} | ${p.seaView ? "✓" : "?"} | ${p.fitScore || "?"} |
`;
  });

  report += `

---
## キャンプ場開発チェックリスト

| 確認項目 | 内容 |
|---------|------|
| 面積基準 | 1000坪（約3300㎡）以上 |
| 眺望条件 | 海が見える・瀬戸内海望 |
| 法規制 | 農地転用・旅館業許可・都市計画区域外確認 |
| インフラ | 接道・電気・水道・汚水処理 |
| アクセス | 最寄り駅・フェリー乗り場からの距離 |

---
*候補地の現地確認・測量・法務局調査は必須です*
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
    console.error("TAVILY_API_KEY が設定されていません");
    return [];
  }

  const properties = [];
  let idCounter = 1;

  // エリア別検索
  for (const area of SEARCH_AREAS) {
    console.log(`\n[${area.name}] 検索中...`);
    for (const keyword of area.keywords) {
      try {
        const result = await tavilySearch(keyword, apiKey);
        for (const item of (result.results || [])) {
          properties.push({
            id: `camping_${area.id}_${idCounter++}`,
            areaId: area.id,
            name: item.title || keyword,
            address: area.name,
            price: "要確認",
            landArea: "要確認",
            tsubo: "要確認",
            seaView: null,
            zoning: "要確認",
            roadAccess: "要確認",
            campingNote: result.answer || item.content || "",
            url: item.url || "",
            fitScore: "要確認",
          });
        }
        await new Promise(r => setTimeout(r, 600));
      } catch (e) {
        console.error(`検索エラー [${keyword}]: ${e.message}`);
      }
    }
  }

  // 広域検索
  console.log("\n[広域検索] 瀬戸内キャンプ場候補地...");
  for (const query of BROAD_QUERIES) {
    try {
      const result = await tavilySearch(query, apiKey);
      for (const item of (result.results || [])) {
        properties.push({
          id: `camping_broad_${idCounter++}`,
          areaId: "broad",
          name: item.title || query,
          address: "岡山県瀬戸内エリア",
          price: "要確認",
          landArea: "要確認",
          tsubo: "要確認",
          seaView: null,
          campingNote: result.answer || item.content || "",
          url: item.url || "",
          fitScore: "要確認",
        });
      }
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {
      console.error(`広域検索エラー: ${e.message}`);
    }
  }

  return properties;
}

async function main() {
  console.log("キャンプ場候補地搜索開始（1000坪以上・海望）...");

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

module.exports = { main, generateReport, saveResults, SEARCH_AREAS };
