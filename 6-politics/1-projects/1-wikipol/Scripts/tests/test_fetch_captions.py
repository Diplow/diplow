from pathlib import Path

from wikipol.fetch.captions import blocks, build_raw, parse_json3, parse_vtt, timestamp

FIXTURES = Path(__file__).parent / "fixtures" / "fetch"


def test_json3_gives_one_segment_per_caption_event():
    segments = parse_json3((FIXTURES / "captions.fr.json3").read_text(encoding="utf-8"))

    assert segments == [
        (160, "Bonjour à tous"),
        (2480, "aujourd'hui on parle du budget"),
        (31200, "le gouvernement recule"),
        (45020, "encore une fois"),
        (3725010, "à demain"),
    ]


def test_vtt_drops_the_word_timings_and_the_blank_cues():
    segments = parse_vtt((FIXTURES / "captions.fr.vtt").read_text(encoding="utf-8"))

    assert segments == [
        (160, "Bonjour à tous"),
        (2480, "aujourd'hui on parle du budget"),
        (31200, "le gouvernement recule"),
    ]


def test_vtt_cues_may_leave_out_the_hours():
    text = (
        "WEBVTT\n\n00:31.200 --> 00:35.300\nle gouvernement\n\n1:02:05.010 --> 1:02:09.000\nfin\n"
    )

    assert parse_vtt(text) == [(31200, "le gouvernement"), (3725010, "fin")]


def test_a_block_runs_until_a_caption_starts_30_seconds_after_it():
    segments = [(160, "a"), (2480, "b"), (30159, "c"), (30160, "d"), (45020, "e")]

    assert blocks(segments) == [(160, "a b c"), (30160, "d e")]


def test_timestamps_are_m_ss_and_h_mm_ss_past_an_hour():
    assert timestamp(160) == "0:00"
    assert timestamp(31200) == "0:31"
    assert timestamp(754_000) == "12:34"
    assert timestamp(3_725_010) == "1:02:05"


def test_a_raw_reads_like_those_copied_from_drive():
    raw = build_raw("ubfvCuQziRA", [(160, "Bonjour."), (31200, "Le budget."), (3725010, "Fin.")])

    assert raw == (
        "---\nyoutube_id: ubfvCuQziRA\n---\n"
        "\n0:00\n\nBonjour.\n"
        "\n\n0:31\n\nLe budget.\n"
        "\n\n1:02:05\n\nFin.\n"
    )
