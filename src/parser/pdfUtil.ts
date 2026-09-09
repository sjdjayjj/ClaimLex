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
}

/**
 * 从 PDF 文件中提取并预处理清洗文本
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

    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // 提取本页文本并处理换行与间距
      const pageItems: string[] = [];
      for (const item of textContent.items as any[]) {
        if (item.str) {
          pageItems.push(item.str);
          // 如果带有换行标记
          if (item.hasEOL) {
            pageItems.push('\n');
          }
        }
      }
      
      const pageText = pageItems.join(' ');
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
