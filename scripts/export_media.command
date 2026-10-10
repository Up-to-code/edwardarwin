#!/bin/zsh
set -e
project_dir=${0:A:h:h}
cd "$project_dir"
command -v ffmpeg >/dev/null || { print 'Install ffmpeg: brew install ffmpeg'; exit 1; }
[[ -f docs/media/emma-intro.webm && -f docs/media/emma-emotions.webm ]] || { print 'In Emma Settings → Demo recording, record the introduction and emotions first.'; exit 1; }
ffmpeg -hide_banner -loglevel error -y -i docs/media/emma-intro.webm -i studio-assets/intro/emma-intro.wav -map 0:v:0 -map 1:a:0 -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -c:a aac -b:a 128k -af apad -shortest -movflags +faststart docs/media/emma-intro.mp4
labels=(neutral happy sad blushing surprised angry sleepy)
for index in {1..7}; do
 start=$(( (index-1)*3.5+0.5 ))
 ffmpeg -hide_banner -loglevel error -y -ss "$start" -t 2.8 -i docs/media/emma-emotions.webm -filter_complex '[0:v]crop=560:720:80:80,scale=280:360:flags=lanczos,fps=12,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer' -loop 0 "docs/media/$labels[$index].gif"
done
print 'MP4 and seven GIFs exported to docs/media.'
