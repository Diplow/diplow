"""A Raw cut into two-minute chunks that keep their seconds, in each of the three shapes of
decisions.md#DEC-8."""

from wikipol.digest.raw_text import clock, parse_raw
from wikipol.index.chunks import (
    BLOCK_SECONDS,
    MAX_WORDS,
    UNTIMED_OVERLAP_WORDS,
    UNTIMED_WORDS,
    chunk_raw,
)


def blocks_raw(starts: list[int]) -> str:
    """A fetched Raw: a frontmatter, then a `m:ss` line and a sentence per block."""
    blocks = [f"{clock(start)}\n\nphrase {start}." for start in starts]
    return "---\nyoutube_id: aaaaaaaaaaa\n---\n\n" + "\n\n\n".join(blocks) + "\n"


def spans(chunks):
    return [(c.start, c.end) for c in chunks]


def test_thirty_second_blocks_make_two_minute_chunks_sharing_one_block():
    chunks = chunk_raw(parse_raw(blocks_raw(list(range(0, 600, 30)))), duration=600)
    assert spans(chunks) == [
        (0, 120),
        (90, 210),
        (180, 300),
        (270, 390),
        (360, 480),
        (450, 570),
        (540, 600),
    ]
    assert [c.position for c in chunks] == list(range(7))
    assert chunks[0].text == "phrase 0. phrase 30. phrase 60. phrase 90."
    assert chunks[1].text.startswith("phrase 90.")  # the shared block


def test_the_last_block_ends_at_the_duration_or_thirty_seconds_later():
    starts = [0, 30, 60]
    assert spans(chunk_raw(parse_raw(blocks_raw(starts)), duration=75)) == [(0, 75)]
    assert spans(chunk_raw(parse_raw(blocks_raw(starts)))) == [(0, 60 + BLOCK_SECONDS)]
    # A last block opening on the video's end ends there.
    assert spans(chunk_raw(parse_raw(blocks_raw(starts)), duration=60)) == [(0, 60)]
    # A duration that doesn't reach the last block is not believed.
    assert spans(chunk_raw(parse_raw(blocks_raw(starts)), duration=50)) == [(0, 90)]


def test_uneven_blocks_are_gathered_by_their_seconds_not_counted():
    # Blocks drift as captions do: 31, 32, 33 seconds. A block as long as a chunk is shared
    # with no neighbor, so it isn't indexed twice.
    chunks = chunk_raw(parse_raw(blocks_raw([0, 31, 63, 96, 129, 400, 431])), duration=460)
    assert spans(chunks) == [(0, 129), (96, 400), (400, 460)]


def test_linked_blocks_skip_the_header_and_trust_their_t():
    raw = (
        "# UN TITRE\n\nhttps://www.youtube.com/watch?v=X0tXWZsjENQ\n\n\n"
        "**[00:00](https://www.youtube.com/watch?v=X0tXWZsjENQ&t=0)**\nbonjour à tous\n\n"
        "**[00:30](https://www.youtube.com/watch?v=X0tXWZsjENQ&t=31)**\non commence\n"
    )
    [chunk] = chunk_raw(parse_raw(raw))
    assert (chunk.start, chunk.end) == (0, 61)
    assert chunk.text == "bonjour à tous on commence"


def test_a_block_without_words_keeps_its_time_but_adds_no_text():
    raw = "0:00\n\nun\n\n0:30\n\n\n1:00\n\ndeux\n"
    [chunk] = chunk_raw(parse_raw(raw))
    assert (chunk.start, chunk.end, chunk.text) == (0, 90, "un deux")


def test_a_raw_without_timestamps_is_cut_by_words_and_carries_no_seconds():
    words = [f"mot{n}" for n in range(1000)]
    chunks = chunk_raw(parse_raw("---\ntitre: x\n---\n\n" + " ".join(words)))
    step = UNTIMED_WORDS - UNTIMED_OVERLAP_WORDS
    assert [c.text.split()[0] for c in chunks] == [words[i] for i in range(0, 1000, step)][:3]
    assert all(c.start is None and c.end is None for c in chunks)
    assert all(len(c.text.split()) <= UNTIMED_WORDS for c in chunks)
    assert chunks[-1].text.split()[-1] == "mot999"
    # Neighbors share their edge.
    assert (
        chunks[0].text.split()[-UNTIMED_OVERLAP_WORDS:]
        == chunks[1].text.split()[:UNTIMED_OVERLAP_WORDS]
    )


def test_a_raw_without_words_has_no_chunk():
    assert chunk_raw(parse_raw("---\nyoutube_id: aaaaaaaaaaa\n---\n\n")) == []
    assert chunk_raw(parse_raw("0:00\n\n\n0:30\n\n")) == []


def test_a_timed_chunk_past_the_word_cap_is_cut_by_words_keeping_its_seconds():
    long_block = " ".join(f"mot{n}" for n in range(MAX_WORDS + 1))
    raw = f"0:00\n\ncourt.\n\n0:30\n\n{long_block}\n\n10:00\n\nfin.\n"
    chunks = chunk_raw(parse_raw(raw), duration=630)
    assert [c.position for c in chunks] == list(range(len(chunks)))
    assert all(len(c.text.split()) <= max(UNTIMED_WORDS, MAX_WORDS) for c in chunks)
    assert {(c.start, c.end) for c in chunks[:-1]} == {(0, 600)}
    assert (chunks[-1].start, chunks[-1].end, chunks[-1].text) == (600, 630, "fin.")
