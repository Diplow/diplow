"""The Digest file: rendered from its fields, read back by YAML, and checked against its Raw."""

from datetime import date

import pytest
import yaml

from wikipol.digest.format import DigestFields, check_digest, render, split_digest
from wikipol.digest.raw_text import parse_raw

VIDEO = "aaaaaaaaaaa"
RAW = parse_raw(
    f"""---
youtube_id: {VIDEO}
---

0:00

Mbappé dans une sauce monumentale parce qu'il a critiqué Mao et ses contrats sont coupés.


0:30

Et donc nous, on va devoir en parler parce qu'on est à la fois bon moi


1:00

je suis spécialiste communiste et Chris est spécialiste foot, donc la double casquette.
"""
)
UNTIMED_RAW = parse_raw(
    "---\nyoutube_id: aaaaaaaaaaa\n---\n\nLa guerre au Parti socialiste commence vraiment.\n"
)

FIELDS = DigestFields(
    title='MBAPPÉ "CONTRE" LA CHINE : 40 % DE LA LIGA ?',
    parent="6-politics/2-sources/1-paduteam/1-chronicle",
    source="paduteam",
    youtube_id=VIDEO,
    published=date(2026, 10, 28),
    duration=90,
    ingested=date(2026, 10, 31),
    model="claude-sonnet-5-5",
)

PREVIEW = "La PaduTeam soutient que l'affaire Mbappé montre la puissance économique de la Chine."


def link(seconds: int, label: str, quote: str) -> str:
    return f"> [{label}](https://www.youtube.com/watch?v={VIDEO}&t={seconds}s) « {quote} »"


CLAIMS = "\n".join(
    [
        "## 1. La Chine sanctionne Mbappé pour avoir critiqué Mao.",
        "",
        "Elle coupe ses contrats.",
        "",
        link(0, "0:00", "parce qu'il a critiqué Mao et ses contrats sont coupés"),
        "",
        "## 2. La PaduTeam parle de foot en communistes.",
        "",
        link(30, "0:30", "à la fois bon moi je suis spécialiste communiste"),
        "",
        link(60, "1:00", "Chris est spécialiste foot, donc la double casquette"),
    ]
)


def digest(claims: str = CLAIMS, preview: str = PREVIEW, fields: DigestFields = FIELDS) -> str:
    return render(fields, preview, claims)


def test_a_rendered_digest_reads_back_with_every_field():
    frontmatter, body = split_digest(digest())

    assert frontmatter == {
        "title": FIELDS.title,
        "parent": FIELDS.parent,
        "owner": "diplo",
        "preview": PREVIEW,
        "source": "paduteam",
        "url": f"https://www.youtube.com/watch?v={VIDEO}",
        "youtube_id": VIDEO,
        "published": date(2026, 10, 28),
        "duration": 90,
        "raw": f"paduteam/{VIDEO}.md",
        "ingested": date(2026, 10, 31),
        "digest_version": 1,
        "model": "claude-sonnet-5-5",
    }
    assert body.startswith(f"# {FIELDS.title}\n\n## 1. ")


def test_unknown_date_and_duration_are_null():
    fields = DigestFields(**{**FIELDS.__dict__, "published": None, "duration": None})
    frontmatter, _ = split_digest(render(fields, PREVIEW, CLAIMS))

    assert (frontmatter["published"], frontmatter["duration"]) == (None, None)
    assert check_digest(render(fields, PREVIEW, CLAIMS), RAW, expected=fields) == []


def test_a_well_formed_digest_has_no_problem():
    assert check_digest(digest(), RAW, expected=FIELDS) == []


def test_a_long_preview_is_refused_and_folded_lines_count_once():
    long_preview = "mot " * 88  # 351 characters once the folded lines are joined

    assert check_digest(digest(preview=long_preview), RAW) == [
        "preview is 351 characters, 350 at most"
    ]
    assert check_digest(digest(preview=("mot " * 88)[:-2]), RAW) == []


def test_an_empty_preview_is_refused():
    assert "preview is empty" in check_digest(digest(preview=""), RAW)


def claims(count: int, extracts: int = 1) -> str:
    one = link(0, "0:00", "parce qu'il a critiqué Mao et ses contrats")
    return "\n\n".join(
        f"## {n}. Affirmation {n}.\n\n" + "\n\n".join([one] * extracts) for n in range(1, count + 1)
    )


def test_six_claims_at_most():
    assert check_digest(digest(claims(6)), RAW) == []
    assert check_digest(digest(claims(7)), RAW) == ["7 claims, 6 at most"]


def test_one_to_three_extracts_a_claim():
    assert check_digest(digest(claims(1, 3)), RAW) == []
    assert check_digest(digest(claims(1, 4)), RAW) == ["claim 1 has 4 Extracts, 1 to 3 wanted"]
    assert check_digest(digest("## 1. Sans citation.\n\nRien."), RAW) == [
        "claim 1 has 0 Extracts, 1 to 3 wanted"
    ]


