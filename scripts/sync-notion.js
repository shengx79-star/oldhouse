#!/usr/bin/env node
/**
 * Notion Sync Script
 * 每日物业报告同步到 Notion
 */

const { Client } = require("@notionhq/client");
const fs = require("fs");
const path = require("path");

// Configuration
const NOTION_TOKEN = "ntn_Q4962668635925IEpCuvPV2JTIjQfmL7tqINE5TncJc1RJ";
const PARENT_PAGE_ID = "33a127cc505b8063b5b8c7e21c802ae5";

// Default report path, can be overridden by command line argument
const DEFAULT_REPORT = "properties_report.md";
const DEFAULT_PAGE_ID = "33a127cc505b8063b5b8c7e21c802ae5";
const args = process.argv.slice(2);
let reportArg = null;
let titlePrefix = "東京23区 再建築不可房源レポート";
let pageId = DEFAULT_PAGE_ID;

for (let i = 0; i < args.length; i++) {
  if (!args[i].startsWith("-") && args[i].includes("_report")) {
    reportArg = args[i];
  } else if (args[i] === "-t" && args[i + 1]) {
    titlePrefix = args[i + 1];
    i++;
  } else if (args[i] === "-p" && args[i + 1]) {
    pageId = args[i + 1];
    i++;
  }
}
const REPORT_PATH = reportArg
  ? path.join(__dirname, "..", "data", path.basename(reportArg, ".md") + ".md")
  : path.join(__dirname, "..", "data", DEFAULT_REPORT);

// Initialize Notion client
const notion = new Client({ auth: NOTION_TOKEN });

// Get today's date in Japan timezone
function getTodayDate() {
  const now = new Date();
  const tokyoTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  return tokyoTime.toISOString().split("T")[0]; // YYYY-MM-DD format
}

// Parse markdown content into Notion blocks
function parseMarkdownToBlocks(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let currentTableRows = [];
  let inTable = false;
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        blocks.push({
          type: "code",
          code: {
            language: "plain text",
            rich_text: [{ type: "text", text: { content: currentTableRows.join("\n") } }]
          }
        });
        currentTableRows = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        currentTableRows = [];
      }
      continue;
    }

    if (inCodeBlock) {
      currentTableRows.push(line);
      continue;
    }

    // Table handling
    if (line.includes("|") && line.trim().startsWith("|")) {
      inTable = true;
      const cells = line.split("|").filter(cell => cell.trim() !== "");
      currentTableRows.push(cells.map(cell => cell.trim()));
      continue;
    } else if (inTable) {
      // End of table - create table block
      if (currentTableRows.length >= 2) {
        const headerRow = currentTableRows[0];
        const tableRows = currentTableRows.slice(1).map(row => ({
          type: "table_row",
          table_row: {
            cells: row.map(cell => [{ type: "text", text: { content: cell } }])
          }
        }));

        blocks.push({
          type: "table",
          table: {
            table_width: headerRow.length,
            has_column_header: true,
            has_row_header: false,
            children: tableRows
          }
        });
      }
      currentTableRows = [];
      inTable = false;
    }

    // Heading 1
    if (line.startsWith("# ")) {
      blocks.push({
        type: "heading_1",
        heading_1: {
          rich_text: [{ type: "text", text: { content: line.slice(2) } }]
        }
      });
      continue;
    }

    // Heading 2
    if (line.startsWith("## ")) {
      blocks.push({
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: line.slice(3) } }]
        }
      });
      continue;
    }

    // Heading 3
    if (line.startsWith("### ")) {
      blocks.push({
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: line.slice(4) } }]
        }
      });
      continue;
    }

    // Bullet list
    if (line.startsWith("- ")) {
      blocks.push({
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: line.slice(2) } }]
        }
      });
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      blocks.push({
        type: "numbered_list_item",
        numbered_list_item: {
          rich_text: [{ type: "text", text: { content: line.replace(/^\d+\.\s/, "") } }]
        }
      });
      continue;
    }

    // Divider
    if (line === "---") {
      blocks.push({ type: "divider", divider: {} });
      continue;
    }

    // Empty line - skip
    if (line.trim() === "") {
      continue;
    }

    // Paragraph
    if (line.trim()) {
      // Handle bold text (**text**)
      const richText = parseInlineFormatting(line);
      blocks.push({
        type: "paragraph",
        paragraph: { rich_text: richText }
      });
    }
  }

  // Handle remaining table
  if (currentTableRows.length > 0 && inTable) {
    if (currentTableRows.length >= 2) {
      const headerRow = currentTableRows[0];
      const tableRows = currentTableRows.slice(1).map(row => ({
        type: "table_row",
        table_row: {
          cells: row.map(cell => [{ type: "text", text: { content: cell } }])
        }
      }));

      blocks.push({
        type: "table",
        table: {
          table_width: headerRow.length,
          has_column_header: true,
          has_row_header: false,
          children: tableRows
        }
      });
    }
  }

  // Handle remaining code block
  if (currentTableRows.length > 0 && inCodeBlock) {
    blocks.push({
      type: "code",
      code: {
        language: "plain text",
        rich_text: [{ type: "text", text: { content: currentTableRows.join("\n") } }]
      }
    });
  }

  return blocks;
}

