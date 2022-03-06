# News

Our changelog is automatically generated from individual news entry files.
This alleviates the burden of having to go back and try to figure out
what changed in a release. It also helps tie pull requests back to the
issue(s) it addresses. Finally, it avoids merge conflicts between pull requests
which would occur if multiple pull requests tried to edit the changelog.

If a change does not warrant a news entry, the `skip news` label can be added
to a pull request to signal this fact.

## Entries

Each news entry is represented by a Markdown file that contains the
relevant details of what changed. The file name of the news entry is
the issue that corresponds to the change along with an optional nonce in
case a single issue corresponds to multiple changes. The directory
the news entry is saved in specifies what section of the changelog the
change corresponds to. External contributors should also make sure to
thank themselves for taking the time and effort to contribute.

As an example, a change corresponding to a bug reported in issue #42
would be saved in the `1 Fixes` directory and named `42.md`
(or `42-nonce_value.md` if there was a need for multiple entries
regarding issue #42) and could contain the following:

```markdown
[Answer](<https://en.wikipedia.org/wiki/42_(number)>)
to the Ultimate Question of Life, the Universe, and Everything!
(thanks [Don Jaymanne](https://github.com/donjayamanne/))
```

This would then be made into an entry in the changelog that was in the
`Fixes` section, contained the details as found in the file, and tied
to issue #42.

## Generating the changelog

The `announce` script can do 3 possible things:

1. Validate that the changelog _could_ be successfully generated
2. Generate the changelog entries
3. Generate the changelog entries **and** `git-rm` the news entry files

The first option is used in CI to make sure any added news entries
will not cause trouble at release time. The second option is for
filling in the changelog for interim releases, e.g. a beta release.
The third option is for final releases that get published to the
[VS Code marketplace](https://marketplace.visualstudio.com/VSCode).

For options 2 & 3, the changelog is sent to stdout so it can be temporarily
saved to a file:

```sh
python3 news > entry.txt
```

It can also be redirected to an editor buffer, e.g.:

```sh
python3 news | code-insiders -
```
