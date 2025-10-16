#!/usr/bin/env node

/**
 * 多服务认证诊断脚本
 * 用于排查跨服务登录 401 错误
 */

const crypto = require('crypto')
const redis = require('../src/models/redis')
const logger = require('../src/utils/logger')

async function diagnoseAuth() {
  console.log('🔍 多服务认证诊断开始...\n')

  try {
    // 1. 检查关键环境变量
    console.log('1️⃣ 检查关键环境变量:')
    const jwtSecret = process.env.JWT_SECRET
    const encryptionKey = process.env.ENCRYPTION_KEY
    const redisHost = process.env.REDIS_HOST || process.env.REDISHOST
    const redisPort = process.env.REDIS_PORT || process.env.REDISPORT
    const redisPassword = process.env.REDIS_PASSWORD || process.env.REDISPASSWORD

    console.log(`   JWT_SECRET: ${jwtSecret ? '✅ 已设置' : '❌ 未设置'}`)
    if (jwtSecret) {
      const jwtHash = crypto.createHash('md5').update(jwtSecret).digest('hex').substring(0, 8)
      console.log(`   JWT_SECRET 指纹: ${jwtHash} (前8位MD5)`)
      console.log(`   JWT_SECRET 长度: ${jwtSecret.length} 字符`)
      if (jwtSecret.length < 32) {
        console.log(`   ⚠️  警告: JWT_SECRET 长度应至少 32 字符`)
      }
    }

    console.log(`   ENCRYPTION_KEY: ${encryptionKey ? '✅ 已设置' : '❌ 未设置'}`)
    if (encryptionKey) {
      const encKeyHash = crypto.createHash('md5').update(encryptionKey).digest('hex').substring(0, 8)
      console.log(`   ENCRYPTION_KEY 指纹: ${encKeyHash} (前8位MD5)`)
      console.log(`   ENCRYPTION_KEY 长度: ${encryptionKey.length} 字符`)
      if (encryptionKey.length !== 32) {
        console.log(`   ⚠️  警告: ENCRYPTION_KEY 必须恰好 32 字符`)
      }
    }

    console.log(`   REDIS_HOST: ${redisHost || '❌ 未设置'}`)
    console.log(`   REDIS_PORT: ${redisPort || '❌ 未设置'}`)
    console.log(`   REDIS_PASSWORD: ${redisPassword ? '✅ 已设置' : '❌ 未设置'}\n`)

    // 2. 测试 Redis 连接
    console.log('2️⃣ 测试 Redis 连接:')
    try {
      const pingResult = await redis.ping()
      console.log(`   ✅ Redis 连接正常: ${pingResult}\n`)
    } catch (error) {
      console.log(`   ❌ Redis 连接失败: ${error.message}\n`)
      console.log('   💡 提示: 确保所有服务使用相同的 Redis 配置')
      return
    }

    // 3. 检查管理员凭据
    console.log('3️⃣ 检查管理员凭据:')
    const adminData = await redis.getSession('admin_credentials')
    if (adminData && Object.keys(adminData).length > 0) {
      console.log(`   ✅ 管理员数据存在于 Redis`)
      console.log(`   用户名: ${adminData.username}`)
      console.log(`   密码哈希: ${adminData.passwordHash ? adminData.passwordHash.substring(0, 20) + '...' : '无'}\n`)
    } else {
      console.log(`   ⚠️  管理员数据不在 Redis 中`)
      console.log(`   提示: 可能需要运行 npm run setup 初始化\n`)
    }

    // 4. 列出所有活跃的管理员会话
    console.log('4️⃣ 检查活跃的管理员会话:')
    const sessionKeys = await redis.keys('session:*')
    console.log(`   找到 ${sessionKeys.length} 个会话\n`)

    if (sessionKeys.length > 0) {
      console.log('   活跃会话列表:')
      for (const key of sessionKeys.slice(0, 5)) {
        const sessionData = await redis.getSession(key.replace('session:', ''))
        if (sessionData && sessionData.username) {
          const createdAt = new Date(sessionData.loginTime || sessionData.createdAt)
          const age = Math.floor((Date.now() - createdAt) / 1000 / 60) // 分钟
          console.log(`   - ${sessionData.username} (创建于 ${age} 分钟前)`)
        }
      }
      if (sessionKeys.length > 5) {
        console.log(`   ... 还有 ${sessionKeys.length - 5} 个会话`)
      }
      console.log()
    }

    // 5. 生成环境变量验证文件
    console.log('5️⃣ 生成环境变量验证文件:')
    const verificationData = {
      timestamp: new Date().toISOString(),
      hostname: require('os').hostname(),
      jwtSecretFingerprint: jwtSecret
        ? crypto.createHash('md5').update(jwtSecret).digest('hex')
        : null,
      encryptionKeyFingerprint: encryptionKey
        ? crypto.createHash('md5').update(encryptionKey).digest('hex')
        : null,
      redisHost,
      redisPort,
      env: process.env.NODE_ENV
    }

    const fs = require('fs')
    const path = require('path')
    const verifyFile = path.join(__dirname, '../temp/env-verification.json')

    // 确保 temp 目录存在
    const tempDir = path.join(__dirname, '../temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    fs.writeFileSync(verifyFile, JSON.stringify(verificationData, null, 2))
    console.log(`   ✅ 验证文件已创建: ${verifyFile}`)
    console.log(`   💡 在其他服务上运行此脚本并比对指纹\n`)

    // 6. 跨服务测试说明
    console.log('6️⃣ 跨服务测试步骤:')
    console.log('   a. 在服务 A 上运行: node scripts/diagnose-multi-service-auth.js')
    console.log('   b. 在服务 B 上运行: node scripts/diagnose-multi-service-auth.js')
    console.log('   c. 比较两个服务的指纹:')
    console.log('      - JWT_SECRET 指纹必须完全相同')
    console.log('      - ENCRYPTION_KEY 指纹必须完全相同')
    console.log('      - REDIS_HOST 和 REDIS_PORT 必须相同\n')

    // 7. 常见问题诊断
    console.log('7️⃣ 常见问题诊断:')
    const issues = []

    if (!jwtSecret || jwtSecret.length < 32) {
      issues.push('❌ JWT_SECRET 未设置或长度不足 32 字符')
    }

    if (!encryptionKey || encryptionKey.length !== 32) {
      issues.push('❌ ENCRYPTION_KEY 未设置或长度不是 32 字符')
    }

    if (!redisHost || !redisPort) {
      issues.push('❌ Redis 配置不完整')
    }

    if (!adminData || Object.keys(adminData).length === 0) {
      issues.push('⚠️  管理员凭据未同步到 Redis')
    }

    if (issues.length === 0) {
      console.log('   ✅ 未发现明显问题\n')
    } else {
      console.log('   发现以下问题:')
      issues.forEach((issue) => console.log(`   ${issue}`))
      console.log()
    }

    // 8. 测试加密一致性
    console.log('8️⃣ 测试加密一致性:')
    if (encryptionKey && encryptionKey.length === 32) {
      try {
        const testData = 'test-data-for-encryption'
        const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, Buffer.alloc(16, 0))
        let encrypted = cipher.update(testData, 'utf8', 'hex')
        encrypted += cipher.final('hex')

        const encryptedHash = crypto.createHash('md5').update(encrypted).digest('hex').substring(0, 8)
        console.log(`   加密测试指纹: ${encryptedHash}`)
        console.log(`   💡 在其他服务上应该得到相同的指纹\n`)
      } catch (error) {
        console.log(`   ❌ 加密测试失败: ${error.message}\n`)
      }
    } else {
      console.log(`   ⚠️  跳过加密测试（ENCRYPTION_KEY 不可用）\n`)
    }

    // 9. 总结和建议
    console.log('9️⃣ 总结和建议:')
    console.log('   如果在另一个服务登录遇到 401 错误，可能原因:')
    console.log('   1. JWT_SECRET 不一致 → 会话 token 无法验证')
    console.log('   2. Redis 配置不一致 → 无法读取会话数据')
    console.log('   3. ENCRYPTION_KEY 不一致 → 无法解密账户数据')
    console.log()
    console.log('   ✅ 解决方案:')
    console.log('   - 确保所有服务使用 .env.railway.shared 中的配置')
    console.log('   - 重新部署所有服务，使用相同的环境变量')
    console.log('   - 运行此脚本在每个服务上验证指纹一致性\n')

    console.log('✅ 诊断完成！\n')

  } catch (error) {
    console.error('❌ 诊断过程出错:', error)
    process.exit(1)
  }

  process.exit(0)
}

// 运行诊断
diagnoseAuth()
