import 'dotenv/config'
import { createConsola } from 'consola'
import { colors } from 'consola/utils'
import pjson from './package.json' with { type: 'json' }
import { cacheRoot, Client } from './src/api.js'
import * as fsp from 'fs/promises'
import path from 'path'
import { Telegraf } from 'telegraf'
import { escStr } from './src/utils.js'

const allowedUser = process.env.TELEGRAM_TRUSTED_USERNAME!

const consola = createConsola({ formatOptions: { compact: true }, level: 5 })
consola.info(`Unicum Bot ${colors.redBright(pjson.version)}\n`)

const uclient: Client = await new Client(consola).init()
const tbot: Telegraf = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

consola.log(JSON.stringify(tbot))

const telegrafUsersPath = `${cacheRoot}/telegrafUsers.json`
const cachedUsers = await fsp.readFile(telegrafUsersPath, { encoding: 'utf8' })
  .then((data) => JSON.parse(data))
  .catch((err) => {
    if (err.code === 'ENOENT') {
      fsp.writeFile(telegrafUsersPath, '{}', { encoding: 'utf8' })
      return {}
    }
    throw err
  })

const keyboard = [
  ['/getvends']
]

tbot.start(async (ctx) => {
  consola.start(`Received Telegram /start! Handling...`)
  let chatId = ctx.chat.id
  let userName = ctx.from.username!

  if (!cachedUsers[userName]) {
    consola.debug(`New userName ${userName} started chat with chatId ${chatId}. Assigning {${userName}: ${chatId}} to cachedUsers and writing to disk`)
    Object.assign(cachedUsers, {[userName]: chatId})
    await fsp.writeFile(telegrafUsersPath, JSON.stringify(cachedUsers), { encoding: 'utf8' })
  }

  if (cachedUsers[userName] !== chatId) {
    consola.debug(`userName ${userName} started chat with chatId ${chatId}, but it doesn't match previously saved chatId ${cachedUsers[userName]}. Setting cachedUsers.${userName} = ${chatId} and writing to disk`)
    cachedUsers[userName] = chatId
    await fsp.writeFile(telegrafUsersPath, cachedUsers, { encoding: 'utf8' })
  }

  if (userName === allowedUser) {
    consola.debug(`Starter is assigned username! Replying.`)
    ctx.reply('Привет! Теперь буду отправлять сюда статусы.', {reply_markup: {
      keyboard: keyboard,
      resize_keyboard: true
    }})
  }
})

tbot.command('getvends', async (ctx) => {
  consola.start(`${ctx.from.username || 'Unknown user'} executed command /getvends! Handling...`)
  if (ctx.chat.id !== cachedUsers[allowedUser]) {
    consola.fail(`${ctx.from.username || 'Unknown user'} is not allowed. Replying...`)
    return ctx.reply('Простите, вы нам не подходите')
  }
  consola.info(`${ctx.from.username || 'Unknown user'} is allowed. Executing...`)
  const waitMessage = await ctx.sendMessage('Подождите, собираю данные...')
  await uclient.getVendsOver(3)
  .then(async (res: { [key: number]: ProductJson[] }) => {
      const machineInfos: GetMachinesJson = await fsp.readFile(path.resolve(cacheRoot, 'latest_machineinfos.json'), { encoding: 'utf8' }).then((val) => JSON.parse(val))

      let message: string = 'Ячейки, продавшиеся более 3 раз\n'
      for (const [key, value] of Object.entries(res)) {
        if (value.length <= 0) continue
        let machineName = machineInfos.machines.find((x) => x.id.toString() === key)!.comment
        let submessage: string = `__*${machineName}:*__\n`
        for (const prod of value) {
          submessage = submessage + ` • x${prod.vends} [${prod.selection}] ${prod.name}\n`
        }
        message = message + submessage
      }
      consola.success(`Executed successfulyl and replied to ${ctx.from.username || 'unknown user'}!`)
      consola.debug(`Sending message: ${message.replaceAll('\n', '<br>')}`)
      ctx.telegram.editMessageText(waitMessage.chat.id, waitMessage.message_id, undefined, escStr(message), { parse_mode: 'MarkdownV2' })
    })
    .catch((err) => {
      consola.error(err)
    })
})

tbot.launch()

await uclient.getOffline().then((val) => {
  if (cachedUsers[allowedUser] && val) {
    tbot.telegram.sendMessage(cachedUsers[allowedUser], escStr(val), { parse_mode: 'MarkdownV2' })
  }
})

setInterval(async () => {
  await uclient.getTokenSmart()
  await uclient.getOffline()
}, 30 * 60000)
