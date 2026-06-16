import codecs

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    content = f.read()

# The block to delete is from `  };\n  video.onended = () => {` down to `    startKaraokeTimer(null, song || { duration: 120 });\n  }\n}`

marker_start = "  };\n  video.onended = () => {\n    if (myGeneration !== karaokeGeneration) return;\n    endSong(player);\n  };"

start_idx = content.find(marker_start)
if start_idx != -1:
    marker_end = "    // Start timer manually for demo\n    startKaraokeTimer(null, song || { duration: 120 });\n  }\n}"
    end_idx = content.find(marker_end, start_idx)
    if end_idx != -1:
        end_idx += len(marker_end)
        
        # We need to ensure we keep the closing brace for startKaraoke?
        # Wait, the block I inserted:
        #       } else {
        #         startKaraokeTimer(null, song || { duration: 120 });
        #       }
        #     });
        #   });
        # """
        # DOES NOT HAVE A CLOSING BRACE for the `startKaraoke` function itself!
        # Let's check `tv.html` around line 3330 (which corresponds to test.js 1673)
        
        new_content = content[:start_idx] + "}\n" + content[end_idx:]
        
        with codecs.open('public/tv.html', 'w', 'utf-8') as f:
            f.write(new_content)
        print("Deleted leftover code and added closing brace.")
    else:
        print("Marker end not found.")
else:
    print("Marker start not found.")
