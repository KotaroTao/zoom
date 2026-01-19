/**
 * OpenAI GPT 要約処理
 * 認証情報はDBから取得（環境変数をフォールバック）
 */

import OpenAI from 'openai';
import { config } from '../../config/env.js';
import { getOpenAICredentials } from '../credentials/index.js';
import { logger } from '../../utils/logger.js';
import {
  createSummaryPrompt,
  createBriefSummaryPrompt,
  createBulletSummaryPrompt,
  createStructuredSummaryPrompt,
} from './prompts.js';
import type { SummaryResult, SummaryOptions, StructuredSummary } from './types.js';

/**
 * OpenAIクライアントを取得（DBから認証情報を取得）
 */
async function getOpenAIClient(): Promise<OpenAI> {
  const creds = await getOpenAICredentials();
  return new OpenAI({
    apiKey: creds.apiKey,
  });
}

// トークン制限（GPT-4のコンテキスト長を考慮）
const MAX_INPUT_CHARS = 100000; // 約25,000トークン相当

/**
 * テキストを要約
 */
export async function generateSummary(
  transcript: string,
  options: SummaryOptions = {}
): Promise<SummaryResult> {
  logger.info('要約生成開始', {
    textLength: transcript.length,
    clientName: options.clientName,
    style: options.style || 'detailed',
  });

  try {
    // テキストが長すぎる場合は切り詰め
    let processedTranscript = transcript;
    if (transcript.length > MAX_INPUT_CHARS) {
      logger.warn('テキストが長いため切り詰めます', {
        original: transcript.length,
        limit: MAX_INPUT_CHARS,
      });
      processedTranscript = transcript.substring(0, MAX_INPUT_CHARS) + '\n\n[...続きは省略...]';
    }

    // スタイルに応じたプロンプトを選択
    let prompt: string;
    switch (options.style) {
      case 'brief':
        prompt = createBriefSummaryPrompt(processedTranscript, options);
        break;
      case 'bullet':
        prompt = createBulletSummaryPrompt(processedTranscript, options);
        break;
      default:
        prompt = createSummaryPrompt(processedTranscript, options);
    }

    // OpenAIクライアントを取得（DBから認証情報）
    const openai = await getOpenAIClient();

    // GPT-4で要約生成
    const response = await openai.chat.completions.create({
      model: config.openai.gptModel || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content:
            'あなたはビジネスミーティングの要約を行う専門家です。重要なポイントを漏らさず、簡潔にまとめてください。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // 一貫性のために低めに設定
      max_tokens: 2000,
    });

    const summary = response.choices[0]?.message?.content;
    if (!summary) {
      throw new Error('要約が生成されませんでした');
    }

    // 要約からキーポイントを抽出
    const keyPoints = extractKeyPoints(summary);
    const actionItems = extractActionItems(summary);

    logger.info('要約生成完了', {
      summaryLength: summary.length,
      keyPointsCount: keyPoints.length,
      actionItemsCount: actionItems.length,
    });

    return {
      success: true,
      summary,
      keyPoints,
      actionItems,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('要約生成失敗', { error: errorMessage });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 構造化された要約を生成
 */
export async function generateStructuredSummary(
  transcript: string,
  options: SummaryOptions = {}
): Promise<{ success: boolean; data?: StructuredSummary; error?: string }> {
  logger.info('構造化要約生成開始', {
    textLength: transcript.length,
    clientName: options.clientName,
  });

  try {
    let processedTranscript = transcript;
    if (transcript.length > MAX_INPUT_CHARS) {
      processedTranscript = transcript.substring(0, MAX_INPUT_CHARS) + '\n\n[...続きは省略...]';
    }

    const prompt = createStructuredSummaryPrompt(processedTranscript, options);

    // OpenAIクライアントを取得（DBから認証情報）
    const openai = await getOpenAIClient();

    const response = await openai.chat.completions.create({
      model: config.openai.gptModel || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content:
            'あなたはミーティング内容を構造化して整理する専門家です。指定されたJSON形式で正確に出力してください。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('レスポンスが空です');
    }

    const data = JSON.parse(content) as StructuredSummary;

    logger.info('構造化要約生成完了', {
      keyPointsCount: data.keyPoints?.length || 0,
      decisionsCount: data.decisions?.length || 0,
      actionItemsCount: data.actionItems?.length || 0,
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('構造化要約生成失敗', { error: errorMessage });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 要約テキストからキーポイントを抽出
 */
function extractKeyPoints(summary: string): string[] {
  const points: string[] = [];

  // 「主な議論」「議論ポイント」セクションを探す
  const discussionMatch = summary.match(/##?\s*主な議論[\s\S]*?(?=##|$)/i);
  if (discussionMatch) {
    const bulletPoints = discussionMatch[0].match(/[-•]\s*(.+)/g);
    if (bulletPoints) {
      points.push(...bulletPoints.map((p) => p.replace(/^[-•]\s*/, '').trim()));
    }
  }

  // 箇条書きを抽出（フォールバック）
  if (points.length === 0) {
    const allBullets = summary.match(/[-•]\s*(.+)/g);
    if (allBullets) {
      points.push(...allBullets.slice(0, 5).map((p) => p.replace(/^[-•]\s*/, '').trim()));
    }
  }

  return points;
}

/**
 * 要約テキストからアクションアイテムを抽出
 */
function extractActionItems(summary: string): string[] {
  const items: string[] = [];

  // 「アクションアイテム」セクションを探す
  const actionMatch = summary.match(/##?\s*アクションアイテム[\s\S]*?(?=##|$)/i);
  if (actionMatch) {
    const checkboxItems = actionMatch[0].match(/[-•\[\]]\s*\[?\s*[x ]?\s*\]?\s*(.+)/g);
    if (checkboxItems) {
      items.push(
        ...checkboxItems.map((item) =>
          item
            .replace(/^[-•]\s*/, '')
            .replace(/\[[ x]?\]\s*/, '')
            .trim()
        )
      );
    }
  }

  return items;
}

/**
 * 長いテキストを分割して要約（チャンク処理）
 */
export async function summarizeLongText(
  transcript: string,
  options: SummaryOptions = {}
): Promise<SummaryResult> {
  const chunkSize = 50000; // 約12,500トークン

  if (transcript.length <= chunkSize) {
    return generateSummary(transcript, options);
  }

  logger.info('長文テキストのチャンク処理開始', {
    totalLength: transcript.length,
    chunkSize,
  });

  // テキストを分割
  const chunks: string[] = [];
  for (let i = 0; i < transcript.length; i += chunkSize) {
    chunks.push(transcript.substring(i, i + chunkSize));
  }

  logger.debug('チャンク数', { count: chunks.length });

  // 各チャンクを要約
  const chunkSummaries: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    logger.debug(`チャンク ${i + 1}/${chunks.length} を処理中`);

    const result = await generateSummary(chunks[i], {
      ...options,
      style: 'bullet',
    });

    if (result.success && result.summary) {
      chunkSummaries.push(`【パート${i + 1}】\n${result.summary}`);
    }
  }

  // チャンク要約を統合
  const combinedSummary = chunkSummaries.join('\n\n');

  logger.debug('チャンク要約を統合中', {
    combinedLength: combinedSummary.length,
  });

  // 最終要約を生成
  return generateSummary(
    `以下は長時間ミーティングを分割して要約したものです。全体を統合した最終要約を作成してください。\n\n${combinedSummary}`,
    options
  );
}
