// The chat's text on /design-system: the two voices in their states, the agent's answer coming word
// after word, its thinking live and folded, and a tile named, on the chat's samples.
import { RotateCcw } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

import { m } from '#/paraglide/messages'

import { Button } from '../../atoms/controls/button'
import { toast } from '../../atoms/Toaster'
import { GallerySection, GalleryState } from '../../gallery/frame'
import { sampleTiles, sampleWords } from '../samples'
import { Mention, type Voice } from './Mention'
import { Message } from './Message'
import { Thinking } from './Thinking'
import type { Word, Words } from './words'

const column = 'grid w-[32rem] max-w-full gap-4'

export function ChatTextGallery() {
  const tiles = sampleTiles()
  const words = sampleWords(tiles)
  return (
    <>
      <GallerySection name="Message">
        <GalleryState label={m.gallery_state_chat_your_words()}>
          <div className={column}>
            <Message voice="human" words={words.question} />
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_chat_sending()}>
          <div className={column}>
            <Message voice="human" words={words.request} state="sending" />
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_chat_failed()}>
          <div className={column}>
            <Message
              voice="human"
              words={words.request}
              state="failed"
              onRetry={() => toast(m.gallery_sample_chat_retried())}
            />
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_chat_agent_run()}>
          <div className={column}>
            <Message voice="agent" words={words.answer} />
            <Message voice="agent" words={words.answerMore} continued />
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_chat_streaming()}>
          <Streaming words={words.answer} />
        </GalleryState>
      </GallerySection>
      <GallerySection name="Thinking">
        <GalleryState label={m.gallery_state_chat_thinking_live()}>
          <div className={column}>
            <LiveThinking />
          </div>
        </GalleryState>
        <GalleryState label={m.gallery_state_chat_thinking_done()}>
          <div className={column}>
            <Thinking state="done" seconds={9} text={m.gallery_sample_chat_thinking()} />
          </div>
        </GalleryState>
      </GallerySection>
      <GallerySection name="Mention">
        <GalleryState label={m.gallery_state_chat_mention_agent()}>
          <Voiced voice="agent">
            <Mention {...tiles.engineering.tile} />
          </Voiced>
        </GalleryState>
        <GalleryState label={m.gallery_state_chat_mention_human()}>
          <Voiced voice="human">
            <Mention {...tiles.engineering.tile} voice="human" />
          </Voiced>
        </GalleryState>
        <GalleryState label={m.gallery_state_chat_mention_draft()}>
          <Voiced voice="agent">
            <Mention {...tiles.shared.tile} />
          </Voiced>
        </GalleryState>
        <GalleryState label={m.gallery_state_chat_mention_gone()}>
          <Voiced voice="human">
            <Mention {...tiles.oldSite.tile} voice="human" />
          </Voiced>
        </GalleryState>
        <GalleryState label={m.gallery_state_chat_mention_plain()}>
          <Voiced voice="agent">
            <Mention title={m.gallery_sample_chat_projects()} />
          </Voiced>
        </GalleryState>
      </GallerySection>
    </>
  )
}

/** A tile alone, set in the voice that names it. */
function Voiced({ voice, children }: { voice: Voice; children: ReactNode }) {
  return (
    <p
      className={
        voice === 'human'
          ? 'font-human text-prose font-light'
          : 'font-agent text-mono text-muted-foreground'
      }
    >
      {children}
    </p>
  )
}

/** The pieces an answer comes in: a word with the space after it, a tile whole. */
function arrivals(words: Words): Word[] {
  return words.flatMap((word): Word[] =>
    typeof word === 'string' ? word.split(/(?<=\s)/) : [word],
  )
}

/** The agent's answer coming in a piece at a time, as a Turn streams it, then done; replayed on a click. */
function Streaming({ words }: { words: Words }) {
  const pieces = arrivals(words)
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (shown >= pieces.length) return
    const timer = setTimeout(() => {
      setShown(shown + 1)
    }, 90)
    return () => {
      clearTimeout(timer)
    }
  }, [shown, pieces.length])
  const done = shown >= pieces.length
  return (
    <div className={column}>
      <Button
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => {
          setShown(0)
        }}
      >
        <RotateCcw aria-hidden />
        {m.gallery_replay_answer()}
      </Button>
      <Message voice="agent" words={pieces.slice(0, shown)} state={done ? 'done' : 'streaming'} />
    </div>
  )
}

/** The agent thinking, its seconds counting and its lines coming, over and over. */
function LiveThinking() {
  const sentences = m.gallery_sample_chat_thinking().split(/(?<=\.)\s+/)
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((before) => (before + 1) % (sentences.length + 3))
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [sentences.length])
  return (
    <Thinking
      state="live"
      seconds={seconds}
      text={sentences.slice(0, Math.min(seconds + 1, sentences.length)).join(' ')}
    />
  )
}
