"""Core tkinter text editor for YapPad."""

from __future__ import annotations

from pathlib import Path
import tkinter as tk
from tkinter import filedialog, font as tkfont, messagebox
from typing import Any, Callable

APP_TITLE = "YapPad"
STARTUP_GREETING = "Oh. You again."
TEXT_FILETYPES = [("Text files", "*.txt"), ("All files", "*.*")]

KeyHook = Callable[[tk.Event], Any]
EditorHook = Callable[["YapPadEditor"], Any]


class YapPadEditor:
    """Plain tkinter text editor with hook points for YapPad's sentient modules."""

    def __init__(self, root: tk.Tk | None = None) -> None:
        self.root = root if root is not None else tk.Tk()
        self.root.title(APP_TITLE)
        self.root.geometry("800x600")
        self.root.minsize(400, 300)

        self.current_file: Path | None = None
        self._dirty: bool = False
        self._suppress_modified: bool = False

        self._key_hooks: list[KeyHook] = []
        self._save_hooks: list[EditorHook] = []
        self._close_hooks: list[EditorHook] = []

        self._build_menu()
        self._build_editor()
        self._build_status_bar()
        self._bind_events()

        self.text.edit_modified(False)
        self.text.focus_set()

    # ------------------------------------------------------------------
    # UI setup
    # ------------------------------------------------------------------
    def _build_menu(self) -> None:
        self.menu_bar = tk.Menu(self.root)
        self.file_menu = tk.Menu(self.menu_bar, tearoff=False)
        self.file_menu.add_command(
            label="New", accelerator="Ctrl+N", command=self.new_file
        )
        self.file_menu.add_command(
            label="Open...", accelerator="Ctrl+O", command=self.open_file
        )
        self.file_menu.add_command(
            label="Save", accelerator="Ctrl+S", command=self.save_file
        )
        self.file_menu.add_command(
            label="Save As...", accelerator="Ctrl+Shift+S", command=self.save_as
        )
        self.file_menu.add_separator()
        self.file_menu.add_command(label="Exit", command=self.close)

        self.menu_bar.add_cascade(label="File", menu=self.file_menu)
        self.root.config(menu=self.menu_bar)

    def _build_editor(self) -> None:
        self.main_frame = tk.Frame(self.root)
        self.main_frame.pack(fill=tk.BOTH, expand=True)

        self.editor_frame = tk.Frame(self.main_frame)
        self.editor_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        editor_font = tkfont.nametofont("TkFixedFont").copy()
        editor_font.configure(size=11)

        self.scrollbar = tk.Scrollbar(self.editor_frame, orient=tk.VERTICAL)
        self.text = tk.Text(
            self.editor_frame,
            wrap=tk.WORD,
            undo=True,
            autoseparators=True,
            maxundo=-1,
            yscrollcommand=self.scrollbar.set,
            font=editor_font,
            padx=8,
            pady=8,
        )
        self.scrollbar.config(command=self.text.yview)

        self.scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    def _build_status_bar(self) -> None:
        self.status_bar = tk.Frame(self.root, bd=1, relief=tk.SUNKEN)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)

        self.status_var = tk.StringVar(value=STARTUP_GREETING)
        self.status_label = tk.Label(
            self.status_bar,
            textvariable=self.status_var,
            anchor=tk.W,
            padx=8,
            pady=3,
        )
        self.status_label.pack(side=tk.LEFT, fill=tk.X, expand=True)

    def _bind_events(self) -> None:
        self.text.bind("<<Modified>>", self._on_modified)
        self.text.bind("<Key>", self._handle_key)

        # Explicit undo/redo/select-all bindings on Text so Linux/X11 default
        # Emacs bindings (e.g. Ctrl+Y = paste, Ctrl+A = line start) do not win.
        self.text.bind("<Control-z>", self._on_undo)
        self.text.bind("<Control-y>", self._on_redo)
        self.text.bind("<Control-Y>", self._on_redo)
        self.text.bind("<Control-Shift-Z>", self._on_redo)
        self.text.bind("<Control-a>", self._on_select_all)
        self.text.bind("<Control-A>", self._on_select_all)

        # File shortcuts bound on both Text (returning "break" to suppress X11
        # Text class bindings like Ctrl+O/Ctrl+N) and root (when focus is elsewhere).
        for widget in (self.text, self.root):
            widget.bind("<Control-n>", self._shortcut_new)
            widget.bind("<Control-N>", self._shortcut_new)
            widget.bind("<Control-o>", self._shortcut_open)
            widget.bind("<Control-O>", self._shortcut_open)
            widget.bind("<Control-s>", self._shortcut_save)
            widget.bind("<Control-Shift-S>", self._shortcut_save_as)

        self.root.protocol("WM_DELETE_WINDOW", self.close)

    # ------------------------------------------------------------------
    # Properties & helpers
    # ------------------------------------------------------------------
    @property
    def dirty(self) -> bool:
        """Whether the buffer has unsaved edits."""
        return self._dirty

    @dirty.setter
    def dirty(self, value: bool) -> None:
        self._dirty = bool(value)
        self._update_title()

    def _update_title(self) -> None:
        name = self.current_file.name if self.current_file is not None else None
        base = f"{APP_TITLE} - {name}" if name else APP_TITLE
        prefix = "*" if self._dirty else ""
        self.root.title(f"{prefix}{base}")

    def set_status(self, message: str) -> None:
        """Update the status bar message."""
        self.status_var.set(message)

    def get_text(self) -> str:
        """Return the full editor text without Tk's trailing sentinel newline."""
        return self.text.get("1.0", "end-1c")

    def set_text(self, content: str, *, mark_dirty: bool = False) -> None:
        """Replace editor content, optionally keeping the buffer clean."""
        self._suppress_modified = True
        try:
            self.text.delete("1.0", tk.END)
            if content:
                self.text.insert("1.0", content)
            self.text.edit_reset()
            self.text.edit_modified(False)
        finally:
            self._suppress_modified = False
        self.dirty = mark_dirty

    # ------------------------------------------------------------------
    # Hook registration
    # ------------------------------------------------------------------
    def on_key(self, callback: KeyHook) -> KeyHook:
        """Register a callback invoked on every <Key> event in the Text widget."""
        self._key_hooks.append(callback)
        return callback

    def on_save(self, callback: EditorHook) -> EditorHook:
        """Register a callback invoked on save; returning False defers default save."""
        self._save_hooks.append(callback)
        return callback

    def on_close(self, callback: EditorHook) -> EditorHook:
        """Register a callback invoked on close; returning False cancels exit."""
        self._close_hooks.append(callback)
        return callback

    # ------------------------------------------------------------------
    # Event handlers
    # ------------------------------------------------------------------
    def _on_modified(self, _event: tk.Event | None = None) -> None:
        if self.text.edit_modified():
            if not self._suppress_modified:
                self.dirty = True
            self.text.edit_modified(False)

    def _handle_key(self, event: tk.Event) -> str | None:
        for callback in list(self._key_hooks):
            if callback(event) == "break":
                return "break"
        return None

    def _on_undo(self, _event: tk.Event | None = None) -> str:
        self.undo()
        return "break"

    def _on_redo(self, _event: tk.Event | None = None) -> str:
        self.redo()
        return "break"

    def _on_select_all(self, _event: tk.Event | None = None) -> str:
        self.text.tag_add(tk.SEL, "1.0", "end-1c")
        self.text.mark_set(tk.INSERT, "end-1c")
        self.text.see(tk.INSERT)
        return "break"

    def _shortcut_new(self, _event: tk.Event | None = None) -> str:
        self.new_file()
        return "break"

    def _shortcut_open(self, _event: tk.Event | None = None) -> str:
        self.open_file()
        return "break"

    def _shortcut_save(self, _event: tk.Event | None = None) -> str:
        self.save_file()
        return "break"

    def _shortcut_save_as(self, _event: tk.Event | None = None) -> str:
        self.save_as()
        return "break"

    # ------------------------------------------------------------------
    # Edit & File actions
    # ------------------------------------------------------------------
    def undo(self) -> None:
        """Undo the previous edit in the Text widget."""
        try:
            self.text.edit_undo()
        except tk.TclError:
            pass

    def redo(self) -> None:
        """Redo the previously undone edit in the Text widget."""
        try:
            self.text.edit_redo()
        except tk.TclError:
            pass

    def new_file(self) -> None:
        """Reset the editor to a fresh, clean buffer."""
        self.current_file = None
        self.set_text("", mark_dirty=False)
        self.set_status("New file")

    def open_file(self, filepath: str | Path | None = None) -> bool:
        """Open a text file into the editor."""
        if filepath is None:
            selected = filedialog.askopenfilename(
                parent=self.root,
                title="Open",
                filetypes=TEXT_FILETYPES,
            )
            if not selected:
                return False
            path = Path(selected)
        else:
            path = Path(filepath)

        try:
            content = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as exc:
            messagebox.showerror(
                "Open Error",
                f"Could not open {path.name}:\n{exc}",
                parent=self.root,
            )
            return False

        self.current_file = path
        self.set_text(content, mark_dirty=False)
        self.set_status(f"Opened {path.name}")
        return True

    def save_file(self) -> bool:
        """Trigger save hooks and, unless intercepted, write the buffer to disk."""
        for callback in list(self._save_hooks):
            if callback(self) is False:
                return False
        return self.perform_save()

    def perform_save(self, filepath: str | Path | None = None) -> bool:
        """Write editor content directly to disk and clear the dirty flag."""
        target = Path(filepath) if filepath is not None else self.current_file
        if target is None:
            return self.save_as()

        try:
            target.write_text(self.get_text(), encoding="utf-8")
        except OSError as exc:
            messagebox.showerror(
                "Save Error",
                f"Could not save {target.name}:\n{exc}",
                parent=self.root,
            )
            return False

        self.current_file = target
        self.text.edit_modified(False)
        self.dirty = False
        self.set_status(f"Saved {target.name}")
        return True

    def save_as(self, filepath: str | Path | None = None) -> bool:
        """Prompt for a destination path and write the buffer to disk."""
        if filepath is None:
            initial = self.current_file.name if self.current_file is not None else None
            selected = filedialog.asksaveasfilename(
                parent=self.root,
                title="Save As",
                defaultextension=".txt",
                filetypes=TEXT_FILETYPES,
                initialfile=initial,
            )
            if not selected:
                return False
            target = Path(selected)
        else:
            target = Path(filepath)

        return self.perform_save(target)

    def close(self) -> bool:
        """Run close hooks and destroy the window unless a hook cancels exit."""
        for callback in list(self._close_hooks):
            if callback(self) is False:
                return False
        self.root.destroy()
        return True

    def run(self) -> None:
        """Start the tkinter main event loop."""
        self.root.mainloop()
