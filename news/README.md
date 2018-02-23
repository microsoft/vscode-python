# News

Our changelog is automatically generate from individual news entries.
This alleviates the burden of having to go back and try to figure out
what changed in a release. It also helps tie pull requests back to the
issue(s) it addresses.

## Entries

Each news entries is represented by a Markdown file that contains the
relevant details of what changed. The file name of the news entry is
the issue that corresponds to the change along with an option nonce in
case a single issue corresponds to multiple changes. The directory
the news entry is saved in specifies what section of the changelog the
change corresponds to.

As an example, a change corresponding to a bug reported in issue #42
would be saved in the `1 Fixes` directory and named `42.md`
(or `42-nonce_value.md` if there was a need for multiple entries
regarding issue #42) and could contain the following:

```markdown
[Answer](https://en.wikipedia.org/wiki/42_(number)#The_Hitchhiker's_Guide_to_the_Galaxy) to the Ultimate Question of
Life, the Universe, and Everything!
```

This would then be made into an entry in the changelog that was in the
`Fixes` section, contained the details as found in the file, and tied
to issue #42.

## Generating the changelog

XXX
