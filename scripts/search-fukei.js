#!/usr/bin/env node
/**
 * 瑕疵房源搜索脚本（再建築不可・訳あり）
 * 区域：東京23区，预算上限：1500万円
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "properties.json");

const SEARCH_QUERIES = [
  "東京23区 再建築不可 売買 1500万以下",
  "東京23区 訳あり物件 一戸建 売地",
  "東京 既存不適格 現状渡し 売買",
  "東京23区 境界未確定 格安 一戸建",
  "東京23区 再建築不可 古家付き 土地",
];

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

  let report = `# 東京23区 再建築不可・瑕疵物件レポート

**更新日：${today}**
**検索条件：再建築不可・訳あり・既存不適格・現状渡し・1500万円以下**

---

## 物件一覧

`;

  if (properties.length === 0) {
    report += "現在符合条件の物件がありません。\n";
  } else {
    properties.forEach((p, i) => {
      report += `### ${i + 1}. ${p.name}

| 項目 | 詳細 |
|------|------|
| **価格** | **${p.price}** |
| **住所** | ${p.address} |
| **土地面積** | ${p.landArea || "要確認"} |
| **建物面積** | ${p.buildingArea || "要確認"} |
| **瑕疵内容** | ${p.defectType || "要確認"} |

`;
      if (p.url) report += `[物件詳細](${p.url})\n`;
      report += `---\n\n`;
    });
  }

  report += `---\n*再建築不可物件は住宅ローン利用不可の場合があります。購入前に金融機関へご確認ください。*\n`;
  return report;
}

async function main() {
  console.log("瑕疵房源搜索開始...");
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.error("TAVILY_API_KEY が設定されていません");
    process.exit(1);
  }

  const properties = [];
  let idCounter = 1;

  for (const query of SEARCH_QUERIES) {
    console.log(`検索中：${query}`);
    try {
      const result = await tavilySearch(query, apiKey);
      for (const item of (result.results || [])) {
        properties.push({
          id: `fukei_${idCounter++}`,
          name: item.title || query,
          address: "東京23区",
          price: "要確認",
          landArea: "要確認",
          buildingArea: "要確認",
          defectType: "再建築不可/訳あり",
          summary: result.answer || "",
          url: item.url || "",
        });
      }
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`検索エラー [${query}]: ${e.message}`);
    }
  }

  const data = saveResults(properties);
  const report = generateReport(properties);
  const reportPath = path.join(DATA_DIR, "properties_report.md");
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`レポート生成完了：${reportPath}`);
  return data;
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, generateReport };
