import { v2 as cloudinary } from 'cloudinary'
import { NextRequest, NextResponse } from 'next/server'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const eventId = formData.get('eventId') as string

    if (!file || !eventId) {
      return NextResponse.json({ error: 'Missing file or eventId' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const isVideo = file.type.startsWith('video/')

    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `momento/${eventId}`,
          resource_type: isVideo ? 'video' : 'image',
          transformation: isVideo
            ? [{ quality: 'auto' }]
            : [{ quality: 'auto', fetch_format: 'auto' }],
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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}