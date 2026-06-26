import Dexie from 'dexie'

const db = new Dexie('ChatAIDatabase')

db.version(1).stores({
  // 对话组
  conversations: '++id, title, characterId, worldBookId, createdAt, updatedAt',
  // 消息
  messages: '++id, conversationId, role, floor, hidden, createdAt',
  // 角色设定
  characters: '++id, name, createdAt',
  // 世界书
  worldBooks: '++id, name, createdAt',
  // 世界书条目
  worldBookEntries: '++id, worldBookId, name, enabled',
  // 总结
  summaries: '++id, conversationId, fromFloor, toFloor, createdAt',
  // 行程表
  schedules: '++id, date, type, createdAt'
})

// v2: 对话新增 aiAvatar 字段（非索引字段，无需修改 stores）
db.version(2).stores({
  conversations: '++id, title, characterId, worldBookId, createdAt, updatedAt',
  messages: '++id, conversationId, role, floor, hidden, createdAt',
  characters: '++id, name, createdAt',
  worldBooks: '++id, name, createdAt',
  worldBookEntries: '++id, worldBookId, name, enabled',
  summaries: '++id, conversationId, fromFloor, toFloor, createdAt',
  schedules: '++id, date, type, createdAt'
})

// v3: 行程表新增 characterId 索引
db.version(3).stores({
  conversations: '++id, title, characterId, worldBookId, createdAt, updatedAt',
  messages: '++id, conversationId, role, floor, hidden, createdAt',
  characters: '++id, name, createdAt',
  worldBooks: '++id, name, createdAt',
  worldBookEntries: '++id, worldBookId, name, enabled',
  summaries: '++id, conversationId, fromFloor, toFloor, createdAt',
  schedules: '++id, date, type, characterId, createdAt'
})

// v4: 移除行程表
db.version(4).stores({
  conversations: '++id, title, characterId, worldBookId, createdAt, updatedAt',
  messages: '++id, conversationId, role, floor, hidden, createdAt',
  characters: '++id, name, createdAt',
  worldBooks: '++id, name, createdAt',
  worldBookEntries: '++id, worldBookId, name, enabled',
  summaries: '++id, conversationId, fromFloor, toFloor, createdAt',
  schedules: null
})

export default db
