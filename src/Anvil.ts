import { BinaryData } from './BinaryData'
import { CompoundTag } from '@strdst/utils.nbt'
import fs from 'fs-extra'
import path from 'path'
import zlib from 'zlib'
import { Region } from './Region'

export interface ILocationTableItem {
  offset: number,
  sectors: number,
  timestamp: number,
}

export type LocationTable = Array<ILocationTableItem | null>

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

    return regions
  }

  private async getRegion(x: number, z: number): Promise<Region> {
    const data = fs.readFileSync(path.join(this.regionPath, `r.${x}.${z}.mca`))
    const buf = new BinaryData(data)

    const table = this.readLocationTable(data)

    return new Region(x, z, table, buf)
  }

  private readLocationTable(data: Buffer): LocationTable {
    const table: LocationTable = []

    for(let i = 0; i < 4096; i += 4) {
      const offset = data.readUInt32BE(i)
      const sectors = data.readIntBE(i + 3, 1)
      const timestamp = data.readIntBE(i + 4096, 4)

      if(offset === 0 || sectors === 0) {
        table[i] = null
      } else {
        table[i] = {
          offset,
          sectors,
          timestamp,
        }
      }
    }

    return table
  }

  public async parse(): Promise<void> {
    const levelData = new BinaryData(fs.readFileSync(this.levelDatPath))
    const regionCoords = await this.getRegions()
    const levelDat = await this.parseLevelDat(levelData)

    const regions = await Promise.all(regionCoords.map(([x, z]) => this.getRegion(x, z)))
  }

}