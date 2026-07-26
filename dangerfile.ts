import { danger, fail, warn } from 'danger';

const LINE_THRESHOLD = 500;
const FILE_THRESHOLD = 10;

const INCLUDE_PREFIXES = ['app/', 'src/', 'components/'] as const;

const EXCLUDE_PATTERNS: ReadonlyArray<RegExp> = [
  /^tests\//,
  /^src\/types\/database\.types\.ts$/,
  /^pnpm-lock\.yaml$/,
  /^supabase\/migrations\//,
  // markdown ファイルは行数・ファイル数の集計対象外（Issue #114）。
  // .md / .mdx を大文字小文字問わず除外する。
  /\.mdx?$/i,
];

const isProductionFile = (filePath: string): boolean => {
  if (!INCLUDE_PREFIXES.some((prefix) => filePath.startsWith(prefix))) {
    return false;
  }
  return !EXCLUDE_PATTERNS.some((pattern) => pattern.test(filePath));
};

// danger-js の diffForFile が返す added / removed は「追加 / 削除された行の中身のみ」を
// EOL で連結した文字列。空文字列のときは 0 行扱いにしないと "".split('\n').length が 1 を返す。
const countDiffLines = (text: string | undefined): number => {
  if (!text) return 0;
  return text.split('\n').length;
};

const productionFiles = [...danger.git.created_files, ...danger.git.modified_files].filter(
  isProductionFile,
);

const guidelineLink =
  '[`docs/development-guidelines.md`](../blob/main/docs/development-guidelines.md) の「PRの大きさの目安」';

const run = async (): Promise<void> => {
  let totalChangedLines = 0;
  for (const file of productionFiles) {
    const diff = await danger.git.diffForFile(file);
    if (!diff) continue;
    totalChangedLines += countDiffLines(diff.added) + countDiffLines(diff.removed);
  }

  if (totalChangedLines > LINE_THRESHOLD) {
    fail(
      [
        `プロダクションコード（\`app/\` \`src/\` \`components/\`、markdown は除く）の追加・変更行数が **${totalChangedLines} 行** で、上限 ${LINE_THRESHOLD} 行を超えています。`,
        'PR を関心事ごとに分割してください。',
        `詳細: ${guidelineLink}。`,
      ].join(' '),
    );
  }

  if (productionFiles.length > FILE_THRESHOLD) {
    warn(
      [
        `プロダクションコードの変更ファイル数が **${productionFiles.length} ファイル** で、推奨上限 ${FILE_THRESHOLD} ファイルを超えています。`,
        '関心事ごとに PR を分割すると、レビュー負荷を下げられます。',
        `詳細: ${guidelineLink}。`,
      ].join(' '),
    );
  }
};

void run();
