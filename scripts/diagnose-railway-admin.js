#!/usr/bin/env node

/**
 * 诊断Railway管理员登录问题
 *
 * 使用方法（在Railway Shell中运行）：
 * node scripts/diagnose-railway-admin.js
 */

const Redis = require('ioredis')

async function diagnoseAdmin() {
  console.log('🔍 开始诊断管理员登录问题...\n')

  // 1. 检查环境变量
  console.log('📋 步骤1: 检查环境变量')
  const adminUsername = process.env.ADMIN_USERNAME
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminUsername || !adminPassword) {
    console.error('❌ 错误: 环境变量未设置')
    console.error('   请在Railway Variables中设置:')
    console.error('   - ADMIN_USERNAME')
    console.error('   - ADMIN_PASSWORD')
    process.exit(1)
  }

  console.log(`✅ 环境变量已设置: ADMIN_USERNAME="${adminUsername}"`)
  console.log(`✅ 环境变量已设置: ADMIN_PASSWORD="${'*'.repeat(adminPassword.length)}"\n`)

  // 2. 连接Redis
  console.log('📋 步骤2: 连接Redis')
  const redisHost = process.env.REDIS_HOST || process.env.REDISHOST || 'localhost'
  const redisPort = process.env.REDIS_PORT || process.env.REDISPORT || 6379
  const redisPassword = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD || ''

  console.log(`   Redis地址: ${redisHost}:${redisPort}`)

  const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 100, 3000))
  })

  try {
    await redis.ping()
    console.log('✅ Redis连接成功\n')
  } catch (error) {
    console.error('❌ Redis连接失败:', error.message)
    await redis.quit()
    process.exit(1)
  }

  // 3. 检查admin_credentials
  console.log('📋 步骤3: 检查Redis中的管理员凭据')
  try {
    const adminData = await redis.hgetall('session:admin_credentials')

    if (!adminData || Object.keys(adminData).length === 0) {
      console.error('❌ Redis中没有管理员凭据！')
      console.error('   原因: admin_credentials可能已过期或从未创建\n')
      console.log('💡 解决方案: 运行以下命令重置密码：')
      console.log('   node scripts/reset-admin-password.js\n')
      await redis.quit()
      process.exit(1)
    }

    console.log('✅ 找到管理员凭据')
    console.log(`   用户名: ${adminData.username}`)
    console.log(`   密码hash: ${adminData.passwordHash?.substring(0, 20)}...`)
    console.log(`   创建时间: ${adminData.createdAt}`)
    console.log(`   更新时间: ${adminData.updatedAt}\n`)

    // 4. 检查TTL
    console.log('📋 步骤4: 检查过期时间 (TTL)')
    const ttl = await redis.ttl('session:admin_credentials')

    if (ttl === -2) {
      console.error('❌ 键不存在')
    } else if (ttl === -1) {
      console.log('⚠️  键没有设置过期时间（永不过期）')
    } else {
      const days = Math.floor(ttl / 86400)
      const hours = Math.floor((ttl % 86400) / 3600)
      console.log(`✅ 剩余有效期: ${days}天 ${hours}小时 (${ttl}秒)`)

      if (ttl < 86400) {
        console.warn(`⚠️  警告: 剩余时间不足1天，即将过期！`)
        console.log('💡 建议: 重启Railway服务以应用1年TTL的修复\n')
      } else if (ttl > 30000000) {
        console.log('✅ TTL已设置为1年，修复已生效！\n')
      }
    }

    // 5. 验证密码
    console.log('📋 步骤5: 验证密码是否匹配')
    const bcrypt = require('bcryptjs')
    const isValidPassword = await bcrypt.compare(adminPassword, adminData.passwordHash)

    if (isValidPassword) {
      console.log('✅ 环境变量中的密码与Redis中的hash匹配\n')
    } else {
      console.error('❌ 密码不匹配！')
      console.error('   环境变量中的密码与Redis中存储的hash不一致')
      console.log('💡 解决方案: 运行以下命令重置密码：')
      console.log('   node scripts/reset-admin-password.js\n')
      await redis.quit()
      process.exit(1)
    }

    // 6. 总结
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎉 诊断完成！所有检查通过')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ 环境变量: 已设置')
    console.log('✅ Redis连接: 正常')
    console.log('✅ 管理员凭据: 存在')
    console.log('✅ 密码验证: 通过')
    console.log(`✅ 过期时间: ${days}天后`)
    console.log('\n👍 你应该可以正常登录了！')
    console.log('   用户名:', adminUsername)
    console.log('   密码:', '*'.repeat(adminPassword.length))

    await redis.quit()
    process.exit(0)

  } catch (error) {
    console.error('❌ 诊断过程出错:', error.message)
    console.error(error.stack)
    await redis.quit()
    process.exit(1)
  }
}

diagnoseAdmin()
