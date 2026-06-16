import codecs

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    content = f.read()

# We know the new startKaraoke ends with `    });\n  });\n`
# We know the leftover starts with `  };\n  video.onended = () => {\n` or something.
# We know `function startKaraokeTimer` comes right after the leftover.

marker1 = "      } else {\n        startKaraokeTimer(null, song || { duration: 120 });\n      }\n    });\n  });"
idx1 = content.find(marker1)

if idx1 != -1:
    idx_end_of_marker1 = idx1 + len(marker1)
    
    marker2 = "function startKaraokeTimer"
    idx2 = content.find(marker2, idx_end_of_marker1)
    
    if idx2 != -1:
        # We need to replace everything between idx_end_of_marker1 and idx2
        # with just `\n}\n\n`
        new_content = content[:idx_end_of_marker1] + "\n}\n\n" + content[idx2:]
        with codecs.open('public/tv.html', 'w', 'utf-8') as f:
            f.write(new_content)
        print("Leftover code finally deleted!")
    else:
        print("Could not find startKaraokeTimer")
else:
    print("Could not find marker1")
