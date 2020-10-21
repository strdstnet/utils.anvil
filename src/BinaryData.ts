import { BinaryData as BData, DataLengths } from '@strdst/utils.binary'
import { EndTag, ListTag, Tag, TagMapper, TagType } from '@strdst/utils.nbt'

export class BinaryData extends BData {

  public readTag<T extends Tag = Tag>(version = 1): T {
    if(version !== 1) throw new Error(`Unsupport NBT version: ${1}`)

    const type = this.readByte()

    if(type === TagType.End) return new EndTag() as any as T

    const tag = TagMapper.get(type)

    const name = this.readString(this.readShort())
    const value = this.readTagValue(tag)

    return tag.assign(name, value) as T
  }

  public readTagValue(tag: Tag): any {
    switch(tag.type) {
      case TagType.Long:
        return this.readLong()
      case TagType.String:
        return this.readString(this.readShort())
      case TagType.List:
        const list = tag as ListTag
        list.valueType = this.readByte()
        switch(list.valueType) {
          case TagType.Int:
            return this.readTagArray('readInt', 'readInt')
          case TagType.Compound:
            return this.readTagArray('readTag', 'readInt')
          default:
            throw new Error(`Don't know how to read ListTag.valueType of ${list.valueType}`)
        }
      case TagType.Int:
        return this.readInt()
      case TagType.IntArray:
        return this.readTagArray('readInt', 'readInt')
      case TagType.ByteArray:
        return this.readTagArray('readByte', 'readInt')
    }

    return super.readTagValue(tag)
  }

  public readUnsignedInt(skip = true): number {
    const v = this.buf.readUInt32BE(this.pos)

    if(skip) this.pos += DataLengths.INT

    return v
  }

}
