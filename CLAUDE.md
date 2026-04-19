# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Japanese Real Estate Monitoring System** for tracking property investment opportunities. There are three search tracks:

1. **瑕疵房源 (Fukei)**: Defective properties (再建築不可, 訳あり) under 15M JPY — Tokyo 23 wards
2. **民宿改造 (Minshuku)**: B&B/hotel conversion properties (一棟戸建, 旅館業許可) — Tokyo 23 wards
3. **露営地用地 (Camping)**: Campsite/glamping land — Setouchi area (宇野港, 渋川海岸, 王子が岳)

## Data Structure

```
data/
├── properties.json          # Fukei property listings
├── properties_report.md     # Fukei report
├── minshuku_properties.json # Minshuku/b&b conversion properties
├── minshuku_report.md       # Minshuku report
├── camping_properties.json  # Camping/glamping land listings
├── camping_report.md        # Camping land report
scripts/
├── sync-notion.js           # Notion sync script
├── search-minshuku.js       # Minshuku search script
└── search-camping.js        # Camping land search script (Setouchi)
```

## Notion Sync

Three separate Notion pages:
- **Fukei properties**: `33a127cc505b8063b5b8c7e21c802ae5`
- **Minshuku properties**: `33a127cc505b80d8811ef70ad048943b`
- **Camping land**: `347127cc505b80eaacccd0a7350f38ff`

Sync commands:
```bash
# Sync fukei report
node scripts/sync-notion.js

# Sync minshuku report
node scripts/sync-notion.js minshuku_report -t "民宿改造可能房源レポート" -p 33a127cc505b80d8811ef70ad048943b

# Sync camping report
node scripts/sync-notion.js camping_report -t "瀬戸内露営地用地レポート" -p 347127cc505b80eaacccd0a7350f38ff
```

## Search Criteria

**Fukei (瑕疵)**:
- Max Price: 15,000,000 JPY
- Keywords: 再建築不可、既存不適格、現状渡し、境界未確定、訳あり

**Minshuku (民宿改造)**:
- No price limit (~20M JPY per room for conversion)
- (民宿可能 OR 旅館業許可 OR Guesthouse) AND (4m道路接道) AND (駅徒歩10分) AND (古民家 OR リノベーション)
- Focus on 一棟戸建/一棟旅館 (whole building sales)

**Camping (キャンプ場候補地)**:
- Areas: 宇野港周辺 / 渋川海岸 / 王子が岳 (玉野市・倉敷市, 岡山県)
- Min size: 500坪（約1650㎡）以上
- Must: 海が見える（瀬戸内海望）
- Keywords: キャンプ場候補地、グランピング用地、山林売地、海望大規模土地
- Concepts:
  - 宇野港: 直島フェリー客流・アート路線・海望キャンプ
  - 渋川海岸: 海辺キャンプ・ファミリー向け・直島連動
  - 王子が岳: パノラマ海景・高単価グランピング・絶景サイト

## Scheduled Tasks

See `.claude/scheduled_tasks.json`. Currently:
- 9:00 AM: Fukei search → Notion
- 10:00 AM: Minshuku search → Notion
- 11:00 AM: Camping land search → Notion

## MCP Tools

- `mcp__tavily__tavily_search` - Search for properties
- `mcp__tavily__tavily_extract` - Extract detailed property info from URLs

## 重要规则

**必须使用Tavily MCP工具进行搜索，禁止使用WebSearch或WebFetch工具。** WebSearch/WebFetch在此项目中不可用，会返回错误或404。搜索功能必须通过 `mcp__tavily__tavily_search` 调用。
