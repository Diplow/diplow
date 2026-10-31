"""Reading a Raw into timed blocks, in the three shapes the bucket holds (decisions.md#DEC-8)."""

from wikipol.digest.raw_text import Block, clock, clock_seconds, parse_raw, words

FETCHED = """---
youtube_id: aaaaaaaaaaa
---

0:00

Mbappé dans une sauce monumentale parce qu'il a critiqué Mao.


0:30

Et donc nous, on va devoir en parler parce qu'on est à la fois bon moi


1:00:31

je suis spécialiste communiste et Chris est spécialiste foot.
"""

LINKED = """# CHARLIE HEBDO EST-IL RÉACTIONNAIRE ?

https://www.youtube.com/watch?v=bbbbbbbbbbb


**[00:00](https://www.youtube.com/watch?v=bbbbbbbbbbb&t=0)**
où est charlie on va se poser cette question

**[00:30](https://www.youtube.com/watch?v=bbbbbbbbbbb&t=30)**
plus vous vivez de votre capital et vous avez du patrimoine
"""

UNTIMED = """---
titre: "BORIS VALLAUD N'A PAS DIT SON DERNIER MOT !"
youtube_id: ccccccccccc

---

La guerre au Parti socialiste commence.
Le Parti socialiste se met en ordre de marche.
"""


def test_a_fetched_raw_is_blocks_starting_at_their_second():
    raw = parse_raw(FETCHED)

    assert [block.start for block in raw.blocks] == [0, 30, 3631]
    assert raw.blocks[0].text == "Mbappé dans une sauce monumentale parce qu'il a critiqué Mao."
    assert raw.timed
    assert raw.starts == {0, 30, 3631}


def test_the_linked_blocks_of_old_raws_start_at_their_t_parameter():
    raw = parse_raw(LINKED)

    assert raw.blocks[0] == Block(
        None, "# CHARLIE HEBDO EST-IL RÉACTIONNAIRE ? https://www.youtube.com/watch?v=bbbbbbbbbbb"
    )
    assert [block.start for block in raw.blocks[1:]] == [0, 30]


def test_a_raw_without_timestamps_is_one_untimed_block():
    raw = parse_raw(UNTIMED)

    assert not raw.timed
    assert raw.blocks == (
        Block(
            None,
            "La guerre au Parti socialiste commence. "
            "Le Parti socialiste se met en ordre de marche.",
        ),
    )


def test_a_quote_is_found_in_the_block_it_starts_in():
    raw = parse_raw(FETCHED)

    assert raw.holds("parce qu'il a critiqué Mao", at=0)
    assert not raw.holds("parce qu'il a critiqué Mao", at=30)


def test_a_quote_may_run_on_into_the_next_block():
    raw = parse_raw(FETCHED)

    assert raw.holds("on est à la fois bon moi je suis spécialiste communiste", at=30)
    assert not raw.holds("on est à la fois bon moi je suis spécialiste communiste", at=3631)


def test_case_and_punctuation_aside_the_words_must_be_the_raw_s():
    raw = parse_raw(FETCHED)

    assert raw.holds("Mbappé, dans une sauce MONUMENTALE…", at=0)
    assert not raw.holds("Mbappé dans une sauce énorme", at=0)
    assert not raw.holds("dans une sauce monumentale parce qu'il a critiqué Staline", at=0)


def test_a_quote_matches_whole_words_only():
    raw = parse_raw(FETCHED)

    assert not raw.holds("bappé dans une sauce", at=0)


def test_an_untimed_raw_is_searched_whole():
    raw = parse_raw(UNTIMED)

    assert raw.holds("commence. Le Parti socialiste se met")
    assert not raw.holds("BORIS VALLAUD N'A PAS DIT")  # the frontmatter is not the Raw's text


def test_clock_labels_and_seconds():
    assert clock_seconds("12:30") == 750
    assert clock_seconds("00:30") == 30
    assert clock_seconds("1:02:30") == 3750
    assert clock_seconds("12:75") is None
    assert clock_seconds("douze") is None
    assert (clock(750), clock(3750)) == ("12:30", "1:02:30")


def test_words_drop_case_and_punctuation():
    assert words("« L'État, c'est MOI ! »") == "l état c est moi"


def test_an_empty_block_does_not_part_a_quote_running_across_it():
    raw = parse_raw(
        "0:00\n\nle début de la phrase\n\n\n0:30\n\n\n1:00\n\ncontinue ici sans coupure\n"
    )

    assert raw.holds("le début de la phrase continue ici", at=0)
