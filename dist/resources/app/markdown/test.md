# Getting Started
## Tutorials
Watch the video here -

https://www.typescriptlang.org/

https://facebook.github.io/react/tutorial/tutorial.html

https://egghead.io/lessons/javascript-mobx-and-react-intro-syncing-the-ui-with-the-app-state-using-observable-and-observer

# Folder Structure
<pre>
src
|
package.json --> The top level package file is for installing dev/test node module dependencies.
   |
   node_modules --> This folder contains all the installed node modules for dev dependencies.
     |
   dist -> This folder contains all assets needed to run the app.
     |
     resources
       |
       app -> The folder where html/js/css etc need to be placed.
        |
        package.json --> This package file lists all distributable dependencies.
</pre>

# Adding Node Modules
OneBranch does not support NPM at the moment.
To add new node module dependencies:

1. Before you add a new package, clear it with LCA using http://aka.ms/osstool. Usually this process is instant and automated.
* Decide whether this is a dev dependency or a dist dependency. A dev dependency is a package required for building/testing like gulp, electron-winstaller, etc. A dist dependency is on packages you intend to ship with orb like react, mobx etc.
* For a dev dependency,
   i. In the src folder, run npm install --save-dev <packageName>
* For a dist dependency, in the app folder, run run npm install --save <packageName>
* cd node_modules_Dev_nuget or cd node_modules_Dist_nuget
* Update the PackageVersion in nuproj
* Run build under node_modules_Dev_nuget or cd node_modules_Dist_nuget
* This creates a manual nuget package that should be pushed to the OneBranch nuget store using the following steps:
   i. Copy the nuget package to \\wanuget\DevStaging. This automatically pushes the package to the nuget store.
* Run 'corext' to modify the corext config file to reference the new version of the package

DO NOT Skip steps the last few steps since these are required for official builds to succeed!!!

# Install typings.
Typeings are required to transpile tsx/ts files to plain js.

In the app folder, run
```
  typings install dt~package --save --global
```

or

```
  typings install package --save
```

You can also check in any typing file directly obtained from npm, github, etc.
If you cannot find typings, you can create your own modules in typings\custom.d.ts.
Alternatively, you can skip the need for typings by using "require" directly in your typescript files.
Example:

```
  const Markdown = require('react-remarkable');
```

# Debugging
Launch orb by typing "orb".
To bring up the chrome dev tools, use Ctrl+Shift+D.
You can hit F5 in the debug tools to refresh without restarting after code changes.
You can "disable cache (while DevTools is open)" and hitting F5 in the debugger reloads the app without restarting.

# Building
To enable compile on save, in VSCode, run Ctrl+Shift+B once. The watcher task will auto compile on any *ts* file modifications.
For a local build, type "b"
To enable official builds (creates installer, etc), type "official" followed by "b". To reset, type "noOfficial"

# Logging
loglevel replaces console.log() and friends with level-based logging and filtering, with none of console's downsides.

Usage:
```javascript
  let log = require('loglevel');
  log.info("unreasonably simple");
```

5 actual logging methods, ordered and available as:
```javascript
  log.trace(msg);
  log.debug(msg);
  log.info(msg);
  log.warn(msg);
  log.error(msg);
```

Documentation - https://github.com/pimterry/loglevel

An h1 header
============

Paragraphs are separated by a blank line.

2nd paragraph. *Italic*, **bold**, and `monospace`. Itemized lists
look like:

  * this one
  * that one
  * the other one

Note that --- not considering the asterisk --- the actual text
content starts at 4-columns in.

> Block quotes are
> written like so.
>
> They can span multiple paragraphs,
> if you like.

Use 3 dashes for an em-dash. Use 2 dashes for ranges (ex., "it's all
in chapters 12--14"). Three dots ... will be converted to an ellipsis.
Unicode is supported. ☺



An h2 header
------------

Here's a numbered list:

 1. first item
 2. second item
 3. third item

Note again how the actual text starts at 4 columns in (4 characters
from the left side). Here's a code sample:

    # Let me re-iterate ...
    for i in 1 .. 10 { do-something(i) }

As you probably guessed, indented 4 spaces. By the way, instead of
indenting the block, you can use delimited blocks, if you like:

~~~
define foobar() {
    print "Welcome to flavor country!";
}
~~~

(which makes copying & pasting easier). You can optionally mark the
delimited block for Pandoc to syntax highlight it:

```python
import time
# Quick, count to ten!
for i in range(10):
    # (but not *too* quick)
    time.sleep(0.5)
    print i
```



### An h3 header ###

Now a nested list:

 1. First, get these ingredients:

      * carrots
      * celery
      * lentils

 2. Boil some water.

 3. Dump everything in the pot and follow
    this algorithm:

        find wooden spoon
        uncover pot
        stir
        cover pot
        balance wooden spoon precariously on pot handle
        wait 10 minutes
        goto first step (or shut off burner when done)

    Do not bump wooden spoon or it will fall.

Notice again how text always lines up on 4-space indents (including
that last line which continues item 3 above).

Here's a link to [a website](http://foo.bar), to a [local
doc](main2.md), [local
doc2](../main3.md), [local
doc3](docs/main3.md), [local
doc4](docs\main4.md) and to a [section heading in the current
doc](#an-h2-header). Here's a footnote [^1].

[^1]: Footnote text goes here.

Tables can look like this:

First Header | Second Header
------------ | -------------
Content from cell 1 | Content from cell 2
Content in the first column | Content in the second column

Table: Shoes, their sizes, and what they're made of

(The above is the caption for the table.) Pandoc also supports
multi-line tables:

--------  -----------------------
keyword   text
--------  -----------------------
red       Sunsets, apples, and
          other red or reddish
          things.

green     Leaves, grass, frogs
          and other things it's
          not easy being.
--------  -----------------------

A horizontal rule follows.

***

Here's a definition list:

apples
  : Good for making applesauce.
oranges
  : Citrus!
tomatoes
  : There's no "e" in tomatoe.

Again, text is indented 4 spaces. (Put a blank line between each
term/definition pair to spread things out more.)

Here's a "line block":

| Line one
|   Line too
| Line tree

and images can be specified like so:

Inline math equations go in like so: $\omega = d\phi / dt$. Display
math should get its own line and be put in in double-dollarsigns:

$$I = \int \rho R^{2} dV$$

And note that you can backslash-escape any punctuation characters
which you wish to be displayed literally, ex.: \`foo\`, \*bar\*, etc.