/**
 * 双色球数据增量更新脚本。
 *
 * 数据源使用乐彩网近 300 期开奖列表。每次运行只追加本地不存在的期号，
 * 并用已有重叠期号校验日期、号码和出球顺序，校验失败时不会写文件。
 */

import fs from 'fs';
import https from 'https';

const DATA_FILE = new URL('./lotto-data.json', import.meta.url);
const SOURCE_URL = 'https://www.17500.cn/api/kaijiang/getlist';
const SOURCE_ORIGIN = 'https://www.17500.cn';
const REQUEST_BODY = new URLSearchParams({
  lotid: 'ssq',
  limit: '300',
  year: ''
}).toString();

function fetchHistoryHtml() {
  return new Promise((resolve, reject) => {
    const request = https.request(SOURCE_URL, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html, */*; q=0.01',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(REQUEST_BODY),
        'Origin': SOURCE_ORIGIN,
        'Referer': SOURCE_ORIGIN + '/kj/list-ssq.html',
        'X-Requested-With': 'XMLHttpRequest',
        'Connection': 'close'
      }
    }, (response) => {
      const chunks = [];

      response.on('data', (chunk) => chunks.push(chunk));
      response.on('aborted', () => reject(new Error('数据源提前中断了连接')));
      response.on('error', reject);
      response.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf8');

        if (response.statusCode !== 200) {
          reject(new Error('数据源返回 HTTP ' + response.statusCode));
          return;
        }

        if (html.length < 1000) {
          reject(new Error('数据源返回内容过短，拒绝更新'));
          return;
        }

        resolve(html);
      });
    });

    request.setTimeout(30000, () => {
      request.destroy(new Error('请求数据源超时'));
    });
    request.on('error', reject);
    request.write(REQUEST_BODY);
    request.end();
  });
}

function htmlToText(html) {
  return html
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMoney(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeBallText(value) {
  const numbers = String(value || '').match(/\d{2}/g);
  return numbers ? numbers.join(' ') : '';
}

function getWeekLabel(dateText) {
  const day = new Date(dateText + 'T00:00:00Z').getUTCDay();
  return '星期' + '日一二三四五六'[day];
}

function parseHistory(html) {
  const records = [];

  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rawCells = Array.from(
      rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi),
      (match) => match[1]
    );

    if (rawCells.length < 6) continue;

    const cells = rawCells.map(htmlToText);
    const issue = cells[0];
    const openTime = cells[1];

    if (!/^20\d{5}$/.test(issue) || !/^\d{4}-\d{2}-\d{2}$/.test(openTime)) {
      continue;
    }

    const winningNumbers = cells[2].match(/\d{2}/g) || [];
    const sequenceNumbers = cells[3].match(/\d{2}/g) || [];

    // 未开奖的未来期号会以“-”占位，等下一次定时任务再处理。
    if (winningNumbers.length !== 7 || sequenceNumbers.length !== 6) {
      continue;
    }

    const redNumbers = winningNumbers.slice(0, 6);
    const blueNumber = winningNumbers[6];
    const sortedRedNumbers = [...redNumbers].sort((a, b) => Number(a) - Number(b));
    const sortedSequenceNumbers = [...sequenceNumbers].sort((a, b) => Number(a) - Number(b));
    const redNumbersAreValid = redNumbers.every((number) => Number(number) >= 1 && Number(number) <= 33);
    const blueNumberIsValid = Number(blueNumber) >= 1 && Number(blueNumber) <= 16;

    if (
      new Set(redNumbers).size !== 6 ||
      !redNumbersAreValid ||
      !blueNumberIsValid ||
      sortedRedNumbers.join(' ') !== redNumbers.join(' ') ||
      sortedSequenceNumbers.join(' ') !== redNumbers.join(' ')
    ) {
      throw new Error('期号 ' + issue + ' 的号码格式异常，拒绝更新');
    }

    const saleMoney = normalizeMoney(cells[4]);
    const prizePoolMoney = normalizeMoney(cells[5]);

    if (!saleMoney || !prizePoolMoney) {
      throw new Error('期号 ' + issue + ' 的金额字段异常，拒绝更新');
    }

    records.push({
      issue,
      openTime,
      frontWinningNum: redNumbers.join(' '),
      backWinningNum: blueNumber,
      seqFrontWinningNum: sequenceNumbers.join(' '),
      seqBackWinningNum: blueNumber,
      saleMoney,
      r9SaleMoney: '',
      prizePoolMoney,
      week: getWeekLabel(openTime),
      winnerDetails: []
    });
  }

  const uniqueRecords = new Map();
  for (const record of records) {
    if (!uniqueRecords.has(record.issue)) {
      uniqueRecords.set(record.issue, record);
    }
  }

  return Array.from(uniqueRecords.values()).sort((a, b) => Number(b.issue) - Number(a.issue));
}

function validateAgainstExisting(sourceData, existingData) {
  if (sourceData.length < 250) {
    throw new Error('只解析到 ' + sourceData.length + ' 条记录，低于安全阈值 250，拒绝更新');
  }

  const existingByIssue = new Map(existingData.map((record) => [record.issue, record]));
  const overlaps = sourceData.filter((record) => existingByIssue.has(record.issue)).slice(0, 20);

  if (overlaps.length < 10) {
    throw new Error('新旧数据重叠期号不足 10 条，无法安全校验');
  }

  for (const sourceRecord of overlaps) {
    const existingRecord = existingByIssue.get(sourceRecord.issue);
    const mismatchedFields = [];

    if (existingRecord.openTime !== sourceRecord.openTime) mismatchedFields.push('开奖日期');
    if (normalizeBallText(existingRecord.frontWinningNum) !== sourceRecord.frontWinningNum) mismatchedFields.push('红球');
    if (normalizeBallText(existingRecord.backWinningNum) !== sourceRecord.backWinningNum) mismatchedFields.push('蓝球');
    if (
      existingRecord.seqFrontWinningNum &&
      normalizeBallText(existingRecord.seqFrontWinningNum) !== sourceRecord.seqFrontWinningNum
    ) {
      mismatchedFields.push('出球顺序');
    }

    if (mismatchedFields.length > 0) {
      throw new Error(
        '期号 ' + sourceRecord.issue + ' 的' + mismatchedFields.join('、') + '与现有数据不一致，拒绝更新'
      );
    }
  }
}

async function crawlLottoData() {
  console.log('开始检查双色球最新数据...');

  const existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(existingData) || existingData.length < 3000) {
    throw new Error('本地历史数据不完整，拒绝覆盖');
  }

  const html = await fetchHistoryHtml();
  const sourceData = parseHistory(html);
  validateAgainstExisting(sourceData, existingData);

  const existingIssues = new Set(existingData.map((record) => record.issue));
  const newRecords = sourceData.filter((record) => !existingIssues.has(record.issue));

  if (newRecords.length === 0) {
    console.log('当前数据已经是最新，无需写入文件。');
    return;
  }

  const mergedData = [...newRecords, ...existingData]
    .sort((a, b) => Number(b.issue) - Number(a.issue));
  const uniqueIssueCount = new Set(mergedData.map((record) => record.issue)).size;

  if (uniqueIssueCount !== mergedData.length) {
    throw new Error('合并后出现重复期号，拒绝写入');
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(mergedData, null, 2), 'utf8');
  console.log(
    '已新增 ' + newRecords.length + ' 期：' +
    newRecords[newRecords.length - 1].issue + ' 至 ' + newRecords[0].issue
  );
  console.log('最新一期：' + mergedData[0].issue + '（' + mergedData[0].openTime + '）');
  console.log('总记录数：' + mergedData.length);
}

crawlLottoData().catch((error) => {
  console.error('双色球数据更新失败：' + error.message);
  process.exitCode = 1;
});