def test_no_claim_and_a_numbering_gap_are_refused():
    assert check_digest(digest("Un résumé."), RAW) == [
        "body line 3: text before the first claim",
        "no claim: a Digest holds 1 to 6 claims, `## <n>. <claim>`",
    ]
    gap = claims(2).replace("## 2.", "## 3.")
    assert check_digest(digest(gap), RAW) == ["claims must be numbered 1, 2, 3… in order"]


def test_another_heading_under_the_title_is_refused():
    problems = check_digest(digest(CLAIMS + "\n\n## Concepts mobilisés\n"), RAW)

    assert problems == ["body line 15: only claims `## <n>. <claim>` go under the title"]


@pytest.mark.parametrize(
    ("extract", "problem"),
    [
        (
            link(0, "0:00", "parce qu'il a critiqué Staline et ses contrats"),
            "is not in the Raw's block at 0 s",
        ),
        (link(30, "0:30", "parce qu'il a critiqué Mao et ses contrats"), "block at 30 s"),
        (link(15, "0:15", "parce qu'il a critiqué Mao et ses"), "no block starting at 15 s"),
        (link(30, "0:31", "à la fois bon moi je suis"), "its label 0:31 is not 30 s"),
        (link(0, "0:00", "critiqué Mao"), "shorter than 5 words"),
        (
            "> [0:00](https://www.youtube.com/watch?v=zzzzzzzzzzz&t=0s) « parce qu'il a critiqué"
            " Mao et »",
            "links another video",
        ),
        ("> « parce qu'il a critiqué Mao et ses contrats »", "is not an Extract"),
        ("> [0:00](https://youtu.be/aaaaaaaaaaa?t=0) « parce qu'il a critiqué »", "not an Extract"),
    ],
)
def test_a_bad_extract_is_named(extract, problem):
    problems = check_digest(digest(f"## 1. Une affirmation.\n\n{extract}"), RAW)

    assert len(problems) == 1
    assert problem in problems[0]
    assert problems[0].startswith("claim 1: ")


def test_an_extract_past_the_video_s_duration_is_refused():
    fields = DigestFields(**{**FIELDS.__dict__, "duration": 60})

    problems = check_digest(digest(fields=fields), RAW)

    assert len(problems) == 1
    assert problems[0].startswith("claim 2: `> [1:00](")
    assert problems[0].endswith("` links 60 s, past the video's 60 s")


def test_extracts_of_an_untimed_raw_carry_no_link():
    untimed = "## 1. La guerre commence.\n\n> « La guerre au Parti socialiste commence »"
    timed = "## 1. La guerre commence.\n\n" + link(0, "0:00", "La guerre au Parti socialiste")

    assert check_digest(digest(untimed), UNTIMED_RAW) == []
    assert "links a timestamp, and the Raw has none" in check_digest(digest(timed), UNTIMED_RAW)[0]


def test_a_wikilink_must_name_a_digest_it_may_cite():
    target = "6-politics/2-sources/1-paduteam/1-chronicle/1-une-autre"
    cited = CLAIMS.replace("Elle coupe", f"Comme dans [[{target}|l'autre]], elle coupe")

    assert check_digest(digest(cited), RAW, linkable={target}) == []
    assert check_digest(digest(cited), RAW) == [
        f"wikilink to [[{target}]], which is not a Digest it may cite"
    ]


def test_fields_are_checked_against_what_the_pipeline_knows():
    text = digest().replace("model: claude-sonnet-5-5", "model: sonnet")

    assert check_digest(text, RAW, expected=FIELDS) == [
        "model 'sonnet' is an alias, not a pinned model id",
        "model is 'sonnet', expected 'claude-sonnet-5-5'",
    ]


def test_missing_and_unknown_fields_are_named():
    text = digest().replace("ingested: 2026-10-31\n", "").replace("owner:", "type: vidéo\nowner:")

    assert check_digest(text, RAW)[:2] == [
        "frontmatter lacks ingested",
        "frontmatter has unknown fields type",
    ]


def test_url_and_raw_must_follow_the_id():
    text = digest().replace(f"raw: paduteam/{VIDEO}.md", "raw: boniface/x.md")

    assert check_digest(text, RAW) == [f"raw must be paduteam/{VIDEO}.md"]


def test_a_digest_without_frontmatter_is_refused():
    assert check_digest("# Titre\n", RAW) == ["no readable YAML frontmatter"]


def test_the_title_survives_yaml_quoting():
    title = "L'« ÉTAT » : c'est \"MOI\" ! #1 \\ fin"
    fields = DigestFields(**{**FIELDS.__dict__, "title": title})

    assert yaml.safe_load(render(fields, PREVIEW, CLAIMS).split("---")[1])["title"] == title
    assert check_digest(render(fields, PREVIEW, CLAIMS), RAW, expected=fields) == []


def test_a_hyphenated_word_survives_the_folded_preview():
    preview = "La PaduTeam soutient peut-être " + "une ligne anti-libérale " * 6 + "fin."

    frontmatter, _ = split_digest(digest(preview=preview))

    assert frontmatter["preview"] == " ".join(preview.split())
