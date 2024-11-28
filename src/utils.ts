export function getUnix(): number {
  return Math.floor(Date.now() / 1000)
}

export function escStr(str: string) {
  return str.replace(/([\[\]()~`#+\-=|{}.!])/g, '\\$1')
}
