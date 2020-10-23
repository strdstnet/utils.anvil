import { BinaryData } from './BinaryData'
import { CompoundTag } from '@strdst/utils.nbt'
import fs from 'fs-extra'
import path from 'path'
import zlib from 'zlib'
import { Region, ChunkNBT } from './Region'

export interface ILocationTableItem {
  offset: number,
  sectors: number,
  timestamp: number,
}

export type LocationTable = Array<ILocationTableItem | null>

export class Anvil {

  private regions: Map<string, Region> = new Map()

  private constructor(private levelPath: string) {}

  private static getRegionId(x: number, z: number) {
    return `region:${x}:${z}`
  }

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

    const region = new Region(x, z, table, buf)

    this.regions.set(Anvil.getRegionId(x, z), region)

    return region
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

  public getChunk(x: number, z: number): null | ChunkNBT {
    const [rX, rZ] = Region.getChunkRegion(x, z)

    const region = this.regions.get(Anvil.getRegionId(rX, rZ))

    if(!region) throw new Error(`Tried getting chunk from an unloaded region: Chunk ${x}:${z}, Region ${rX}:${rZ}`)

    return region.getChunkAbsolute(x, z)
  }

  public static async parse(levelPath: string): Promise<Anvil> {
    const anvil = new Anvil(levelPath)

    const levelData = new BinaryData(fs.readFileSync(anvil.levelDatPath))
    const regionCoords = await anvil.getRegions()
    const levelDat = await anvil.parseLevelDat(levelData)

    await Promise.all(regionCoords.map(([x, z]) => anvil.getRegion(x, z)))

    return anvil
  }

}