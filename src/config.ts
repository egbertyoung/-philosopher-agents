/**
 * 应用配置文件
 */

export const APP_CONFIG = {
  /** 应用名称 */
  name: '哲学家对话',

  /** 应用名称首字母（用于 Logo） */
  nameInitial: '哲',

  /** 应用描述 */
  description: '与古今中外哲学大师对话，探索智慧之源',

  /** 版本号 */
  version: '1.0.0',
};

export default APP_CONFIG;

/**
 * 哲学家配置（前端）
 */
export const PHILOSOPHERS = [
  {
    id: 'aristotle',
    name: '亚里士多德',
    nameEn: 'Aristotle',
    era: '公元前384–322年',
    origin: '古希腊',
    emoji: '🏛️',
    color: '#1677FF',
    description: '古希腊哲学家，逻辑学、形而上学、伦理学的奠基人',
  },
  {
    id: 'confucius',
    name: '孔子',
    nameEn: 'Confucius',
    era: '公元前551–479年',
    origin: '中国鲁国',
    emoji: '📜',
    color: '#52C41A',
    description: '中国古代思想家、教育家，儒家学派创始人',
  },
  {
    id: 'hegel',
    name: '黑格尔',
    nameEn: 'Hegel',
    era: '1770–1831年',
    origin: '德国',
    emoji: '⚡',
    color: '#722ED1',
    description: '德国古典哲学集大成者，辩证法与历史哲学的奠基人',
  },
  {
    id: 'zhuangzi',
    name: '庄子',
    nameEn: 'Zhuangzi',
    era: '约公元前369–286年',
    origin: '中国宋国',
    emoji: '🦋',
    color: '#FA8C16',
    description: '道家哲学代表，逍遥游与齐物论作者',
  },
];
