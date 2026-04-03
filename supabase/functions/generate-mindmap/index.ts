import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const L1_COLORS = [
  '#0a84ff',
  '#30d158',
  '#bf5af2',
  '#ff9f0a',
  '#5ac8fa',
  '#ff453a',
  '#ffd60a',
  '#ff6b6b',
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { text, depth, style } = await req.json()

  // CHIAMATA 1: struttura principale
  const call1 = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: 'Rispondi SOLO con JSON valido e completo.',
      messages: [
        {
          role: 'user',
          content: `Dal testo estrai i concetti principali (max 8) come nodi L1.
Testo: ${text}
JSON: {
  "title": "titolo",
  "description": "sommario 1 frase",
  "root": "etichetta radice max 3 parole",
  "branches": [{ "id": "n1", "label": "ramo max 3 parole" }]
}`,
        },
      ],
    }),
  })

  const data1 = await call1.json()
  const structure = JSON.parse(
    data1.content[0].text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
  )

  const allNodes: any[] = [
    {
      id: 'root',
      label: structure.root,
      level: 0,
      parent: null,
      color: '#ffffff',
    },
  ]
  const allEdges: any[] = []

  for (let i = 0; i < structure.branches.length; i++) {
    const branch = structure.branches[i]
    const color = L1_COLORS[i % L1_COLORS.length]

    allNodes.push({
      id: branch.id,
      label: branch.label,
      level: 1,
      parent: 'root',
      color,
    })
    allEdges.push({ source: 'root', target: branch.id })

    if (depth === 'essential') continue

    // CHIAMATA 2: sotto-nodi per ogni ramo
    try {
      const call2 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: 'Rispondi SOLO con JSON valido.',
          messages: [
            {
              role: 'user',
              content: `Dal testo, estrai sotto-concetti per "${branch.label}".
Max ${depth === 'detailed' ? 6 : 3} elementi.
Testo: ${text}
JSON: { "items": [{ "id": "${branch.id}_1", "label": "max 4 parole", "children": ["figlio1"] }] }`,
            },
          ],
        }),
      })

      const data2 = await call2.json()
      const detail = JSON.parse(
        data2.content[0].text
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim()
      )

      detail.items?.forEach((item: any) => {
        allNodes.push({
          id: item.id,
          label: item.label,
          level: 2,
          parent: branch.id,
          color: '#8a8a8a',
        })
        allEdges.push({ source: branch.id, target: item.id })

        if (depth === 'detailed' && item.children) {
          item.children.forEach((child: string, k: number) => {
            const childId = `${item.id}_${k}`
            allNodes.push({
              id: childId,
              label: child,
              level: 3,
              parent: item.id,
              color: '#555555',
            })
            allEdges.push({ source: item.id, target: childId })
          })
        }
      })
    } catch (e) {
      console.warn(`Branch ${branch.label} failed:`, e)
    }
  }

  return new Response(
    JSON.stringify({
      title: structure.title,
      description: structure.description,
      root: structure.root,
      nodes: allNodes,
      edges: allEdges,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
