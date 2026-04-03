'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import ConversationSidebar, { type Conversation } from '@/components/chat/conversation-sidebar'
import ChatArea from '@/components/chat/chat-area'
import SourcePanel, { type SourceData } from '@/components/chat/source-panel'

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeTitle, setActiveTitle] = useState('')
  const [selectedSource, setSelectedSource] = useState<SourceData | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadConversations()
  }, [])

  async function loadConversations() {
    const { data } = await supabase
      .from('conversations')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })

    if (data) setConversations(data)
  }

  function handleSelectConversation(id: string) {
    const conv = conversations.find(c => c.id === id)
    setActiveId(id)
    setActiveTitle(conv?.title ?? '')
    setIsPanelOpen(false)
  }

  function handleNewConversation() {
    setActiveId(null)
    setActiveTitle('')
    setIsPanelOpen(false)
  }

  async function handleDeleteConversation(id: string) {
    // Delete messages then conversation
    await supabase.from('messages').delete().eq('conversation_id', id)
    await supabase.from('conversations').delete().eq('id', id)

    setConversations(prev => prev.filter(c => c.id !== id))

    if (activeId === id) {
      setActiveId(null)
      setActiveTitle('')
      setIsPanelOpen(false)
    }
  }

  const handleConversationCreated = useCallback((id: string, title: string) => {
    const newConv: Conversation = {
      id,
      title,
      created_at: new Date().toISOString(),
    }
    setConversations(prev => [newConv, ...prev])
    setActiveId(id)
    setActiveTitle(title)
  }, [])

  function handleOpenSource(source: SourceData) {
    setSelectedSource(source)
    setIsPanelOpen(true)
  }

  function handleClosePanel() {
    setIsPanelOpen(false)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
      />
      <ChatArea
        conversationId={activeId}
        conversationTitle={activeTitle}
        onConversationCreated={handleConversationCreated}
        onOpenSource={handleOpenSource}
      />
      <SourcePanel
        source={selectedSource}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
      />
    </div>
  )
}
