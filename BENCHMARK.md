# Transcription benchmark

Six clips, one request per clip per model, same prompt, temperature 0.

`agree` is cross-model agreement: token-level edit distance between this
model's transcript and every other model's transcript of the same audio.
There is no ground truth for these clips, so corroboration stands in for it.
`loop` is the fraction of output sitting inside a repeated 4-gram.

## Verdict

| model | agree | cover | loop | clips completed | score |
|---|---|---|---|---|---|
| `gemini-3.6-flash` | 0.81 | 0.97 | 0.05 | 6/6 | 0.863 |
| `gemini-3.5-flash` | 0.77 | 0.99 | 0.14 | 5/6 | 0.833 |
| `gemini-3.7-flash` | 0.75 | 1.00 | 0.14 | 4/6 | 0.826 |
| `gemini-3.8-flash` | 0.00 | 0.00 | 0.00 | 0/6 | 0.000 |

## Per clip

### test-2.mp4

**gemini-3.5-flash** — 36 words, 15.0s covered, loop 72%, 15s

> I can make it rain on your body like rain on your body like rain I don't know what to do tied up on your body like rain make it rain on your body like rain

**gemini-3.6-flash** — 32 words, 14.5s covered, loop 31%, 68s

> I can make it rain on ya, somebody like on this fast taking rain on ya. I don't know what you do, tied up to the rain on ya, somebody like making...

**gemini-3.7-flash** — 47 words, 15.5s covered, loop 57%, 17s

> I can make it happen suit me hangin' on it You'd be like wait Turn his face hangin' on it I don't know what you do Tie you down to the chair hangin' on it You'd be like wait make it happen suit me hangin' on it

**gemini-3.8-flash** — FAILED: HTTP 503


### test-3.mp4

**gemini-3.5-flash** — FAILED: unparseable JSON

**gemini-3.6-flash** — 68 words, 14.1s covered, loop 0%, 26s

> Life is this. I like this. Right now on the come up, lately been talking my shit because I know I come from the gutters and shout-out to brother. Then I go pop out in all of this linen like I was a baller. How can you hate me? I'm coming from under. Nowhere to sleep, what the fuck is a cover? Now I pop out in Balencias

**gemini-3.7-flash** — 74 words, 14.8s covered, loop 0%, 12s

> Life is this. I like this. Right now I'm on the come up. Lately been talking my shit because I know I come from the gutters and shout out to your brother, then I go pop out in all of this linen like I was a baller. How can you hate me? I'm coming from under. Nowhere to sleep, what the fuck is a cover? Now I pop out in Balenci, they run us

**gemini-3.8-flash** — FAILED: HTTP 503


### test-4.mp4

**gemini-3.5-flash** — 33 words, 19.8s covered, loop 0%, 16s

> And the Italian Grand Prix is underway Che confusione sarà perché ti amo è un'emozione che cresce piano piano stringimi forte e stammi più vicino se ci sto Oh mio dio predestinato Il predestinato

**gemini-3.6-flash** — 32 words, 19.1s covered, loop 0%, 21s

> And the Italian Grand Prix is underway! Che confusione sarà perché ti amo È un'emozione che cresce piano piano Stringimi forte e stammi più vicino se ci sto È arrivato il predestinato! Il predestinato!

**gemini-3.7-flash** — 34 words, 19.4s covered, loop 0%, 12s

> And the Italian Grand Prix is underway. che confusione Sarà perché ti amo È un'emozione che cresce piano piano Stringimi forte e stammi più vicino se ci sto Va a vincere il predestinato! Il predestinato

**gemini-3.8-flash** — FAILED: HTTP 503


### test-5.mp4

**gemini-3.5-flash** — 18 words, 19.0s covered, loop 0%, 14s

> Take me to the moon where we both fell in love My mind's awake I feel so alive

**gemini-3.6-flash** — 18 words, 19.2s covered, loop 0%, 15s

> Take me to the moon where we both fell in love. My mind's awake, I feel so alive.

**gemini-3.7-flash** — FAILED: HTTP 503

**gemini-3.8-flash** — FAILED: HTTP 503


### test-6.mp4

**gemini-3.5-flash** — 18 words, 14.5s covered, loop 0%, 12s

> Kissing on your lips, perfect Never seen another girl this perfect Sticking out your tongue for the picture

**gemini-3.6-flash** — 19 words, 14.3s covered, loop 0%, 13s

> Piercing on your lip, it's perfect. Never seen another girl this perfect. Sticking out your tongue for the picture,

**gemini-3.7-flash** — 19 words, 14.7s covered, loop 0%, 7s

> piercing on your lip, it's perfect. Ever seen another girl this perfect? Sticking out your tongue for the picture

**gemini-3.8-flash** — FAILED: HTTP 429


### test-7.mp4

**gemini-3.5-flash** — 24 words, 6.3s covered, loop 0%, 15s

> Helen Peach is my son's, who's the daddy? I graduate with honors. I, bold, Nate O'Connor. I did a freestyle then I got a

**gemini-3.6-flash** — 25 words, 6.2s covered, loop 0%, 25s

> Alan Pringle is my son's son, who's the daddy? I graduated with honors. I ball, NATO, Connor. I did a freestyle, then I got a

**gemini-3.7-flash** — FAILED: HTTP 503

**gemini-3.8-flash** — FAILED: HTTP 429

