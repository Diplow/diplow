from pathlib import Path

import pytest

from wikipol.config import (
    DEFAULT_SOURCES_DIR,
    ConfigError,
    load_fetcher_settings,
    load_settings,
    load_source,
    load_sources,
)

FAKE_KEY = "fake-key-from-file"
FAKE_PASSWORD = "fake-password-from-file"
FULL_ENV = "\n".join(
    [
        "WIKIPOL_S3_BUCKET=raws",
        "WIKIPOL_S3_ENDPOINT=https://s3.example.test",
        "SCW_ACCESS_KEY=" + FAKE_KEY,
        "SCW_" + "SECRET_KEY=" + FAKE_PASSWORD,
    ]
)


@pytest.fixture
def env_file(tmp_path):
    path = tmp_path / "wikipol.env"
    path.write_text(FULL_ENV)
    return path


def test_settings_come_from_the_env_file(env_file):
    settings = load_settings({"WIKIPOL_ENV": str(env_file)})

    assert settings.s3_bucket == "raws"
    assert settings.s3_endpoint == "https://s3.example.test"
    assert settings.s3_region == "fr-par"
    assert settings.s3_access_key == FAKE_KEY
    assert settings.s3_secret_key == FAKE_PASSWORD


def test_the_process_environment_wins_over_the_file(env_file):
    settings = load_settings(
        {"WIKIPOL_ENV": str(env_file), "WIKIPOL_S3_BUCKET": "other", "WIKIPOL_S3_REGION": "nl-ams"}
    )

    assert (settings.s3_bucket, settings.s3_region) == ("other", "nl-ams")


def test_a_missing_variable_is_named_and_no_value_is_shown(tmp_path):
    env = tmp_path / "wikipol.env"
    env.write_text("SCW_ACCESS_KEY=" + FAKE_KEY)

    with pytest.raises(ConfigError, match="WIKIPOL_S3_BUCKET") as error:
        load_settings({"WIKIPOL_ENV": str(env)})
    assert FAKE_KEY not in str(error.value)


def test_credentials_stay_out_of_the_repr(env_file):
    text = repr(load_settings({"WIKIPOL_ENV": str(env_file)}))

    assert FAKE_KEY not in text
    assert FAKE_PASSWORD not in text


def test_a_source_resolves_its_frozen_vault(demo_tree):
    source = load_source(demo_tree["sources"] / "1-demo")

    assert (source.name, source.slug) == ("Demo", "demo")
    assert source.legacy_vault == demo_tree["vault"].resolve()
    assert source.legacy_inventory == demo_tree["vault"].resolve() / "Sources" / "Inventaire.md"


def test_a_source_without_a_slug_is_refused(tmp_path):
    (tmp_path / "1-x").mkdir()
    (tmp_path / "1-x" / "source.yaml").write_text("source:\n  name: X\n")

    with pytest.raises(ConfigError, match="slug"):
        load_source(tmp_path / "1-x")


@pytest.mark.parametrize(
    ("text", "complaint"),
    [
        ("source: [unclosed\n", "not valid YAML"),
        ("- a list\n", "no `source:` mapping"),
        ("source:\n  name: X\n  slug: Bad Slug\n", "is not lowercase"),
        ("source:\n  name: X\n  slug: x\nlegacy: a string\n", "must be mappings"),
        ("source:\n  name: X\n  slug: x\nyoutube: a string\n", "must be mappings"),
        ("source:\n  name: X\n  slug: x\nyoutube: []\n", "must be mappings"),
    ],
)
def test_a_malformed_source_yaml_is_a_config_error(tmp_path, text, complaint):
    (tmp_path / "1-x").mkdir()
    (tmp_path / "1-x" / "source.yaml").write_text(text)

    with pytest.raises(ConfigError, match=complaint):
        load_source(tmp_path / "1-x")


def test_a_missing_sources_folder_is_a_config_error(tmp_path):
    with pytest.raises(ConfigError, match="no Sources folder"):
        load_sources(tmp_path / "nowhere")


def test_two_sources_with_one_slug_are_refused(tmp_path):
    for node in ("1-a", "2-b"):
        (tmp_path / node).mkdir()
        (tmp_path / node / "source.yaml").write_text("source:\n  name: A\n  slug: same\n")

    with pytest.raises(ConfigError, match="share the slug same"):
        load_sources(tmp_path)


def test_a_numeric_name_is_read_as_text(tmp_path):
    (tmp_path / "1-x").mkdir()
    (tmp_path / "1-x" / "source.yaml").write_text("source:\n  name: 2024\n  slug: x\n")

    assert load_source(tmp_path / "1-x").name == "2024"


def test_the_repo_sources_load_in_node_order():
    sources = load_sources(DEFAULT_SOURCES_DIR)

    assert [s.slug for s in sources] == ["paduteam", "boniface"]
    assert sources[0].channel_url == "https://www.youtube.com/@PaduTeam/videos"
    for source in sources:
        assert source.channel_url
        assert source.legacy_vault is not None
        assert source.legacy_vault.is_dir()
        assert Path(source.legacy_vault).parent.name == "Legacy"


def test_the_fetcher_is_yt_dlp_unless_told_otherwise():
    assert load_fetcher_settings({}).kind == "yt-dlp"


def test_the_command_line_wins_over_the_environment_for_the_fetcher():
    environ = {"WIKIPOL_FETCHER": "transcript-api", "WIKIPOL_TRANSCRIPT_API_KEY": FAKE_KEY}

    assert load_fetcher_settings(environ).kind == "transcript-api"
    assert load_fetcher_settings(environ, kind="yt-dlp").kind == "yt-dlp"
    assert FAKE_KEY not in repr(load_fetcher_settings(environ))


def test_the_transcript_api_needs_its_key_from_the_env_file(tmp_path):
    env = tmp_path / "wikipol.env"

    with pytest.raises(ConfigError, match="WIKIPOL_TRANSCRIPT_API_KEY"):
        load_fetcher_settings({"WIKIPOL_ENV": str(env)}, kind="transcript-api")
    env.write_text("WIKIPOL_TRANSCRIPT_API_KEY=" + FAKE_KEY)
    settings = load_fetcher_settings({"WIKIPOL_ENV": str(env)}, kind="transcript-api")
    assert settings.transcript_api_key == FAKE_KEY


def test_an_unknown_fetcher_is_a_config_error():
    with pytest.raises(ConfigError, match="WIKIPOL_FETCHER"):
        load_fetcher_settings({"WIKIPOL_FETCHER": "curl"})
