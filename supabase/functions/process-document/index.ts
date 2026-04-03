import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Estrae word/document.xml da un DOCX (ZIP)
// usando solo API native Deno
async function extractDocxText(
  buffer: ArrayBuffer
): Promise<string> {
  const bytes = new Uint8Array(buffer)

  // Trova la firma ZIP (PK\x03\x04)
  // e cerca il file word/document.xml
  const target = 'word/document.xml'

  let xmlContent = ''
  let pos = 0

  while (pos < bytes.length - 30) {
    // Cerca local file header signature: 50 4B 03 04
    if (
      bytes[pos] === 0x50 &&
      bytes[pos + 1] === 0x4B &&
      bytes[pos + 2] === 0x03 &&
      bytes[pos + 3] === 0x04
    ) {
      const filenameLen =
        bytes[pos + 26] | (bytes[pos + 27] << 8)
      const extraLen =
        bytes[pos + 28] | (bytes[pos + 29] << 8)
      const compressedSize =
        bytes[pos + 18] |
        (bytes[pos + 19] << 8) |
        (bytes[pos + 20] << 16) |
        (bytes[pos + 21] << 24)
      const compressionMethod =
        bytes[pos + 8] | (bytes[pos + 9] << 8)

      const filenameStart = pos + 30
      const filenameEnd = filenameStart + filenameLen
      const filename = new TextDecoder().decode(
        bytes.slice(filenameStart, filenameEnd)
      )

      const dataStart = filenameEnd + extraLen

      if (filename === target) {
        const compressedData = bytes.slice(
          dataStart,
          dataStart + compressedSize
        )

        if (compressionMethod === 0) {
          // Non compresso
          xmlContent = new TextDecoder().decode(compressedData)
        } else if (compressionMethod === 8) {
          // Deflate — usa DecompressionStream
          const ds = new DecompressionStream('deflate-raw')
          const writer = ds.writable.getWriter()
          const reader = ds.readable.getReader()

          writer.write(compressedData)
          writer.close()

          const chunks: Uint8Array[] = []
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
          }

          const totalLength = chunks.reduce(
            (acc, c) => acc + c.length, 0
          )
          const result = new Uint8Array(totalLength)
          let offset = 0
          for (const chunk of chunks) {
            result.set(chunk, offset)
            offset += chunk.length
          }

          xmlContent = new TextDecoder().decode(result)
        }
        break
      }

      pos = dataStart + compressedSize
    } else {
      pos++
    }
  }

  if (!xmlContent) {
    throw new Error('word/document.xml not found in DOCX')
  }

  // Estrai testo per paragrafo
  const paragraphs = xmlContent.split(/<w:p[ >\/]/)
  const texts: string[] = []

  for (const para of paragraphs) {
    const runs = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g)
    if (runs) {
      const paraText = runs
        .map(r => r.replace(/<[^>]+>/g, ''))
        .join('')
        .trim()
      if (paraText) texts.push(paraText)
    }
  }

  return texts.join('\n')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let document_id: string | undefined

  try {
    const body = await req.json()
    document_id = body.document_id

    console.log('Processing document:', document_id)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: doc, error: docError } =
      await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('id', document_id)
        .single()

    if (docError || !doc) {
      throw new Error('Document not found')
    }

    console.log('Document:', doc.title,
      'type:', doc.file_type)

    let text = ''

    if (doc.file_type === 'md' && doc.content_markdown) {
      text = doc.content_markdown
      console.log('Using markdown content')
    } else {
      const { data: fileData, error: fileError } =
        await supabaseAdmin.storage
          .from('documents')
          .download(doc.file_path)

      if (fileError) throw fileError

      const arrayBuffer = await fileData.arrayBuffer()
      console.log('File size:', arrayBuffer.byteLength)

      if (doc.file_type === 'docx') {
        text = await extractDocxText(arrayBuffer)
      } else if (doc.file_type === 'pdf') {
        const decoder = new TextDecoder('latin1')
        const raw = decoder.decode(arrayBuffer)
        const blocks: string[] = []
        const regex = /BT([\s\S]*?)ET/g
        let m
        while ((m = regex.exec(raw)) !== null) {
          const strMatches = m[1].match(/\(([^)]+)\)/g)
          if (strMatches) {
            blocks.push(
              strMatches.map(s => s.slice(1, -1)).join(' ')
            )
          }
        }
        text = blocks.length > 0
          ? blocks.join('\n')
          : raw.replace(/[^\x20-\x7E\n]/g, ' ')
               .replace(/\s+/g, ' ').trim()
      } else if (doc.file_type === 'pptx') {
        const decoder = new TextDecoder('utf-8',
          { fatal: false })
        const raw = decoder.decode(
          new Uint8Array(arrayBuffer)
        )
        const matches = raw.match(/<a:t[^>]*>([^<]+)<\/a:t>/g)
        if (matches) {
          text = matches
            .map(m => m.replace(/<[^>]+>/g, '').trim())
            .filter(t => t.length > 0)
            .join(' ')
        }
      }
    }

    console.log('Text length:', text.length)
    console.log('Preview:', text.substring(0, 300))

    if (!text.trim()) {
      throw new Error('No text extracted from document')
    }

    // Chunking
    let chunks: string[] = []

    if (doc.file_type === 'md') {
      chunks = text
        .split(/\n---\n/)
        .map(c => c.trim())
        .filter(c => c.length > 50)
    } else {
      const blocks = text
        .split(/\n\n+/)
        .map(b => b.trim())
        .filter(b => b.length > 30)

      let current = ''
      for (const block of blocks) {
        const words = (current + ' ' + block)
          .split(/\s+/).length
        if (words > 400 && current) {
          chunks.push(current.trim())
          current = block
        } else {
          current += '\n\n' + block
        }
      }
      if (current.trim()) chunks.push(current.trim())
    }

    console.log('Chunks:', chunks.length)

    // Elimina chunk precedenti
    await supabaseAdmin
      .from('document_chunks')
      .delete()
      .eq('document_id', document_id)

    // Genera embeddings e salva
    const aiSession = new Supabase.ai.Session('gte-small')

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const sectionMatch = chunk.match(/^#{1,3}\s+(.+)$/m)
      const section = sectionMatch ? sectionMatch[1] : ''

      const embedding = await aiSession.run(chunk, {
        mean_pool: true,
        normalize: true,
      })

      const { error: insertError } = await supabaseAdmin
        .from('document_chunks')
        .insert({
          document_id,
          chunk_index: i,
          content: chunk,
          section,
          embedding,
        })

      if (insertError) {
        throw new Error(
          `Insert chunk ${i}: ${insertError.message}`
        )
      }

      console.log(`Chunk ${i + 1}/${chunks.length}`)
    }

    await supabaseAdmin
      .from('documents')
      .update({ status: 'ready' })
      .eq('id', document_id)

    console.log('Done.')

    return new Response(
      JSON.stringify({ success: true, chunks: chunks.length }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )

  } catch (error: any) {
    console.error('process-document error:', error.message)

    if (document_id) {
      try {
        const admin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )
        await admin
          .from('documents')
          .update({ status: 'error' })
          .eq('id', document_id)
      } catch {}
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
