import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Leggi body UNA SOLA VOLTA
    const { message, conversation_id, filters } = await req.json()

    console.log('Message received:', message)
    console.log('Conversation ID:', conversation_id)

    // Verifica auth dall'header
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)

    // Client admin per tutte le operazioni
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Genera embedding della query
    console.log('Generating embedding...')
    const aiSession = new Supabase.ai.Session('gte-small')
    const queryEmbedding = await aiSession.run(message, {
      mean_pool: true,
      normalize: true,
    })
    console.log('Embedding generated, length:', queryEmbedding.length)

    // Retrieval semantico
    console.log('Running match_documents...')
    const { data: chunks, error: searchError } = await supabaseAdmin.rpc(
      'match_documents',
      {
        query_embedding: queryEmbedding,
        match_count: 5,
        filter_industry: filters?.industry || null,
      }
    )

    if (searchError) {
      console.error('Search error:', searchError)
      throw new Error(`Search failed: ${searchError.message}`)
    }

    console.log('Chunks found:', chunks?.length || 0)

    const sources = (chunks || []).map((c: any) => ({
      document_id: c.document_id,
      title: c.title,
      chunk_content: c.content,
      section: c.section,
      similarity: c.similarity,
    }))

    // Costruisci prompt
    const contextText = (chunks || [])
      .map(
        (c: any) =>
          `---\nDocumento: ${c.title}\nSezione: ${c.section || 'N/A'}\nContenuto: ${c.content}\n---`
      )
      .join('\n')

    const systemPrompt = `Sei un assistente interno di Horsa Insight.
Rispondi SOLO in base ai documenti nel contesto.
Se la risposta non è nei documenti, dillo.
Cita sempre la fonte per ogni affermazione.
Rispondi in italiano, in modo professionale.`

    const userPrompt =
      chunks?.length > 0
        ? `Contesto:\n${contextText}\n\nDomanda: ${message}`
        : `Non ho trovato documenti rilevanti.\n\nDomanda: ${message}`

    // Chiamata Anthropic streaming
    console.log('Calling Anthropic...')
    const anthropicResponse = await fetch(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          stream: true,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      }
    )

    console.log('Anthropic status:', anthropicResponse.status)

    if (!anthropicResponse.ok) {
      const err = await anthropicResponse.text()
      console.error('Anthropic error:', err)
      throw new Error(`Anthropic failed: ${err}`)
    }

    // Stream al client
    const encoder = new TextEncoder()
    let fullText = ''

    const readable = new ReadableStream({
      async start(controller) {
        // Manda prima le fonti
        controller.enqueue(
          encoder.encode(
            'data: ' + JSON.stringify({ type: 'sources', sources }) + '\n\n'
          )
        )

        const reader = anthropicResponse.body!.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (
                parsed.type === 'content_block_delta' &&
                parsed.delta?.type === 'text_delta'
              ) {
                const text = parsed.delta.text
                fullText += text
                controller.enqueue(
                  encoder.encode(
                    'data: ' +
                      JSON.stringify({ type: 'delta', text }) +
                      '\n\n'
                  )
                )
              }
            } catch {}
          }
        }

        console.log('Stream complete, saving message...')

        // Salva messaggio
        await supabaseAdmin.from('messages').insert({
          conversation_id,
          role: 'assistant',
          content: fullText,
          sources,
        })

        controller.enqueue(
          encoder.encode(
            'data: ' + JSON.stringify({ type: 'done' }) + '\n\n'
          )
        )

        controller.close()
        console.log('Done.')
      },
    })

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('chat error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
