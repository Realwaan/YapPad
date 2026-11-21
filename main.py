"""Entry point for YapPad — the Sentient Notepad."""

from dotenv import load_dotenv

from editor import YapPadEditor


def create_app() -> YapPadEditor:
    """Load environment configuration and build the YapPad editor window."""
    load_dotenv()
    return YapPadEditor()


def main() -> None:
    """Launch YapPad."""
    app = create_app()
    app.run()


if __name__ == "__main__":
    main()
