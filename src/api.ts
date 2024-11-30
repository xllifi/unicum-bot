import 'dotenv/config'
import { ConsolaInstance } from 'consola'
import { colors } from 'consola/utils'
import ky, { HTTPError } from 'ky'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import { getUnix } from './utils.js'
import RelativeTime from '@yaireo/relative-time'
import * as path from 'path'

type TokenFile = {
  token: string
  validUntil: number
}

const cacheRootCwd = process.env.CACHE_ROOT_DIR!.toString().replace(/^\/+/, '')
export const cacheRoot = path.resolve(process.env.CACHE_ROOT_CWD === 'true' ? cacheRootCwd : '/'+cacheRootCwd)
const relativeTime = new RelativeTime()
const tokenFilePath: string = path.resolve(cacheRoot, `latest_token.json`)

export class Client {
  token: string = ''
  consola: ConsolaInstance

  cookieHeader: object = { Cookie: `nvmc_login=${this.token}` }

  constructor(consola: ConsolaInstance) {
    this.consola = consola
  }

  async init(token?: string): Promise<Client> {
    if (token) {
      this.tokenStr(token, 0)
    } else {
      let smart: { token: string; validUntil?: number } = await this.getTokenSmart()
      this.tokenStr(smart.token, smart.validUntil)
    }

    this.cookieHeader = { Cookie: `nvmc_login=${token || this.token}` }
    this.consola.debug(`cookieHeader set: ${JSON.stringify(this.cookieHeader)}`)

    if (!fs.existsSync(cacheRoot)) {
      this.consola.debug(`Cache directory doesn\'t exist yet, creating! (${cacheRoot})`)
      fs.mkdirSync(cacheRoot, { recursive: true })
    }
    return this
  }

  async getTokenApi(): Promise<string> {
    this.consola.start(`Acquiring token...`)

    return new Promise<string>(async (resolve, reject) => {
      this.consola.debug(colors.gray('[1/2] ') + `Sending request to ${process.env.BASE_HOST}iamrobot.json`)

      await ky.post<{ token: string }>(`${process.env.BASE_HOST}iamrobot.json`, {
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            login: process.env.LOGIN_USERNAME,
            password: process.env.LOGIN_PASSWORD
          })
        })
        .then(async (res) => {
          // Succeeded
          if (res.status === 200) {
            this.consola.debug(colors.gray('[2/2] ') + `Recieved response with code ${res.status}`)
            this.consola.success('Token acquired! Returning it to caller.')
            resolve((await res.json()).token)
          }
        })
        .catch(async (err: HTTPError) => {
          // Wait for queue
          if (err.response.status === 409) {
            this.consola.debug(colors.gray('[2/2] ') + `Recieved error response with code ${err.response.status}, retrying`)
            this.consola.fail(`Endpoint busy, retrying in ${process.env.LOGIN_RETRYMS!}ms.`)
            setTimeout(() => {
              resolve(this.getTokenApi())
            }, parseInt(process.env.LOGIN_RETRYMS!))
            return
          }
          // Failed
          this.consola.debug(colors.gray('[2/2] ') + `Recieved error response with code ${err.response.status}, throwing error`)
          reject(err)
        })
    })
  }

  async getTokenSmart(): Promise<{ token: string; validUntil?: number }> {
    this.consola.start(`Searching for saved token...`)

    let fileContent: TokenFile = await fsp.readFile(tokenFilePath, { encoding: 'utf8' })
      .then((val) => JSON.parse(val))
      .catch((err) => {
        return null
      })
    if (fileContent && fileContent.validUntil > getUnix()) {
      this.consola.success(`Saved token is okay! Expires ${relativeTime.from(new Date(fileContent.validUntil * 1000))}`)
      return {
        token: fileContent.token,
        validUntil: fileContent.validUntil
      }
    }

    this.consola.fail(`Saved token is not okay! ${fileContent ? `Expired ${relativeTime.from(new Date(fileContent.validUntil * 1000))}.` : 'There\'s no token...'}`)
    return {
      token: await this.getTokenApi()
    }
  }

  async tokenStr(token: string, validUntil?: number): Promise<void> {
    this.token = token

    let tokenFile: TokenFile = {
      token,
      validUntil: validUntil !== undefined ? validUntil : getUnix() + 39 * 60
    }
    this.consola.debug(`Updated and cached token to ${tokenFile.token}. Valid until ${new Date(tokenFile.validUntil).toLocaleString('en-GB', { timeZone: process.env.TZ! })}`)

    await fsp.writeFile(tokenFilePath, JSON.stringify(tokenFile))
  }

  async getMachineInfos(): Promise<MachineJson[]> {
    this.consola.debug(`Getting machineInfos`)
    const resp: GetMachinesJson = await ky
      .get<GetMachinesJson>(`${process.env.BASE_HOST}getmachines.json`, {
        headers: {
          ...this.cookieHeader
        }
      })
      .then((res) => res.json())
    this.tokenStr(resp.user.token)

    await fsp.writeFile(path.resolve(cacheRoot, 'latest_machineinfos.json'), JSON.stringify(resp), { encoding: 'utf8' })

    return resp.machines
  }

  async getCurstates(guid: string): Promise<CurstateJson> {
    this.consola.debug(`Gettings curstate of machine ${guid}`)
    const resp = await ky
      .post<CurstateJson>(`${process.env.BASE_HOST}curstate.json`, {
        headers: {
          ...this.cookieHeader,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          machineguid: guid
        })
      })
      .then((resp) => resp.json())
    this.tokenStr(resp.user.token)

    return resp
  }

  async getVendsOver(maxVends: number, machineInfos?: MachineJson[]) {
    if (!machineInfos) machineInfos = await this.getMachineInfos()

    let ret = {}
    for (const machine of machineInfos) {
      const curstate: CurstateJson = await this.getCurstates(machine.guid)

      let filteredProducts: ProductJson[] = []
      for (const product of curstate.products.filter((x) => x.vends >= maxVends)) {
        filteredProducts.push(product)
        this.consola.info(`[${machine.comment}] ${product.name} sold ${colors.redBright(product.vends)} time(s)! Check it out!`)
      }
      Object.assign(ret, {[machine.id]: filteredProducts})
    }

    return ret
  }

  async getOffline() {
    const machineInfos: MachineJson[] = await this.getMachineInfos()
    const offlineMachines: MachineJson[] = machineInfos.filter((x) => x.device.status.online === false)

    if (offlineMachines.length > 0) {
      let message = `${offlineMachines.length === 1 ? 'Автомат' : 'Автоматы'} [${offlineMachines.map((x) => x.comment).join(', ')}] оффлайн!`
      this.consola.fail(colors.redBright(message))
      return message
    }
  }
}
