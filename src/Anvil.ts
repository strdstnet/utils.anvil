import { BinaryData } from './BinaryData'
import { CompoundTag } from '@strdst/utils.nbt'
import fs from 'fs-extra'
import path from 'path'
import zlib from 'zlib'

export class Anvil {

  constructor(private levelPath: string) {}

  private get levelDatPath() {
    return path.join(this.levelPath, 'level.dat')
  }

  private get regionPath() {
    return path.join(this.levelPath, 'region')
  }

  private hasGzipHeader(data: BinaryData): boolean {
    const buf = data.clone()

    if(buf.readByte() !== 0x1f || buf.readByte() !== 0x8b) return false

    return true
  }

  private async parseLevelDat(levelData: BinaryData): Promise<CompoundTag> {
    if(this.hasGzipHeader(levelData)) {
      const buf = zlib.gunzipSync(levelData.buf)
      levelData = new BinaryData(buf)
    }

    return levelData.readTag() as CompoundTag
  }

  private async getRegions(): Promise<Array<[number, number]>> {
    const files = fs.readdirSync(this.regionPath)

    const regions: Array<[number, number]> = []

    for await(const file of files) {
      const matches = Array.from(file.matchAll(/r\.(-?[0-9])\.(-?[0-9])\.mca/gim))

      if(matches.length === 1 && matches[0].length === 3) {
        regions.push([parseInt(matches[0][1]), parseInt(matches[0][2])])
      }
    }

    // return regions
    return [regions[0]]
  }

  private async getRegion(x: number, z: number): Promise<number> {
    const data = fs.readFileSync(path.join(this.regionPath, `r.${x}.${z}.mca`))
    const buf = new BinaryData(data)

    // buf.readByte()
    // buf.readByte()
    // buf.readByte()
    // buf.readByte()
    // const scheme = buf.readByte()

    // console.log(`${x}:${z} -`, scheme)

    this.readLocationTable(buf)
    this.readTimestampTable(buf)
    
    return 0
  }

  private async readLocationTable(data: BinaryData) {
    for(let i = 0; i < 1024; i++) {
      const offset = data.readUnsignedInt()
      const size = data.readByte()

      console.log(offset * 4096, size * 4096)

      // https://github.com/PrismarineJS/prismarine-provider-anvil/blob/078bbc1726d6e5fa0746f6bc237f402cc8c47f2e/src/region.js#L73
    }
  }

  private async readTimestampTable(data: BinaryData) {
    for(let i = 0; i < 1024; i++) {
      const timestamp = data.readInt()

      console.log(timestamp)
    }
  }

  public async parse(): Promise<void> {
    const levelData = new BinaryData(fs.readFileSync(this.levelDatPath))
    const regionCoords = await this.getRegions()
    const levelDat = await this.parseLevelDat(levelData)

    const regions = await Promise.all(regionCoords.map(([x, z]) => this.getRegion(x, z)))
  }

}