// Parse inline formatting like **bold**
function parseInlineFormatting(text) {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Check for bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index === 0) {
      parts.push({
        type: "text",
        text: { content: boldMatch[1] },
        annotations: { bold: true }
      });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Check for link [text](url)
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);
    if (linkMatch && linkMatch.index === 0) {
      parts.push({
        type: "text",
        text: { content: linkMatch[1], link: { url: linkMatch[2] } }
      });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Find next special character
    const nextBold = remaining.indexOf("**");
    const nextLink = remaining.indexOf("[");

    let nextSpecial = -1;
    if (nextBold !== -1) nextSpecial = nextBold;
    if (nextLink !== -1 && (nextSpecial === -1 || nextLink < nextSpecial)) nextSpecial = nextLink;

    if (nextSpecial === -1) {
      // No more special formatting
      if (remaining.length > 0) {
        parts.push({ type: "text", text: { content: remaining } });
      }
      break;
    } else if (nextSpecial === 0) {
      // Should not happen if we already matched at index 0
      remaining = remaining.slice(1);
    } else {
      // Add text before special character
      parts.push({ type: "text", text: { content: remaining.slice(0, nextSpecial) } });
      remaining = remaining.slice(nextSpecial);
    }
  }

  if (parts.length === 0) {
    parts.push({ type: "text", text: { content: text } });
  }

  return parts;
}

// Create a new page in Notion
async function createNotionPage(title, blocks) {
  try {
    const response = await notion.pages.create({
      parent: { page_id: pageId },
      properties: {
        title: {
          title: [{ type: "text", text: { content: title } }]
        }
      },
      children: blocks.slice(0, 100) // Notion API limit per request
    });

    console.log(`Created Notion page: ${title}`);
    return response;
  } catch (error) {
    console.error(`Error creating Notion page: ${error.message}`);
    throw error;
  }
}

// Main sync function
async function syncToNotion() {
  console.log("Starting Notion sync...");

  // Check if report exists
  if (!fs.existsSync(REPORT_PATH)) {
    console.error(`Report not found: ${REPORT_PATH}`);
    process.exit(1);
  }

  // Read report
  const reportContent = fs.readFileSync(REPORT_PATH, "utf-8");

  // Get today's date
  const today = getTodayDate();

  // Parse markdown to blocks
  const blocks = parseMarkdownToBlocks(reportContent);

  console.log(`Parsed ${blocks.length} blocks from report`);

  // Create Notion page
  const pageTitle = `${titlePrefix} - ${today}`;
  await createNotionPage(pageTitle, blocks);

  console.log("Notion sync completed!");
}

// Run if called directly
if (require.main === module) {
  syncToNotion().catch(console.error);
}

module.exports = { syncToNotion, parseMarkdownToBlocks };
