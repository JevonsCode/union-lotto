// 查看lotto-data.json文件 data.length
import fs from 'fs';

try {
  // 读取lotto-data.json文件
  const data = JSON.parse(fs.readFileSync('./lotto-data.json', 'utf8'));
  
  console.log('lotto-data.json 数据统计:');
  console.log('- 数据总数量:', data.length);
  
  if (data.length > 0) {
    console.log('- 最新期号:', data[0].issue);
    console.log('- 最早期号:', data[data.length - 1].issue);
    console.log('- 示例数据结构:', Object.keys(data[0]));
  }
  
} catch (error) {
  console.error('读取文件时出错:', error.message);
}



