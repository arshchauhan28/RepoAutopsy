from app.services.github_service import parse_github_url, GitHubError


def test_parse_github_url():
    assert parse_github_url("https://github.com/openai/openai-python") == ("openai", "openai-python")
    assert parse_github_url("https://github.com/openai/openai-python.git") == ("openai", "openai-python")


def test_reject_non_github():
    try:
        parse_github_url("https://gitlab.com/a/b")
    except GitHubError:
        assert True
    else:
        assert False
