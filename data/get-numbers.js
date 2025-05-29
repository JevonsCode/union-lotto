/**
 * https://www.zhcw.com/kjxx/ssq/ 是双色球历史网站
 * 爬虫脚本，通过API接口获取双色球历史数据
 */

import fs from 'fs';
import https from 'https';
import { URL } from 'url';
import zlib from 'zlib';

// API基础URL
const BASE_URL = 'https://jc.zhcw.com/port/client_json.php';

// 生成随机数用于URL参数
function generateRandomParams() {
  const timestamp = Date.now();
  const random = Math.random().toString().substring(2);
  return {
    callback: `jQuery1122020727164605304327_${timestamp}`,
    tt: Math.random(),
    _: timestamp
  };
}

// 构建API URL
function buildApiUrl(pageNum) {
  const params = generateRandomParams();
  const urlParams = new URLSearchParams({
    callback: params.callback,
    transactionType: '10001001',
    lotteryId: '1',
    issueCount: '10000', // 设置一个较大的值来获取更多历史数据
    startIssue: '',
    endIssue: '',
    startDate: '',
    endDate: '',
    type: '0',
    pageNum: pageNum.toString(),
    pageSize: '100', // 每页100条数据
    tt: params.tt.toString(),
    _: params._.toString()
  });
  
  return `${BASE_URL}?${urlParams.toString()}`;
}

// 发送HTTP请求
function fetchData(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.zhcw.com/',
        'Origin': 'https://www.zhcw.com',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'script',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-site'
      }
    };

    console.log('请求选项:', options);
    
    const req = https.request(options, (res) => {
      console.log('响应状态码:', res.statusCode);
      console.log('响应头:', res.headers);
      
      let stream = res;
      
      // 检查是否需要解压缩
      const encoding = res.headers['content-encoding'];
      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
        console.log('使用gzip解压缩');
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
        console.log('使用deflate解压缩');
      } else if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
        console.log('使用brotli解压缩');
      }
      
      let data = '';
      
      stream.on('data', (chunk) => {
        data += chunk;
      });
      
      stream.on('end', () => {
        try {
          console.log('解压后数据长度:', data.length);
          console.log('前200字符:', data.substring(0, 200));
          
          if (data.length === 0) {
            reject(new Error('Empty response from server'));
            return;
          }
          
          // 改进的JSONP解析逻辑
          let jsonData;
          
          // 尝试多种JSONP格式解析
          const patterns = [
            /jQuery\d+_\d+\((.*)\)/,
            /jQuery.*?\((.*)\)/,
            /callback\((.*)\)/,
            /^[^(]*\((.*)\)$/
          ];
          
          for (const pattern of patterns) {
            const match = data.match(pattern);
            if (match && match[1]) {
              try {
                jsonData = JSON.parse(match[1]);
                console.log('成功解析JSONP，使用模式:', pattern);
                break;
              } catch (e) {
                console.log('尝试解析失败:', e.message);
                continue;
              }
            }
          }
          
          // 如果JSONP解析失败，尝试直接解析JSON
          if (!jsonData) {
            try {
              jsonData = JSON.parse(data);
              console.log('直接解析JSON成功');
            } catch (e) {
              console.error('所有解析方法都失败了');
              console.error('响应数据:', data.substring(0, 500));
              reject(new Error('Failed to parse response'));
              return;
            }
          }
          
          resolve(jsonData);
        } catch (error) {
          console.error('解析过程中发生错误:', error.message);
          reject(error);
        }
      });
      
      stream.on('error', (error) => {
        console.error('流解压错误:', error.message);
        reject(error);
      });
    });

    req.on('error', (error) => {
      console.error('请求错误:', error.message);
      reject(error);
    });

    req.end();
  });
}

// 转换数据格式以匹配现有的lotto-data.json格式
function transformData(apiData) {
  console.log('API返回数据结构:', Object.keys(apiData));
  
  // 根据实际API返回格式，数据在data字段中
  if (!apiData.data || !Array.isArray(apiData.data)) {
    console.log('data字段不存在或不是数组:', apiData.data);
    return [];
  }
  
  console.log('data数组长度:', apiData.data.length);
  if (apiData.data.length > 0) {
    console.log('第一条数据结构:', Object.keys(apiData.data[0]));
  }
  
  return apiData.data.map(item => ({
    issue: item.issue,
    openTime: item.openTime,
    frontWinningNum: item.frontWinningNum,
    backWinningNum: item.backWinningNum,
    seqFrontWinningNum: item.seqFrontWinningNum || item.frontWinningNum,
    seqBackWinningNum: item.seqBackWinningNum || item.backWinningNum,
    saleMoney: item.saleMoney || '',
    r9SaleMoney: item.r9SaleMoney || '',
    prizePoolMoney: item.prizePoolMoney || '',
    week: item.week || '',
    winnerDetails: item.winnerDetails || []
  }));
}

// 主函数
async function crawlLottoData() {
  console.log('开始爬取双色球历史数据...');
  
  const allData = [];
  let pageNum = 1;
  let hasMoreData = true;
  
  while (hasMoreData) {
    try {
      console.log(`正在爬取第 ${pageNum} 页数据...`);
      
      const url = buildApiUrl(pageNum);
      console.log('请求URL:', url);
      
      const response = await fetchData(url);
      console.log('API响应成功，数据类型:', typeof response);
      
      if (response && response.data && response.data.length > 0) {
        const transformedData = transformData(response);
        allData.push(...transformedData);
        
        console.log(`第 ${pageNum} 页获取到 ${transformedData.length} 条数据，累计: ${allData.length} 条`);
        
        // 检查是否还有更多数据
        const currentPage = parseInt(response.pageNum);
        const totalPages = parseInt(response.pages);
        const pageSize = parseInt(response.pageSize);
        
        console.log(`当前页: ${currentPage}/${totalPages}, 每页: ${pageSize} 条`);
        
        if (currentPage >= totalPages || transformedData.length < pageSize) {
          console.log('已获取所有数据');
          hasMoreData = false;
        } else {
          pageNum++;
        }
      } else {
        console.log('没有更多数据，爬取完成');
        hasMoreData = false;
      }
      
      // 添加延迟，避免请求过于频繁
      if (hasMoreData) {
        console.log('等待1秒后继续...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`爬取第 ${pageNum} 页时出错:`, error.message);
      
      // 如果是第一页就出错，则退出
      if (pageNum === 1) {
        throw error;
      }
      
      // 其他页出错则停止爬取
      console.log('由于错误停止爬取');
      hasMoreData = false;
    }
  }
  
  console.log(`爬取完成，共获取 ${allData.length} 条数据`);
  
  if (allData.length > 0) {
    // 保存所有数据到主文件
    const jsonData = JSON.stringify(allData, null, 2);
    fs.writeFileSync('./data/lotto-data.json', jsonData, 'utf8');
    console.log(`所有数据已保存到 ./data/lotto-data.json (${allData.length} 条记录)`);
    
    // 显示一些统计信息
    if (allData.length > 0) {
      const firstIssue = allData[allData.length - 1].issue;
      const lastIssue = allData[0].issue;
      console.log(`数据范围: 第 ${firstIssue} 期 至 第 ${lastIssue} 期`);
    }
  } else {
    console.log('没有获取到任何数据');
  }
}

// 运行爬虫
crawlLottoData().catch(error => {
  console.error('爬虫运行失败:', error.message);
  process.exit(1);
});