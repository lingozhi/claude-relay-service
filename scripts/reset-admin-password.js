#!/usr/bin/env node

/**
 * 重置管理员密码脚本
 * 使用环境变量中的 ADMIN_USERNAME 和 ADMIN_PASSWORD
 */

const bcrypt = require('bcryptjs')
const Redis = require('ioredis')

async function resetAdminPassword() {
  console.log('🔐 重置管理员密码...\n')

  // 获取环境变量
  const redisHost = process.env.REDIS_HOST || process.env.REDISHOST || 'localhost'
  const redisPort = process.env.REDIS_PORT || process.env.REDISPORT || 6379
  const redisPassword = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD || ''
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    console.error('❌ 错误: ADMIN_PASSWORD 环境变量未设置')
    console.error('   请设置环境变量后再运行此脚本\n')
    console.error('   示例:')
    console.error('   export ADMIN_PASSWORD=YourSecurePassword123')
    console.error('   node scripts/reset-admin-password.js\n')
    process.exit(1)
  }

  console.log('📊 配置信息:')
  console.log(`   Redis Host: ${redisHost}`)
  console.log(`   Redis Port: ${redisPort}`)
  console.log(`   管理员用户名: ${adminUsername}`)
  console.log(`   管理员密码: ${adminPassword.substring(0, 3)}${'*'.repeat(adminPassword.length - 3)}\n`)

  // 连接 Redis
  const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    retryStrategy: (times) => {
      if (times > 3) {
        return null
      }
      return Math.min(times * 100, 3000)
    }
  })

  try {
    // 测试连接
    console.log('1️⃣ 测试 Redis 连接...')
    const pong = await redis.ping()
    console.log(`   ✅ ${pong}\n`)

    // 检查现有管理员数据
    console.log('2️⃣ 检查现有管理员数据...')
    const existingData = await redis.get('admin_credentials')
    if (existingData) {
      try {
        const parsed = JSON.parse(existingData)
        console.log(`   ⚠️  找到现有管理员: ${parsed.username}`)
        console.log(`   将被覆盖...\n`)
      } catch (e) {
        console.log(`   ⚠️  现有数据格式异常，将被覆盖...\n`)
      }
    } else {
      console.log(`   📝 未找到现有管理员数据\n`)
    }

    // 生成密码哈希
    console.log('3️⃣ 生成密码哈希...')
    const saltRounds = 10
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds)
    console.log(`   ✅ 密码哈希已生成\n`)

    // 创建管理员数据
    const adminData = {
      username: adminUsername,
      passwordHash,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      updatedAt: new Date().toISOString()
    }

    // 保存到 Redis
    console.log('4️⃣ 保存管理员数据到 Redis...')
    await redis.set('admin_credentials', JSON.stringify(adminData))
    console.log(`   ✅ 管理员数据已保存\n`)

    // 验证保存结果
    console.log('5️⃣ 验证保存结果...')
    const savedData = await redis.get('admin_credentials')
    if (savedData) {
      const parsed = JSON.parse(savedData)
      console.log(`   ✅ 验证成功`)
      console.log(`   用户名: ${parsed.username}`)
      console.log(`   创建时间: ${parsed.createdAt}\n`)
    } else {
      console.log(`   ❌ 验证失败，数据未保存\n`)
      process.exit(1)
    }

    // 测试密码验证
    console.log('6️⃣ 测试密码验证...')
    const isValid = await bcrypt.compare(adminPassword, passwordHash)
    if (isValid) {
      console.log(`   ✅ 密码验证通过\n`)
    } else {
      console.log(`   ❌ 密码验证失败\n`)
      process.exit(1)
    }

    console.log('✅ 管理员密码重置成功！\n')
    console.log('📋 登录信息:')
    console.log(`   用户名: ${adminUsername}`)
    console.log(`   密码: ${adminPassword}`)
    console.log()
    console.log('💡 现在可以使用以上凭据登录 Web 管理界面\n')

    await redis.quit()
    process.exit(0)
  } catch (error) {
    console.error('❌ 重置密码失败:', error.message)
    console.error(error)
    await redis.quit()
    process.exit(1)
  }
}

resetAdminPassword()
