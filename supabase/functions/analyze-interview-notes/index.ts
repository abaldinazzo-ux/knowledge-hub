import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { notes, project_type } = await req.json()

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: 'Rispondi SOLO con JSON valido. Nessun testo aggiuntivo.',
      messages: [
        {
          role: 'user',
          content: `Analizza queste note di intervista per un progetto ${project_type}.
Classifica ogni informazione in uno di questi nodi:
kpi, dim, users, stakeholders, data, period, pain, vincoli

Note: ${notes}

JSON:
{
  "suggestions": [
    {
      "node": "kpi",
      "items": ["item1"],
      "confidence": 0.9,
      "reasoning": "spiegazione"
    }
  ],
  "unclassified": ["testo non classificabile"]
}`,
        },
      ],
    }),
  })

  const data = await response.json()
  const text = data.content[0].text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  return new Response(text, {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
