/**
 * 要約用プロンプトテンプレート
 */

import type { SummaryOptions } from './types.js';

/**
 * 基本的な要約プロンプト
 */
export function createSummaryPrompt(
  transcript: string,
  options: SummaryOptions = {}
): string {
  const clientInfo = options.clientName ? `【クライアント】${options.clientName}\n` : '';
  const titleInfo = options.meetingTitle ? `【ミーティング】${options.meetingTitle}\n` : '';
  const contextInfo = options.context ? `【補足情報】${options.context}\n` : '';
  const maxLength = options.maxLength || 500;

  return `以下はミーティングの文字起こしです。日本語で要約してください。

${clientInfo}${titleInfo}${contextInfo}

【要約の要件】
- ${maxLength}文字以内で簡潔にまとめる
- 重要な議論ポイントを箇条書きで含める
- 決定事項があれば明記する
- アクションアイテム（誰が何をいつまでに）があれば列挙する
- 次回のミーティング予定があれば記載する

【文字起こし】
${transcript}

【出力形式】
## 概要
（ミーティングの概要を1-2文で）

## 主な議論
- ポイント1
- ポイント2
- ...

## 決定事項
- 決定1
- 決定2
- ...

## アクションアイテム
- [ ] タスク1（担当者、期限）
- [ ] タスク2（担当者、期限）
- ...

## 次のステップ
- フォローアップ事項
`;
}

/**
 * 簡潔な要約プロンプト（短め）
 */
export function createBriefSummaryPrompt(
  transcript: string,
  options: SummaryOptions = {}
): string {
  const clientInfo = options.clientName ? `（${options.clientName}）` : '';

  return `以下のミーティング${clientInfo}の文字起こしを、3-5行で簡潔に要約してください。
重要な決定事項とアクションアイテムがあれば必ず含めてください。

【文字起こし】
${transcript}

【要約】`;
}

/**
 * 箇条書き要約プロンプト
 */
export function createBulletSummaryPrompt(
  transcript: string,
  options: SummaryOptions = {}
): string {
  const clientInfo = options.clientName ? `【クライアント】${options.clientName}\n` : '';

  return `以下のミーティングの文字起こしを箇条書きで要約してください。

${clientInfo}

【文字起こし】
${transcript}

【出力形式】
• 要点1
• 要点2
• 要点3
...

（5-10個の箇条書きで、最も重要な内容を抽出してください）`;
}

/**
 * 構造化要約プロンプト（JSON出力）
 */
export function createStructuredSummaryPrompt(
  transcript: string,
  options: SummaryOptions = {}
): string {
  const clientInfo = options.clientName ? `【クライアント】${options.clientName}\n` : '';
  const titleInfo = options.meetingTitle ? `【ミーティング】${options.meetingTitle}\n` : '';

  return `以下のミーティングの文字起こしを分析し、JSON形式で構造化された要約を出力してください。

${clientInfo}${titleInfo}

【文字起こし】
${transcript}

【出力形式】
以下のJSON形式で出力してください：
{
  "overview": "ミーティングの概要（1-2文）",
  "keyPoints": ["議論ポイント1", "議論ポイント2", ...],
  "decisions": ["決定事項1", "決定事項2", ...],
  "actionItems": [
    {"task": "タスク内容", "assignee": "担当者名（不明な場合はnull）", "deadline": "期限（不明な場合はnull）"},
    ...
  ],
  "nextSteps": ["次のステップ1", "次のステップ2", ...]
}

JSONのみを出力し、他のテキストは含めないでください。`;
}

/**
 * クライアント向けサマリープロンプト
 */
export function createClientSummaryPrompt(
  transcript: string,
  clientName: string,
  previousContext?: string
): string {
  const contextInfo = previousContext
    ? `【過去のやりとり】\n${previousContext}\n\n`
    : '';

  return `以下は${clientName}様とのミーティングの文字起こしです。
クライアントとの関係構築の観点から、重要なポイントを要約してください。

${contextInfo}

【文字起こし】
${transcript}

【要約の観点】
1. クライアントのニーズや課題
2. 提案した解決策
3. クライアントの反応や懸念点
4. 合意した事項
5. 次回までのアクション

【出力形式】
## ${clientName}様 ミーティングサマリー

### ニーズ・課題
- ...

### 提案内容
- ...

### 合意事項
- ...

### 次回アクション
- ...

### 補足メモ
- ...`;
}

/**
 * 包括的な詳細要約プロンプト（長文・詳細版）
 */
export function createComprehensiveSummaryPrompt(
  transcript: string,
  options: SummaryOptions = {}
): string {
  const clientInfo = options.clientName ? `【クライアント】${options.clientName}\n` : '';
  const titleInfo = options.meetingTitle ? `【ミーティング】${options.meetingTitle}\n` : '';

  return `以下はミーティングの文字起こしです。可能な限り詳細で包括的な要約を作成してください。
情報を省略せず、ミーティングの内容を完全に把握できるレベルの要約を目指してください。

${clientInfo}${titleInfo}

【要約の要件】
- 制限なく、必要な分だけ詳細に記載してください
- 議論の流れが分かるように時系列で整理してください
- 具体的な数字、日付、金額などは必ず記載してください
- 各参加者の発言や意見を可能な限り含めてください
- 質疑応答の内容も詳細に記録してください
- 暗黙の合意事項や未解決の課題も明記してください

【文字起こし】
${transcript}

【出力形式】
## ミーティング詳細要約

### 1. ミーティング概要
（目的、参加者、日時などの基本情報）

### 2. 議論の詳細

#### 2.1 議題1: [議題名]
- 背景・経緯
- 議論内容（誰が何を発言したか）
- 結論・決定事項

#### 2.2 議題2: [議題名]
（同様の形式で続ける）

### 3. 質疑応答・ディスカッション
- Q: 質問内容
- A: 回答内容
（やりとりを詳細に記録）

### 4. 決定事項一覧
| No | 決定事項 | 詳細 | 担当 |
|----|----------|------|------|
| 1  | ...      | ...  | ...  |

### 5. アクションアイテム
| No | タスク | 担当者 | 期限 | 優先度 |
|----|--------|--------|------|--------|
| 1  | ...    | ...    | ...  | ...    |

### 6. 未解決事項・持ち越し課題
- 課題1: 詳細説明
- 課題2: 詳細説明

### 7. 次回に向けて
- 次回ミーティング予定
- 事前準備事項
- フォローアップ事項

### 8. その他メモ
- 重要な発言の引用
- 補足情報
- 注意点`;
}
