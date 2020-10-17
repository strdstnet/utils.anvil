import { Anvil } from '../src'
import path from 'path'

;(async() => {
  const a = new Anvil(path.join(__dirname, 'world'))
  await a.parse()
})()
