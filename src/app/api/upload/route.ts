import { v2 as cloudinary } from 'cloudinary'
import { NextRequest, NextResponse } from 'next/server'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const ALLOWED_TYPES = [
  // Images — all common formats including HEIC
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif', 'image/heic', 'image/heif', 'image/avif',
  'image/tiff', 'image/bmp', 'image/svg+xml',
  // Videos
  'video/mp4', 'video/quicktime', 'video/webm',
  'video/x-msvideo', 'video/mpeg', 'video/3gpp',
]

const MAX_SIZE_MB = 50

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const eventId = formData.get('eventId') as string

    if (!file || !eventId) {
      return NextResponse.json({ error: 'Missing file or eventId' }, { status: 400 })
    }

    // Size check
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_SIZE_MB}MB.` },
        { status: 400 }
      )
    }

    // Type check — use MIME type first, fall back to extension for HEIC
    const mimeType = file.type.toLowerCase()
    const fileName = file.name.toLowerCase()
    const isHeic = mimeType === 'image/heic' || mimeType === 'image/heif' ||
      fileName.endsWith('.heic') || fileName.endsWith('.heif')
    const isVideo = mimeType.startsWith('video/')
    const isImage = mimeType.startsWith('image/') || isHeic

    const allowed = ALLOWED_TYPES.includes(mimeType) || isHeic
    if (!allowed) {
      return NextResponse.json(
        { error: `File type not supported: ${mimeType || file.name}. Please upload images or videos only.` },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'Momento/AdimandJojo26',
          resource_type: isVideo ? 'video' : 'image',
          // Convert HEIC to JPG automatically on Cloudinary side
          ...(isHeic && { format: 'jpg' }),
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      ).end(buffer)
    })

    return NextResponse.json({
      url: result.secure_url,
      type: isVideo ? 'video' : 'image',
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message ?? 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }
}