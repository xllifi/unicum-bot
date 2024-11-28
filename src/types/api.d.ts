type UserJson = {
  login: string
  lang: string
  lightweb: boolean
  blocked: boolean
  rights: { [key: string]: boolean }
  group: string | null
  lerr: number
  token: string
}
type MachineJson = {
  compbm: string
  bm: string
  id: number
  guid: string
  serial: string
  rentab: string
  typeid: number
  typestr: string
  hide: boolean
  publicity: boolean
  groups: unknown[] | null
  geo_man: unknown | null
  address: string
  place: string
  comment: string
  device: {
    phone: string
    vmtoken: string | null
    redirected: boolean
    status: {
      removed: boolean
      online: boolean
    }
    updating: boolean
    decimal: number
    changer: unknown | null
    bill: {
      tubes: unknown | null
    }
    cashless1: unknown | null
    cashless2: unknown | object | null
    fiscalprinter: unknown | object | null
  }
  route: unknown | null
}
type ProductJson = {
  productID: number,
  type: string,
  selection: string,
  name: string,
  guid: string | null,
  max: number,
  level: number,
  vends: number,
  blocked: boolean,
  disabled: boolean,
  articleID: number,
  age: unknown,
  decimal: number,
  price: number,
  price_cl1: number,
  price_cl2: number,
  price_cl3: number,
  ingredients: unknown[]
}

type CurstateJson = {
  user: UserJson
  error: number
  errors: string
  vmtoken: string
  state: string
  geo_man: null | unknown
  geo_auto: unknown
  vmguid: string
  vmsn: string
  vmaddress: string
  vmplace: string
  vmcomment: string
  candispense: boolean
  coffe: boolean
  snack: boolean
  typeid: number
  typestr: string
  decimal: number
  vendscost: number
  vendscount: number
  cashbox: number
  cashboxcount: number
  bills: number
  billscount: number
  lostev: boolean
  products: ProductJson[]
}

type GetMachinesJson = {
  user: UserJson
  company: string
  machines: MachineJson[]
}
