import { BinaryData } from './BinaryData'
import { LocationTable, ILocationTableItem } from './Anvil'
import zlib from 'zlib'
import { ByteTag, CompoundTag, IntArrayTag, IntTag, Tag } from '@strdst/utils.nbt'

export enum ChunkCompression {
  GZIP = 1,
  ZLIB = 2,
}

type ChunkNBT = CompoundTag<{
  Level: CompoundTag<{
    LightPopulated: ByteTag,
    zPos: IntTag,
    HeightMap: IntArrayTag,
  }>,
}>

export class Region {

  constructor(
    public x: number,
    public z: number,
    protected locationTable: LocationTable,
    protected chunkData: BinaryData,
  ) {}

  public getChunkAbsolute(x: number, z: number) {
    if(x >> 5 !== this.x || z >> 5 !== this.z) throw new Error('Attempted to load chunk from incorrect region')

    return this.getChunk(x & 0x1F, z & 0x1F)
  }

  public getChunk(x: number, z: number): null | ChunkNBT {
    if(!this.hasChunk(x, z)) return null
    const offset = this.getChunkOffset(x, z)

    const sector = offset >> 8
    const numSectors = offset & 0xFF
    const byteOffset = sector * 4096

    const length = this.chunkData.buf.readUInt32BE(byteOffset)

    const scheme = this.chunkData.buf[byteOffset + 4]

    if(scheme !== ChunkCompression.ZLIB) throw new Error(`Invalid chunk compression scheme: ${scheme}${scheme === ChunkCompression.GZIP ? ' (GZIP)' : ''}`)

    const compressed = this.chunkData.buf.slice(byteOffset + 5, byteOffset + 4 + length)

    const decompressed = zlib.inflateSync(compressed)
    const data = new BinaryData(decompressed)

    return data.readTag() as ChunkNBT
  }

  protected getChunkLocationItem(x: number, z: number): ILocationTableItem {
    return this.locationTable[x | (z << 5)] as ILocationTableItem
  }

  protected getChunkOffset(x: number, z: number): number {
    return this.getChunkLocationItem(x, z).offset
  }

  public hasChunk(x: number, z: number): boolean {
    return this.getChunkOffset(x, z) !== 0
  }

}
