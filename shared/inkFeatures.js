// Client-safe ink grid helpers (no Node / process.env).

export const KID_NOUNS_ZH = [
  '小鱼', '小鸟', '小猫', '小狗', '太阳', '月亮', '星星', '小花', '大树',
  '小房子', '小船', '苹果', '气球', '云朵', '彩虹', '小车', '蝴蝶', '兔子',
  '小人儿', '心心', '蛋糕', '冰激凌', '西瓜', '雪人', '蜗牛',
];

export const KID_NOUNS_EN = [
  'fish', 'bird', 'cat', 'dog', 'sun', 'moon', 'star', 'flower', 'tree',
  'house', 'boat', 'apple', 'balloon', 'cloud', 'rainbow', 'car', 'butterfly', 'rabbit',
  'person', 'heart', 'cake', 'ice cream', 'watermelon', 'snowman', 'snail',
];

export function computeFeatures(grid) {
  const lines = grid.split('\n').filter(Boolean);
  const rows = lines.length;
  const cols = lines[0]?.length || 1;
  let minX = cols;
  let maxX = 0;
  let minY = rows;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (lines[y][x] === '#') {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  return {
    aspect: w / h,
    density: count / (rows * cols),
    bboxFill: count / (w * h),
    inkCells: count,
  };
}
