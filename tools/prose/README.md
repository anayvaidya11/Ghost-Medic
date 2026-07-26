# tools/prose — is the writing actually readable?

```sh
node tools/prose/readability.mjs
node tools/prose/readability.mjs --verbose   # also lists the hardest sentences
```

Exits non-zero if any page is above grade 10.

## Why

The site claims to be written for a reader who is technical enough to smell
exaggeration but is not an embedded engineer. That is a claim about the writing,
and every other claim on this project has to be checkable, so this one is too.

Flesch-Kincaid grade level is a rough instrument. It cannot tell good writing
from bad, and it rewards short sentences whether or not they say anything. What
it is genuinely good at is catching the thing that actually happens here: a
sentence that grew three clauses long while a number was being defended. Use it
as a tripwire, not a target.

## What it deliberately ignores

- **Everything inside `<pre>` and `<code>`.** Test output, model transcripts,
  code and the sensor block are verbatim artifacts. The house style says they are
  never edited to fit the prose style, so scoring them would push the numbers
  around for text nobody is allowed to touch.
- **Nav and footer.** Identical on all five pages, so including them drags every
  score toward the same number and hides the differences between pages.

## One thing worth knowing

Closing block tags become full stops before scoring. Without that, a table's
cells and a list's items run together into a single enormous sentence: the first
version of this script rated the real-vs-standing-in table as one grade-72
sentence and reported the whole page as failing. If you change the extraction,
check the sentence counts still look sane before believing the grades.
