#!/usr/bin/env node

/**
 * 简单的 Redis 连接测试
 */

const Redis = require('ioredis')

async function testRedis() {
  console.log('🔍 测试 Railway Redis 连接...\n')

  const redisHost = process.env.REDIS_HOST || 'localhost'
  const redisPort = process.env.REDIS_PORT || 6379
  const redisPassword = process.env.REDIS_PASSWORD || ''

  console.log('📊 连接信息:')
  console.log(`   Host: ${redisHost}`)
  console.log(`   Port: ${redisPort}`)
  console.log(`   Password: ${redisPassword ? '✅ 已设置 (' + redisPassword.substring(0, 10) + '...)' : '❌ 未设置'}\n`)

  const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    retryStrategy: (times) => {
      if (times > 3) {
        return null // 停止重试
      }
      return Math.min(times * 100, 3000)
    },
    maxRetriesPerRequest: 3
  })

  try {
    // 1. Ping 测试
    console.log('1️⃣ Ping 测试...')
    const pong = await redis.ping()
    console.log(`   ✅ ${pong}\n`)

    // 2. 检查数据库大小
    console.log('2️⃣ 检查数据库大小...')
    const dbsize = await redis.dbsize()
    console.log(`   📊 Redis 中有 ${dbsize} 个 key\n`)

    if (dbsize === 0) {
      console.log('   ⚠️  Redis 是空的！可能原因:')
      console.log('      - 这是新的 Redis 实例')
      console.log('      - Redis 被清空了')
      console.log('      - 连接到了错误的 Redis\n')
    }

    // 3. 检查管理员凭据
    console.log('3️⃣ 检查管理员凭据...')
    const adminCreds = await redis.get('admin_credentials')
    if (adminCreds) {
      console.log('   ✅ 管理员凭据存在')
      try {
        const parsed = JSON.parse(adminCreds)
        console.log(`   用户名: ${parsed.username || '未知'}`)
      } catch (e) {
        console.log('   ⚠️  无法解析管理员凭据')
      }
    } else {
      console.log('   ❌ 管理员凭据不存在')
      console.log('   💡 需要运行初始化: npm run setup\n')
    }
    console.log()

    // 4. 检查会话
    console.log('4️⃣ 检查活跃会话...')
    const sessionKeys = await redis.keys('session:*')
    console.log(`   找到 ${sessionKeys.length} 个会话\n`)

    // 5. 检查 API Keys
    console.log('5️⃣ 检查 API Keys...')
    const apiKeyKeys = await redis.keys('api_key:*')
    console.log(`   找到 ${apiKeyKeys.length} 个 API Key\n`)

    // 6. 检查 Claude 账户
    console.log('6️⃣ 检查 Claude 账户...')
    const claudeAccountKeys = await redis.keys('claude_account:*')
    console.log(`   找到 ${claudeAccountKeys.length} 个 Claude 账户\n`)

    // 7. 检查 Gemini 账户
    console.log('7️⃣ 检查 Gemini 账户...')
    const geminiAccountKeys = await redis.keys('gemini_account:*')
    console.log(`   找到 ${geminiAccountKeys.length} 个 Gemini 账户\n`)

    // 8. 总结
    console.log('📊 总结:')
    if (dbsize === 0) {
      console.log('   ❌ Redis 是空的，需要初始化')
      console.log('   💡 解决方案:')
      console.log('      1. 确保环境变量中设置了 ADMIN_USERNAME 和 ADMIN_PASSWORD')
      console.log('      2. 重新部署服务，系统会自动初始化')
      console.log('      3. 或者手动运行: npm run setup\n')
    } else if (!adminCreds) {
      console.log('   ⚠️  有数据但缺少管理员凭据')
      console.log('   💡 可能需要重新初始化管理员账号\n')
    } else if (sessionKeys.length === 0) {
      console.log('   ⚠️  没有活跃会话')
      console.log('   💡 这是正常的，登录后会创建会话\n')
    } else {
      console.log('   ✅ Redis 数据正常\n')
    }

    console.log('✅ 诊断完成！\n')

    await redis.quit()
    process.exit(0)
  } catch (error) {
    console.error('❌ Redis 操作失败:', error.message)
    await redis.quit()
    process.exit(1)
  }
}

testRedis()
