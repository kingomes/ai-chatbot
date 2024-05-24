'use client'

import { useLocalStorage } from '@/lib/hooks/use-local-storage'
import { useEffect, useState, useRef } from 'react'
import { useUIState, useAIState } from 'ai/rsc'
import { Session } from '@/lib/types'
import { usePathname, useRouter } from 'next/navigation'
import { useScrollAnchor } from '@/lib/hooks/use-scroll-anchor'
import { toast } from 'sonner'
import { Message, useAssistant as useAssistant } from 'ai/react';

export interface ChatProps extends React.ComponentProps<'div'> {
  initialMessages?: Message[]
  id?: string
  session?: Session
  missingKeys: string[]
}

const roleToColorMap: Record<Message['role'], string> = {
  system: 'red',
  user: 'black',
  function: 'blue',
  tool: 'purple',
  assistant: 'green',
  data: 'orange',
};

export function Chat({ id, className, session, missingKeys }: ChatProps) {
  const {
    status,
    messages,
    input,
    submitMessage,
    handleInputChange,
    error,
    stop,
  } = useAssistant({ api: '/api' });

  const router = useRouter()
  const path = usePathname()
  const [aiState] = useAIState()
  const [messagesUI] = useUIState()

  const [_, setNewChatId] = useLocalStorage('newChatId', id)

  useEffect(() => {
    if (session?.user) {
      if (!path.includes('chat') && messagesUI.length === 1) {
        window.history.replaceState({}, '', `/chat/${id}`)
      }
    }
  }, [id, path, session?.user, messagesUI])

  useEffect(() => {
    const messagesLength = aiState.messagesUI?.length
    if (messagesLength === 2) {
      router.refresh()
    }
  }, [aiState.messagesUI, router])

  useEffect(() => {
    setNewChatId(id)
  })

  useEffect(() => {
    missingKeys.map(key => {
      toast.error(`Missing ${key} environment variable!`)
    })
  }, [missingKeys])

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (status === 'awaiting_message') {
      inputRef.current?.focus();
    }
  }, [status]);

  const { messagesRef, scrollRef, visibilityRef, isAtBottom, scrollToBottom } =
    useScrollAnchor()

    return (
      <div className="flex flex-col w-full max-w-md h-screen mx-auto py-24">
        {error != null && (
          <div className="relative px-6 py-4 text-white bg-red-500 rounded-md">
            <span className="block sm:inline">
              Error: {(error as any).toString()}
            </span>
          </div>
        )}
  
        <div
          className="flex-1 overflow-auto mb-4 px-4"
          ref={scrollRef}
        >
          {messages.map((m: Message) => (
            <div
              key={m.id}
              className="whitespace-pre-wrap"
              style={{ color: roleToColorMap[m.role] }}
            >
              <strong>{`${m.role}: `}</strong>
              {m.role !== 'data' && m.content}
              {m.role === 'data' && (
                <>
                  {(m.data as any).description}
                  <br />
                  <pre className={'bg-gray-200'}>
                    {JSON.stringify(m.data, null, 2)}
                  </pre>
                </>
              )}
              <br />
              <br />
            </div>
          ))}
  
          {status === 'in_progress' && (
            <div className="w-full h-8 max-w-md p-2 mb-8 bg-gray-300 rounded-lg dark:bg-gray-600 animate-pulse" />
          )}
        </div>
  
        <form onSubmit={submitMessage} className="relative w-full max-w-md p-2">
          <input
            ref={inputRef}
            disabled={status !== 'awaiting_message'}
            className="fixed w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl bottom-14 ax-w-md"
            value={input}
            placeholder="What is the price of Nvidia?"
            onChange={handleInputChange}
          />
        </form>
  
        <button
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 text-white bg-red-500 rounded-lg"
          onClick={stop}
        >
          Stop
        </button>
      </div>
    );
}
