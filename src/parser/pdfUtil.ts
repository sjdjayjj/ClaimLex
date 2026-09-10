import * as pdfjsLib from 'pdfjs-dist';
import { cleanDocumentText, TextCleanResult } from './textCleaner';

// 配置 pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;

export interface PDFExtractOptions {
  onProgress?: (current: number, total: number, pageTextLength: number) => void;
  maxPages?: number;
}

export interface PDFExtractResult {
  text: string;
  cleanResult: TextCleanResult;
  totalPages: number;
  extractedPages: number;
  isScannedWarning: boolean;
  hasTableStructure?: boolean;
}

interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 依据 2D 坐标（Y 轴行聚类、X 轴排序与跨列探测）提取并还原 PDF 页面内的表格与排版结构
 */
function reconstructPageLayoutAndTables(items: any[]): { pageText: string; hasTable: boolean } {
  const validItems: RawTextItem[] = [];

  for (const item of items) {
    if (item.str && typeof item.str === 'string' && item.str.trim().length > 0) {
      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      validItems.push({
        str: item.str,
        x: transform[4] || 0,
        y: transform[5] || 0,
        width: item.width || 0,
        height: item.height || 10,
      });
    }
  }

  if (validItems.length === 0) {
    return { pageText: '', hasTable: false };
  }

  // 1. 行聚类（PDF 中 Y 相同的视为同一行，设置 Y 容差如 4 像素）
  const Y_TOLERANCE = 4.5;
  const rows: { y: number; items: RawTextItem[] }[] = [];

  for (const item of validItems) {
    let matchedRow = rows.find(r => Math.abs(r.y - item.y) <= Y_TOLERANCE);
    if (!matchedRow) {
      matchedRow = { y: item.y, items: [] };
      rows.push(matchedRow);
    }
    matchedRow.items.push(item);
  }

  // 2. 按 Y 坐标从大到小降序排列（PDF 坐标系中顶部 Y 值大，底部 Y 值小）
  rows.sort((a, b) => b.y - a.y);

  let pageHasTable = false;
  const lineOutputs: string[] = [];

  // 3. 处理每一行，并按 X 从左到右升序排列
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);

    // 检查此行是否表现出明显的表格列特征：
    // 特征 A: 行内有较多分散项（>= 3 项）且相互之间有间隙
    // 特征 B: 或者包含典型的表头关键字（如 序号/案号/被告/本金/利息/罚息/复利/身份证）
    const rowStr = row.items.map(it => it.str).join(' ');
    const isHeaderCandidate = /(案号|被告|身份证|本金|利息|罚息|复利|截息|受理费|保全费|原告)/.test(rowStr);

    let isTableRow = isHeaderCandidate;

    // 探测相邻单元格之间的水平距离跳跃 (间距大于一定阈值视为不同单元格/列)
    const segments: string[] = [];
    let currentCellStr = '';

    for (let i = 0; i < row.items.length; i++) {
      const cur = row.items[i];
      const prev = i > 0 ? row.items[i - 1] : null;

      if (prev) {
        const gap = cur.x - (prev.x + prev.width);
        // 如果水平间距明显大于常规空格间隙（例如大于 12pt），判定为新的一列
        if (gap > 12) {
          if (currentCellStr.trim()) {
            segments.push(currentCellStr.trim());
          }
          currentCellStr = cur.str;
          isTableRow = true;
          continue;
        }
      }

      currentCellStr += (currentCellStr ? ' ' : '') + cur.str;
    }

    if (currentCellStr.trim()) {
      segments.push(currentCellStr.trim());
    }

    // 若该行检测到 3 个及以上独立列或包含表头特征，将其格式化为 Markdown 规整表格行
    if (segments.length >= 3 || (isHeaderCandidate && segments.length >= 2)) {
      pageHasTable = true;
      lineOutputs.push('| ' + segments.join(' | ') + ' |');
    } else {
      lineOutputs.push(segments.join(' '));
    }
  }

  return {
    pageText: lineOutputs.join('\n'),
    hasTable: pageHasTable,
  };
}

/**
 * 从 PDF 文件中提取并预处理清洗文本（支持内置表格结构智能还原）
 */
export async function extractTextFromPDF(
  file: File,
  options?: PDFExtractOptions
): Promise<PDFExtractResult> {
  if (!file) {
    throw new Error('未检测到有效的文件对象');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
    });

    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    const pagesToRead = options?.maxPages ? Math.min(options.maxPages, totalPages) : totalPages;
    let rawCombinedText = '';
    let docHasTable = false;

    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // 调用 2D 空间排版与表格结构还原算法
      const { pageText, hasTable } = reconstructPageLayoutAndTables(textContent.items as any[]);
      if (hasTable) {
        docHasTable = true;
      }

      rawCombinedText += `\n--- [第 ${i} 页] ---\n` + pageText;

      options?.onProgress?.(i, totalPages, pageText.length);
    }

    // 针对提取的文本进行深度清洗与格式规整
    const cleanResult = cleanDocumentText(rawCombinedText);

    // 检测是否为扫描件（平均每页提取到的有效汉字/字符过少）
    const avgCharsPerPage = totalPages > 0 ? cleanResult.cleanedLength / totalPages : 0;
    const isScannedWarning = totalPages >= 1 && avgCharsPerPage < 50;

    return {
      text: cleanResult.cleanedText,
      cleanResult,
      totalPages,
      extractedPages: pagesToRead,
      isScannedWarning,
      hasTableStructure: docHasTable,
    };
  } catch (error: any) {
    if (error.name === 'PasswordException') {
      throw new Error('该 PDF 文档已加密或设置了阅读密码，请先解密后再上传');
    }
    if (error.name === 'InvalidPDFException') {
      throw new Error('文件不是合法的 PDF 格式或文件已损坏');
    }
    throw new Error(`PDF 解析失败: ${error.message || '未知解析错误'}`);
  }
}
