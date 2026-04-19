#!/usr/bin/env node
/**
 * 民宿改造房源搜索脚本
 * 搜索条件：
 * 1. 允许民宿的土地/规约（民宿可能、旅館業許可済み等）
 * 2. 符合4x4接道要求（幅員4m以上道路に接道）
 * 3. 距核心站10分钟内
 * 4. 具备改造15-33平米高效空间潜力的户型
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "minshuku_properties.json");

// 搜索关键词组合
const SEARCH_CONDITIONS = {
  base: {
    areas: ["東京23区"],
    propertyType: "一戸建",
    maxPrice: null, // 不限价格，视房间数量而定（约2000万/间）
  },
  // 民宿相关关键词
  minshuku: [
    "民宿可能",
    "Airbnb可能",
    "旅館業許可",
    "Guesthouse",
    "民宿経営",
    "シェアハウス",
    "コワーキングスペース",
  ],
  // 接道条件相关
  accessRoad: [
    "4m道路",
    "幅員4m以上",
    "接道義務",
    "道路幅4m",
    "接道条件",
  ],
  // 站近相关
  stationNear: [
    "駅徒歩10分",
    "駅近",
    "駅徒歩5分",
    "駅徒歩8分",
  ],
  // 改造潜力相关
  renovationPotential: [
    "、古民家",
    "再生",
    "リノベーション",
    "リフォーム済み",
    "用途変更可能",
    "スケルトン",
    "DIY可能",
    "、天井高",
    "、メゾネット",
  ],
  // 排除条件
  exclude: [
    "再建築不可", // 再建築不可可能影响民宿许可
    "既存不適格",
    "訳あり",
  ],
};

// 搜索平台URL
const SEARCH_URLS = {
  suumo: {
    base: "https://suumo.jp/b/kodate/kw/",
    query: "東京23区/民宿可能/駅近/一戸建/",
  },
  homes: {
    base: "https://www.homes.co.jp/kodate/chuko/",
    query: "東京23区/民宿/ Guesthouse/",
  },
  stepon: {
    base: "https://www.stepon.co.jp/kodate/area_13/list_13_",
    query: "",
  },
};

// 保存搜索结果
function saveResults(properties) {
  // 读取现有数据
  let existingData = { properties: [], lastUpdated: "" };
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    } catch (e) {
      console.log("读取现有数据失败，创建新文件");
    }
  }

  // 合并去重
  const existingIds = new Set(existingData.properties.map(p => p.id));
  const newProperties = properties.filter(p => !existingIds.has(p.id));
  const updatedProperties = [...existingData.properties, ...newProperties];

  // 保存
  const data = {
    properties: updatedProperties,
    lastUpdated: new Date().toISOString(),
    totalCount: updatedProperties.length,
    newCount: newProperties.length,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), "utf-8");
  console.log(`保存完成：共${updatedProperties.length}件，新增${newProperties.length}件`);
  return data;
}

// 生成报告
function generateReport(properties) {
  const today = new Date().toISOString().split("T")[0];

  let report = `# 東京23区 民宿改造可能房源レポート

**更新日期：${today}**
**検索条件：民宿可能・4x4接道・駅近10分以内・改造潜力**
**予算上限：2,000万円**

---

## 民宿改造可能房源

`;

  if (properties.length === 0) {
    report += "現在符合条件的房源がありません。\n";
    return report;
  }

  properties.forEach((p, i) => {
    report += `### ${i + 1}. ${p.name}

| 項目 | 詳細 |
|------|------|
| **価格** | **${p.price}** |
| **住所** | ${p.address} |
| **交通** | ${p.station} |
| **土地面積** | ${p.landArea} |
| **建物面積** | ${p.buildingArea} |
| **户型** | ${p.layout} |
| **築年** | ${p.age} |
| **民宿条件** | ${p.minshukuConditions || "要確認"} |
| **接道条件** | ${p.roadAccess || "要確認"} |
| **改造潜力** | ${p.renovationPotential || "要確認"} |

`;
    if (p.url) {
      report += `**🔗 [物件詳細ページ](${p.url})**\n`;
    }
    report += `---\n\n`;
  });

  report += `## 房源比較表

| # | 物件名 | 価格 | 区域 | 駅 | 土地 | 建物 | 民宿 | 接道 |
|:-:|--------|-----:|------|-----|-----:|-----:|:----:|:----:|
`;

  properties.forEach((p, i) => {
    report += `| ${i + 1} | ${p.name.substring(0, 10)} | **${p.price}** | ${p.area || "-"} | ${p.stationTime || "-"} | ${p.landArea || "-"} | ${p.buildingArea || "-"} | ${p.minshukuTag || "?"} | ${p.roadTag || "?"} |
`;
  });

  report += `

---
*本レポート的秘密度：一般公開*
*民宿改造には旅館業許可申請・消防法・建築基準法確認が必要です*
`;

  return report;
}

// 模拟搜索结果（实际使用时由tavily搜索填充）
async function searchWithTavily() {
  console.log("需要使用 tavily MCP 工具进行实际搜索");
  console.log("搜索条件：");
  console.log("  - 民宿可能・Airbnb可能・Guesthouse");
  console.log("  - 4m幅員以上道路接道");
  console.log("  - 駅徒歩10分以内");
  console.log("  - 古民家・リノベーション済み");
  return [];
}

// Main
async function main() {
  console.log("民宿改造房源搜索开始...");

  const properties = await searchWithTavily();
  const data = saveResults(properties);

  const report = generateReport(properties);
  const reportPath = path.join(DATA_DIR, "minshuku_report.md");
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`报告已生成：${reportPath}`);

  return data;
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, generateReport, saveResults };
