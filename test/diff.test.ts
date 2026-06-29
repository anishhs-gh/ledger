import { describe, it, expect } from 'vitest'
import { analyzeDiff } from '../src/git/diff'

const RAW = `diff --git a/added.txt b/added.txt
new file mode 100644
index 0000000..aaaaaaa
--- /dev/null
+++ b/added.txt
@@ -0,0 +1,2 @@
+line one
+line two
diff --git a/mod.txt b/mod.txt
index 1111111..2222222 100644
--- a/mod.txt
+++ b/mod.txt
@@ -1,2 +1,2 @@
-old line
+new line
 kept line
diff --git a/del.txt b/del.txt
deleted file mode 100644
index 3333333..0000000
--- a/del.txt
+++ /dev/null
@@ -1 +0,0 @@
-gone
diff --git a/old/name.txt b/new/name.txt
similarity index 100%
rename from old/name.txt
rename to new/name.txt
diff --git a/img.png b/img.png
new file mode 100644
index 0000000..4444444
Binary files /dev/null and b/img.png differ
`

function fakeGit(raw: string) {
  return { diff: async () => raw } as any
}

describe('analyzeDiff', () => {
  it('returns an empty list for an empty diff', async () => {
    expect(await analyzeDiff(fakeGit('   '), 'a', 'b')).toEqual([])
  })

  it('parses added / modified / deleted / renamed / binary entries', async () => {
    const files = await analyzeDiff(fakeGit(RAW), 'a', 'b')
    const byPath = Object.fromEntries(files.map(f => [f.path, f]))

    expect(files).toHaveLength(5)

    expect(byPath['added.txt'].operation).toBe('added')
    expect(byPath['added.txt'].linesAdded).toBe(2)
    expect(byPath['added.txt'].linesRemoved).toBe(0)

    expect(byPath['mod.txt'].operation).toBe('modified')
    expect(byPath['mod.txt'].linesAdded).toBe(1)
    expect(byPath['mod.txt'].linesRemoved).toBe(1)

    expect(byPath['del.txt'].operation).toBe('deleted')
    expect(byPath['del.txt'].linesRemoved).toBe(1)

    const renamed = byPath['old/name.txt']
    expect(renamed.operation).toBe('renamed')
    expect(renamed.newPath).toBe('new/name.txt')

    expect(byPath['img.png'].operation).toBe('added')
    expect(byPath['img.png'].linesAdded).toBe(0)
  })
})
