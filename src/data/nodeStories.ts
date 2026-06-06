import type { RouteNodeStory } from '../types';

const commons = 'https://commons.wikimedia.org/wiki/File:';

export const nodeStories: Record<string, RouteNodeStory> = {
  feima: {
    image: '/assets/nodes/jiangyin-feima.jpg',
    imageSource: `${commons}Jiangyin,_Wuxi,_Jiangsu,_China_-_panoramio.jpg`,
    teaser: '赛季从江阴出发，第一段不追求速度，先让跑步和城市建立连接。',
    detail:
      '飞马水城云廊是这条城市探索线的出发口。用户从这里提交第一段跑量，地图上出现的不是冷冰冰的数字，而是一段被品牌记录下来的出发仪式：今天跑出去的几公里，会变成赛季路线上的第一束光。',
  },
  xinqiao: {
    image: '/assets/nodes/jiangyin-xinqiao.jpg',
    imageSource: `${commons}江阴中山公园雪浪湖.jpg`,
    teaser: '下一段会进入更轻盈的绿道节奏，适合把训练感和跑团互动拉起来。',
    detail:
      '新桥生态绿道代表的是跑者最熟悉的日常训练场：不用隆重，也不用很远，只要能持续回来。抵达这里后，系统会把连续训练、跑团榜单和小徽章放在一起，让用户感觉自己不是一个人在刷公里数。',
  },
  longzhuang: {
    image: '/assets/nodes/jiangyin-longzhuang.jpg',
    imageSource: `${commons}Nanhu_Village,_Yuecheng,_Jiangyin,_Wuxi.jpg`,
    teaser: '城市线会从训练进入探索，沿途节点开始出现生态和乡野的呼吸感。',
    detail:
      '龙庄生态园是路线里的转折点。前半程是建立习惯，抵达这里后，赛季开始强调“我正在认识这座城市”。文案、分享卡和节点彩蛋可以围绕生态、晨跑、周末轻远足展开，让普通训练多一点可讲述的画面。',
  },
  yuqiao: {
    image: '/assets/nodes/jiangyin-yuqiao.jpg',
    imageSource: `${commons}江阴中山公园旧门.jpg`,
    teaser: '老街节点会把城市记忆写进路线，分享卡也会更有文化识别度。',
    detail:
      '郁桥老街承接的是城市记忆。用户跑到这里时，系统可以给出一张带有老街纹样的节点卡，让“今天又跑了几公里”变成“我把江阴的一段街巷点亮了”。这类内容很适合后续接入本地文旅或品牌故事共创。',
  },
  finish: {
    image: '/assets/nodes/jiangyin-finish.jpg',
    imageSource: `${commons}Jiangyin_Yangtze_River_bridge-2b.jpeg`,
    teaser: '终点会给用户一个明确的赛季身份，也自然承接权益和分享动作。',
    detail:
      '澜跑完赛广场是首条路线的收束点。完成 42.8 km 后，用户获得的不只是完赛提示，而是一个可展示的品牌赛季身份：完赛徽章、权益资格、跑团荣誉和个人分享卡都在这里汇合，形成继续参加下一季的理由。',
  },
  nanjing: {
    image: '/assets/nodes/nanjing-start.jpg',
    imageSource: `${commons}Nanjing_City_Wall_and_Moat.jpg`,
    teaser: '锡马训练线从南京出发，把赛前一个月变成一段有方向的远征。',
    detail:
      '南京起跑门像一场赛前训练营的入场牌。用户选择这条线后，系统把“我要为锡马准备”转化成一个可推进的数字远征，适合承接赛事报名用户、跑团训练计划和品牌赛季传播。',
  },
  zhenjiang: {
    image: '/assets/nodes/zhenjiang-river.jpg',
    imageSource: `${commons}镇江长江滨_-_Yangtze_River_Coast_-_2015.04_-_panoramio.jpg`,
    teaser: '镇江江岸段会提示本周节奏，帮助用户在热情之后稳住训练。',
    detail:
      '镇江江岸段强调“节奏”。很多跑者不是缺一次冲劲，而是缺少能坚持一周的安排。抵达这里后，AI 陪跑者可以提醒用户控制强度、安排恢复，把品牌陪伴从鼓励扩展到更真实的训练支持。',
  },
  changzhou: {
    image: '/assets/nodes/wuxi-canal.jpg',
    imageSource: `${commons}Wuxi_Grand_Canal.jpg`,
    teaser: '补给站会把训练反馈和装备权益放到一起，形成自然的品牌触点。',
    detail:
      '常州补给站是路线中段的能量点。这里适合出现装备补给券、袜子/速干衣抽奖、跑团补水提醒等轻量权益，让用户感到品牌不是突然推销，而是在一段真实训练最需要补给的时候出现。',
  },
  wuxi: {
    image: '/assets/nodes/wuxi-canal.jpg',
    imageSource: `${commons}Wuxi_Grand_Canal.jpg`,
    teaser: '锡马终点会把赛前训练和正式赛事情绪接上，适合做转发收尾。',
    detail:
      '无锡锡马终点是这条训练线的情绪终点。用户抵达这里时，系统可以生成“我已完成赛前数字远征”的分享卡，并把线下赛事、跑团合影、装备体验和品牌活动资格串起来，延长赛事热度。',
  },
  'loop-nanjing': {
    image: '/assets/nodes/nanjing-loop.jpg',
    imageSource: `${commons}East_Water_Gate_of_Nanjing_City_Wall,_2016-01-31.jpg`,
    teaser: '旗舰路线从南京开门，更适合跑团核心用户用累计里程共同推进。',
    detail:
      '南京赛季门是江苏大环线的开场。它不只服务个人，也可以服务跑团共同推进：每个人真实提交的跑量都会把团队往前推一点，适合制造“我们一起穿越江苏”的赛季叙事。',
  },
  'loop-xuzhou': {
    image: '/assets/nodes/xuzhou-yunlong.jpg',
    imageSource: `${commons}20260131_Yunlong_Lake_in_Xuzhou_01.jpg`,
    teaser: '徐州段会进入挑战感更强的区间，适合核心跑者和高跑量用户。',
    detail:
      '徐州挑战站代表旗舰路线的强度升级。抵达这里的用户已经积累了可观跑量，系统可以给出更有荣誉感的称号、跑团榜单高亮和挑战段提醒，让高投入跑者被看见。',
  },
  'loop-lianyungang': {
    image: '/assets/nodes/lianyungang-sea.jpg',
    imageSource: `${commons}连岛的海.JPG`,
    teaser: '海岸补给站会让旗舰路线从城市挑战进入跨城远征。',
    detail:
      '连云港海岸补给站让路线突然有了开阔感。这里适合做“海岸补给”主题彩蛋：恢复建议、能量补给、跑团合照任务，甚至可以和线下越野或城市文旅内容产生联动。',
  },
  'loop-suzhou': {
    image: '/assets/nodes/wuxi-canal.jpg',
    imageSource: `${commons}Wuxi_Grand_Canal.jpg`,
    teaser: '江南城市段会强调文化质感，适合给分享卡增加旗舰路线标识。',
    detail:
      '苏州城市段承担旗舰路线的文化层。用户跑到这里时，系统可以让分享卡切换成更精致的江南视觉，并展示团队已经跨过的城市节点，让长路线不只剩下数字。',
  },
  'loop-finish': {
    image: '/assets/nodes/wuxi-canal.jpg',
    imageSource: `${commons}Wuxi_Grand_Canal.jpg`,
    teaser: '最后的无锡礼台会收束整条大环线，给出赛季最高荣誉。',
    detail:
      '无锡完赛礼台是江苏大环线的最高荣誉点。它适合承接年度活动候选席位、跑团荣誉展示、品牌装备体验资格等更稀缺的权益，让完成者有足够强的身份感和传播理由。',
  },
};
