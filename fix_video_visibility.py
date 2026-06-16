import codecs

with codecs.open('public/tv.html', 'r', 'utf-8') as f:
    content = f.read()

# Replace the reset logic in playNextSong
old_code = """  // Clean state to avoid staleness without detaching from DOM
  video.pause();
  video.removeAttribute('src');
  video.load();"""

new_code = """  // Clean state to avoid staleness without detaching from DOM
  video.pause();
  // Ensure video is visible and not affected by any residual CSS
  video.style.display = 'block';
  video.style.opacity = '1';
  video.style.visibility = 'visible';
  video.style.filter = 'none';"""

if old_code in content:
    content = content.replace(old_code, new_code)
    with codecs.open('public/tv.html', 'w', 'utf-8') as f:
        f.write(content)
    print("Video visibility forced.")
else:
    print("Old code not found.")
